"""
Shared test configuration — single test database for all test files.
Prevents isolation issues when running multiple test files together.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    """Clean tables between tests for isolation."""
    yield
    # Clean in reverse dependency order
    for table in reversed(Base.metadata.sorted_tables):
        try:
            test_engine.execute(table.delete())
        except Exception:
            pass
