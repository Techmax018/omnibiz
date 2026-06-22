from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = 'tenants'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    memberships = relationship('UserTenant', back_populates='tenant', cascade='all, delete-orphan')
    accounts = relationship('BusinessAccount', back_populates='tenant', cascade='all, delete-orphan')
    branches = relationship('Branch', back_populates='tenant', cascade='all, delete-orphan')
