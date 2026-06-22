from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import Optional
from app.deps import get_current_tenant, get_current_user, get_db, require_manager
from app.models import Branch, BusinessAccount, Tenant

router = APIRouter()


# ── Pydantic models defined BEFORE use ──────────────────────
class BranchCreatePayload(BaseModel):
    name: str
    county: Optional[str] = None
    location_code: Optional[str] = None

    @validator('name')
    def name_required(cls, v):
        if not v or not v.strip():
            raise ValueError('Branch name is required')
        return v.strip()


class SetupPayload(BaseModel):
    company_name: str
    currency: str = 'KES'
    industry: str
    branch_name: str
    branch_location: str
    tax_name: str
    tax_rate: float

    @validator('company_name', 'branch_name', 'industry')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()


# ── Branch endpoints ─────────────────────────────────────────
@router.get('/api/branches')
def list_branches(
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Returns all branches for the current tenant."""
    branches = (
        db.query(Branch)
        .filter(Branch.tenant_id == current_tenant.id)
        .order_by(Branch.id)
        .all()
    )
    return [
        {
            'id': b.id,
            'name': b.name,
            'county': b.county,
            'location_code': b.location_code,
            'created_at': b.created_at.isoformat(),
        }
        for b in branches
    ]


@router.post('/api/branches', status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreatePayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    _role=Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Owner or Manager creates a new branch."""
    # Prevent duplicate branch names within a tenant
    existing = db.query(Branch).filter(
        Branch.tenant_id == current_tenant.id,
        Branch.name == payload.name.strip(),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f'A branch named "{payload.name}" already exists')

    try:
        branch = Branch(
            tenant_id=current_tenant.id,
            name=payload.name,
            county=payload.county,
            location_code=payload.location_code or '',
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return {
            'id': branch.id,
            'name': branch.name,
            'county': branch.county,
            'location_code': branch.location_code,
            'created_at': branch.created_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to create branch. Please try again.',
        ) from exc


# ── First-time setup ─────────────────────────────────────────
@router.get('/api/setup/status')
def setup_status(
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Returns whether this tenant has completed first-time setup."""
    has_branch = db.query(Branch).filter(Branch.tenant_id == current_tenant.id).first()
    has_account = db.query(BusinessAccount).filter(BusinessAccount.tenant_id == current_tenant.id).first()
    return {
        'is_first_time_setup': not has_branch or not has_account,
        'tenant_name': current_tenant.name,
    }


@router.post('/api/setup/initialize', status_code=status.HTTP_201_CREATED)
def initialize_setup(
    payload: SetupPayload,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Completes first-time onboarding: creates branch + business account in one transaction."""
    existing_branch = db.query(Branch).filter(Branch.tenant_id == current_tenant.id).first()
    if existing_branch:
        raise HTTPException(status_code=400, detail='Setup has already been completed for this company')

    try:
        tenant = db.query(Tenant).filter(Tenant.id == current_tenant.id).first()
        if tenant and payload.company_name:
            tenant.name = payload.company_name
            tenant.description = f'{payload.industry} — {payload.currency}'

        branch = Branch(
            tenant_id=current_tenant.id,
            name=payload.branch_name,
            county=payload.branch_location,
            location_code='HQ',
        )
        db.add(branch)
        db.flush()

        account = BusinessAccount(
            tenant_id=current_tenant.id,
            name=f'{payload.company_name} — Main',
            owner=current_user.email,
            email=current_user.email,
        )
        db.add(account)
        db.commit()

        return {
            'status': 'ok',
            'branch_id': branch.id,
            'account_id': account.id,
            'message': 'Setup complete. Welcome to OmniBiz!',
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Setup failed. Please try again.',
        ) from exc
