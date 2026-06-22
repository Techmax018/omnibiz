from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Platform-level Super Admin flag — not tied to any tenant
    is_super_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    memberships = relationship('UserTenant', back_populates='user', cascade='all, delete-orphan')

    def has_role_for_tenant(self, tenant_id: int, role: str) -> bool:
        return any(
            membership.tenant_id == tenant_id and membership.role == role
            for membership in self.memberships
        )
