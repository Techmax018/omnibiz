from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime, timedelta  # <-- Imported timedelta for safe math lookbacks
from app.deps import get_current_tenant, get_current_user, get_db, RoleChecker
from app.models import TransactionLedger, SaleInvoice, Product
from app.services.notifications import push_notification

router = APIRouter()

# ── VAT rates by KRA category ────────────────────────────────
VAT_RATES = {
    'A-Exempt': 0.0,
    'B-16%': 0.16,
    'C-Zero': 0.0,
    'D-Non-VAT': 0.0,
    'E-8%': 0.08,
}


class PaymentCreate(BaseModel):
    invoice_id: int
    cash_amount: float = 0.0
    mobile_money_amount: float = 0.0
    card_amount: float = 0.0
    bank_transfer_amount: float = 0.0
    notes: Optional[str] = None


def compute_vat(amount: float, category: str) -> dict:
    rate = VAT_RATES.get(category, 0.16)
    vat = amount * rate / (1 + rate)
    return {
        'gross': round(amount, 2),
        'vat': round(vat, 2),
        'net': round(amount - vat, 2),
        'rate': category,
        'rate_pct': rate * 100,
    }


@router.get('/api/finance/ledger')
def get_ledger(limit: int = 50, current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    entries = db.query(TransactionLedger).filter(
        TransactionLedger.tenant_id == current_tenant.id,
    ).order_by(TransactionLedger.timestamp.desc()).limit(limit).all()

    return [
        {
            'id': e.id,
            'timestamp': e.timestamp.isoformat(),
            'action_type': e.action_type,
            'entity': e.entity,
            'amount': float(e.amount),
            'currency': e.currency,
            'notes': e.notes,
            'is_correction': e.is_correction,
            'reference_id': e.reference_id,
        }
        for e in entries
    ]


@router.get('/api/finance/balance-sheet')
def balance_sheet(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    entries = db.query(TransactionLedger).filter(TransactionLedger.tenant_id == current_tenant.id).all()

    total_revenue = sum(float(e.amount) for e in entries if e.action_type == 'sale' and not e.is_correction)
    total_corrections = sum(float(e.amount) for e in entries if e.action_type == 'sale' and e.is_correction)
    total_transfers = sum(float(e.amount) for e in entries if e.action_type == 'stock_transfer')

    invoices = db.query(SaleInvoice).filter(SaleInvoice.tenant_id == current_tenant.id).all()
    total_outstanding = sum(float(i.outstanding_amount) for i in invoices)
    total_paid = sum(float(i.paid_amount) for i in invoices)

    products = db.query(Product).filter(Product.tenant_id == current_tenant.id, Product.active == True).all()
    inventory_value = sum(float(p.cost_price) for p in products)

    return {
        'assets': {
            'cash_and_receivables': round(total_paid, 2),
            'accounts_receivable': round(total_outstanding, 2),
            'inventory_value': round(inventory_value, 2),
            'total_assets': round(total_paid + total_outstanding + inventory_value, 2),
        },
        'revenue': {
            'gross_revenue': round(total_revenue, 2),
            'corrections': round(total_corrections, 2),
            'net_revenue': round(total_revenue - total_corrections, 2),
        },
        'profit_loss': {
            'gross_profit': round(total_revenue - total_corrections - inventory_value * 0.3, 2),
            'note': 'Simplified P&L — full double-entry requires chart of accounts setup',
        },
    }


@router.get('/api/finance/tax-report')
def tax_report(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    invoices = db.query(SaleInvoice).filter(SaleInvoice.tenant_id == current_tenant.id).all()
    total_gross = sum(float(i.total_amount) for i in invoices)

    from app.models import SaleLineItem
    line_items = db.query(SaleLineItem).filter(SaleLineItem.tenant_id == current_tenant.id).all()

    by_category: dict = {}
    for item in line_items:
        cat = item.vat_rate or 'B-16%'
        if cat not in by_category:
            by_category[cat] = {'gross': 0.0, 'vat': 0.0, 'net': 0.0}
        calc = compute_vat(float(item.total_amount), cat)
        by_category[cat]['gross'] += calc['gross']
        by_category[cat]['vat'] += calc['vat']
        by_category[cat]['net'] += calc['net']

    total_vat = sum(v['vat'] for v in by_category.values())
    return {
        'total_gross_sales': round(total_gross, 2),
        'total_vat_collected': round(total_vat, 2),
        'breakdown_by_category': [
            {'category': k, **{kk: round(vv, 2) for kk, vv in v.items()}}
            for k, v in by_category.items()
        ],
    }


@router.post('/api/finance/payments')
def record_payment(
    payload: PaymentCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    role=Depends(RoleChecker(['Owner', 'Manager'])),
    db: Session = Depends(get_db),
):
    invoice = db.query(SaleInvoice).filter(
        SaleInvoice.id == payload.invoice_id,
        SaleInvoice.tenant_id == current_tenant.id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail='Invoice not found')

    if invoice.status == 'paid':
        raise HTTPException(status_code=400, detail='Invoice is already fully paid')

    total_payment = (
        payload.cash_amount
        + payload.mobile_money_amount
        + payload.card_amount
        + payload.bank_transfer_amount
    )
    if total_payment <= 0:
        raise HTTPException(status_code=400, detail='Payment amount must be greater than zero')

    outstanding = float(invoice.outstanding_amount)
    if total_payment > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f'Payment KES {total_payment:,.2f} exceeds outstanding balance KES {outstanding:,.2f}',
        )

    try:
        new_outstanding = outstanding - total_payment
        invoice.paid_amount = float(invoice.paid_amount) + total_payment
        invoice.outstanding_amount = max(0.0, new_outstanding)
        invoice.status = 'paid' if invoice.outstanding_amount <= 0 else 'partial'

        breakdown = []
        for method, amount in [
            ('cash', payload.cash_amount),
            ('mobile_money', payload.mobile_money_amount),
            ('card', payload.card_amount),
            ('bank_transfer', payload.bank_transfer_amount),
        ]:
            if amount > 0:
                breakdown.append(f'{method}: KES {amount:,.2f}')
                ledger = TransactionLedger(
                    tenant_id=current_tenant.id,
                    user_id=current_user.id,
                    action_type=f'payment_{method}',
                    entity='sale_invoice',
                    entity_id=str(invoice.id),
                    amount=amount,
                    notes=payload.notes or f'{method} payment for {invoice.invoice_number}',
                    reference_id=invoice.invoice_number,
                )
                db.add(ledger)

        db.commit()
        push_notification(
            db, current_tenant.id, 'payment',
            f'Payment recorded: {invoice.invoice_number}',
            f'KES {total_payment:,.2f} via {", ".join(breakdown)}. Status: {invoice.status}.',
            user_id=current_user.id,
            branch_id=invoice.branch_id,
        )
        db.commit()
        return {
            'status': 'ok',
            'invoice_status': invoice.status,
            'outstanding_amount': float(invoice.outstanding_amount),
            'payment_breakdown': breakdown,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to record payment. Please try again.',
        ) from exc


@router.get('/api/finance/analytics')
def analytics_summary(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    from sqlalchemy import func
    from app.models import InventoryItem

    entries = db.query(TransactionLedger).filter(TransactionLedger.tenant_id == current_tenant.id).all()
    invoices = db.query(SaleInvoice).filter(SaleInvoice.tenant_id == current_tenant.id).all()
    inventory = db.query(InventoryItem).filter(InventoryItem.tenant_id == current_tenant.id).all()

    daily_revenue: dict = {}
    for e in entries:
        if e.action_type == 'sale' and not e.is_correction:
            day = e.timestamp.strftime('%Y-%m-%d')
            daily_revenue[day] = daily_revenue.get(day, 0) + float(e.amount)

    low_stock_count = sum(1 for i in inventory if i.reorder_level > 0 and i.quantity_on_hand <= i.reorder_level)
    products = db.query(Product).filter(Product.tenant_id == current_tenant.id, Product.active == True).all()

    # Safe dynamic rolling calculation for the past 30 days
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    revenue_30d_total = sum(v for d, v in daily_revenue.items() if d >= thirty_days_ago)

    return {
        'daily_revenue': [{'date': d, 'amount': round(a, 2)} for d, a in sorted(daily_revenue.items())[-30:]],
        'total_invoices': len(invoices),
        'paid_invoices': sum(1 for i in invoices if i.status == 'paid'),
        'outstanding_invoices': sum(1 for i in invoices if i.status != 'paid'),
        'low_stock_products': low_stock_count,
        'total_products': len(products),
        'revenue_30d': round(revenue_30d_total, 2),
    }