from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import Optional

from app.deps import (
    get_current_tenant, get_current_user, get_db,
    get_current_token_data, RoleChecker,
)
from app.models import Employee, EmployeeShift, SaleInvoice
from app.services.notifications import push_notification

router = APIRouter()

require_manager_up = RoleChecker(['Owner', 'Manager'])
require_any = RoleChecker(['Owner', 'Manager', 'Cashier'])


class EmployeeCreate(BaseModel):
    name: str
    role: str = 'Cashier'
    phone: Optional[str] = None
    email: Optional[str] = None
    commission_rate: float = 0.0
    branch_id: int


class ShiftSubmit(BaseModel):
    """Cashier submits a completed shift for manager review."""
    shift_name: str
    clock_in: str    # ISO datetime string
    clock_out: str   # ISO datetime string
    notes: Optional[str] = None

    @validator('shift_name')
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError('Shift name is required')
        return v.strip()

    @validator('clock_out')
    def clock_out_after_clock_in(cls, v, values):
        try:
            ci = datetime.fromisoformat(values['clock_in'])
            co = datetime.fromisoformat(v)
            if co <= ci:
                raise ValueError('Clock-out must be after clock-in')
        except (KeyError, ValueError) as e:
            if 'after' in str(e):
                raise
        return v


class ShiftReview(BaseModel):
    note: Optional[str] = None


def serialize_employee(e: Employee) -> dict:
    return {
        'id': e.id,
        'name': e.name,
        'role': e.role,
        'phone': e.phone,
        'email': e.email,
        'commission_rate': float(e.commission_rate),
        'is_active': e.is_active,
        'branch_id': e.branch_id,
        'created_at': e.created_at.isoformat(),
    }


def serialize_shift(s: EmployeeShift) -> dict:
    hours = None
    if s.clock_out:
        hours = round((s.clock_out - s.clock_in).total_seconds() / 3600, 2)
    return {
        'id': s.id,
        'employee_id': s.employee_id,
        'employee_name': s.employee.name if s.employee else None,
        'shift_name': s.shift_name or '',
        'clock_in': s.clock_in.isoformat(),
        'clock_out': s.clock_out.isoformat() if s.clock_out else None,
        'hours_worked': hours,
        'notes': s.notes or '',
        'status': s.status,
        'review_note': s.review_note or '',
        'submitted_by': s.submitted_by,
    }


