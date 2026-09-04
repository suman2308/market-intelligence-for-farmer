"""
Database session management.
SQLite for local dev, PostgreSQL for production (Supabase-compatible).
"""
from sqlalchemy import create_engine, event, inspect, text
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


def _add_missing_columns():
    """Best-effort, additive-only schema repair.

    There is no migration tool (Alembic) in this project, and
    Base.metadata.create_all() only creates missing *tables* — it never
    alters an existing table, so a newly added nullable column (e.g.
    ProduceLot.offers_close_at) silently works in a fresh dev DB but
    crashes production with "column does not exist" until someone runs
    the ALTER TABLE by hand. This closes that gap automatically on
    startup. It only ever adds columns that exist on the ORM model but
    not in the live table — it never drops or modifies anything.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # brand-new table — create_all() already created it
        existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_columns:
                continue
            try:
                col_type = column.type.compile(dialect=engine.dialect)
                with engine.begin() as conn:
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}'))
                print(f"[schema] Added missing column {table.name}.{column.name}")
            except Exception as e:
                print(f"[schema] Could not add {table.name}.{column.name}: {e}")


def init_db():
    """Create all tables, then best-effort add any columns missing from
    existing tables (see _add_missing_columns)."""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
