"""
Model Training Pipeline — §16, §53
Trains XGBoost regression per crop with chronological split validation.
Optionally trains HistGradientBoostingRegressor as a second model.

All training uses chronological split — NEVER random split.
Compares every model against naive baseline.
Falls back to naive/MA if data insufficient or XGBoost doesn't beat naive.
"""
import os
import math
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from dataclasses import asdict

from ml.feature_engineering import (
    build_features, get_feature_columns, prepare_training_data,
    validate_data_quality, MIN_RECORDS_FOR_FEATURES, TARGET_HORIZON,
)
from ml.baselines import compute_baseline_predictions, naive_forecast, moving_average_forecast
from ml.evaluation import (
    compute_metrics, compare_with_naive, chronological_split,
    ModelMetrics, rolling_origin_validation, aggregate_rolling_metrics,
)

MODELS_DIR = Path(os.environ.get("SHETBHAV_MODELS_DIR") or (Path(__file__).resolve().parent.parent / "data" / "models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_CROPS = ["tomato", "onion", "soybean"]
MODEL_VERSION = "2.0.0"


def train_crop_model(
    crop: str,
    price_records: List[dict],
    target_horizon: int = TARGET_HORIZON,
    use_hist_gbr: bool = False,
) -> Dict:
    """
    Train XGBoost (and optionally HistGradientBoosting) for a crop.

    Args:
        crop: crop name (tomato, onion, soybean)
        price_records: list of dicts with date, modal_price, min_price, max_price, arrivals_qty
        target_horizon: days ahead to predict
        use_hist_gbr: whether to also train HistGradientBoostingRegressor

    Returns:
        Training result dict with metrics, model info, and status.
    """
    crop = crop.lower()
    if crop not in SUPPORTED_CROPS:
        return {"error": f"Crop '{crop}' not supported. Use: {SUPPORTED_CROPS}"}

    # ── Data quality check ────────────────────────────────────────
    quality = validate_data_quality(price_records)
    if not quality["valid"]:
        return {
            "status": "insufficient_data",
            "crop": crop,
            "issues": quality["issues"],
            "record_count": quality["record_count"],
            "min_required": quality["min_required"],
            "model_trained": False,
        }

    # ── Prepare features ──────────────────────────────────────────
    feature_df, feature_cols, target_col = prepare_training_data(
        price_records, target_horizon=target_horizon
    )

    if feature_df.empty or not feature_cols:
        return {
            "status": "insufficient_data",
            "crop": crop,
            "issues": ["Could not build features from provided data"],
            "model_trained": False,
        }

    # ── Chronological split ───────────────────────────────────────
    train_df, val_df, test_df = chronological_split(feature_df)

    if len(train_df) < 30 or len(test_df) < 7:
        return {
            "status": "insufficient_data",
            "crop": crop,
            "issues": [f"Train set: {len(train_df)}, Test set: {len(test_df)} (need 30/7)"],
            "model_trained": False,
        }

    X_train = train_df[feature_cols].values
    y_train = train_df[target_col].values
    X_val = val_df[feature_cols].values
    y_val = val_df[target_col].values
    X_test = test_df[feature_cols].values
    y_test = test_df[target_col].values

    # ── Baselines ─────────────────────────────────────────────────
    all_prices = feature_df["modal_price"].tolist()
    baselines = compute_baseline_predictions(all_prices[:-len(test_df)], target_horizon)

    # Naive on test set: predict the last training price for each test day
    naive_preds = np.full(len(y_test), train_df["modal_price"].iloc[-1])
    ma7_preds = np.full(len(y_test), train_df["modal_price"].iloc[-target_horizon:].mean() if len(train_df) >= target_horizon else train_df["modal_price"].mean())

    naive_metrics = compute_metrics(y_test, naive_preds, "naive", n_train=len(train_df))
    naive_metrics = compare_with_naive(naive_metrics, y_test, naive_preds)

    ma7_metrics = compute_metrics(y_test, ma7_preds, "ma_7", n_train=len(train_df))
    ma7_metrics = compare_with_naive(ma7_metrics, y_test, naive_preds)

    # ── Train XGBoost ─────────────────────────────────────────────
    try:
        from xgboost import XGBRegressor
        has_xgb = True
    except ImportError:
        has_xgb = False

    xgb_result = None
    if has_xgb:
        xgb_model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbosity=0,
            early_stopping_rounds=20,
        )
        xgb_model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        xgb_pred = np.maximum(xgb_model.predict(X_test), 0)
        xgb_metrics = compute_metrics(
            y_test, xgb_pred, "xgboost",
            train_dates=train_df["date"] if "date" in train_df.columns else None,
            test_dates=test_df["date"] if "date" in test_df.columns else None,
            n_train=len(train_df),
        )
        xgb_metrics = compare_with_naive(xgb_metrics, y_test, naive_preds)

        # Compute residual std for prediction intervals
        residuals = y_test - xgb_pred
        residual_std = float(np.std(residuals))

        xgb_result = {
            "model": xgb_model,
            "metrics": xgb_metrics,
            "residual_std": residual_std,
            "feature_importance": dict(zip(feature_cols, xgb_model.feature_importances_.tolist())),
        }
    else:
        xgb_result = {
            "model": None,
            "metrics": ModelMetrics(model_name="xgboost", mae=float("inf")),
            "residual_std": 0,
        }

    # ── Optional: HistGradientBoostingRegressor ───────────────────
    hgb_result = None
    if use_hist_gbr:
        try:
            from sklearn.ensemble import HistGradientBoostingRegressor
            hgb_model = HistGradientBoostingRegressor(
                max_iter=200,
                learning_rate=0.05,
                max_depth=6,
                random_state=42,
            )
            hgb_model.fit(X_train, y_train)
            hgb_pred = np.maximum(hgb_model.predict(X_test), 0)
            hgb_metrics = compute_metrics(y_test, hgb_pred, "hist_gradient_boosting", n_train=len(train_df))
            hgb_metrics = compare_with_naive(hgb_metrics, y_test, naive_preds)
            hgb_residuals = y_test - hgb_pred
            hgb_result = {
                "model": hgb_model,
                "metrics": hgb_metrics,
                "residual_std": float(np.std(hgb_residuals)),
            }
        except Exception:
            hgb_result = None

    # ── Select best model ─────────────────────────────────────────
    candidates = []
    if xgb_result and xgb_result["model"] is not None:
        candidates.append(("xgboost", xgb_result))
    if hgb_result and hgb_result.get("model") is not None:
        candidates.append(("hist_gradient_boosting", hgb_result))

    best_name = "naive"
    best_result = None
    best_mae = naive_metrics.mae

    for name, result in candidates:
        m = result["metrics"]
        if m.mae < best_mae and m.beats_naive:
            best_mae = m.mae
            best_name = name
            best_result = result

    # ── Determine final model ─────────────────────────────────────
    model_trained = best_result is not None and best_result["model"] is not None
    use_model = model_trained and best_result["metrics"].beats_naive

    if use_model:
        # Save model
        model_path = MODELS_DIR / f"xgb_price_forecast_{crop}.joblib"
        feature_path = MODELS_DIR / f"features_{crop}.joblib"
        metadata_path = MODELS_DIR / f"metadata_{crop}.joblib"

        joblib.dump(best_result["model"], model_path)
        joblib.dump(feature_cols, feature_path)

        metadata = {
            "crop": crop,
            "model_name": best_name,
            "model_version": MODEL_VERSION,
            "trained_at": datetime.utcnow().isoformat(),
            "feature_columns": feature_cols,
            "target_horizon": target_horizon,
            "n_train": len(train_df),
            "n_val": len(val_df),
            "n_test": len(test_df),
            "train_start": str(train_df["date"].iloc[0]) if "date" in train_df.columns else "",
            "train_end": str(train_df["date"].iloc[-1]) if "date" in train_df.columns else "",
            "test_start": str(test_df["date"].iloc[0]) if "date" in test_df.columns else "",
            "test_end": str(test_df["date"].iloc[-1]) if "date" in test_df.columns else "",
            "metrics": best_result["metrics"].to_dict(),
            "residual_std": best_result["residual_std"],
            "all_model_metrics": {
                "naive": naive_metrics.to_dict(),
                "ma_7": ma7_metrics.to_dict(),
                best_name: best_result["metrics"].to_dict(),
            },
        }
        if hgb_result and hgb_result["model"] is not None:
            metadata["all_model_metrics"]["hist_gradient_boosting"] = hgb_result["metrics"].to_dict()

        joblib.dump(metadata, metadata_path)

    # ── Build result ──────────────────────────────────────────────
    all_metrics = {
        "naive": naive_metrics.to_dict(),
        "ma_7": ma7_metrics.to_dict(),
    }
    if xgb_result:
        all_metrics["xgboost"] = xgb_result["metrics"].to_dict()
    if hgb_result:
        all_metrics["hist_gradient_boosting"] = hgb_result["metrics"].to_dict()

    selected = best_result["metrics"].to_dict() if use_model else naive_metrics.to_dict()

    # If the fallback is selected, remove any stale model artifacts so status
    # endpoints never report an old model as current.
    if not use_model:
        for suffix in ("xgb_price_forecast", "features", "metadata"):
            p = MODELS_DIR / f"{suffix}_{crop}.joblib"
            if p.exists():
                p.unlink()

    return {
        "status": "trained" if use_model else "insufficient_data",
        "crop": crop,
        "model_trained": use_model,
        "selected_model": best_name if use_model else "naive",
        "model_version": MODEL_VERSION,
        "target_horizon": target_horizon,
        "all_metrics": all_metrics,
        "selected_metrics": selected,
        "beats_naive": best_result["metrics"].beats_naive if use_model else False,
        "data_quality": quality,
        "feature_count": len(feature_cols),
        "records_used": len(feature_df),
        "train_size": len(train_df),
        "test_size": len(test_df),
    }


def train_all_models(
    crop_data: Dict[str, List[dict]],
    target_horizon: int = TARGET_HORIZON,
    use_hist_gbr: bool = False,
) -> Dict[str, Dict]:
    """
    Train models for all supported crops.

    Args:
        crop_data: {crop_name: [price_records]}
        target_horizon: days ahead
        use_hist_gbr: include HistGradientBoostingRegressor
    """
    results = {}
    for crop in SUPPORTED_CROPS:
        records = crop_data.get(crop, [])
        results[crop] = train_crop_model(crop, records, target_horizon, use_hist_gbr)
    return results


def load_trained_model(crop: str) -> Optional[Tuple]:
    """Load a trained model, feature columns, and metadata. Returns None if not found."""
    crop = crop.lower()
    model_path = MODELS_DIR / f"xgb_price_forecast_{crop}.joblib"
    feature_path = MODELS_DIR / f"features_{crop}.joblib"
    metadata_path = MODELS_DIR / f"metadata_{crop}.joblib"

    if not all(p.exists() for p in [model_path, feature_path, metadata_path]):
        return None

    model = joblib.load(model_path)
    feature_cols = joblib.load(feature_path)
    metadata = joblib.load(metadata_path)
    return model, feature_cols, metadata
