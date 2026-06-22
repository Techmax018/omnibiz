from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_tenant, get_current_user, get_db, get_current_token_data
from app.models import AppNotification

router = APIRouter()


def serialize(n: AppNotification) -> dict:
    return {
        'id': n.id,
        'category': n.category,
        'title': n.title,
        'body': n.body or '',
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
    }


def _scoped_query(db: Session, token_data, tenant_id: int):
    """
    Returns a SQLAlchemy query filtered by the caller's role:

    Owner   → all notifications for the tenant (full visibility)
    Manager → tenant notifications for their branch, plus tenant-wide ones
              (branch_id == their branch OR branch_id IS NULL)
    Cashier → only notifications they personally triggered
    """
    q = db.query(AppNotification).filter(AppNotification.tenant_id == tenant_id)

    if token_data.role == 'Owner':
        # No further filter — owners see everything
        pass
    elif token_data.role == 'Manager':
        if token_data.branch_id:
            # Their branch OR tenant-wide events (branch_id is NULL)
            q = q.filter(
                (AppNotification.branch_id == token_data.branch_id) |
                (AppNotification.branch_id == None)
            )
    else:
        # Cashier — only their own actions
        q = q.filter(AppNotification.user_id == token_data.sub)

    return q


@router.get('/api/notifications')
def get_notifications(
    limit: int = 50,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    items = (
        _scoped_query(db, token_data, current_tenant.id)
        .order_by(AppNotification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [serialize(n) for n in items]


@router.get('/api/notifications/unread-count')
def unread_count(
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    count = (
        _scoped_query(db, token_data, current_tenant.id)
        .filter(AppNotification.is_read == False)
        .count()
    )
    return {'count': count}


@router.post('/api/notifications/{notif_id}/read')
def mark_read(
    notif_id: int,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    # Scoped so a Cashier can't mark someone else's notification as read
    n = (
        _scoped_query(db, token_data, current_tenant.id)
        .filter(AppNotification.id == notif_id)
        .first()
    )
    if n:
        n.is_read = True
        db.commit()
    return {'status': 'ok'}


@router.post('/api/notifications/read-all')
def mark_all_read(
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    (
        _scoped_query(db, token_data, current_tenant.id)
        .filter(AppNotification.is_read == False)
        .update({'is_read': True}, synchronize_session=False)
    )
    db.commit()
    return {'status': 'ok'}
