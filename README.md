# OmniBiz — Multi-Tenant Business Intelligence Platform

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://omnibiz-blnp.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-blue?logo=render)](https://omnibiz-2ldo.onrender.com)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-teal?logo=postgresql)](https://neon.tech)

OmniBiz is a complete multi-tenant business management system built for retail, wholesale, and service operations across East Africa. It covers point of sale, inventory, HR, finance, CRM, and compliance — all in one platform.

---

## Live Demo

| Service | URL |
|---------|-----|
| Frontend | https://omnibiz-blnp.vercel.app |
| Backend API | https://omnibiz-2ldo.onrender.com/docs |

**Default SuperAdmin credentials:**
- Email: `admin@example.com`
- Password: `admin123`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router v7 |
| Backend | FastAPI (Python 3.11), Uvicorn |
| Database | SQLAlchemy 1.4 + Neon PostgreSQL (production) / SQLite (dev) |
| Auth | HTTP-only cookies, JWT (python-jose), bcrypt |
| Hosting | Vercel (frontend) + Render (backend) |
| PDF Export | jsPDF (lazy-loaded) |
| Offline | IndexedDB via custom `useOfflineSync` hook |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OmniBiz Platform                      │
│                                                          │
│  ┌──────────────┐        ┌──────────────────────────┐   │
│  │   Vercel     │ HTTPS  │       Render             │   │
│  │  React SPA   │◄──────►│   FastAPI Backend        │   │
│  │              │ cookies│   (Python 3.11)          │   │
│  └──────────────┘        └────────────┬─────────────┘   │
│                                       │ PostgreSQL       │
│                                       ▼                  │
│                          ┌──────────────────────────┐   │
│                          │    Neon.tech              │   │
│                          │    PostgreSQL 18          │   │
│                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Role Hierarchy

```
SuperAdmin (platform-level)
    └── Creates Business Owners + their Company Tenants
            └── Owner (company-level, all branches)
                    ├── Creates Managers (branch-scoped)
                    │       └── Manager creates Cashiers
                    └── Creates Cashiers directly
```

### Role Permissions

| Feature | SuperAdmin | Owner | Manager | Cashier |
|---------|-----------|-------|---------|---------|
| Create business owners | ✅ | ❌ | ❌ | ❌ |
| View all companies | ✅ | ❌ | ❌ | ❌ |
| Add Managers | ❌ | ✅ | ❌ | ❌ |
| Add Cashiers | ❌ | ✅ | ✅ | ❌ |
| View all branches | ❌ | ✅ | ❌ | ❌ |
| Branch analytics | ❌ | ✅ | ✅ (own) | ❌ |
| POS / Sales | ❌ | ✅ | ✅ | ✅ |
| Inventory management | ❌ | ✅ | ✅ | Request only |
| Finance / Ledger | ❌ | ✅ | ❌ | ❌ |
| Approve product requests | ❌ | ✅ | ✅ | ❌ |
| Approve shift submissions | ❌ | ✅ | ✅ | ❌ |
| Submit shift | ❌ | ❌ | ❌ | ✅ |

---

## Project Structure

