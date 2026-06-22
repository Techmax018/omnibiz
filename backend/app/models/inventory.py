from sqlalchemy import Column, Integer, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from app.db.base import Base


class InventoryItem(Base):
    __tablename__ = 'inventory_items'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    quantity_on_hand = Column(Numeric(12, 2), nullable=False, default=0.0)
    reorder_level = Column(Numeric(12, 2), nullable=False, default=0.0)
    reserved_quantity = Column(Numeric(12, 2), nullable=False, default=0.0)

    product = relationship('Product')
    branch = relationship('Branch')
