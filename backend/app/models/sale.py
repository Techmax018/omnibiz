from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class SaleInvoice(Base):
    __tablename__ = 'sale_invoices'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    customer_id = Column(Integer, ForeignKey('customer_accounts.id', ondelete='SET NULL'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    invoice_number = Column(String(128), unique=True, nullable=False, index=True)
    total_amount = Column(Numeric(14, 2), nullable=False)
    paid_amount = Column(Numeric(14, 2), nullable=False, default=0.0)
    outstanding_amount = Column(Numeric(14, 2), nullable=False, default=0.0)
    status = Column(String(32), nullable=False, default='pending')
    etims_status = Column(String(32), nullable=False, default='pending')
    etims_payload = Column(String(2048), nullable=True)
    signed_etims = Column(String(2048), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    is_locked = Column(Boolean, nullable=False, default=True)

    line_items = relationship('SaleLineItem', back_populates='invoice')
    customer = relationship('CustomerAccount')


class SaleLineItem(Base):
    __tablename__ = 'sale_line_items'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    invoice_id = Column(Integer, ForeignKey('sale_invoices.id', ondelete='CASCADE'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='SET NULL'), nullable=True)
    description = Column(String(512), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    vat_rate = Column(String(32), nullable=False)
    item_code = Column(String(64), nullable=True)
    hs_code = Column(String(64), nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=False)

    invoice = relationship('SaleInvoice', back_populates='line_items')
    product = relationship('Product')
