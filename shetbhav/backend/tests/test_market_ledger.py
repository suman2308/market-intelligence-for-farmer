"""
Tests for the local market-data ledger (services/market_ledger.py).

The ledger is the durability layer for real market data: every record fetched
from data.gov.in is appended to a JSONL file, and startup replays the file
into the database. These tests exercise append/dedupe/restore/labeling.
"""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import SessionLocal
from models.database import MarketPrice, Crop, Market


@pytest.fixture()
def ledger_env(tmp_path, monkeypatch):
    """Point the ledger at a fresh temp file for the duration of a test."""
    path = tmp_path / "ledger_test.jsonl"
    monkeypatch.setenv("MARKET_DATA_LEDGER_PATH", str(path))
    import services.market_ledger as ml
    yield ml
    if path.exists():
        path.unlink()


def _rec(commodity="Onion", market="Nashik APMC", date="2026-09-20", modal=2100.0, **kw):
    base = {
        "state": "Maharashtra", "district": "Nashik",
        "market": market, "commodity": commodity, "variety": "Local",
        "grade": "Grade A", "arrival_date": date,
        "min_price": modal * 0.8, "max_price": modal * 1.2, "modal_price": modal,
        "arrivals": 320, "fetched_at": "2026-09-21T10:00:00",
    }
    base.update(kw)
    return base


class TestAppendAndDedupe:
    def test_append_writes_normalized_record(self, ledger_env):
        added = ledger_env.append_records([_rec()])
        assert added == 1
        recs = ledger_env.read_ledger()
        assert len(recs) == 1
        assert recs[0]["commodity"] == "Onion"
        assert recs[0]["arrival_date"] == "2026-09-20"

    def test_append_is_idempotent(self, ledger_env):
        ledger_env.append_records([_rec()])
        assert ledger_env.append_records([_rec()]) == 0
        # Same (crop, market, date) with a corrected price must not duplicate
        assert ledger_env.append_records([_rec(modal=9999)]) == 0
        assert len(ledger_env.read_ledger()) == 1

    def test_different_market_or_date_both_stored(self, ledger_env):
        ledger_env.append_records([
            _rec(),
            _rec(market="Lasalgaon APMC"),
            _rec(date="2026-09-21"),
        ])
        assert len(ledger_env.read_ledger()) == 3

    def test_invalid_records_rejected(self, ledger_env):
        assert ledger_env.append_records([
            _rec(modal=0),                 # zero price
            _rec(modal=-5),                # negative price
            _rec(arrival_date="garbage"),  # unparsable date
            _rec(arrival_date=""),         # missing date
            {},                            # empty
        ]) == 0
        assert ledger_env.read_ledger() == []

    def test_ddmmyyyy_dates_normalized(self, ledger_env):
        ledger_env.append_records([_rec(arrival_date="21/09/2026")])
        assert ledger_env.read_ledger()[0]["arrival_date"] == "2026-09-21"

    def test_missing_file_reads_empty(self, ledger_env):
        assert ledger_env.read_ledger() == []
        assert ledger_env.ledger_keys() == set()


class TestRealOnlyGate:
    def test_append_real_records_skips_synthetic(self, ledger_env):
        assert ledger_env.append_real_records([_rec()], source_type="synthetic") == 0
        assert ledger_env.read_ledger() == []

    def test_append_real_records_accepts_live(self, ledger_env):
        assert ledger_env.append_real_records([_rec()], source_type="live") == 1


class TestRestoreToDb:
    def test_restore_creates_rows_marked_real(self, ledger_env):
        db = SessionLocal()
        try:
            ledger_env.append_records([_rec(commodity="TestCropX", market="TestMandiX")])
            assert ledger_env.restore_to_db(db) == 1
            row = db.query(MarketPrice).filter(MarketPrice.commodity == "TestCropX").first()
            assert row is not None
            assert row.source_type == "historical_dataset"
            assert row.is_demo is False
            assert row.market_name == "TestMandiX"
            assert row.modal_price == pytest.approx(2100.0)
            # Restore is idempotent: no duplicate row on replay
            assert ledger_env.restore_to_db(db) >= 0
            assert db.query(MarketPrice).filter(MarketPrice.commodity == "TestCropX").count() == 1
        finally:
            db.close()

    def test_restore_creates_missing_crop_and_market(self, ledger_env):
        db = SessionLocal()
        try:
            ledger_env.append_records([_rec(commodity="TestCropY", market="TestMandiY")])
            ledger_env.restore_to_db(db)
            assert db.query(Crop).filter(Crop.name == "TestCropY").first() is not None
            assert db.query(Market).filter(Market.name == "TestMandiY").first() is not None
        finally:
            db.close()


class TestSyncDbToLedger:
    def test_real_rows_flow_db_to_file(self, ledger_env):
        db = SessionLocal()
        try:
            crop = db.query(Crop).first()
            market = db.query(Market).first()
            db.add(MarketPrice(
                market_id=market.id, crop_id=crop.id,
                date=datetime(2026, 9, 22), arrival_date=datetime(2026, 9, 22),
                min_price=100, max_price=200, modal_price=150,
                market_name=market.name, commodity=crop.name,
                source_type="live", source_name="data.gov.in / AGMARKNET",
                fetched_at=datetime(2026, 9, 22, 10),
            ))
            db.commit()
            assert ledger_env.sync_db_to_ledger(db) >= 1
        finally:
            db.close()

    def test_existing_rows_do_not_duplicate(self, ledger_env):
        db = SessionLocal()
        try:
            before = len(ledger_env.read_ledger())
            assert ledger_env.sync_db_to_ledger(db) >= 0
            assert ledger_env.sync_db_to_ledger(db) == 0  # second run adds nothing
            assert len(ledger_env.read_ledger()) >= before
        finally:
            db.close()


class TestStats:
    def test_stats_shape(self, ledger_env):
        ledger_env.append_records([_rec(), _rec(date="2026-09-25")])
        stats = ledger_env.ledger_stats()
        assert stats["records"] == 2
        assert "Onion" in stats["crops"]
        assert stats["date_range"]["from"] == "2026-09-20"
        assert stats["date_range"]["to"] == "2026-09-25"
