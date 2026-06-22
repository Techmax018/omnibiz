from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class Employee(Base):
    __tablename__ = 'employees'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    name = Column(String(255), nullable=False)
    role = Column(String(64), nullable=False, default='Cashier')  # Cashier, Manager, Admin
    phone = Column(String(64), nullable=True)
    email = Column(String(255), nullable=True)
    commission_rate = Column(Numeric(5, 2), nullable=False, default=0.0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    branch = relationship('Branch')
    shifts = relationship('EmployeeShift', back_populates='employee', cascade='all, delete-orphan')


class EmployeeShift(Base):
    __tablename__ = 'employee_shifts'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    employee_id = Column(Integer, ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    # user_id of the cashier who submitted this shift (may differ from employee)
    submitted_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    shift_name = Column(String(128), nullable=True)          # e.g. "Morning Shift"
    clock_in = Column(DateTime, nullable=False, default=datetime.now)
    clock_out = Column(DateTime, nullable=True)
    notes = Column(String(512), nullable=True)
    # pending | approved | rejected
    status = Column(String(32), nullable=False, default='pending')
    review_note = Column(String(512), nullable=True)

    employee = relationship('Employee', back_populates='shifts')
