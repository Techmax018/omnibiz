from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Branch(Base):
    __tablename__ = 'branches'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    county = Column(String(128), nullable=True)
    location_code = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    tenant = relationship('Tenant', back_populates='branches')