```
omnibiz/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py       # Settings (env vars, cookie config)
│   │   │   └── middleware.py   # Business/branch context middleware
│   │   ├── db/
│   │   │   ├── base.py         # SQLAlchemy Base
│   │   │   └── session.py      # DB engine + session factory
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── tenant.py
│   │   │   ├── user_tenant.py  # Role membership join table
│   │   │   ├── branch.py
│   │   │   ├── product.py
│   │   │   ├── product_request.py  # Cashier → approval workflow
│   │   │   ├── inventory.py
│   │   │   ├── sale.py
│   │   │   ├── customer.py
│   │   │   ├── employee.py     # Includes shift submissions
│   │   │   ├── ledger.py
│   │   │   ├── notification.py
│   │   │   └── business.py
│   │   ├── routes/
│   │   │   ├── auth.py         # Login, user provisioning, RBAC
│   │   │   ├── dashboard.py    # Business/branch dashboards
│   │   │   ├── inventory.py    # Products CRUD + stock transfer
│   │   │   ├── retail.py       # POS sales + invoice creation
│   │   │   ├── finance.py      # Ledger, balance sheet, VAT, payments
│   │   │   ├── hrm.py          # Employees, shifts, performance
│   │   │   ├── customers.py    # CRM + store credit
│   │   │   ├── product_requests.py  # Approval workflow
│   │   │   ├── notifications.py     # Role-scoped notifications
│   │   │   ├── setup.py        # Onboarding, branches
│   │   │   └── transactions.py # Legacy ledger entries
│   │   ├── services/
│   │   │   ├── retail.py       # Full invoice creation service
│   │   │   ├── notifications.py # push_notification() helper
│   │   │   └── etims.py        # KRA eTIMS compliance
│   │   ├── auth.py             # JWT + bcrypt helpers
│   │   ├── deps.py             # FastAPI dependency injection
│   │   └── schemas.py          # Pydantic request/response models
│   ├── main.py                 # App entry point
│   ├── requirements.txt
│   ├── Procfile                # Render start command
│   ├── runtime.txt             # Python 3.11.9
│   └── .env.example            # Environment variable template
│
├── business-system-frontend/   # React + Vite frontend
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js       # Central fetch wrapper (401 handling)
│   │   │   ├── auth.js         # Login/refresh/me calls
│   │   │   ├── modules.js      # All module API calls
│   │   │   └── config.js       # API_BASE from env
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # Auth state + role-based routing
│   │   │   └── NotificationsContext.jsx  # Real-time notifications
│   │   ├── components/
│   │   │   ├── Dashboard.jsx        # Owner/Manager shell
│   │   │   ├── CashierPOS.jsx       # Cashier dedicated POS shell
│   │   │   ├── SuperAdminDashboard.jsx  # Platform management
│   │   │   ├── ProtectedRoute.jsx   # Role-aware route guard
│   │   │   ├── OnboardingWizard.jsx # First-time setup flow
│   │   │   ├── dashboards/
│   │   │   │   ├── OwnerDashboard.jsx    # All-branch overview
│   │   │   │   ├── ManagerDashboard.jsx  # Branch-scoped analytics
│   │   │   │   └── CashierDashboard.jsx  # Supermarket-style POS
│   │   │   └── modules/
│   │   │       ├── InventoryModule.jsx
│   │   │       ├── CRMModule.jsx
│   │   │       ├── HRMModule.jsx
│   │   │       ├── FinanceModule.jsx
│   │   │       ├── UserManagement.jsx
│   │   │       └── NotificationsLog.jsx
│   │   ├── config/
│   │   │   └── navConfig.js    # Role-based sidebar navigation
│   │   ├── hooks/
│   │   │   └── useOfflineSync.jsx  # IndexedDB offline queue
│   │   ├── lib/
│   │   │   ├── pdfExport.js    # jsPDF export functions
│   │   │   └── offlineStorage.js   # IndexedDB helpers
│   │   └── pages/
│   │       └── LoginPage.jsx
│   ├── vercel.json             # Vercel deployment config
│   └── .env.production         # VITE_API_BASE for production
│
├── vercel.json                 # Root Vercel build config
├── package.json                # npm run dev (concurrent start)
└── .gitignore
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### Setup

```bash
# 1. Clone
git clone https://github.com/Techmax018/omnibiz.git
cd omnibiz

# 2. Backend virtual environment
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Frontend dependencies
cd business-system-frontend
npm install
cd ..

# 4. Install root dev dependency
npm install
```

### Running locally

```bash
# Start both frontend and backend simultaneously
npm run dev
```

This runs:
- **Backend** → `http://localhost:8000` (FastAPI + auto-reload)
- **Frontend** → `http://localhost:5173` (Vite dev server)

### Individual commands

```bash
npm run backend    # FastAPI only
npm run frontend   # Vite only
npm run build      # Production build (frontend)
```

### Backend environment (local)

Create `backend/.env`:

```env
DATABASE_URL=sqlite:///./busihub.db
SECRET_KEY=your-local-secret-key
API_ORIGINS=["http://localhost:5173"]
USE_SECURE_COOKIES=false
COOKIE_SAMESITE=lax
```

---

## API Reference

Base URL: `https://omnibiz-2ldo.onrender.com`

Interactive docs: `https://omnibiz-2ldo.onrender.com/docs`

### Authentication

All endpoints use HTTP-only cookie authentication. Cookies are set on login and automatically sent with every request via `credentials: 'include'`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | None | Login — returns user + tenant, sets cookies |
| `POST` | `/auth/refresh` | Refresh cookie | Refresh access token |
| `GET` | `/auth/me` | Access cookie | Get current user |
| `POST` | `/auth/logout` | None | Clear cookies |

### User Management

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/auth/users` | Owner, Manager | List staff in company |
| `POST` | `/auth/users` | Owner, Manager | Create Manager or Cashier |
| `POST` | `/auth/users/change-password` | Owner, Manager | Change staff password |
| `PATCH` | `/auth/users/{id}/toggle-active` | Owner | Enable/disable account |
| `DELETE` | `/auth/users/{id}` | Owner | Remove staff member |

### SuperAdmin

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/owners` | SuperAdmin | List all business owners |
| `POST` | `/api/admin/owners` | SuperAdmin | Provision owner + company |
| `PATCH` | `/api/admin/owners/{id}/toggle-active` | SuperAdmin | Suspend/reinstate owner |
| `DELETE` | `/api/admin/owners/{id}` | SuperAdmin | Delete owner + company |

