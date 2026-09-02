"""
Database session management.
SQLite for local dev, PostgreSQL for production (Supabase-compatible).
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from models.database import Base
from config.settings import DATABASE_URL, DEMO_MODE


is_sqlite = "sqlite" in DATABASE_URL.lower()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True,
    pool_size=10 if not is_sqlite else 1,
    max_overflow=20 if not is_sqlite else 0,
    echo=False,
)

# Enable WAL mode for SQLite concurrency
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
