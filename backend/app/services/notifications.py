"""
push_notification() — call from any route to create a scoped notification.

Scoping rules (enforced at query time in the routes layer):
  - Owner     → sees all notifications for their tenant
  - Manager   → sees tenant-wide + their branch notifications (branch_id match or NULL)
  - Cashier   → sees only notifications where user_id == themselves

branch_id should be passed whenever the action is branch-specific
(sales, stock, transfers, clock-in/out, customer ops).
Leave it None for tenant-wide events (user management, company setup, logins).
"""
from sqlalchemy.orm import Session
from app.models import AppNotification


def push_notification(
    db: Session,
    tenant_id: int,
    category: str,
    title: str,
    body: str = '',
    user_id: int = None,
    branch_id: int = None,
) -> AppNotification:
    notif = AppNotification(
        tenant_id=tenant_id,
        user_id=user_id,
        branch_id=branch_id,
        category=category,
        title=title,
        body=body,
        is_read=False,
    )
    db.add(notif)
    # caller is responsible for db.commit()
    return notif
