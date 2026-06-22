from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_access_token, create_refresh_token, hash_password, verify_password, verify_token
from app.core.config import settings
from app.deps import get_db, get_current_user, require_super_admin
from app.models import Tenant, User, UserTenant
from app.schemas import (
    AuthResponse, LoginRequest, ProvisionOwnerRequest,
    SwitchTenantRequest, TenantData, UserData,
)
from app.services.notifications import push_notification

router = APIRouter()


# ── Cookie helpers ─────────────────────────────────────────────
def get_refresh_token(request: Request) -> str:
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Refresh token missing',
        )
    return token


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.USE_SECURE_COOKIES,
        samesite=settings.COOKIE_SAMESITE,
        path='/',
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.USE_SECURE_COOKIES,
        samesite=settings.COOKIE_SAMESITE,
        path='/',
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


# ── Response builders ──────────────────────────────────────────
def _user_data(user: User, role: str | None = None, branch_id: int | None = None) -> UserData:
    return UserData(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        is_super_admin=user.is_super_admin,
        created_at=user.created_at,
        role=role,
        branch_id=branch_id,
    )


def build_auth_response(user: User, tenant: Tenant | None, role: str | None, branch_id: int | None = None) -> AuthResponse:
    tenant_data = TenantData(id=tenant.id, name=tenant.name, description=tenant.description) if tenant else None
    return AuthResponse(
        user=_user_data(user, role=role, branch_id=branch_id),
        tenant=tenant_data,
    )


