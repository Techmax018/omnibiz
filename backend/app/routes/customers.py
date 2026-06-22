from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.deps import get_current_tenant, get_current_user, get_db, RoleChecker, get_current_token_data, branch_scope_check
from app.models import CustomerAccount, CustomerLedgerEntry, SaleInvoice

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: float = 0.0
    branch_id: int


class StoreCreditAdjust(BaseModel):
    customer_id: int
    amount: float
    entry_type: str  # 'credit' or 'debit'
    notes: Optional[str] = None


def serialize_customer(c: CustomerAccount) -> dict:
    return {
        'id': c.id,
        'name': c.name,
        'phone': c.phone,
        'email': c.email,
        'credit_limit': float(c.credit_limit),
        'balance': float(c.balance),
        'active': c.active,
        'branch_id': c.branch_id,
        'created_at': c.created_at.isoformat(),
    }


@router.get('/api/customers')
def list_customers(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    customers = db.query(CustomerAccount).filter(CustomerAccount.tenant_id == current_tenant.id).all()
    return [serialize_customer(c) for c in customers]


@router.post('/api/customers', status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    role=Depends(RoleChecker(['Owner', 'Manager'])),
    db: Session = Depends(get_db),
):
    branch_scope_check(token_data, payload.branch_id)
    customer = CustomerAccount(
        tenant_id=current_tenant.id,
        branch_id=payload.branch_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        credit_limit=payload.credit_limit,
        balance=0.0,
        active='active',
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return serialize_customer(customer)


@router.get('/api/customers/{customer_id}/history')
def customer_history(customer_id: int, current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    customer = db.query(CustomerAccount).filter(
        CustomerAccount.id == customer_id,
        CustomerAccount.tenant_id == current_tenant.id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail='Customer not found')

    invoices = db.query(SaleInvoice).filter(
        SaleInvoice.customer_id == customer_id,
        SaleInvoice.tenant_id == current_tenant.id,
    ).order_by(SaleInvoice.created_at.desc()).limit(20).all()

    ledger = db.query(CustomerLedgerEntry).filter(
        CustomerLedgerEntry.customer_id == customer_id,
        CustomerLedgerEntry.tenant_id == current_tenant.id,
    ).order_by(CustomerLedgerEntry.created_at.desc()).limit(20).all()

    return {
        'customer': serialize_customer(customer),
        'invoices': [
            {
                'invoice_number': i.invoice_number,
                'total_amount': float(i.total_amount),
                'outstanding_amount': float(i.outstanding_amount),
                'status': i.status,
                'created_at': i.created_at.isoformat(),
            }
            for i in invoices
        ],
        'ledger': [
            {
                'amount': float(e.amount),
                'entry_type': e.entry_type,
                'balance_after': float(e.balance_after),
                'notes': e.notes,
                'created_at': e.created_at.isoformat(),
            }
            for e in ledger
        ],
    }


@router.post('/api/customers/credit-adjust')
def adjust_store_credit(payload: StoreCreditAdjust, current_user=Depends(get_current_user), current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    customer = db.query(CustomerAccount).filter(
        CustomerAccount.id == payload.customer_id,
        CustomerAccount.tenant_id == current_tenant.id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail='Customer not found')

    if payload.entry_type == 'credit':
        new_balance = float(customer.balance) - payload.amount
    else:
        new_balance = float(customer.balance) + payload.amount

    customer.balance = new_balance
    entry = CustomerLedgerEntry(
        tenant_id=current_tenant.id,
        branch_id=customer.branch_id,
        customer_id=customer.id,
        amount=payload.amount,
        entry_type=payload.entry_type,
        balance_after=new_balance,
        notes=payload.notes or 'Manual adjustment',
        is_correction=True,
    )
    db.add(entry)
    db.commit()
    return {'status': 'ok', 'new_balance': new_balance}
