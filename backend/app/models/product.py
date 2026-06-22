from sqlalchemy import Column, Integer, Numeric, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Product(Base):
    __tablename__ = 'products'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    sku = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=True)
    sales_price = Column(Numeric(12, 2), nullable=False, default=0.0)
    cost_price = Column(Numeric(12, 2), nullable=False, default=0.0)
    item_code = Column(String(64), nullable=True)
    hs_code = Column(String(64), nullable=True)
    vat_category = Column(String(32), nullable=False, default='B-16%')
    active = Column(Boolean, default=True, nullable=False)

    branch = relationship('Branch')
