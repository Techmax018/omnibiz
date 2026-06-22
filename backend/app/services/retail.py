from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    CustomerAccount,
    CustomerLedgerEntry,
    InventoryItem,
    Product,
    SaleInvoice,
    SaleLineItem,
    TransactionLedger,
)
from app.services.etims import build_etims_payload, sign_etims_payload


def apply_branch_scope(model, business_id: int, branch_id: int):
    return model.tenant_id == business_id, model.branch_id == branch_id


def create_sale_invoice(db: Session, business_id: int, branch_id: int, user_id: int, customer_id: int, items: list[dict], payment_amount: Decimal, ip_address: str):
    total_amount = sum(Decimal(item['quantity']) * Decimal(item['unit_price']) for item in items)
    outstanding_amount = total_amount - payment_amount

    invoice = SaleInvoice(
        tenant_id=business_id,
        branch_id=branch_id,
        customer_id=customer_id,
        user_id=user_id,
        invoice_number=f"INV-{business_id}-{branch_id}-{int(Decimal(total_amount) * 100)}",
        total_amount=total_amount,
        paid_amount=payment_amount,
        outstanding_amount=outstanding_amount,
        status='paid' if outstanding_amount <= 0 else 'credit',
        etims_status='pending',
    )
    db.add(invoice)
    db.flush()

    for item in items:
        product = db.query(Product).filter(
            Product.id == item['product_id'],
            Product.tenant_id == business_id,
            Product.branch_id == branch_id,
        ).first()
        line_item = SaleLineItem(
            tenant_id=business_id,
            branch_id=branch_id,
            invoice_id=invoice.id,
            product_id=product.id if product else None,
            description=item.get('description', product.name if product else 'Item'),
            quantity=Decimal(item['quantity']),
            unit_price=Decimal(item['unit_price']),
            vat_rate=product.vat_category if product else item.get('vat_rate', 'B-16%'),
            item_code=product.item_code if product else item.get('item_code'),
            hs_code=product.hs_code if product else item.get('hs_code'),
            total_amount=Decimal(item['quantity']) * Decimal(item['unit_price']),
        )
        db.add(line_item)

        inventory = db.query(InventoryItem).filter(
            InventoryItem.product_id == product.id,
            InventoryItem.tenant_id == business_id,
            InventoryItem.branch_id == branch_id,
        ).first()
        if inventory:
            inventory.quantity_on_hand = max(Decimal('0.0'), inventory.quantity_on_hand - Decimal(item['quantity']))

    customer = db.query(CustomerAccount).filter(
        CustomerAccount.id == customer_id,
        CustomerAccount.tenant_id == business_id,
        CustomerAccount.branch_id == branch_id,
    ).first()

    if customer:
        new_balance = customer.balance + outstanding_amount
        if new_balance > customer.credit_limit:
            raise ValueError('Customer credit limit exceeded')
        customer.balance = new_balance
        ledger_entry = CustomerLedgerEntry(
            tenant_id=business_id,
            branch_id=branch_id,
            customer_id=customer.id,
            amount=outstanding_amount,
            entry_type='debit',
            balance_after=new_balance,
            reference_id=invoice.invoice_number,
            notes='Credit sale recorded',
            is_correction=False,
        )
        db.add(ledger_entry)

    sales_payload = {
        'invoice_number': invoice.invoice_number,
        'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
        'customer_name': customer.name if customer else 'Walk-in Customer',
        'customer_phone': customer.phone if customer else None,
        'line_items': [
            {
                'description': line_item.description,
                'quantity': str(line_item.quantity),
                'unit_price': str(line_item.unit_price),
                'vat_rate': line_item.vat_rate,
                'item_code': line_item.item_code,
                'hs_code': line_item.hs_code,
                'total_amount': str(line_item.total_amount),
            }
            for line_item in invoice.line_items
        ],
        'total_amount': str(invoice.total_amount),
        'paid_amount': str(invoice.paid_amount),
        'outstanding_amount': str(invoice.outstanding_amount),
    }

    signed_payload = sign_etims_payload(build_etims_payload(sales_payload))
    invoice.etims_payload = build_etims_payload(sales_payload)
    invoice.signed_etims = signed_payload
    invoice.etims_status = 'signed'

    transaction = TransactionLedger(
        tenant_id=business_id,
        user_id=user_id,
        action_type='sale',
        entity='sale_invoice',
        entity_id=str(invoice.id),
        amount=invoice.total_amount,
        ip_address=ip_address,
        notes=f'Invoice {invoice.invoice_number} created',
        reference_id=invoice.invoice_number,
    )
    db.add(transaction)
    db.commit()
    db.refresh(invoice)
    return invoice
