"""
Model Registry — §53
Manages model persistence, versioning, and metadata.
Uses joblib for model serialization.

Tracks:
  - Model file per crop
  - Feature columns per crop
  - Training metadata (dates, sizes, metrics)
  - Model version history
  - Comparison with baselines
"""
import os
import json
import joblib
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from dataclasses import asdict

MODELS_DIR = Path(__file__).resolve().parent.parent / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def get_model_path(crop: str, model_type: str = "xgboost") -> Path:
    """Get the path for a trained model file."""
    return MODELS_DIR / f"xgb_price_forecast_{crop}.joblib"


def get_feature_path(crop: str) -> Path:
    """Get the path for feature columns file."""
    return MODELS_DIR / f"features_{crop}.joblib"


def get_metadata_path(crop: str) -> Path:
    """Get the path for training metadata file."""
    return MODELS_DIR / f"metadata_{crop}.joblib"


def save_model(model, crop: str, feature_cols: List[str], metadata: Dict) -> None:
    """Save model, features, and metadata to disk."""
    joblib.dump(model, get_model_path(crop))
    joblib.dump(feature_cols, get_feature_path(crop))
    joblib.dump(metadata, get_metadata_path(crop))


def load_model(crop: str) -> Optional[Tuple]:
    """Load model, feature_cols, and metadata. Returns None if any file missing."""
    model_path = get_model_path(crop)
    feature_path = get_feature_path(crop)
    metadata_path = get_metadata_path(crop)

    if not all(p.exists() for p in [model_path, feature_path, metadata_path]):
        return None

    try:
        model = joblib.load(model_path)
        feature_cols = joblib.load(feature_path)
        metadata = joblib.load(metadata_path)
        return model, feature_cols, metadata
    except Exception:
        return None


def get_model_status(crop: str) -> Dict:
    """Get the current status of a trained model."""
    crop = crop.lower()
    loaded = load_model(crop)

    if loaded is None:
        return {
            "crop": crop,
            "model_available": False,
            "status": "not_trained",
        }

    _, _, metadata = loaded
    return {
        "crop": crop,
        "model_available": True,
        "model_name": metadata.get("model_name", "unknown"),
        "model_version": metadata.get("model_version", "unknown"),
        "trained_at": metadata.get("trained_at", "unknown"),
        "target_horizon": metadata.get("target_horizon", 7),
        "n_train": metadata.get("n_train", 0),
        "n_test": metadata.get("n_test", 0),
        "metrics": metadata.get("metrics", {}),
        "all_model_metrics": metadata.get("all_model_metrics", {}),
        "beats_naive": metadata.get("metrics", {}).get("beats_naive", False),
        "residual_std": metadata.get("residual_std", 0),
        "train_start": metadata.get("train_start", ""),
        "train_end": metadata.get("train_end", ""),
        "test_start": metadata.get("test_start", ""),
        "test_end": metadata.get("test_end", ""),
    }


def get_all_model_statuses() -> Dict[str, Dict]:
    """Get status of all supported crop models."""
    crops = ["tomato", "onion", "soybean"]
    return {crop: get_model_status(crop) for crop in crops}


def compare_models(crop: str) -> Optional[Dict]:
    """Get full model comparison report for a crop."""
    loaded = load_model(crop)
    if loaded is None:
        return None

    _, _, metadata = loaded
    all_metrics = metadata.get("all_model_metrics", {})

    return {
        "crop": crop,
        "selected_model": metadata.get("model_name", "unknown"),
        "model_version": metadata.get("model_version", "unknown"),
        "beats_naive": metadata.get("metrics", {}).get("beats_naive", False),
        "model_comparison": all_metrics,
        "recommendation": _get_model_recommendation(all_metrics),
    }


def _get_model_recommendation(all_metrics: Dict) -> str:
    """Generate a human-readable model recommendation."""
    xgb = all_metrics.get("xgboost", {})
    naive = all_metrics.get("naive", {})

    if not xgb:
        return "XGBoost not available. Using naive baseline."

    xgb_mae = xgb.get("mae", float("inf"))
    naive_mae = naive.get("mae", 0)

    if naive_mae == 0:
        return "Insufficient data for meaningful comparison."

    improvement = (naive_mae - xgb_mae) / naive_mae * 100

    if improvement >= 10:
        return f"XGBoost significantly outperforms naive baseline ({improvement:.1f}% MAE improvement). Model recommended."
    elif improvement >= 2:
        return f"XGBoost modestly outperforms naive ({improvement:.1f}% MAE improvement). Model acceptable."
    elif improvement > -5:
        return f"XGBoost similar to naive baseline ({improvement:.1f}% MAE). Using naive forecast."
    else:
        return f"XGBoost underperforms naive ({improvement:.1f}% MAE). Using naive baseline."


def list_saved_models() -> List[Dict]:
    """List all saved model files with their metadata."""
    models = []
    for path in MODELS_DIR.glob("metadata_*.joblib"):
        try:
            metadata = joblib.load(path)
            models.append({
                "crop": metadata.get("crop", "unknown"),
                "model_version": metadata.get("model_version", "unknown"),
                "trained_at": metadata.get("trained_at", "unknown"),
                "model_name": metadata.get("model_name", "unknown"),
            })
        except Exception:
            continue
    return models
