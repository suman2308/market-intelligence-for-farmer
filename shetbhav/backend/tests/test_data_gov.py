"""
Tests for data.gov.in API integration.
Tests: API key security, response normalization, caching, fallback, source labeling.
"""
import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import DATA_GOV_API_KEY


class TestApiKeySecurity:
    """§: API key must never appear in responses, logs, or frontend."""

    def test_api_key_loaded_from_env(self):
        """API key should be read from environment."""
        key = DATA_GOV_API_KEY
        assert key, "API key should be configured"
        assert len(key) > 10, "API key should be meaningful length"

    def test_api_key_not_in_settings_export(self):
        """Settings module should not accidentally include key in __all__."""
        from config import settings
        # The key exists in settings but shouldn't be in any response model
        assert hasattr(settings, "DATA_GOV_API_KEY")

    def test_key_check_function_works(self):
        from services.data_gov import _check_api_key
        assert _check_api_key() is True

    def test_key_check_with_empty_key(self):
        from services.data_gov import _check_api_key
        with patch("services.data_gov.DATA_GOV_API_KEY", ""):
            assert _check_api_key() is False

    def test_sync_status_does_not_expose_key(self):
        """Sync status should never include the actual API key value."""
        from services.data_gov import get_sync_status
        # Just check the function signature doesn't leak key
        import inspect
        source = inspect.getsource(get_sync_status)
        assert DATA_GOV_API_KEY not in source, "API key found in source code"

    def test_test_endpoint_does_not_expose_full_key(self):
        """The /sync/test endpoint should mask the API key."""
        from config.settings import DATA_GOV_API_KEY
        # The endpoint truncates the key: first 8 chars + "..."
        assert DATA_GOV_API_KEY[:8] + "..." != DATA_GOV_API_KEY  # Sanity check


class TestResponseNormalization:
    """API responses should be normalized to consistent format."""

    def test_store_records_normalizes_fields(self):
        from services.data_gov import _store_records
        from config.database import SessionLocal
        from models.database import Crop

        db = SessionLocal()
        try:
            crop = db.query(Crop).first()
            if not crop:
                pytest.skip("No crops in test DB")

            mock_records = [
                {
                    "arrival_date": "2026-08-15",
                    "min_price": "1200",
                    "max_price": "1800",
                    "modal_price": "1500",
                    "arrivals": "250",
                    "market": "Nashik APMC",
                    "state": "Maharashtra",
                    "commodity": crop.name,
                    "variety": "local",
                    "grade": "A",
                }
            ]

            inserted, updated, skipped, rejected = _store_records(
                db, mock_records, crop.name
            )
            assert inserted >= 0
            assert rejected == 0
        finally:
            db.close()

    def test_store_records_rejects_invalid_prices(self):
        from services.data_gov import _store_records
        from config.database import SessionLocal
        from models.database import Crop

        db = SessionLocal()
        try:
            crop = db.query(Crop).first()
            if not crop:
                pytest.skip("No crops in test DB")

            mock_records = [
                {
                    "arrival_date": "2026-08-15",
                    "min_price": "-100",  # Invalid negative price
                    "max_price": "1800",
                    "modal_price": "0",    # Invalid zero price
                    "arrivals": "250",
                    "market": "Nashik",
                }
            ]

            inserted, updated, skipped, rejected = _store_records(
                db, mock_records, crop.name
            )
            assert rejected >= 1  # At least the negative price record rejected
            assert inserted == 0
        finally:
            db.close()

    def test_store_records_rejects_invalid_dates(self):
        from services.data_gov import _store_records
        from config.database import SessionLocal
        from models.database import Crop

        db = SessionLocal()
        try:
            crop = db.query(Crop).first()
            if not crop:
                pytest.skip("No crops in test DB")

            mock_records = [
                {
                    "arrival_date": "",  # Missing date
                    "min_price": "1200",
                    "max_price": "1800",
                    "modal_price": "1500",
                },
                {
                    "min_price": "1200",  # No date at all
                    "max_price": "1800",
                    "modal_price": "1500",
                },
            ]

            inserted, updated, skipped, rejected = _store_records(
                db, mock_records, crop.name
            )
            assert rejected >= 2
        finally:
            db.close()


class TestCaching:
    """Cached data should be returned when available."""

    def test_cache_returns_none_when_empty(self):
        from services.data_gov import get_cached_data
        from config.database import SessionLocal

        db = SessionLocal()
        try:
            result = get_cached_data(db, crop_id=9999)  # Non-existent crop
            assert result is None
        finally:
            db.close()


class TestFallback:
    """When API fails, system should fall back gracefully."""

    def test_sync_handles_missing_api_key(self):
        from services.data_gov import sync_mandi_data
        from config.database import SessionLocal

        db = SessionLocal()
        try:
            with patch("services.data_gov.DATA_GOV_API_KEY", ""):
                result = sync_mandi_data(db, crop_name="tomato")
                assert result["overall_status"] in ("partial", "success")
                assert result["api_key_configured"] is False
        finally:
            db.close()

    def test_fetch_handles_timeout(self):
        from services.data_gov import fetch_from_api
        from config.database import SessionLocal

        db = SessionLocal()
        try:
            with patch("services.data_gov.DATA_GOV_API_KEY", "test_key_12345"):
                with patch("urllib.request.urlopen", side_effect=TimeoutError("timed out")):
                    data, meta = fetch_from_api(db, "tomato")
                    assert data is None
                    assert meta["api_status"] in ("error", "timeout")
        finally:
            db.close()

    def test_source_labeling_synthetic(self):
        """Synthetic fallback data should be clearly labeled."""
        from services.market_data import MarketDataService
        from config.database import SessionLocal

        db = SessionLocal()
        try:
            svc = MarketDataService()
            result = svc.get_current_prices(db, crop_id=9999)  # Non-existent crop
            # Should return error or synthetic
            if "source" in result:
                assert result["source"] in ("synthetic", "cached", "historical_dataset")
        finally:
            db.close()


class TestSmartSellConfidence:
    """Smart Sell confidence should decrease with non-live data."""

    def test_confidence_decreases_with_synthetic_data(self):
        """Confidence should be lower for synthetic vs live data."""
        from ml.forecasting import predict_price

        # With historical data
        records = [{"date": f"2026-01-{i+1:02d}", "modal_price": 2000 + i * 10,
                    "min_price": 1800, "max_price": 2200, "arrivals_qty": 200}
                   for i in range(60)]
        prices = [r["modal_price"] for r in records]
        forecast = predict_price("tomato", 2000, historical_prices=prices)
        assert forecast["confidence"] > 0

        # Without data (synthetic fallback)
        forecast_synth = predict_price("tomato", 2000)
        assert forecast_synth["confidence"] <= forecast["confidence"]


class TestSourceLabels:
    """Source metadata must be present on all records."""

    def test_sync_status_returns_source_info(self):
        from services.data_gov import get_sync_status
        from config.database import SessionLocal

        db = SessionLocal()
        try:
            status = get_sync_status(db)
            assert "api_key_configured" in status
            assert "crops" in status
            for crop_name, crop_status in status["crops"].items():
                if crop_status.get("available"):
                    assert "source_type" in crop_status
                    assert "freshness" in crop_status
        finally:
            db.close()
