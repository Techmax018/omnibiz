from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class AppNotification(Base):
    __tablename__ = 'app_notifications'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)   # who triggered it
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='SET NULL'), nullable=True)  # which branch
    category = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    tenant = relationship('Tenant')
