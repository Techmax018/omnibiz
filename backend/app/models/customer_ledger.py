from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class CustomerLedgerEntry(Base):
    __tablename__ = 'customer_ledger_entries'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    customer_id = Column(Integer, ForeignKey('customer_accounts.id', ondelete='CASCADE'), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    entry_type = Column(String(16), nullable=False)  # debit or credit
    balance_after = Column(Numeric(12, 2), nullable=False)
    reference_id = Column(String(128), nullable=True)
    notes = Column(String(1024), nullable=True)
    is_correction = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    customer = relationship('CustomerAccount')
