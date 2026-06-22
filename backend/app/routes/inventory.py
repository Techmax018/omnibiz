from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.deps import get_current_tenant, get_current_user, get_db, RoleChecker, get_current_token_data, branch_scope_check
from app.models import Product, InventoryItem, Branch, TransactionLedger
from app.services.notifications import push_notification

router = APIRouter()


class ProductCreate(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    sales_price: float
    cost_price: float = 0.0
    vat_category: str = 'B-16%'
    item_code: Optional[str] = None
    hs_code: Optional[str] = None
    branch_id: int
    reorder_level: float = 0.0
    quantity_on_hand: float = 0.0


class StockTransferCreate(BaseModel):
    product_id: int
    from_branch_id: int
    to_branch_id: int
    quantity: float
    notes: Optional[str] = None


def serialize_product(p: Product, inv: InventoryItem = None) -> dict:
    return {
        'id': p.id,
        'name': p.name,
        'sku': p.sku,
        'description': p.description,
        'sales_price': float(p.sales_price),
        'cost_price': float(p.cost_price),
        'vat_category': p.vat_category,
        'item_code': p.item_code,
        'hs_code': p.hs_code,
        'branch_id': p.branch_id,
        'active': p.active,
        'quantity_on_hand': float(inv.quantity_on_hand) if inv else 0.0,
        'reorder_level': float(inv.reorder_level) if inv else 0.0,
        'low_stock': float(inv.quantity_on_hand) <= float(inv.reorder_level) if inv and inv.reorder_level > 0 else False,
    }


@router.get('/api/inventory/products')
def list_products(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.tenant_id == current_tenant.id, Product.active == True).all()
    result = []
    for p in products:
        inv = db.query(InventoryItem).filter(
            InventoryItem.product_id == p.id,
            InventoryItem.tenant_id == current_tenant.id,
        ).first()
        result.append(serialize_product(p, inv))
    return result


@router.post('/api/inventory/products', status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    role=Depends(RoleChecker(['Owner', 'Manager'])),
    db: Session = Depends(get_db),
):
    branch_scope_check(token_data, payload.branch_id)

    # Validate branch belongs to this tenant
    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id,
        Branch.tenant_id == current_tenant.id,
    ).first()
    if not branch:
        raise HTTPException(status_code=400, detail='Branch not found in your company')

    existing = db.query(Product).filter(
        Product.sku == payload.sku,
        Product.tenant_id == current_tenant.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f'SKU "{payload.sku}" already exists')

    try:
        product = Product(
            tenant_id=current_tenant.id,
            branch_id=payload.branch_id,
            sku=payload.sku,
            name=payload.name,
            description=payload.description,
            sales_price=payload.sales_price,
            cost_price=payload.cost_price,
            vat_category=payload.vat_category,
            item_code=payload.item_code,
            hs_code=payload.hs_code,
        )
        db.add(product)
        db.flush()
        inv = InventoryItem(
            tenant_id=current_tenant.id,
            branch_id=payload.branch_id,
            product_id=product.id,
            quantity_on_hand=payload.quantity_on_hand,
            reorder_level=payload.reorder_level,
        )
        db.add(inv)
        db.commit()
        db.refresh(product)
        push_notification(db, current_tenant.id, 'stock',
            f'New product added: {product.name}',
            f'SKU: {product.sku} — Opening stock: {payload.quantity_on_hand}',
            user_id=current_user.id,
            branch_id=payload.branch_id)
        db.commit()
        return serialize_product(product, inv)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to create product. Please try again.',
        ) from exc


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sales_price: Optional[float] = None
    cost_price: Optional[float] = None
    vat_category: Optional[str] = None
    item_code: Optional[str] = None
    hs_code: Optional[str] = None
    reorder_level: Optional[float] = None
    quantity_on_hand: Optional[float] = None
    active: Optional[bool] = None


