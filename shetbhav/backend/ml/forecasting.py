"""
Price Forecasting Pipeline — §16, §53
Orchestrates the full forecasting pipeline:
  1. Data quality validation
  2. Feature engineering
  3. Model training (XGBoost vs naive comparison)
  4. Prediction with confidence intervals
  5. Transparent source labels

Output schema:
  crop, mandi, horizon, predicted_price, expected_low, expected_high,
  confidence, model_name, model_version, trained_until, data_source,
  forecast_status, explanation
"""
import os
import math
import random
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from pathlib import Path

from ml.baselines import naive_forecast, moving_average_forecast, compute_baseline_predictions
from ml.evaluation import compute_metrics, compare_with_naive, ModelMetrics
from ml.model_training import train_crop_model, load_trained_model, SUPPORTED_CROPS, MODEL_VERSION
from ml.model_registry import get_model_status, get_all_model_statuses

MODELS_DIR = Path(__file__).resolve().parent.parent / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

HORIZONS = {"short": 7, "medium": 14, "long": 30}


def predict_price(
    crop: str,
    current_price: float,
    arrivals: float = 200.0,
    horizon: int = 7,
    mandi: str = "",
    historical_prices: Optional[List[float]] = None,
    price_records: Optional[List[dict]] = None,
) -> Dict:
    """
    Main prediction entry point. §16: Never display false precision.

    Resolution order:
      1. Use trained XGBoost if available and beats naive
      2. Use moving average if enough data
      3. Use naive forecast as final fallback
      4. Return insufficient_data status if nothing works

    Returns full forecast schema.
    """
    crop = crop.lower()
    horizon = HORIZONS.get(str(horizon), horizon)

    # Collect historical prices from records if provided
    if price_records and not historical_prices:
        historical_prices = [r["modal_price"] for r in sorted(price_records, key=lambda x: x.get("date", ""))]

    # ── Try trained model ─────────────────────────────────────────
    loaded = load_trained_model(crop)
    if loaded is not None:
        model, feature_cols, metadata = loaded
        # Only use if it beat naive during training
        metrics = metadata.get("metrics", {})
        if metrics.get("beats_naive", False):
            try:
                return _predict_with_model(
                    model, feature_cols, metadata, crop, current_price,
                    arrivals, horizon, mandi, historical_prices,
                )
            except Exception:
                pass  # Fall through to baselines

    # ── Try baselines with historical data ────────────────────────
    if historical_prices and len(historical_prices) >= 14:
        ma_result = moving_average_forecast(historical_prices, window=7, horizon=horizon)
        spread = current_price * 0.06
        confidence = _compute_baseline_confidence(len(historical_prices), horizon)

        return {
            "crop": crop,
            "mandi": mandi or "N/A",
            "horizon": horizon,
            "predicted_price": ma_result["point_prediction"],
            "expected_low": round(max(0, ma_result["point_prediction"] - spread), 0),
            "expected_high": round(ma_result["point_prediction"] + spread, 0),
            "confidence": confidence,
            "confidence_label": _confidence_label(confidence),
            "model_name": "7-day Moving Average",
            "model_version": "baseline-v1.0",
            "trained_until": "",
            "data_source": "historical_dataset",
            "forecast_status": "forecast_available",
            "explanation": ma_result["explanation"],
            "model_beats_naive": False,
        }

    # ── Naive fallback ────────────────────────────────────────────
    spread = current_price * 0.08
    return {
        "crop": crop,
        "mandi": mandi or "N/A",
        "horizon": horizon,
        "predicted_price": round(current_price, 0),
        "expected_low": round(max(0, current_price - spread), 0),
        "expected_high": round(current_price + spread, 0),
        "confidence": 0.40,
        "confidence_label": "Low",
        "model_name": "Naive (latest price)",
        "model_version": "baseline-v1.0",
        "trained_until": "",
        "data_source": "synthetic",
        "forecast_status": "low_confidence",
        "explanation": f"Using latest price ₹{current_price:,.0f}/q as forecast. Insufficient data for ML model.",
        "model_beats_naive": False,
    }


def _predict_with_model(
    model, feature_cols: List[str], metadata: Dict,
    crop: str, current_price: float, arrivals: float,
    horizon: int, mandi: str,
    historical_prices: Optional[List[float]] = None,
) -> Dict:
    """Build features from current state and predict using trained model."""
    now = datetime.utcnow()
    features = _build_prediction_features(
        current_price, arrivals, now, historical_prices
    )

    # Ensure all feature columns present
    for col in feature_cols:
        if col not in features:
            features[col] = 0.0

    X = pd.DataFrame([{col: features.get(col, 0) for col in feature_cols}])
    predicted = float(model.predict(X)[0])
    predicted = max(0, predicted)

    # Prediction interval from training residuals
    residual_std = metadata.get("residual_std", current_price * 0.05)
    expected_low = max(0, predicted - 1.96 * residual_std)
    expected_high = predicted + 1.96 * residual_std

    # Round to nearest 50
    predicted = round(predicted / 50) * 50
    expected_low = round(expected_low / 50) * 50
    expected_high = round(expected_high / 50) * 50

    # Confidence based on model metrics
    metrics = metadata.get("metrics", {})
    mae = metrics.get("mae", current_price * 0.1)
    mape = metrics.get("mape")
    if mape is not None and mape < 5:
        confidence = 0.85
    elif mape is not None and mape < 10:
        confidence = 0.72
    elif mae < current_price * 0.05:
        confidence = 0.70
    else:
        confidence = 0.55

    # Reduce confidence for longer horizons
    if horizon > 7:
        confidence *= 0.85
    if horizon > 14:
        confidence *= 0.85

    data_label = metadata.get("train_end", "")
    if data_label:
        data_label = f"Trained on data until {data_label}"

    return {
        "crop": crop,
        "mandi": mandi or "N/A",
        "horizon": horizon,
        "predicted_price": predicted,
        "expected_low": expected_low,
        "expected_high": expected_high,
        "confidence": round(confidence, 2),
        "confidence_label": _confidence_label(confidence),
        "model_name": metadata.get("model_name", "XGBoost"),
        "model_version": metadata.get("model_version", MODEL_VERSION),
        "trained_until": metadata.get("train_end", ""),
        "data_source": "model_prediction",
        "forecast_status": "forecast_available",
        "explanation": (
            f"XGBoost model predicts ₹{predicted:,}/q in {horizon} days "
            f"(range: ₹{expected_low:,}–₹{expected_high:,}). "
            f"Model MAE: ₹{mae:,.0f}/q. "
            f"This is an estimate, not a guarantee."
        ),
        "model_beats_naive": metrics.get("beats_naive", False),
        "mae": mae,
        "mape": mape,
    }


