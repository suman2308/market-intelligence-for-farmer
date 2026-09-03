"""
Baseline Forecasting Models — §53
Simple baselines that XGBoost must outperform:
  1. Naive: next price = latest available price
  2. Moving Average (7-day): next price = mean of last 7 days
  3. Moving Average (14-day): next price = mean of last 14 days

Every ML model is compared against these baselines.
If XGBoost cannot beat the naive baseline, it should not be used.
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple


def naive_forecast(
    prices: List[float],
    horizon: int = 7,
) -> Dict:
    """
    Naive baseline: predict the latest available price for all future horizons.
    This is the hardest baseline to beat — it assumes no change.

    Returns:
        predictions: list of predicted prices for each day in horizon
        point_prediction: the single prediction (latest price)
    """
    if not prices:
        return {"predictions": [], "point_prediction": 0, "method": "naive"}

    latest = prices[-1]
    predictions = [latest] * horizon
    return {
        "predictions": predictions,
        "point_prediction": round(latest, 2),
        "method": "naive",
        "explanation": f"Assumes price stays at ₹{latest:,.0f}/quintal (latest available)",
    }


def moving_average_forecast(
    prices: List[float],
    window: int = 7,
    horizon: int = 7,
) -> Dict:
    """
    Moving average baseline: predict the recent average for all future horizons.

    Args:
        prices: historical price series (sorted oldest to newest)
        window: number of recent days to average
        horizon: days ahead to forecast
    """
    if len(prices) < min(window, 3):
        latest = prices[-1] if prices else 0
        return {
            "predictions": [latest] * horizon,
            "point_prediction": round(latest, 2),
            "method": f"moving_average_{window}",
            "window": window,
            "explanation": f"Insufficient data for {window}-day average, using latest price",
        }

    recent = prices[-window:]
    avg = np.mean(recent)
    predictions = [round(float(avg), 2)] * horizon

    return {
        "predictions": predictions,
        "point_prediction": round(float(avg), 2),
        "method": f"moving_average_{window}",
        "window": window,
        "explanation": f"Based on {window}-day average of ₹{avg:,.0f}/quintal",
    }


def linear_trend_forecast(
    prices: List[float],
    horizon: int = 7,
    lookback: int = 14,
) -> Dict:
    """
    Linear trend baseline: fit a line to recent data and extrapolate.
    Used as a secondary reference — not a primary baseline.
    """
    if len(prices) < lookback or len(prices) < 5:
        latest = prices[-1] if prices else 0
        return {
            "predictions": [latest] * horizon,
            "point_prediction": round(latest, 2),
            "method": "linear_trend_fallback",
            "explanation": "Insufficient data for trend, using latest price",
        }

    recent = prices[-lookback:]
    x = np.arange(len(recent))
    coeffs = np.polyfit(x, recent, 1)
    slope, intercept = coeffs

    future_x = np.arange(len(recent), len(recent) + horizon)
    predictions = np.polyval(coeffs, future_x)
    predictions = np.maximum(predictions, 0)  # prices can't be negative

    return {
        "predictions": predictions.tolist(),
        "point_prediction": round(float(predictions[0]), 2),
        "method": "linear_trend",
        "lookback": lookback,
        "slope_per_day": round(float(slope), 2),
        "explanation": f"Linear trend over {lookback} days (slope: ₹{slope:+.0f}/day)",
    }


def compute_baseline_predictions(
    historical_prices: List[float],
    horizon: int = 7,
) -> Dict[str, Dict]:
    """
    Compute all baseline predictions for comparison.

    Returns dict keyed by baseline name.
    """
    return {
        "naive": naive_forecast(historical_prices, horizon),
        "ma_7": moving_average_forecast(historical_prices, window=7, horizon=horizon),
        "ma_14": moving_average_forecast(historical_prices, window=14, horizon=horizon),
    }


def get_best_baseline(
    historical_prices: List[float],
    horizon: int = 7,
) -> Tuple[str, Dict]:
    """
    Select the best baseline using recent holdout data.
    Uses last 'horizon' days as validation set.

    Returns (best_baseline_name, best_baseline_result)
    """
    if len(historical_prices) < horizon + 14:
        # Not enough data for evaluation — default to naive
        result = naive_forecast(historical_prices, horizon)
        return "naive", result

    # Holdout: last 'horizon' days are the actual future
    train_prices = historical_prices[:-horizon]
    actuals = np.array(historical_prices[-horizon:])

    baselines = compute_baseline_predictions(train_prices, horizon)

    best_name = "naive"
    best_mae = float("inf")

    for name, bl in baselines.items():
        preds = np.array(bl["predictions"][:len(actuals)])
        if len(preds) == 0:
            continue
        mae = np.mean(np.abs(actuals - preds))
        if mae < best_mae:
            best_mae = mae
            best_name = name

    return best_name, baselines[best_name]
