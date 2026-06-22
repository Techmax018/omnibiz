from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import Optional

from app.deps import (
    get_current_tenant, get_current_user, get_db,
    get_current_token_data, RoleChecker,
)
from app.models import Branch, InventoryItem, Product, ProductRequest
from app.services.notifications import push_notification

router = APIRouter()

require_cashier_up = RoleChecker(['Owner', 'Manager', 'Cashier'])
require_manager_up = RoleChecker(['Owner', 'Manager'])


class ProductRequestCreate(BaseModel):
    name: str
    sku: str
    sales_price: float
    cost_price: float = 0.0
    vat_category: str = 'B-16%'
    quantity_on_hand: float = 0.0
    reorder_level: float = 0.0
    description: Optional[str] = None

    @validator('name')
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError('Product name is required')
        return v.strip()

    @validator('sku')
    def sku_required(cls, v):
        if not v or not v.strip():
            raise ValueError('SKU is required')
        return v.strip().upper()

    @validator('sales_price')
    def price_positive(cls, v):
        if v < 0:
            raise ValueError('Price must be zero or positive')
        return v


class ReviewPayload(BaseModel):
    note: Optional[str] = None


def _serialize(req: ProductRequest) -> dict:
    return {
        'id': req.id,
        'name': req.name,
        'sku': req.sku,
        'sales_price': float(req.sales_price),
        'cost_price': float(req.cost_price),
        'vat_category': req.vat_category,
        'quantity_on_hand': float(req.quantity_on_hand),
        'reorder_level': float(req.reorder_level),
        'description': req.description or '',
        'status': req.status,
        'branch_id': req.branch_id,
        'requested_by': req.requested_by,
        'reviewed_by': req.reviewed_by,
        'review_note': req.review_note or '',
        'product_id': req.product_id,
        'created_at': req.created_at.isoformat(),
        'reviewed_at': req.reviewed_at.isoformat() if req.reviewed_at else None,
    }


# ── Cashier submits a product request ─────────────────────────
@router.post('/api/product-requests', status_code=status.HTTP_201_CREATED)
def create_product_request(
    payload: ProductRequestCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_cashier_up),
    db: Session = Depends(get_db),
):
    branch_id = token_data.branch_id
    if not branch_id:
        raise HTTPException(status_code=400, detail='No branch assigned to your account')

    # Prevent duplicate SKU requests that are already pending
    existing_pending = db.query(ProductRequest).filter(
        ProductRequest.tenant_id == current_tenant.id,
        ProductRequest.branch_id == branch_id,
        ProductRequest.sku == payload.sku,
        ProductRequest.status == 'pending',
    ).first()
    if existing_pending:
        raise HTTPException(status_code=400, detail=f'A pending request for SKU "{payload.sku}" already exists')

    # Also block if an approved product with this SKU exists in this tenant
    existing_product = db.query(Product).filter(
        Product.tenant_id == current_tenant.id,
        Product.sku == payload.sku,
    ).first()
    if existing_product:
        raise HTTPException(status_code=400, detail=f'Product with SKU "{payload.sku}" already exists')

    req = ProductRequest(
        tenant_id=current_tenant.id,
        branch_id=branch_id,
        requested_by=current_user.id,
        name=payload.name,
        sku=payload.sku,
        sales_price=payload.sales_price,
        cost_price=payload.cost_price,
        vat_category=payload.vat_category,
        quantity_on_hand=payload.quantity_on_hand,
        reorder_level=payload.reorder_level,
        description=payload.description,
        status='pending',
    )
    db.add(req)
    db.flush()

    push_notification(
        db, current_tenant.id, 'stock',
        f'New product request: {payload.name}',
        f'SKU {payload.sku} requested by {current_user.email}. Awaiting approval.',
        user_id=current_user.id,
        branch_id=branch_id,
    )
    db.commit()
    db.refresh(req)
    return _serialize(req)


