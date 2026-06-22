from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class TransactionLedger(Base):
    __tablename__ = 'transaction_ledger'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    timestamp = Column(DateTime, default=datetime.now, nullable=False)
    action_type = Column(String(128), nullable=False)
    entity = Column(String(128), nullable=False)
    entity_id = Column(String(128), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(8), default='KES', nullable=False)
    ip_address = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    is_correction = Column(Boolean, default=False, nullable=False)
    reference_id = Column(String(128), nullable=True)

    tenant = relationship('Tenant')
    user = relationship('User')
