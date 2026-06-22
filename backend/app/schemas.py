from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TenantData(BaseModel):
    id: int
    name: str
    description: Optional[str] = None


class UserData(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    is_super_admin: bool = False
    created_at: datetime
    role: Optional[str] = None
    branch_id: Optional[int] = None


class AuthResponse(BaseModel):
    user: UserData
    # Tenant is null for SuperAdmin — they operate platform-wide
    tenant: Optional[TenantData] = None


class SwitchTenantRequest(BaseModel):
    tenant_id: int = Field(..., alias='tenant_id')


class BusinessAccountCreate(BaseModel):
    name: str
    owner: str
    email: Optional[EmailStr] = None


class TokenPayload(BaseModel):
    sub: int
    # tenant_id is 0 (sentinel) for SuperAdmin who has no tenant
    tenant_id: int = 0
    role: str = 'SuperAdmin'
    is_super_admin: bool = False
    business_id: Optional[int] = None
    branch_id: Optional[int] = None
    exp: int
    purpose: str


# ── Super Admin provisioning schemas ─────────────────────────
class ProvisionOwnerRequest(BaseModel):
    """SuperAdmin creates a Business Owner together with their company tenant."""
    owner_email: EmailStr
    owner_password: str
    owner_name: str
    company_name: str
    company_description: Optional[str] = None


class BusinessBranchContext(BaseModel):
    business_id: int
    branch_id: int


class SaleLineItemPayload(BaseModel):
    product_id: int
    description: Optional[str] = None
    quantity: float
    unit_price: float
    item_code: Optional[str] = None
    hs_code: Optional[str] = None
    vat_rate: str = 'B-16%'


class SaleCreateRequest(BaseModel):
    customer_id: Optional[int] = None
    payment_amount: float
    items: List[SaleLineItemPayload]


class SaleCreateResponse(BaseModel):
    invoice_id: int
    invoice_number: str
    total_amount: float
    outstanding_amount: float
    etims_status: str
