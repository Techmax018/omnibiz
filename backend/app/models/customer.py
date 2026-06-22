from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class CustomerAccount(Base):
    __tablename__ = 'customer_accounts'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(64), nullable=True)
    email = Column(String(255), nullable=True)
    credit_limit = Column(Numeric(12, 2), nullable=False, default=0.0)
    balance = Column(Numeric(12, 2), nullable=False, default=0.0)
    active = Column(String(8), nullable=False, default='active')
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    branch = relationship('Branch')
