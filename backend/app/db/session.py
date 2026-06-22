from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={} if settings.DATABASE_URL.startswith('postgresql') else {'check_same_thread': False},
    future=True,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)
