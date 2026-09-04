"""
Shared test configuration — single test database for all test files.
Prevents isolation issues when running multiple test files together.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Isolate model artifacts written during tests (synthetic training runs) so they
# never clobber the real production models in backend/data/models. Must be set
# before ml.* modules are imported below.
os.environ["SHETBHAV_MODELS_DIR"] = tempfile.mkdtemp(prefix="shetbhav_test_models_")

# Force the WHOLE backend onto the test database before any project module is
# imported (config/settings.py reads these env vars at import time). Several
# services and tests open their own sessions via ``config.database.SessionLocal``
# (e.g. app.main, services.data_gov, services.quality_grading) — without this,
# those sessions hit the production/dev SQLite file, which does not exist on CI
# and therefore has no tables ("no such table: crops").
os.environ["DATABASE_URL"] = "sqlite:///./test_shared.db"
# The data.gov.in tests assert a key is configured; CI has no real key, so use a
# clearly-fake one. Real keys are never needed: HTTP calls are patched/mocked.
os.environ.setdefault("DATA_GOV_API_KEY", "shetbhav-ci-test-key-12345")

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from models.database import Base, Crop, Market
from config.database import get_db
from app.main import app
from fastapi.testclient import TestClient

TEST_DATABASE_URL = "sqlite:///./test_shared.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True, scope="session")
def create_all_tables():
    """Create all tables once for the test session."""
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    try:
        if db.query(Crop).count() == 0:
            db.add_all([
                Crop(name="Tomato", name_hi="टमाटर", name_mr="टोमॅटो",
                     category="vegetable", unit="kg", supports_ai_grading=True),
                Crop(name="Onion", name_hi="प्याज़", name_mr="कांदा",
                     category="vegetable", unit="kg", supports_ai_grading=False),
                Crop(name="Soybean", name_hi="सोयाबीन", name_mr="सोयाबीन",
                     category="grain", unit="kg", supports_ai_grading=False),
            ])
            db.add(Market(name="Nashik APMC", code="MH_NSK_001", district="Nashik",
                         state="Maharashtra", location_lat=19.9975, location_lng=73.7898))
            db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_database():
    """Clean user-created data between tests for isolation.

    Seed rows (crops, markets) are created once per session by
    ``create_all_tables`` and must survive across tests, so they are
    preserved here.
    """
    yield
    from sqlalchemy import text
    seed_tables = {Crop.__tablename__, Market.__tablename__}
    with test_engine.begin() as conn:
        # Clean in reverse dependency order (children before parents)
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in seed_tables:
                continue
            try:
                conn.execute(text(f"DELETE FROM {table.name}"))
            except Exception:
                pass