@router.put('/api/inventory/products/{product_id}')
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    role=Depends(RoleChecker(['Owner', 'Manager'])),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == current_tenant.id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail='Product not found')

    branch_scope_check(token_data, product.branch_id)

    try:
        if payload.name is not None:         product.name = payload.name
        if payload.description is not None:  product.description = payload.description
        if payload.sales_price is not None:  product.sales_price = payload.sales_price
        if payload.cost_price is not None:   product.cost_price = payload.cost_price
        if payload.vat_category is not None: product.vat_category = payload.vat_category
        if payload.item_code is not None:    product.item_code = payload.item_code
        if payload.hs_code is not None:      product.hs_code = payload.hs_code
        if payload.active is not None:       product.active = payload.active

        inv = db.query(InventoryItem).filter(
            InventoryItem.product_id == product_id,
            InventoryItem.tenant_id == current_tenant.id,
        ).first()
        if inv:
            if payload.reorder_level is not None:    inv.reorder_level = payload.reorder_level
            if payload.quantity_on_hand is not None: inv.quantity_on_hand = payload.quantity_on_hand

        db.commit()
        db.refresh(product)
        push_notification(
            db, current_tenant.id, 'stock',
            f'Product updated: {product.name}',
            f'SKU {product.sku} updated by {current_user.email}.',
            user_id=current_user.id,
            branch_id=product.branch_id,
        )
        db.commit()
        return serialize_product(product, inv)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail='Failed to update product.') from exc


@router.get('/api/inventory/low-stock')
def low_stock_alerts(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    items = db.query(InventoryItem).filter(InventoryItem.tenant_id == current_tenant.id).all()
    alerts = []
    for inv in items:
        if inv.reorder_level > 0 and inv.quantity_on_hand <= inv.reorder_level:
            alerts.append({
                'product_id': inv.product_id,
                'product_name': inv.product.name if inv.product else '—',
                'branch_id': inv.branch_id,
                'quantity_on_hand': float(inv.quantity_on_hand),
                'reorder_level': float(inv.reorder_level),
            })
    return alerts


@router.post('/api/inventory/transfer')
def transfer_stock(
    payload: StockTransferCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    role=Depends(RoleChecker(['Owner', 'Manager'])),
    db: Session = Depends(get_db),
):
    branch_scope_check(token_data, payload.from_branch_id)

    if payload.from_branch_id == payload.to_branch_id:
        raise HTTPException(status_code=400, detail='Source and destination branches must be different')
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail='Transfer quantity must be greater than zero')

    src = db.query(InventoryItem).filter(
        InventoryItem.product_id == payload.product_id,
        InventoryItem.branch_id == payload.from_branch_id,
        InventoryItem.tenant_id == current_tenant.id,
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail='Product not found at source branch')
    if float(src.quantity_on_hand) < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f'Insufficient stock — available: {float(src.quantity_on_hand)}, requested: {payload.quantity}',
        )

    try:
        dst = db.query(InventoryItem).filter(
            InventoryItem.product_id == payload.product_id,
            InventoryItem.branch_id == payload.to_branch_id,
            InventoryItem.tenant_id == current_tenant.id,
        ).first()
        if not dst:
            dst = InventoryItem(
                tenant_id=current_tenant.id,
                branch_id=payload.to_branch_id,
                product_id=payload.product_id,
                quantity_on_hand=0,
                reorder_level=0,
            )
            db.add(dst)

        src.quantity_on_hand = float(src.quantity_on_hand) - payload.quantity
        dst.quantity_on_hand = float(dst.quantity_on_hand) + payload.quantity

        ledger = TransactionLedger(
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action_type='stock_transfer',
            entity='inventory',
            entity_id=str(payload.product_id),
            amount=payload.quantity,
            notes=payload.notes or f'Transfer {payload.quantity} units branch {payload.from_branch_id}→{payload.to_branch_id}',
        )
        db.add(ledger)
        db.commit()

        if float(src.quantity_on_hand) <= float(src.reorder_level) and src.reorder_level > 0:
            push_notification(db, current_tenant.id, 'stock',
                'Low stock alert after transfer',
                f'Product ID {payload.product_id} at branch {payload.from_branch_id} is below reorder level.',
                user_id=current_user.id,
                branch_id=payload.from_branch_id)
            db.commit()

        push_notification(db, current_tenant.id, 'transfer',
            f'Stock transferred: {payload.quantity} units',
            f'Product {payload.product_id}: branch {payload.from_branch_id} → {payload.to_branch_id}.',
            user_id=current_user.id,
            branch_id=payload.from_branch_id)
        db.commit()
        return {'status': 'ok', 'transferred': payload.quantity}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Stock transfer failed. Please try again.',
        ) from exc
