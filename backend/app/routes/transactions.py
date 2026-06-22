from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import Optional

from app.deps import get_current_tenant, get_current_user, get_db, get_current_token_data
from app.models import TransactionLedger
from app.services.notifications import push_notification

router = APIRouter()


class OrderPayload(BaseModel):
    client: str
    status: str = 'Pending'
    amount: float
    account_id: Optional[int] = None

    @validator('amount')
    def amount_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Amount must be zero or positive')
        return v

    @validator('client')
    def client_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Client name is required')
        return v.strip()


class TransactionPayload(BaseModel):
    action_type: str = 'adjustment'
    entity: str = 'general'
    entity_id: Optional[str] = None
    amount: float = 0.0
    ip_address: Optional[str] = None
    notes: Optional[str] = None
    is_correction: bool = False
    reference_id: Optional[str] = None


@router.post('/api/orders')
def create_order(
    order: OrderPayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    try:
        record = TransactionLedger(
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action_type='sale',
            entity=order.client,
            entity_id=str(order.account_id or '0'),
            amount=order.amount,
            ip_address='0.0.0.0',
            notes=f'Status: {order.status}',
        )
        db.add(record)
        db.flush()
        push_notification(
            db, current_tenant.id, 'sale',
            f'New sale: {order.client}',
            f'Amount: KES {float(order.amount):,.2f} — {order.status}',
            user_id=current_user.id,
            branch_id=token_data.branch_id,   # scopes to cashier/manager branch
        )
        db.commit()
        db.refresh(record)
        return {'status': 'ok', 'transaction_id': record.id}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to record sale. Please try again.',
        ) from exc


@router.post('/api/transactions')
def create_transaction(
    payload: TransactionPayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    try:
        record = TransactionLedger(
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action_type=payload.action_type,
            entity=payload.entity,
            entity_id=str(payload.entity_id or ''),
            amount=payload.amount,
            ip_address=payload.ip_address,
            notes=payload.notes,
            is_correction=payload.is_correction,
            reference_id=payload.reference_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {'status': 'ok', 'transaction_id': record.id}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to record transaction. Please try again.',
        ) from exc
