from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional

from app.auth import verify_token
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Tenant, User, UserTenant
from app.schemas import BusinessBranchContext, TokenPayload


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get(settings.TOKEN_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required',
        )
    return token


def get_current_token_data(token: str = Depends(get_token_from_cookie)) -> TokenPayload:
    payload = verify_token(token, expected_purpose='access')
    return TokenPayload(**payload)


def get_current_user(token_data: TokenPayload = Depends(get_current_token_data), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Inactive or missing user',
        )
    return user


def get_current_tenant(token_data: TokenPayload = Depends(get_current_token_data), db: Session = Depends(get_db)) -> Tenant:
    # SuperAdmin has no tenant — reject calls that require one
    if token_data.is_super_admin or token_data.tenant_id == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Super Admin does not operate within a tenant context',
        )
    membership = (
        db.query(UserTenant)
        .filter(UserTenant.user_id == token_data.sub, UserTenant.tenant_id == token_data.tenant_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Tenant access prohibited',
        )
    tenant = db.query(Tenant).filter(Tenant.id == token_data.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tenant not found')
    return tenant


def get_current_membership(
    token_data: TokenPayload = Depends(get_current_token_data),
    db: Session = Depends(get_db),
) -> UserTenant:
    """Returns the full UserTenant row for the current request — role + branch_id."""
    membership = (
        db.query(UserTenant)
        .filter(UserTenant.user_id == token_data.sub, UserTenant.tenant_id == token_data.tenant_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Tenant access prohibited')
    return membership


def get_business_branch_context(
    request: Request,
    token_data: TokenPayload = Depends(get_current_token_data),
) -> BusinessBranchContext:
    business_id = request.state.business_id or token_data.business_id or token_data.tenant_id
    branch_id = request.state.branch_id or token_data.branch_id
    if not business_id or not branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Business and branch context required',
        )
    if token_data.tenant_id != business_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Token tenant does not match business context',
        )
    return BusinessBranchContext(business_id=business_id, branch_id=branch_id)


class RoleChecker:
    """Dependency that blocks access unless the caller's role is in allowed_roles."""
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, token_data: TokenPayload = Depends(get_current_token_data)) -> TokenPayload:
        if token_data.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f'Access restricted to: {", ".join(self.allowed_roles)}',
            )
        return token_data


class SuperAdminChecker:
    """Blocks access unless the caller is the platform Super Admin."""
    def __call__(
        self,
        token_data: TokenPayload = Depends(get_current_token_data),
        db: Session = Depends(get_db),
    ) -> TokenPayload:
        if not token_data.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Super Admin access required',
            )
        # Double-check the DB flag so tokens cannot be forged
        user = db.query(User).filter(User.id == token_data.sub).first()
        if not user or not user.is_super_admin or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Super Admin access required',
            )
        return token_data


# Convenience aliases
require_super_admin = SuperAdminChecker()
require_owner       = RoleChecker(['Owner'])
require_manager     = RoleChecker(['Owner', 'Manager'])
require_cashier     = RoleChecker(['Owner', 'Manager', 'Cashier'])  # any tenant role


def branch_scope_check(token_data: TokenPayload, target_branch_id: int) -> None:
    """
    Managers and Cashiers can only access their assigned branch_id.
    Owners can access any branch (branch_id == None in token means no restriction).
    """
    if token_data.role == 'Owner':
        return  # owners see everything
    if token_data.branch_id and token_data.branch_id != target_branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Access denied: not your assigned branch',
        )
