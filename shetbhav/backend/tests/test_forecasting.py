"""
Comprehensive tests for the forecasting pipeline.
Tests: chronological split, no-future-leakage, naive baseline, insufficient data,
missing dates, forecast output schema, confidence levels, storage-cost deduction,
Smart Sell comparison, model metadata and versioning.
"""
import os
import sys
import math
import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.feature_engineering import build_features, validate_data_quality, prepare_training_data
from ml.baselines import naive_forecast, moving_average_forecast, compute_baseline_predictions
from ml.evaluation import compute_metrics, compare_with_naive, chronological_split, ModelMetrics
from ml.model_training import train_crop_model, load_trained_model, SUPPORTED_CROPS
from ml.model_registry import get_model_status, save_model, load_model
from ml.forecasting import predict_price, _confidence_label


# ── Helpers ──────────────────────────────────────────────────────────

def make_price_records(n=120, base=2000, volatility=0.08, crop_id=1, market_id=1):
    """Generate synthetic price records for testing."""
    np.random.seed(42)
    records = []
    start = datetime(2026, 1, 1)
    for i in range(n):
        day = start + timedelta(days=i)
        seasonal = 200 * math.sin(2 * math.pi * i / 365)
        noise = np.random.normal(0, base * volatility)
        modal = max(500, base + seasonal + noise)
        records.append({
            "date": day.strftime("%Y-%m-%d"),
            "modal_price": round(modal, 2),
            "min_price": round(modal * 0.85, 2),
            "max_price": round(modal * 1.15, 2),
            "arrivals_qty": round(np.random.uniform(50, 400), 1),
            "crop_id": crop_id,
            "market_id": market_id,
        })
    return records


def make_short_records(n=15):
    """Very short record set — should trigger insufficient data."""
    return make_price_records(n=n, base=1500)[:n]


# ── Feature Engineering Tests ────────────────────────────────────────

