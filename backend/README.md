# OmniBiz Backend — FastAPI

Python 3.11 REST API powering the OmniBiz platform.

## Stack

- **FastAPI** 0.115 — async web framework
- **SQLAlchemy** 1.4 — ORM (sync sessions)
- **Pydantic v2** — request/response validation
- **python-jose** — JWT token creation/verification
- **passlib + bcrypt** — password hashing
- **psycopg2-binary** — PostgreSQL driver
- **Uvicorn** — ASGI server

## Local Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file (see `.env.example`):

```env
DATABASE_URL=sqlite:///./busihub.db
SECRET_KEY=your-secret-key
API_ORIGINS=["http://localhost:5173"]
USE_SECURE_COOKIES=false
COOKIE_SAMESITE=lax
```

Run:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Authentication Flow

1. `POST /auth/login` — validates credentials, sets two `HttpOnly` cookies:
   - `omnibiz_access` (15 min JWT)
   - `omnibiz_refresh` (7 day JWT)
2. Every protected route reads `omnibiz_access` cookie via `get_token_from_cookie`
3. When access token expires, `POST /auth/refresh` issues a new pair
4. `POST /auth/logout` deletes both cookies

## Dependency Injection

Key deps in `app/deps.py`:

```python
get_db()                # SQLAlchemy session
get_current_user()      # Loads User from token sub
get_current_tenant()    # Loads Tenant from token tenant_id
get_current_membership()# Full UserTenant row (role + branch_id)
get_current_token_data()# Raw TokenPayload
RoleChecker([...])      # Blocks if role not in list
SuperAdminChecker()     # Blocks if not is_super_admin
branch_scope_check()    # Managers/Cashiers locked to their branch
```

## Database Migrations

Tables are created automatically on startup via:

```python
Base.metadata.create_all(bind=engine)
```

For the production Neon database, run migrations manually:

```python
DATABASE_URL="postgresql://..." python3 -c "
from app.db.base import Base
from app.db.session import engine
import app.models
Base.metadata.create_all(bind=engine)
"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./busihub.db` | Database connection string |
| `SECRET_KEY` | `change-me` | JWT signing key |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token TTL |
| `API_ORIGINS` | `["http://localhost:5173"]` | CORS allowed origins |
| `USE_SECURE_COOKIES` | `false` | Set `true` in production (HTTPS) |
| `COOKIE_SAMESITE` | `lax` | Set `none` for cross-origin (Vercel → Render) |
