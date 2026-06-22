from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class BusinessAccount(Base):
    __tablename__ = 'business_accounts'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    tenant = relationship('Tenant', back_populates='accounts')