# ── Manager/Owner lists requests ───────────────────────────────
@router.get('/api/product-requests')
def list_product_requests(
    status_filter: Optional[str] = None,   # pending | approved | rejected | all
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    q = db.query(ProductRequest).filter(ProductRequest.tenant_id == current_tenant.id)

    # Managers only see their branch; Owners see all
    if token_data.role == 'Manager' and token_data.branch_id:
        q = q.filter(ProductRequest.branch_id == token_data.branch_id)

    if status_filter and status_filter != 'all':
        q = q.filter(ProductRequest.status == status_filter)

    items = q.order_by(ProductRequest.created_at.desc()).all()
    return [_serialize(r) for r in items]


# ── Cashier can see their own requests ─────────────────────────
@router.get('/api/product-requests/mine')
def my_product_requests(
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    items = (
        db.query(ProductRequest)
        .filter(
            ProductRequest.tenant_id == current_tenant.id,
            ProductRequest.requested_by == current_user.id,
        )
        .order_by(ProductRequest.created_at.desc())
        .limit(30)
        .all()
    )
    return [_serialize(r) for r in items]


# ── Approve ────────────────────────────────────────────────────
@router.post('/api/product-requests/{req_id}/approve')
def approve_product_request(
    req_id: int,
    payload: ReviewPayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    req = db.query(ProductRequest).filter(
        ProductRequest.id == req_id,
        ProductRequest.tenant_id == current_tenant.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail='Request not found')
    if req.status != 'pending':
        raise HTTPException(status_code=400, detail=f'Request is already {req.status}')

    # Manager can only approve requests for their own branch
    if token_data.role == 'Manager' and token_data.branch_id != req.branch_id:
        raise HTTPException(status_code=403, detail='You can only approve requests for your branch')

    # Check for SKU collision one more time
    existing = db.query(Product).filter(
        Product.tenant_id == current_tenant.id,
        Product.sku == req.sku,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f'SKU "{req.sku}" was already added by another approval')

    try:
        # Create the product
        product = Product(
            tenant_id=req.tenant_id,
            branch_id=req.branch_id,
            sku=req.sku,
            name=req.name,
            description=req.description,
            sales_price=req.sales_price,
            cost_price=req.cost_price,
            vat_category=req.vat_category,
            active=True,
        )
        db.add(product)
        db.flush()

        # Create inventory record
        inv = InventoryItem(
            tenant_id=req.tenant_id,
            branch_id=req.branch_id,
            product_id=product.id,
            quantity_on_hand=req.quantity_on_hand,
            reorder_level=req.reorder_level,
        )
        db.add(inv)

        # Update the request
        req.status = 'approved'
        req.reviewed_by = current_user.id
        req.review_note = payload.note or ''
        req.reviewed_at = datetime.now()
        req.product_id = product.id

        push_notification(
            db, req.tenant_id, 'stock',
            f'Product approved: {req.name}',
            f'SKU {req.sku} approved by {current_user.email} and added to inventory.',
            user_id=current_user.id,
            branch_id=req.branch_id,
        )
        db.commit()
        return _serialize(req)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail='Approval failed. Please try again.',
        ) from exc


# ── Reject ─────────────────────────────────────────────────────
@router.post('/api/product-requests/{req_id}/reject')
def reject_product_request(
    req_id: int,
    payload: ReviewPayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    req = db.query(ProductRequest).filter(
        ProductRequest.id == req_id,
        ProductRequest.tenant_id == current_tenant.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail='Request not found')
    if req.status != 'pending':
        raise HTTPException(status_code=400, detail=f'Request is already {req.status}')

    if token_data.role == 'Manager' and token_data.branch_id != req.branch_id:
        raise HTTPException(status_code=403, detail='You can only reject requests for your branch')

    req.status = 'rejected'
    req.reviewed_by = current_user.id
    req.review_note = payload.note or ''
    req.reviewed_at = datetime.now()

    push_notification(
        db, req.tenant_id, 'stock',
        f'Product request rejected: {req.name}',
        f'SKU {req.sku} rejected by {current_user.email}. Reason: {payload.note or "No reason given"}.',
        user_id=current_user.id,
        branch_id=req.branch_id,
    )
    db.commit()
    return _serialize(req)