# ── Employees ─────────────────────────────────────────────────
@router.get('/api/employees')
def list_employees(
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    employees = db.query(Employee).filter(Employee.tenant_id == current_tenant.id).all()
    return [serialize_employee(e) for e in employees]


@router.post('/api/employees', status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    from app.models import Branch
    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id,
        Branch.tenant_id == current_tenant.id,
    ).first()
    if not branch:
        raise HTTPException(status_code=400, detail='Branch not found in your company')

    try:
        employee = Employee(
            tenant_id=current_tenant.id,
            branch_id=payload.branch_id,
            name=payload.name,
            role=payload.role,
            phone=payload.phone,
            email=payload.email,
            commission_rate=payload.commission_rate,
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return serialize_employee(employee)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail='Failed to create employee.') from exc


# ── Legacy clock-in / clock-out (HRM module) ─────────────────
@router.post('/api/employees/{employee_id}/clock-in')
def clock_in(
    employee_id: int,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == current_tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail='Employee not found')

    open_shift = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee_id,
        EmployeeShift.clock_out == None,
    ).first()
    if open_shift:
        raise HTTPException(status_code=400, detail='Employee already clocked in')

    shift = EmployeeShift(
        tenant_id=current_tenant.id,
        employee_id=employee_id,
        submitted_by=current_user.id,
        clock_in=datetime.now(),
        status='approved',   # direct clock-in by manager = auto-approved
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return {'shift_id': shift.id, 'clock_in': shift.clock_in.isoformat()}


@router.post('/api/employees/{employee_id}/clock-out')
def clock_out(
    employee_id: int,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    shift = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee_id,
        EmployeeShift.clock_out == None,
        EmployeeShift.tenant_id == current_tenant.id,
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail='No open shift found')

    shift.clock_out = datetime.now()
    db.commit()
    hours = (shift.clock_out - shift.clock_in).total_seconds() / 3600
    return {'shift_id': shift.id, 'hours_worked': round(hours, 2), 'clock_out': shift.clock_out.isoformat()}


# ── Cashier shift submission ───────────────────────────────────
@router.post('/api/shifts/submit', status_code=status.HTTP_201_CREATED)
def submit_shift(
    payload: ShiftSubmit,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    """
    Cashier (or any staff) submits a shift record.
    It lands as 'pending' and notifies the branch manager for review.
    """
    # Find the employee record linked to this user (if any)
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == current_tenant.id,
    ).first()
    # If no linked employee, use branch_id from token to find any branch employee
    # or just store the shift against branch without an employee record
    employee_id = employee.id if employee else None

    try:
        clock_in_dt = datetime.fromisoformat(payload.clock_in)
        clock_out_dt = datetime.fromisoformat(payload.clock_out)
    except ValueError:
        raise HTTPException(status_code=400, detail='Invalid datetime format. Use ISO 8601.')

    shift = EmployeeShift(
        tenant_id=current_tenant.id,
        employee_id=employee_id or _get_or_create_phantom_employee(db, current_user, current_tenant, token_data),
        submitted_by=current_user.id,
        shift_name=payload.shift_name,
        clock_in=clock_in_dt,
        clock_out=clock_out_dt,
        notes=payload.notes or '',
        status='pending',
    )
    db.add(shift)
    db.flush()

    push_notification(
        db, current_tenant.id, 'employee',
        f'Shift submitted: {payload.shift_name}',
        f'{current_user.email} submitted "{payload.shift_name}" ({clock_in_dt.strftime("%H:%M")} → {clock_out_dt.strftime("%H:%M")}). Awaiting review.',
        user_id=current_user.id,
        branch_id=token_data.branch_id,
    )
    db.commit()
    db.refresh(shift)
    return serialize_shift(shift)


def _get_or_create_phantom_employee(db, user, tenant, token_data) -> int:
    """Creates a minimal Employee record for a system user who has no employee profile yet."""
    emp = Employee(
        tenant_id=tenant.id,
        branch_id=token_data.branch_id,
        user_id=user.id,
        name=user.email.split('@')[0],
        role='Cashier',
    )
    db.add(emp)
    db.flush()
    return emp.id


# ── List shifts (manager/owner sees all in branch/tenant; cashier sees own) ─
@router.get('/api/shifts')
def list_shifts(
    status_filter: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    q = db.query(EmployeeShift).filter(EmployeeShift.tenant_id == current_tenant.id)

    if token_data.role == 'Cashier':
        # Cashier sees only their own submissions
        q = q.filter(EmployeeShift.submitted_by == current_user.id)
    elif token_data.role == 'Manager' and token_data.branch_id:
        # Manager sees their branch
        q = q.join(Employee).filter(Employee.branch_id == token_data.branch_id)

    if status_filter and status_filter != 'all':
        q = q.filter(EmployeeShift.status == status_filter)

    shifts = q.order_by(EmployeeShift.clock_in.desc()).limit(100).all()
    return [serialize_shift(s) for s in shifts]


# ── Manager/Owner approves a shift ────────────────────────────
@router.post('/api/shifts/{shift_id}/approve')
def approve_shift(
    shift_id: int,
    payload: ShiftReview,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    shift = db.query(EmployeeShift).filter(
        EmployeeShift.id == shift_id,
        EmployeeShift.tenant_id == current_tenant.id,
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail='Shift not found')
    if shift.status != 'pending':
        raise HTTPException(status_code=400, detail=f'Shift is already {shift.status}')

    shift.status = 'approved'
    shift.review_note = payload.note or ''

    push_notification(
        db, current_tenant.id, 'employee',
        f'Shift approved: {shift.shift_name or "Shift #" + str(shift.id)}',
        f'Approved by {current_user.email}.',
        user_id=shift.submitted_by,
        branch_id=shift.employee.branch_id if shift.employee else None,
    )
    db.commit()
    return serialize_shift(shift)


# ── Manager/Owner rejects a shift ─────────────────────────────
@router.post('/api/shifts/{shift_id}/reject')
def reject_shift(
    shift_id: int,
    payload: ShiftReview,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    _role=Depends(require_manager_up),
    db: Session = Depends(get_db),
):
    shift = db.query(EmployeeShift).filter(
        EmployeeShift.id == shift_id,
        EmployeeShift.tenant_id == current_tenant.id,
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail='Shift not found')
    if shift.status != 'pending':
        raise HTTPException(status_code=400, detail=f'Shift is already {shift.status}')

    shift.status = 'rejected'
    shift.review_note = payload.note or ''

    push_notification(
        db, current_tenant.id, 'employee',
        f'Shift rejected: {shift.shift_name or "Shift #" + str(shift.id)}',
        f'Rejected by {current_user.email}. Reason: {payload.note or "No reason given"}.',
        user_id=shift.submitted_by,
        branch_id=shift.employee.branch_id if shift.employee else None,
    )
    db.commit()
    return serialize_shift(shift)


# ── Employee performance ───────────────────────────────────────
@router.get('/api/employees/{employee_id}/performance')
def employee_performance(
    employee_id: int,
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == current_tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail='Employee not found')

    invoices = db.query(SaleInvoice).filter(
        SaleInvoice.user_id == employee.user_id,
        SaleInvoice.tenant_id == current_tenant.id,
    ).all() if employee.user_id else []

    total_sales = sum(float(i.total_amount) for i in invoices)
    commission = total_sales * float(employee.commission_rate) / 100

    shifts = db.query(EmployeeShift).filter(
        EmployeeShift.employee_id == employee_id,
        EmployeeShift.status == 'approved',
    ).all()
    total_hours = sum(
        (s.clock_out - s.clock_in).total_seconds() / 3600
        for s in shifts if s.clock_out
    )

    return {
        'employee': serialize_employee(employee),
        'total_sales': total_sales,
        'commission_earned': round(commission, 2),
        'total_shifts': len(shifts),
        'total_hours': round(total_hours, 2),
    }
