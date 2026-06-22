from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.deps import get_current_tenant, get_current_user, get_db, get_business_branch_context
from app.models import CustomerAccount, SaleInvoice
from app.schemas import SaleCreateRequest, SaleCreateResponse, BusinessBranchContext
from app.services.retail import create_sale_invoice

router = APIRouter()


@router.get('/api/branches/context', response_model=BusinessBranchContext)
def get_branch_context(
    context=Depends(get_business_branch_context),
):
    return context


@router.post('/api/sales', response_model=SaleCreateResponse)
def create_sale(
    payload: SaleCreateRequest,
    request: Request,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    context=Depends(get_business_branch_context),
    db: Session = Depends(get_db),
):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')

    customer = None
    if payload.customer_id:
        customer = db.query(CustomerAccount).filter(
            CustomerAccount.id == payload.customer_id,
            CustomerAccount.tenant_id == context.business_id,
            CustomerAccount.branch_id == context.branch_id,
        ).first()
        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Customer not found')

    try:
        invoice = create_sale_invoice(
            db=db,
            business_id=context.business_id,
            branch_id=context.branch_id,
            user_id=current_user.id,
            customer_id=payload.customer_id,
            items=payload.items,
            payment_amount=Decimal(payload.payment_amount),
            ip_address=request.client.host if request.client else '0.0.0.0',
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return SaleCreateResponse(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        total_amount=float(invoice.total_amount),
        outstanding_amount=float(invoice.outstanding_amount),
        etims_status=invoice.etims_status,
    )


@router.get('/api/sales/latest')
def latest_sales(
    current_user=Depends(get_current_user),
    context=Depends(get_business_branch_context),
    db: Session = Depends(get_db),
):
    invoices = (
        db.query(SaleInvoice)
        .filter(
            SaleInvoice.tenant_id == context.business_id,
            SaleInvoice.branch_id == context.branch_id,
        )
        .order_by(SaleInvoice.created_at.desc())
        .limit(12)
        .all()
    )
    return [
        {
            'invoice_number': invoice.invoice_number,
            'customer_id': invoice.customer_id,
            'total_amount': float(invoice.total_amount),
            'outstanding_amount': float(invoice.outstanding_amount),
            'status': invoice.status,
            'etims_status': invoice.etims_status,
            'created_at': invoice.created_at.isoformat(),
        }
        for invoice in invoices
    ]