### Inventory

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/api/inventory/products` | All | List products with stock levels |
| `POST` | `/api/inventory/products` | Owner, Manager | Create product |
| `PUT` | `/api/inventory/products/{id}` | Owner, Manager | Update product / adjust stock |
| `GET` | `/api/inventory/low-stock` | All | Products below reorder level |
| `POST` | `/api/inventory/transfer` | Owner, Manager | Transfer stock between branches |

### Product Requests (Approval Workflow)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/product-requests` | Cashier+ | Submit product addition request |
| `GET` | `/api/product-requests` | Owner, Manager | List requests (scoped by branch) |
| `GET` | `/api/product-requests/mine` | Any | Cashier's own requests |
| `POST` | `/api/product-requests/{id}/approve` | Owner, Manager | Approve → creates product |
| `POST` | `/api/product-requests/{id}/reject` | Owner, Manager | Reject with reason |

### Shifts

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/shifts/submit` | Any | Submit shift for review |
| `GET` | `/api/shifts` | All | List shifts (role-scoped) |
| `POST` | `/api/shifts/{id}/approve` | Owner, Manager | Approve shift |
| `POST` | `/api/shifts/{id}/reject` | Owner, Manager | Reject with reason |

### Finance

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/api/finance/ledger` | All | Transaction ledger |
| `GET` | `/api/finance/balance-sheet` | All | Assets + P&L snapshot |
| `GET` | `/api/finance/tax-report` | All | VAT breakdown by KRA category |
| `POST` | `/api/finance/payments` | Owner, Manager | Record invoice payment |
| `GET` | `/api/finance/analytics` | All | 30-day revenue + invoice stats |

---

## Database Schema

### Core Tables

```
users               — System accounts (all roles including SuperAdmin)
tenants             — Companies / business entities
user_tenants        — Role membership (user ↔ tenant, role, branch)
branches            — Physical locations within a tenant

products            — Product catalogue (per branch)
inventory_items     — Stock levels (per product per branch)
product_requests    — Cashier product addition requests (pending approval)

sale_invoices       — Full POS invoices
sale_line_items     — Individual line items per invoice
transaction_ledger  — Audit trail for all financial events

customer_accounts   — CRM profiles
customer_ledger_entries — Customer balance history

employees           — Staff profiles
employee_shifts     — Shift records (submitted by cashiers, reviewed by managers)

app_notifications   — Role + branch scoped notification feed
business_accounts   — Named financial sub-accounts
```

---

## Deployment

### Environment Variables

#### Render (Backend)

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From Neon.tech |
| `SECRET_KEY` | Random 64-char string | Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `USE_SECURE_COOKIES` | `true` | Required for HTTPS |
| `COOKIE_SAMESITE` | `none` | Required for cross-origin (Vercel → Render) |
| `API_ORIGINS` | `["https://your-app.vercel.app"]` | Exact Vercel URL |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |

#### Vercel (Frontend)

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://your-service.onrender.com` |

### Deploy Steps

1. **Database** — Create free PostgreSQL on [neon.tech](https://neon.tech)
2. **Backend** — Connect repo to [render.com](https://render.com), set root dir to `backend`, add env vars
3. **Frontend** — Connect repo to [vercel.com](https://vercel.com), add `VITE_API_BASE` env var
4. **Update CORS** — After Vercel gives you the URL, update `API_ORIGINS` in Render

> **Critical:** `COOKIE_SAMESITE=none` + `USE_SECURE_COOKIES=true` must both be set on Render for cross-origin authentication to work.

---

## Key Features

### Point of Sale (Cashier)
- Supermarket-style product grid with search and category filters
- Touch-friendly product tiles with live stock counts
- Cart management with quantity controls and stock validation
- Multiple payment methods: Cash, M-Pesa, Card, Bank Transfer
- Receipt generation with change calculation
- Offline mode — sales queued to IndexedDB and synced on reconnect
- `/` keyboard shortcut focuses product search

### Product Request Workflow
- Cashiers submit new product addition requests
- Manager/Owner review queue with approve/reject + note
- On approval, product and inventory record created atomically
- Notifications sent to relevant branch staff

### Shift Management
- Cashiers submit shift records (name, clock-in, clock-out)
- Manager/Owner approves or rejects with a note
- Shift history visible per user
- Approved shifts count toward performance metrics

### Notifications
- Real-time polling every 30 seconds
- Role-scoped: Owner sees all, Manager sees branch + tenant-wide, Cashier sees own actions only
- Branch-tagged events (sales, stock, transfers) route to correct managers
- Dismissable from dropdown (persists in full log)

### PDF Exports
- Dashboard overview, branch report, inventory, finance, customers, employees
- Lazy-loaded jsPDF — doesn't bloat initial bundle
- OmniBiz branded with header, footer, page numbers

### Multi-Tenant Security
- Every DB query is tenant-scoped
- JWT carries `tenant_id`, `role`, `branch_id`
- `branch_scope_check()` enforces Manager/Cashier can't access other branches
- SuperAdmin cannot access any tenant's data
- Session expires in 15 minutes; silent refresh via `HttpOnly` cookie

---

## Author

**MaxDevs / Techmax018**  
Powered by [UnderworldTech](https://underworld-tech.vercel.app/)