def _build_prediction_features(
    current_price: float,
    arrivals: float,
    now: datetime,
    historical_prices: Optional[List[float]] = None,
) -> Dict[str, float]:
    """Build feature vector from current state for prediction."""
    features = {}
    dates = pd.to_datetime([now])
    features["day_of_year"] = now.timetuple().tm_yday
    features["month"] = now.month
    features["day_of_week"] = now.weekday()
    features["week_of_year"] = now.isocalendar()[1]
    features["sin_day_of_year"] = math.sin(2 * math.pi * now.timetuple().tm_yday / 365.25)
    features["cos_day_of_year"] = math.cos(2 * math.pi * now.timetuple().tm_yday / 365.25)
    features["sin_month"] = math.sin(2 * math.pi * now.month / 12)
    features["cos_month"] = math.cos(2 * math.pi * now.month / 12)
    features["modal_price"] = current_price
    features["min_price"] = current_price * 0.85
    features["max_price"] = current_price * 1.15
    features["arrivals_qty"] = arrivals

    prices = historical_prices or [current_price]

    # Lagged prices
    for lag in [1, 3, 7, 14, 30]:
        idx = len(prices) - lag
        features[f"price_lag_{lag}"] = prices[idx] if idx >= 0 else current_price

    # Rolling averages
    for w in [3, 7, 14, 30]:
        recent = prices[-w:] if len(prices) >= w else prices
        features[f"price_ma_{w}"] = np.mean(recent)
        features[f"price_std_{w}"] = np.std(recent) if len(recent) > 1 else 0
        features[f"arrivals_ma_{w}"] = arrivals

    # Price changes
    if len(prices) > 1:
        features["price_change_1d"] = (prices[-1] - prices[-2]) / max(prices[-2], 1)
    else:
        features["price_change_1d"] = 0
    if len(prices) > 7:
        features["price_change_7d"] = (prices[-1] - prices[-8]) / max(prices[-8], 1)
    else:
        features["price_change_7d"] = 0
    if len(prices) > 30:
        features["price_change_30d"] = (prices[-1] - prices[-31]) / max(prices[-31], 1)
    else:
        features["price_change_30d"] = 0

    # CV
    for w in [7, 30]:
        recent = prices[-w:] if len(prices) >= w else prices
        std = np.std(recent) if len(recent) > 1 else 0
        mean = np.mean(recent)
        features[f"price_cv_{w}"] = std / max(mean, 1)

    # Range
    for w in [7, 30]:
        recent = prices[-w:] if len(prices) >= w else prices
        features[f"price_range_{w}"] = max(recent) - min(recent)

    # Arrivals
    for lag in [1, 7]:
        features[f"arrivals_lag_{lag}"] = arrivals
    features["arrivals_change_7d"] = 0

    return features


def _compute_baseline_confidence(n_records: int, horizon: int) -> float:
    """Compute confidence for baseline forecast based on data quantity."""
    if n_records > 180 and horizon <= 7:
        return 0.55
    elif n_records > 90:
        return 0.48
    elif n_records > 30:
        return 0.40
    return 0.30


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.75:
        return "High"
    elif confidence >= 0.50:
        return "Medium"
    elif confidence >= 0.30:
        return "Low"
    return "Very Low"


def get_forecast_status(crop: str) -> Dict:
    """Get the current forecasting status for a crop."""
    status = get_model_status(crop)
    return {
        "crop": crop,
        "model_available": status.get("model_available", False),
        "model_name": status.get("model_name", "N/A"),
        "model_version": status.get("model_version", "N/A"),
        "beats_naive": status.get("beats_naive", False),
        "metrics": status.get("metrics", {}),
    }


def get_all_forecast_statuses() -> Dict[str, Dict]:
    """Get forecasting status for all supported crops."""
    return {crop: get_forecast_status(crop) for crop in SUPPORTED_CROPS}


def train_and_evaluate(
    crop: str,
    price_records: List[dict],
    horizon: int = 7,
) -> Dict:
    """Train a model and return the full evaluation result."""
    return train_crop_model(crop, price_records, target_horizon=horizon)