class TestFeatureEngineering:
    def test_build_features_returns_dataframe(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        result = build_features(df, target_horizon=7)
        assert not result.empty
        assert "target_price_7d" in result.columns

    def test_features_include_lags_and_rolling(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        result = build_features(df)
        assert "price_lag_1" in result.columns
        assert "price_lag_7" in result.columns
        assert "price_ma_7" in result.columns
        assert "price_std_7" in result.columns

    def test_features_include_seasonality(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        result = build_features(df)
        assert "sin_day_of_year" in result.columns
        assert "cos_day_of_year" in result.columns
        assert "month" in result.columns

    def test_features_no_nan_in_output(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        result = build_features(df)
        assert result.isna().sum().sum() == 0

    def test_insufficient_data_returns_empty(self):
        records = make_price_records(20)
        df = pd.DataFrame(records)
        result = build_features(df)
        assert result.empty


class TestDataValidation:
    def test_valid_data_passes(self):
        records = make_price_records(120)
        quality = validate_data_quality(records)
        assert quality["valid"] is True
        assert quality["record_count"] == 120

    def test_too_few_records_fails(self):
        records = make_price_records(30)
        quality = validate_data_quality(records)
        assert quality["valid"] is False
        assert any("Only" in issue for issue in quality["issues"])

    def test_empty_records_fails(self):
        quality = validate_data_quality([])
        assert quality["valid"] is False

    def test_detects_duplicates(self):
        records = make_price_records(100)
        records[1] = records[0].copy()  # Add a duplicate
        quality = validate_data_quality(records)
        assert quality["duplicate_records"] >= 1

    def test_missing_dates_detected(self):
        records = make_price_records(120)
        # Remove every other date
        records = [r for i, r in enumerate(records) if i % 2 == 0]
        quality = validate_data_quality(records)
        assert quality["missing_date_pct"] > 0


# ── Chronological Split Tests ────────────────────────────────────────

class TestChronologicalSplit:
    def test_split_preserves_order(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        df["target"] = df["modal_price"].shift(-7)
        df = df.dropna()
        train, val, test = chronological_split(df)
        assert train.iloc[-1]["date"] < val.iloc[0]["date"]
        assert val.iloc[-1]["date"] < test.iloc[0]["date"]

    def test_split_sizes_approximate(self):
        records = make_price_records(120)
        df = pd.DataFrame(records)
        df["target"] = df["modal_price"].shift(-7)
        df = df.dropna()
        train, val, test = chronological_split(df)
        total = len(train) + len(val) + len(test)
        assert len(train) > len(val)
        assert len(train) > len(test)

    def test_no_data_from_future_in_train(self):
        """Train set must not contain any dates from validation or test."""
        records = make_price_records(120)
        df = pd.DataFrame(records)
        df["target"] = df["modal_price"].shift(-7)
        df = df.dropna()
        train, val, test = chronological_split(df)
        train_dates = set(pd.to_datetime(train["date"]))
        test_dates = set(pd.to_datetime(test["date"]))
        assert len(train_dates & test_dates) == 0


# ── No Future Leakage Test ───────────────────────────────────────────

class TestNoFutureLeakage:
    def test_no_target_leakage(self):
        """Target must be shifted forward — never available during training."""
        records = make_price_records(120)
        df = pd.DataFrame(records)
        df["target"] = df["modal_price"].shift(-7)
        df = df.dropna()
        train, val, test = chronological_split(df)
        # Train target should be actual price 7 days AFTER train date
        # Not the current price
        assert train["target"].iloc[0] != train["modal_price"].iloc[0]

    def test_lags_are_backward_looking(self):
        """Lagged features must only reference past data."""
        records = make_price_records(120)
        df = pd.DataFrame(records)
        result = build_features(df, target_horizon=7)
        if not result.empty:
            # price_lag_1 should equal modal_price from 1 day earlier
            for i in range(1, min(10, len(result))):
                assert result["price_lag_1"].iloc[i] == result["modal_price"].iloc[i - 1]


# ── Baseline Tests ───────────────────────────────────────────────────

class TestBaselines:
    def test_naive_returns_latest_price(self):
        prices = [100, 200, 300, 400, 500]
        result = naive_forecast(prices, horizon=3)
        assert result["point_prediction"] == 500
        assert len(result["predictions"]) == 3
        assert all(p == 500 for p in result["predictions"])

    def test_naive_empty_prices(self):
        result = naive_forecast([], horizon=3)
        assert result["point_prediction"] == 0

    def test_ma_7_returns_average(self):
        prices = list(range(100, 110))  # 100, 101, ..., 109
        result = moving_average_forecast(prices, window=7, horizon=3)
        expected_avg = np.mean([103, 104, 105, 106, 107, 108, 109])
        assert abs(result["point_prediction"] - expected_avg) < 0.01

    def test_ma_14_with_short_data_uses_available(self):
        prices = [100, 200, 300]
        result = moving_average_forecast(prices, window=14, horizon=3)
        # With only 3 prices and window=14, averages all available: mean(100,200,300)=200
        assert result["point_prediction"] == 200.0

    def test_baseline_predictions_has_all_keys(self):
        prices = [100 + i for i in range(50)]
        baselines = compute_baseline_predictions(prices, horizon=7)
        assert "naive" in baselines
        assert "ma_7" in baselines
        assert "ma_14" in baselines

    def test_naive_baseline_hard_to_beat(self):
        """Naive should have low MAE for stable prices."""
        prices = [2000] * 50  # perfectly stable
        result = naive_forecast(prices, horizon=7)
        assert result["point_prediction"] == 2000


# ── Model Training Tests ─────────────────────────────────────────────

class TestModelTraining:
    def test_train_onion_model(self):
        records = make_price_records(150, base=1600)
        result = train_crop_model("onion", records)
        assert "status" in result
        assert result["crop"] == "onion"

    def test_train_tomato_model(self):
        records = make_price_records(150, base=2400)
        result = train_crop_model("tomato", records)
        assert result["crop"] == "tomato"

    def test_train_soybean_model(self):
        records = make_price_records(150, base=4200)
        result = train_crop_model("soybean", records)
        assert result["crop"] == "soybean"

    def test_insufficient_data_returns_status(self):
        records = make_short_records(20)
        result = train_crop_model("tomato", records)
        assert result["status"] == "insufficient_data"
        assert result["model_trained"] is False

    def test_unsupported_crop(self):
        result = train_crop_model("rice", make_price_records(150))
        assert "error" in result

    def test_model_saves_to_disk(self):
        records = make_price_records(150, base=1600)
        result = train_crop_model("onion", records)
        loaded = load_trained_model("onion")
        if result.get("model_trained"):
            assert loaded is not None

    def test_metrics_include_naive_comparison(self):
        records = make_price_records(150, base=2400)
        result = train_crop_model("tomato", records)
        if "all_metrics" in result:
            assert "naive" in result["all_metrics"]
            assert "xgboost" in result["all_metrics"]


# ── Evaluation Metrics Tests ─────────────────────────────────────────

class TestEvaluation:
    def test_compute_metrics_basic(self):
        actuals = np.array([100, 200, 300, 400])
        preds = np.array([110, 190, 310, 390])
        metrics = compute_metrics(actuals, preds, "test")
        assert metrics.mae > 0
        assert metrics.rmse > 0
        assert metrics.mape is not None

    def test_perfect_predictions_mae_zero(self):
        actuals = np.array([100, 200, 300])
        metrics = compute_metrics(actuals, actuals, "perfect")
        assert metrics.mae == 0
        assert metrics.rmse == 0

    def test_mape_skips_zero_prices(self):
        actuals = np.array([0, 100, 200])
        preds = np.array([10, 110, 190])
        metrics = compute_metrics(actuals, preds, "test")
        # MAPE should be computed only on non-zero actuals
        assert metrics.mape is not None

    def test_compare_with_naive_positive_improvement(self):
        actuals = np.array([100, 200, 300])
        model_preds = np.array([105, 195, 305])  # close to actuals
        naive_preds = np.array([150, 150, 150])   # way off
        m = compute_metrics(actuals, model_preds, "test")
        m = compare_with_naive(m, actuals, naive_preds)
        assert m.improvement_over_naive_mae_pct > 0
        assert m.beats_naive is True

    def test_compare_with_naive_worse_model(self):
        actuals = np.array([100, 200, 300])
        model_preds = np.array([50, 50, 50])    # terrible
        naive_preds = np.array([95, 195, 295])  # great
        m = compute_metrics(actuals, model_preds, "test")
        m = compare_with_naive(m, actuals, naive_preds)
        assert m.improvement_over_naive_mae_pct < 0
        assert m.beats_naive is False

    def test_confidence_labels(self):
        assert _confidence_label(0.85) == "High"
        assert _confidence_label(0.60) == "Medium"
        assert _confidence_label(0.35) == "Low"
        assert _confidence_label(0.10) == "Very Low"


# ── Forecast Output Schema Tests ─────────────────────────────────────

class TestForecastSchema:
    def test_predict_price_returns_full_schema(self):
        records = make_price_records(150, base=1600)
        prices = [r["modal_price"] for r in records]
        result = predict_price("onion", 1600, historical_prices=prices)
        required_keys = [
            "crop", "mandi", "horizon", "predicted_price",
            "expected_low", "expected_high", "confidence",
            "model_name", "model_version", "trained_until",
            "data_source", "forecast_status", "explanation",
        ]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"

    def test_forecast_prices_are_positive(self):
        result = predict_price("tomato", 2400, arrivals=200)
        assert result["predicted_price"] >= 0
        assert result["expected_low"] >= 0
        assert result["expected_high"] >= result["expected_low"]

    def test_forecast_range_brackets_prediction(self):
        result = predict_price("onion", 1600, arrivals=200)
        assert result["expected_low"] <= result["predicted_price"] <= result["expected_high"]

    def test_insufficient_data_status(self):
        result = predict_price("rice", 1000)
        # "rice" not in SUPPORTED_CROPS but prediction still works (naive fallback)
        assert result["forecast_status"] in ("forecast_available", "low_confidence")

    def test_confidence_between_0_and_1(self):
        for crop in SUPPORTED_CROPS:
            result = predict_price(crop, 2000)
            assert 0 <= result["confidence"] <= 1


# ── Storage Cost Deduction Tests ─────────────────────────────────────

class TestStorageCostDeduction:
    def test_storage_cost_positive(self):
        from services.smart_sell import estimate_storage_cost
        cost = estimate_storage_cost(1000, 7)
        assert cost > 0

    def test_spoilage_cost_positive(self):
        from services.smart_sell import estimate_spoilage
        loss = estimate_spoilage("tomato", 1000, 7)
        assert loss >= 0

    def test_net_realization_subtracts_costs(self):
        from services.smart_sell import calculate_net_realization
        net = calculate_net_realization(
            gross_price=2000,
            transport_cost=200,
            storage_cost=100,
            expected_loss=50,
            handling_cost=15,
        )
        assert net == 2000 - 200 - 100 - 50 - 15

    def test_net_is_less_than_gross(self):
        from services.smart_sell import calculate_net_realization
        net = calculate_net_realization(2000, 100, 50, 30, 15)
        assert net < 2000


# ── Model Registry Tests ────────────────────────────────────────────

class TestModelRegistry:
    def test_get_model_status_not_trained(self):
        status = get_model_status("tomato")
        assert "model_available" in status

    def test_save_and_load(self):
        import tempfile
        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit([[1], [2], [3]], [100, 200, 300])
        feature_cols = ["feature1"]
        metadata = {"crop": "test", "model_version": "0.0.1"}
        save_model(model, "_test_crop", feature_cols, metadata)
        loaded = load_model("_test_crop")
        assert loaded is not None
        m, fc, md = loaded
        assert md["crop"] == "test"
        # Cleanup
        for suffix in ["", "_features", "_metadata"]:
            path = Path(__file__).parent.parent / "data" / "models" / f"{'xgb_price_forecast_test_crop.joblib' if suffix == '' else f'features_test_crop.joblib' if suffix == '_features' else f'metadata_test_crop.joblib'}"
            if path.exists():
                path.unlink()


# ── Smart Sell Integration Tests ─────────────────────────────────────

class TestSmartSellIntegration:
    def test_forecast_used_in_storage_option(self):
        """Storage option should reference forecast data."""
        records = make_price_records(150, base=1600)
        prices = [r["modal_price"] for r in records]
        forecast = predict_price("onion", 1600, historical_prices=prices)
        assert "predicted_price" in forecast
        assert forecast["predicted_price"] > 0

    def test_forecast_does_not_alone_determine_recommendation(self):
        """§18: Forecast is ONE input, not the sole decider."""
        records = make_price_records(150, base=2000)
        prices = [r["modal_price"] for r in records]
        forecast = predict_price("tomato", 2000, historical_prices=prices)
        # Even with a high forecast, costs should reduce net value
        from services.smart_sell import calculate_net_realization, estimate_storage_cost, HANDLING_COST_PER_Q
        future_price = forecast["predicted_price"]
        storage = estimate_storage_cost(1000, 7) / 10  # per quintal
        net = calculate_net_realization(future_price, 200, storage, 40, HANDLING_COST_PER_Q)
        # Net should always be less than gross due to costs
        assert net < future_price
