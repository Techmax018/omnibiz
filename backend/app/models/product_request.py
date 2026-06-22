from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class ProductRequest(Base):
    """
    A Cashier's request to add a new product to their branch.
    Requires Manager or Owner approval before the product is created.
    """
    __tablename__ = 'product_requests'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    requested_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    # Product details proposed by the cashier
    name = Column(String(255), nullable=False)
    sku = Column(String(64), nullable=False)
    sales_price = Column(Numeric(12, 2), nullable=False, default=0.0)
    cost_price = Column(Numeric(12, 2), nullable=False, default=0.0)
    vat_category = Column(String(32), nullable=False, default='B-16%')
    quantity_on_hand = Column(Numeric(12, 2), nullable=False, default=0.0)
    reorder_level = Column(Numeric(12, 2), nullable=False, default=0.0)
    description = Column(Text, nullable=True)

    # Workflow state: pending | approved | rejected
    status = Column(String(32), nullable=False, default='pending')
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    # Auto-created product id after approval
    product_id = Column(Integer, ForeignKey('products.id', ondelete='SET NULL'), nullable=True)

    tenant = relationship('Tenant')
    branch = relationship('Branch')
