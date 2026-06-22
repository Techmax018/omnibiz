from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_tenant, get_current_user, get_db, RoleChecker, get_current_token_data
from app.models import BusinessAccount, TransactionLedger, UserTenant, Branch, SaleInvoice, InventoryItem, CustomerAccount
from app.schemas import BusinessAccountCreate
from app.services.notifications import push_notification

router = APIRouter()


def serialize_account(account: BusinessAccount) -> dict:
    return {
        'id': account.id,
        'tenant_id': account.tenant_id,
        'name': account.name,
        'owner': account.owner,
        'email': account.email,
        'created_at': account.created_at.isoformat() if account.created_at else None,
    }


@router.get('/api/accounts')
def list_accounts(current_tenant=Depends(get_current_tenant), db: Session = Depends(get_db)):
    accounts = (
        db.query(BusinessAccount)
        .filter(BusinessAccount.tenant_id == current_tenant.id)
        .order_by(BusinessAccount.id)
        .all()
    )
    return [serialize_account(account) for account in accounts]


@router.post('/api/accounts')
def create_account(
    account: BusinessAccountCreate,
    current_tenant=Depends(get_current_tenant),
    role=Depends(RoleChecker(['Owner'])),
    db: Session = Depends(get_db),
):
    new_account = BusinessAccount(
        tenant_id=current_tenant.id,
        name=account.name,
        owner=account.owner,
        email=account.email,
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    push_notification(db, current_tenant.id, 'account',
        f'New account created: {new_account.name}',
        f'Owner: {new_account.owner}')
    db.commit()
    return serialize_account(new_account)


# ── Owner-level global dashboard ─────────────────────────────
@router.get('/api/dashboard')
def get_dashboard(
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    # Owners see all branches; Managers/Cashiers see their branch only
    branch_filter = []
    if token_data.role in ('Manager', 'Cashier') and token_data.branch_id:
        branch_filter = [TransactionLedger.entity_id == str(token_data.branch_id)]

    ledger_q = db.query(TransactionLedger).filter(TransactionLedger.tenant_id == current_tenant.id)
    if branch_filter:
        # For branch-scoped roles use branch-scoped invoice data
        invoices_q = db.query(SaleInvoice).filter(
            SaleInvoice.tenant_id == current_tenant.id,
            SaleInvoice.branch_id == token_data.branch_id,
        )
        accounts = db.query(CustomerAccount).filter(
            CustomerAccount.tenant_id == current_tenant.id,
            CustomerAccount.branch_id == token_data.branch_id,
        ).all()
    else:
        invoices_q = db.query(SaleInvoice).filter(SaleInvoice.tenant_id == current_tenant.id)
        accounts = db.query(BusinessAccount).filter(BusinessAccount.tenant_id == current_tenant.id).all()

    opportunities = ledger_q.all()
    invoices = invoices_q.all()

    total_revenue = sum(float(i.total_amount) for i in invoices)
    total_paid = sum(float(i.paid_amount) for i in invoices)
    open_invoices = sum(1 for i in invoices if i.status != 'paid')
    pending_orders = sum(1 for e in opportunities if e.action_type == 'sale' and e.is_correction)

    # Build branch list for Owner
    branches = []
    if token_data.role == 'Owner':
        branches = [{'id': b.id, 'name': b.name, 'county': b.county} for b in
                    db.query(Branch).filter(Branch.tenant_id == current_tenant.id).all()]

    recent = sorted(opportunities, key=lambda x: x.timestamp, reverse=True)[:8]

    return {
        'role': token_data.role,
        'branch_id': token_data.branch_id,
        'branches': branches,
        'company': {
            'name': current_tenant.name,
            'week_revenue': f'KES {total_revenue:,.2f}',
        },
        'stats': [
            {'title': 'Total Revenue', 'value': f'KES {total_revenue:,.2f}', 'detail': 'Across all sales'},
            {'title': 'Collected', 'value': f'KES {total_paid:,.2f}', 'detail': 'Paid invoices'},
            {'title': 'Open Invoices', 'value': str(open_invoices), 'detail': 'Awaiting payment'},
            {'title': 'Active Accounts', 'value': str(len(accounts)), 'detail': 'Customers / accounts'},
        ],
        'recent_orders': [
            {
                'id': item.id,
                'client': item.entity,
                'status': 'Completed' if item.action_type == 'sale' else 'Invoiced',
                'amount': f'KES {float(item.amount):,.2f}',
                'date': item.timestamp.strftime('%Y-%m-%d'),
            }
            for item in recent
        ],
        'customers': [], 'invoices': [], 'reports': [], 'sales': [],
    }


# ── Branch-scoped dashboard (Manager/Cashier) ─────────────────
@router.get('/api/dashboard/branch/{branch_id}')
def get_branch_dashboard(
    branch_id: int,
    current_user=Depends(get_current_user),
    current_tenant=Depends(get_current_tenant),
    token_data=Depends(get_current_token_data),
    db: Session = Depends(get_db),
):
    # Restrict non-owners to their own branch
    if token_data.role != 'Owner' and token_data.branch_id != branch_id:
        raise HTTPException(status_code=403, detail='Access restricted to your assigned branch')

    invoices = db.query(SaleInvoice).filter(
        SaleInvoice.tenant_id == current_tenant.id,
        SaleInvoice.branch_id == branch_id,
    ).all()

    inventory = db.query(InventoryItem).filter(
        InventoryItem.tenant_id == current_tenant.id,
        InventoryItem.branch_id == branch_id,
    ).all()

    customers = db.query(CustomerAccount).filter(
        CustomerAccount.tenant_id == current_tenant.id,
        CustomerAccount.branch_id == branch_id,
    ).all()

    total_revenue = sum(float(i.total_amount) for i in invoices)
    total_paid = sum(float(i.paid_amount) for i in invoices)
    low_stock = sum(1 for inv in inventory if inv.reorder_level > 0 and inv.quantity_on_hand <= inv.reorder_level)

    return {
        'branch_id': branch_id,
        'total_revenue': total_revenue,
        'total_paid': total_paid,
        'open_invoices': sum(1 for i in invoices if i.status != 'paid'),
        'low_stock_count': low_stock,
        'customer_count': len(customers),
        'recent_invoices': [
            {
                'invoice_number': i.invoice_number,
                'total_amount': float(i.total_amount),
                'outstanding_amount': float(i.outstanding_amount),
                'status': i.status,
                'created_at': i.created_at.isoformat(),
            }
            for i in sorted(invoices, key=lambda x: x.created_at, reverse=True)[:10]
        ],
    }
