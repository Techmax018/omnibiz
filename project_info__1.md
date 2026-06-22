# Complete Auth 401 Diagnosis & Action Plan

## What Has Been Fixed (on disk, in code files)

### Files changed (all correct, verified):

| File | Change | Status |
|------|--------|--------|
| `business-system-frontend/.env` | `VITE_API_BASE=http://127.0.0.1:8000` → `http://localhost:8000` | ✅ Saved |
| `backend/app/auth.py` | `create_access_token`/`create_refresh_token`: convert `sub` to `str` before encoding | ✅ Saved |
| `backend/app/auth.py` | `verify_token`: convert `sub` back to `int` after decoding | ✅ Saved |
| `backend/app/models/tenant.py` | Added `branches = relationship('Branch', back_populates='tenant')` | ✅ Saved |
| `backend/app/routes/auth.py` | Added `verify_token` to import line | ✅ Saved |

### Verifications performed (in earlier session):
- ✅ JWT `str`→`int` round-trip: correct (`{'sub': 1, 'tenant_id': 1, ...}`)  
- ✅ Server starts without ORM crash (the SQLAlchemy `Tenant.branches` error is gone)

## Why You Still See 401s — Three Remaining Causes

### Cause 1: Frontend Vite dev server hasn't reloaded the `.env` file
Vite caches environment variables **at startup**. The `.env` change from `127.0.0.1` to `localhost` hasn't taken effect because Vite still has the old value.  

**Fix (requires Act Mode):** Restart the Vite dev server:
```bash
# Find and kill the old vite process:
pkill -f vite

# Then restart:
cd business-system-frontend && npm run dev
```

### Cause 2: Stale cookies in the browser
Your browser has cookies set for `127.0.0.1:8000`. Now the frontend calls `localhost:8000` — the browser treats these as **different sites** and won't send the old cookies, so the backend receives no token → 401.

**Fix:** Clear all cookies for `127.0.0.1` and `localhost` in your browser DevTools (Application → Cookies → delete all), then reload and log in again.

### Cause 3: No valid users in the database
Even after fixing the cookie/token chain, the `/auth/login` endpoint may return `401 Invalid credentials` if:
- There are no users in the database, OR
- The `passlib` + `bcrypt` library versions are incompatible (Python 3.14 may have issues with older bcrypt)

You can check this by querying the database:
```bash
sqlite3 backend/busihub.db "SELECT id, email FROM users;"```
If it returns no rows, you need to seed a user.

### Bonus: Potential `passlib`/`bcrypt` version mismatch
Python 3.14 can cause compatibility issues with older bcrypt releases. If you need to create users, you may need to pin bcrypt:
```txt
# requirements.txt
bcrypt==4.2.0
passlib[bcrypt]==1.7.4
```
Then reinstall: `pip install -r requirements.txt`

## Step-by-Step Plan (to execute in Act Mode)

1. **Restart backend** — it's already running the fixed code (confirmed working)
2. **Restart frontend** — `pkill -f vite && cd business-system-frontend && npm run dev`
3. **Clear browser cookies** — DevTools → Application → Cookies → delete `127.0.0.1` and `localhost`
4. **Check database has users** — `sqlite3 backend/busihub.db "SELECT id, email FROM users;"`
5. **If no users exist** — fix bcrypt versions, then seed a user using the Python app:
   ```python
   # Inside backend/ directory
   from app.db.session import SessionLocal
   from app.models import User, Tenant, UserTenant
   from app.auth import hash_password
   db = SessionLocal()
   tenant = Tenant(name='Default', description='Default tenant')
   db.add(tenant); db.commit(); db.refresh(tenant)
   user = User(email='admin@example.com', hashed_password=hash_password('admin123'), is_active=True)
   db.add(user); db.commit(); db.refresh(user)
   db.add(UserTenant(user_id=user.id, tenant_id=tenant.id, role='Owner'))
   db.commit(); db.close()
   ```
6. **Log in fresh** from the frontend

## Current Server Logs Diagnosis

The logs show:
```
POST /auth/login → 401 Unauthorized
GET /auth/me → 401 Unauthorized
POST /auth/refresh → 401 Unauthorized
OPTIONS requests → 200 OK  (CORS preflight works)
```

The `OPTIONS 200` confirms CORS is configured properly. The `POST /auth/login 401` means either the credentials are wrong or the bcrypt hash validation is failing silently. The `GET /auth/me 401` means no cookie is being sent (because the frontend hostname changed).

**Switch to Act Mode** to execute the restart + cookie clear + database check. The code fixes are complete — they just need a running environment to take effect.