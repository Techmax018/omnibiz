from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserTenant(Base):
    __tablename__ = 'user_tenants'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    role = Column(Enum('Owner', 'Manager', 'Cashier', name='tenant_roles'), nullable=False)
    assigned_name = Column(String(255), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='SET NULL'), nullable=True)

    user = relationship('User', back_populates='memberships')
    tenant = relationship('Tenant', back_populates='memberships')
