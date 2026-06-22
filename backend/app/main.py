from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.middleware import BusinessBranchMiddleware
from app.db.base import Base
from app.db.session import engine
from app.routes import auth, dashboard, retail, transactions, inventory, customers, hrm, finance, setup, notifications, product_requests


def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME, version='1.0.0')

    # 1. Custom operational middleware added FIRST (executed inner layer)
    app.add_middleware(BusinessBranchMiddleware)

    # 2. CORSMiddleware added LAST (executed outer layer to catch all errors)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    app.include_router(auth.router)
    app.include_router(dashboard.router)
    app.include_router(retail.router)
    app.include_router(transactions.router)
    app.include_router(inventory.router)
    app.include_router(customers.router)
    app.include_router(hrm.router)
    app.include_router(finance.router)
    app.include_router(setup.router)
    app.include_router(notifications.router)
    app.include_router(product_requests.router)

    Base.metadata.create_all(bind=engine)
    return app


app = create_app()