# ── Login — unified for all roles ─────────────────────────────
@router.post('/auth/login', response_model=AuthResponse)
def login(request_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request_data.email).first()
    if not user or not verify_password(request_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account is deactivated')

    # ── Super Admin path — no tenant context ──────────────────
    if user.is_super_admin:
        token_payload = {
            'sub': user.id,
            'tenant_id': 0,
            'role': 'SuperAdmin',
            'is_super_admin': True,
        }
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)
        set_auth_cookies(response, access_token, refresh_token)
        return build_auth_response(user, tenant=None, role='SuperAdmin')

    # ── Tenant user path ───────────────────────────────────────
    membership = db.query(UserTenant).filter(UserTenant.user_id == user.id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No business membership found')

    token_payload = {
        'sub': user.id,
        'tenant_id': membership.tenant_id,
        'role': membership.role,
        'branch_id': membership.branch_id,
        'is_super_admin': False,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    set_auth_cookies(response, access_token, refresh_token)

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    push_notification(
        db, tenant.id, 'login',
        f'Login: {user.email}',
        f'{membership.role} signed in.',
        user_id=user.id,
    )
    db.commit()
    return build_auth_response(user, tenant, role=membership.role, branch_id=membership.branch_id)


# ── Token refresh ──────────────────────────────────────────────
@router.post('/auth/refresh', response_model=AuthResponse)
def refresh(response: Response, db: Session = Depends(get_db), refresh_token: str = Depends(get_refresh_token)):
    payload = verify_token(refresh_token, expected_purpose='refresh')
    user = db.query(User).filter(User.id == payload['sub']).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not active')

    # Super Admin refresh
    if payload.get('is_super_admin') or user.is_super_admin:
        token_payload = {'sub': user.id, 'tenant_id': 0, 'role': 'SuperAdmin', 'is_super_admin': True}
        access_token = create_access_token(token_payload)
        new_refresh = create_refresh_token(token_payload)
        set_auth_cookies(response, access_token, new_refresh)
        return build_auth_response(user, tenant=None, role='SuperAdmin')

    membership = db.query(UserTenant).filter(
        UserTenant.user_id == user.id, UserTenant.tenant_id == payload['tenant_id']
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Tenant access prohibited')

    token_payload = {
        'sub': user.id,
        'tenant_id': membership.tenant_id,
        'role': membership.role,
        'branch_id': membership.branch_id,
        'is_super_admin': False,
    }
    access_token = create_access_token(token_payload)
    new_refresh = create_refresh_token(token_payload)
    set_auth_cookies(response, access_token, new_refresh)
    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    return build_auth_response(user, tenant, role=membership.role, branch_id=membership.branch_id)


# ── Current user ───────────────────────────────────────────────
@router.get('/auth/me', response_model=AuthResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_super_admin:
        return build_auth_response(current_user, tenant=None, role='SuperAdmin')

    membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No tenant assigned')

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    return build_auth_response(current_user, tenant, role=membership.role, branch_id=membership.branch_id)


# ── Logout ─────────────────────────────────────────────────────
@router.post('/auth/logout')
def logout(response: Response):
    response.delete_cookie(key=settings.TOKEN_COOKIE_NAME, path='/')
    response.delete_cookie(key=settings.REFRESH_COOKIE_NAME, path='/')
    return {'status': 'logged_out'}


# ══════════════════════════════════════════════════════════════
# Super Admin — platform management
# ══════════════════════════════════════════════════════════════

@router.get('/api/admin/owners')
def list_owners(
    _token=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """SuperAdmin: list all Business Owner accounts with their companies."""
    memberships = db.query(UserTenant).filter(UserTenant.role == 'Owner').all()
    result = []
    for m in memberships:
        u = db.query(User).filter(User.id == m.user_id).first()
        t = db.query(Tenant).filter(Tenant.id == m.tenant_id).first()
        if u and t:
            result.append({
                'id': u.id,
                'email': u.email,
                'assigned_name': m.assigned_name or '',
                'is_active': u.is_active,
                'company_id': t.id,
                'company_name': t.name,
                'company_description': t.description or '',
                'created_at': u.created_at.isoformat(),
            })
    return result


@router.post('/api/admin/owners', status_code=status.HTTP_201_CREATED)
def provision_owner(
    payload: ProvisionOwnerRequest,
    _token=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    SuperAdmin provisions a new Business Owner and their Company Tenant
    in a single atomic transaction.
    """
    if db.query(User).filter(User.email == payload.owner_email).first():
        raise HTTPException(status_code=400, detail='Email already in use')

    if db.query(Tenant).filter(Tenant.name == payload.company_name).first():
        raise HTTPException(status_code=400, detail='A company with that name already exists')

    # 1. Create the Tenant (company)
    tenant = Tenant(
        name=payload.company_name,
        description=payload.company_description or '',
    )
    db.add(tenant)
    db.flush()  # get tenant.id

    # 2. Create the User
    new_user = User(
        email=payload.owner_email,
        hashed_password=hash_password(payload.owner_password),
        is_active=True,
        is_super_admin=False,
    )
    db.add(new_user)
    db.flush()  # get new_user.id

    # 3. Create the UserTenant membership (Owner, no branch — owners are cross-branch)
    membership = UserTenant(
        user_id=new_user.id,
        tenant_id=tenant.id,
        role='Owner',
        assigned_name=payload.owner_name or payload.owner_email.split('@')[0],
        branch_id=None,
    )
    db.add(membership)
    db.commit()
    db.refresh(new_user)

    return {
        'id': new_user.id,
        'email': new_user.email,
        'assigned_name': membership.assigned_name,
        'role': 'Owner',
        'is_active': new_user.is_active,
        'company_id': tenant.id,
        'company_name': tenant.name,
        'created_at': new_user.created_at.isoformat(),
    }


@router.patch('/api/admin/owners/{user_id}/toggle-active')
def toggle_owner_active(
    user_id: int,
    _token=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """SuperAdmin enables/disables a Business Owner account."""
    target = db.query(User).filter(User.id == user_id, User.is_super_admin == False).first()
    if not target:
        raise HTTPException(status_code=404, detail='Owner not found')

    target.is_active = not target.is_active
    db.commit()
    return {'id': target.id, 'is_active': target.is_active}


@router.delete('/api/admin/owners/{user_id}')
def delete_owner(
    user_id: int,
    _token=Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """SuperAdmin removes a Business Owner and their company tenant entirely."""
    target = db.query(User).filter(User.id == user_id, User.is_super_admin == False).first()
    if not target:
        raise HTTPException(status_code=404, detail='Owner not found')

    # CASCADE on UserTenant + Tenant memberships handles cleanup
    membership = db.query(UserTenant).filter(UserTenant.user_id == user_id, UserTenant.role == 'Owner').first()
    if membership:
        # Delete the entire company tenant (cascades to all branches, products, etc.)
        tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
        if tenant:
            db.delete(tenant)

    db.delete(target)
    db.commit()
    return {'status': 'deleted', 'user_id': user_id}


# ══════════════════════════════════════════════════════════════
# Owner — staff provisioning within their tenant
# ══════════════════════════════════════════════════════════════

class StaffCreateRequest(BaseModel):
    email: str
    password: str
    role: str = 'Cashier'      # Only 'Manager' or 'Cashier' allowed
    assigned_name: str = ''
    branch_id: int


class PasswordChangeRequest(BaseModel):
    user_id: int
    new_password: str


@router.get('/auth/users')
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not membership or membership.role not in ('Owner', 'Manager'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    memberships = db.query(UserTenant).filter(UserTenant.tenant_id == membership.tenant_id).all()
    result = []
    for m in memberships:
        u = db.query(User).filter(
            User.id == m.user_id,
            User.is_super_admin == False,   # Never expose SuperAdmin
        ).first()
        if not u:
            continue
        # Managers can only see Cashiers in their branch
        if membership.role == 'Manager':
            if m.role not in ('Cashier',):
                continue
            if membership.branch_id and m.branch_id != membership.branch_id:
                continue
        result.append({
            'id': u.id,
            'email': u.email,
            'role': m.role,
            'assigned_name': m.assigned_name or '',
            'branch_id': m.branch_id,
            'is_active': u.is_active,
            'created_at': u.created_at.isoformat(),
        })
    return result


@router.post('/auth/users', status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Owner (or Manager) adds a staff member — Manager or Cashier only.
    The new user is automatically bound to the caller's tenant + a specific branch.
    """
    caller_membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not caller_membership or caller_membership.role not in ('Owner', 'Manager'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    # Enforce: staff roles only — Owners cannot be created here
    # Manager can only create Cashiers; Owner can create Manager or Cashier
    caller_role = caller_membership.role
    if caller_role == 'Manager':
        if payload.role != 'Cashier':
            raise HTTPException(status_code=400, detail='Managers can only add Cashiers')
    elif caller_role == 'Owner':
        valid_roles = ('Manager', 'Cashier')
        if payload.role not in valid_roles:
            raise HTTPException(status_code=400, detail='Only Manager or Cashier roles can be assigned here')
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail='Email already in use')

    # Branch must belong to the same tenant
    from app.models import Branch
    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id,
        Branch.tenant_id == caller_membership.tenant_id,
    ).first()
    if not branch:
        raise HTTPException(status_code=400, detail='Branch not found in your company')

    # Single transaction: user + membership
    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_super_admin=False,
    )
    db.add(new_user)
    db.flush()

    membership = UserTenant(
        user_id=new_user.id,
        tenant_id=caller_membership.tenant_id,
        role=payload.role,
        assigned_name=payload.assigned_name or payload.email.split('@')[0],
        branch_id=payload.branch_id,
    )
    db.add(membership)
    db.commit()
    db.refresh(new_user)

    push_notification(
        db, caller_membership.tenant_id, 'user',
        f'New staff added: {new_user.email}',
        f'Role: {payload.role} · Branch: {branch.name}. Added by {current_user.email}.',
        user_id=current_user.id,
        branch_id=payload.branch_id,   # visible to Manager of that branch + Owner
    )
    db.commit()

    return {
        'id': new_user.id,
        'email': new_user.email,
        'role': payload.role,
        'assigned_name': membership.assigned_name,
        'branch_id': membership.branch_id,
        'is_active': new_user.is_active,
        'created_at': new_user.created_at.isoformat(),
    }


@router.post('/auth/users/change-password')
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caller_membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not caller_membership or caller_membership.role not in ('Owner', 'Manager'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')

    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail='User not found')

    target.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {'status': 'ok', 'message': 'Password updated'}


@router.patch('/auth/users/{user_id}/toggle-active')
def toggle_user_active(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caller_membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not caller_membership or caller_membership.role != 'Owner':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Owner only')

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail='User not found')
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail='Cannot deactivate yourself')

    target.is_active = not target.is_active
    db.commit()
    return {'id': target.id, 'is_active': target.is_active}


class RoleChangeRequest(BaseModel):
    role: str


@router.post('/auth/users/{user_id}/role')
def set_user_role(
    user_id: int,
    payload: RoleChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caller_membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not caller_membership or caller_membership.role != 'Owner':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Owner only')

    valid_roles = ('Manager', 'Cashier')
    if payload.role not in valid_roles:
        raise HTTPException(status_code=400, detail='Only Manager or Cashier roles can be assigned')

    target_membership = db.query(UserTenant).filter(
        UserTenant.user_id == user_id,
        UserTenant.tenant_id == caller_membership.tenant_id,
    ).first()
    if not target_membership:
        raise HTTPException(status_code=404, detail='User not found in your company')
    if target_membership.user_id == current_user.id:
        raise HTTPException(status_code=400, detail='Cannot change your own role')

    old_role = target_membership.role
    target_membership.role = payload.role
    push_notification(
        db, caller_membership.tenant_id, 'user',
        f'Role changed: user #{user_id}',
        f'{old_role} → {payload.role} by {current_user.email}.',
        user_id=current_user.id,
    )
    db.commit()
    return {'id': user_id, 'role': payload.role}


@router.delete('/auth/users/{user_id}')
def remove_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner removes a staff member from their company. Deletes user if no other memberships."""
    caller_membership = db.query(UserTenant).filter(UserTenant.user_id == current_user.id).first()
    if not caller_membership or caller_membership.role != 'Owner':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Owner only')

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail='Cannot remove yourself')

    membership = db.query(UserTenant).filter(
        UserTenant.user_id == user_id,
        UserTenant.tenant_id == caller_membership.tenant_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail='User not found in your company')

    target_user = db.query(User).filter(User.id == user_id).first()
    email_snapshot = target_user.email if target_user else f'user#{user_id}'

    db.delete(membership)
    db.flush()

    # Only delete the account if they have no other company memberships
    remaining = db.query(UserTenant).filter(UserTenant.user_id == user_id).count()
    if remaining == 0 and target_user:
        db.delete(target_user)

    push_notification(
        db, caller_membership.tenant_id, 'user',
        f'Staff removed: {email_snapshot}',
        f'Removed by {current_user.email}.',
        user_id=current_user.id,
    )
    db.commit()
    return {'status': 'removed', 'user_id': user_id}


# ── Tenant switch (multi-tenant users) ────────────────────────
@router.post('/auth/switch-tenant', response_model=AuthResponse)
def switch_tenant(
    request_data: SwitchTenantRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.query(UserTenant).filter(
        UserTenant.user_id == current_user.id,
        UserTenant.tenant_id == request_data.tenant_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Tenant access denied')

    token_payload = {
        'sub': current_user.id,
        'tenant_id': membership.tenant_id,
        'role': membership.role,
        'branch_id': membership.branch_id,
        'is_super_admin': False,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    set_auth_cookies(response, access_token, refresh_token)

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
    return build_auth_response(current_user, tenant, role=membership.role, branch_id=membership.branch_id)
