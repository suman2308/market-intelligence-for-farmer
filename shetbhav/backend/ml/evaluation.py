"""
Model Evaluation — §53
Chronological split validation, metric computation, naive baseline comparison.

Metrics:
  - MAE (Mean Absolute Error) in Rs/quintal
  - RMSE (Root Mean Squared Error) in Rs/quintal
  - MAPE (Mean Absolute Percentage Error) — only when no zero prices
  - Improvement over naive baseline (%)

Validation strategy:
  - Chronological split: first 70% train, next 15% validation, last 15% test
  - NO random split — preserves temporal order
  - Rolling-origin validation for robust estimates
"""
import math
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict


@dataclass
class ModelMetrics:
    """Complete metrics for a single model evaluation."""
    model_name: str
    mae: float = 0.0
    rmse: float = 0.0
    mape: Optional[float] = None  # None when unsafe to compute
    naive_mae: float = 0.0
    naive_rmse: float = 0.0
    improvement_over_naive_mae_pct: float = 0.0
    improvement_over_naive_rmse_pct: float = 0.0
    n_test_samples: int = 0
    training_period: str = ""
    testing_period: str = ""
    train_start: str = ""
    train_end: str = ""
    test_start: str = ""
    test_end: str = ""
    n_train_samples: int = 0
    beats_naive: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def compute_metrics(
    actuals: np.ndarray,
    predictions: np.ndarray,
    model_name: str = "model",
    train_dates: Optional[pd.Series] = None,
    test_dates: Optional[pd.Series] = None,
    n_train: int = 0,
) -> ModelMetrics:
    """
    Compute MAE, RMSE, and (safe) MAPE for model predictions.

    Args:
        actuals: true prices
        predictions: predicted prices
        model_name: identifier
        train_dates: dates used for training (for reporting)
        test_dates: dates used for testing (for reporting)
        n_train: number of training samples
    """
    actuals = np.array(actuals, dtype=float)
    predictions = np.array(predictions, dtype=float)

    # Clip predictions to non-negative
    predictions = np.maximum(predictions, 0)

    n = len(actuals)
    if n == 0:
        return ModelMetrics(model_name=model_name)

    mae = float(np.mean(np.abs(actuals - predictions)))
    rmse = float(math.sqrt(np.mean((actuals - predictions) ** 2)))

    # MAPE — only when no actuals are zero or near-zero
    mape = None
    safe_mask = np.abs(actuals) > 10  # ignore near-zero prices
    if safe_mask.sum() > 0:
        mape = float(np.mean(np.abs((actuals[safe_mask] - predictions[safe_mask]) / actuals[safe_mask])) * 100)

    metrics = ModelMetrics(
        model_name=model_name,
        mae=round(mae, 2),
        rmse=round(rmse, 2),
        mape=round(mape, 2) if mape is not None else None,
        n_test_samples=n,
        n_train_samples=n_train,
    )

    # Date ranges
    if train_dates is not None and len(train_dates) > 0:
        metrics.train_start = str(train_dates.iloc[0])
        metrics.train_end = str(train_dates.iloc[-1])
        metrics.training_period = f"{metrics.train_start} to {metrics.train_end}"
    if test_dates is not None and len(test_dates) > 0:
        metrics.test_start = str(test_dates.iloc[0])
        metrics.test_end = str(test_dates.iloc[-1])
        metrics.testing_period = f"{metrics.test_start} to {metrics.test_end}"

    return metrics


def compare_with_naive(
    model_metrics: ModelMetrics,
    naive_actuals: np.ndarray,
    naive_predictions: np.ndarray,
) -> ModelMetrics:
    """
    Compare model metrics against naive baseline.
    Updates model_metrics with improvement percentages.
    """
    naive_mae = float(np.mean(np.abs(naive_actuals - naive_predictions)))
    naive_rmse = float(math.sqrt(np.mean((naive_actuals - naive_predictions) ** 2)))

    model_metrics.naive_mae = round(naive_mae, 2)
    model_metrics.naive_rmse = round(naive_rmse, 2)

    if naive_mae > 0:
        model_metrics.improvement_over_naive_mae_pct = round(
            (naive_mae - model_metrics.mae) / naive_mae * 100, 1
        )
    if naive_rmse > 0:
        model_metrics.improvement_over_naive_rmse_pct = round(
            (naive_rmse - model_metrics.rmse) / naive_rmse * 100, 1
        )

    # Model "beats naive" if MAE improvement ≥ 2% (modest threshold)
    model_metrics.beats_naive = model_metrics.improvement_over_naive_mae_pct >= 2.0

    return model_metrics


def chronological_split(
    df: pd.DataFrame,
    train_pct: float = 0.70,
    val_pct: float = 0.15,
    test_pct: float = 0.15,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Chronological split — NO random shuffling.
    First 70% = train, next 15% = validation, last 15% = test.
    """
    n = len(df)
    train_end = int(n * train_pct)
    val_end = int(n * (train_pct + val_pct))

    train = df.iloc[:train_end].copy()
    val = df.iloc[train_end:val_end].copy()
    test = df.iloc[val_end:].copy()

    return train, val, test


def rolling_origin_validation(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_col: str,
    model_class,
    model_params: dict,
    min_train_size: int = 120,
    step: int = 7,
    horizon: int = 7,
) -> List[ModelMetrics]:
    """
    Rolling-origin (expanding window) validation.
    More robust than a single chronological split.

    For each origin:
      - Train on all data up to origin
      - Test on the next 'horizon' days
      - Move origin forward by 'step' days
    """
    results = []
    n = len(df)

    for origin in range(min_train_size, n - horizon, step):
        train = df.iloc[:origin]
        test_end = min(origin + horizon, n)
        test = df.iloc[origin:test_end]

        if len(test) == 0:
            continue

        X_train = train[feature_cols].values
        y_train = train[target_col].values
        X_test = test[feature_cols].values
        y_test = test[target_col].values

        # Train model
        try:
            model = model_class(**model_params)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
        except Exception:
            continue

        # Naive baseline for this window
        naive_pred = np.full(len(y_test), train[target_col].iloc[-1])

        metrics = compute_metrics(
            actuals=y_test,
            predictions=y_pred,
            model_name="rolling_xgb",
            n_train=len(train),
        )
        metrics = compare_with_naive(metrics, y_test, naive_pred)
        results.append(metrics)

    return results


def aggregate_rolling_metrics(rolling_results: List[ModelMetrics]) -> ModelMetrics:
    """Aggregate rolling-origin results into a single summary."""
    if not rolling_results:
        return ModelMetrics(model_name="aggregated_rolling")

    n = len(rolling_results)
    return ModelMetrics(
        model_name="xgboost_rolling_avg",
        mae=round(np.mean([r.mae for r in rolling_results]), 2),
        rmse=round(np.mean([r.rmse for r in rolling_results]), 2),
        mape=round(np.mean([r.mape for r in rolling_results if r.mape is not None]), 2)
        if any(r.mape is not None for r in rolling_results)
        else None,
        naive_mae=round(np.mean([r.naive_mae for r in rolling_results]), 2),
        naive_rmse=round(np.mean([r.naive_rmse for r in rolling_results]), 2),
        improvement_over_naive_mae_pct=round(
            np.mean([r.improvement_over_naive_mae_pct for r in rolling_results]), 1
        ),
        beats_naive=np.mean([r.beats_naive for r in rolling_results]) > 0.5,
        n_test_samples=sum(r.n_test_samples for r in rolling_results),
        n_train_samples=max(r.n_train_samples for r in rolling_results),
    )
