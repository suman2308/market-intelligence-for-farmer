"""
Feature Engineering — §16, §53
Builds feature matrices from mandi price history for forecasting models.

Features:
  - Lagged prices (1, 3, 7, 14, 30 days)
  - Rolling averages (3, 7, 14, 30 days)
  - Rolling std deviations
  - Price change ratios
  - Seasonality (day_of_year, month, week_of_year, sin/cos encoding)
  - Arrival volume features
  - Nearby-market features (cross-market price correlation)
"""
import math
import numpy as np
import pandas as pd
from typing import List, Optional, Tuple, Dict


# ── Feature Configuration ───────────────────────────────────────────
LAG_DAYS = [1, 3, 7, 14, 30]
ROLLING_WINDOWS = [3, 7, 14, 30]
TARGET_HORIZON = 7  # predict 7 days ahead by default
MIN_RECORDS_FOR_FEATURES = 60  # need at least 60 days for full lag features


def build_features(
    df: pd.DataFrame,
    target_horizon: int = TARGET_HORIZON,
    include_nearby: bool = False,
    nearby_dfs: Optional[List[pd.DataFrame]] = None,
) -> pd.DataFrame:
    """
    Build feature matrix from a time-sorted price DataFrame.

    Expected columns: date, modal_price, min_price, max_price, arrivals_qty
    Optional: market_id, crop_id

    Returns DataFrame with features + target column.
    Rows with NaN from lag/rolling are dropped.
    """
    if len(df) < MIN_RECORDS_FOR_FEATURES:
        return pd.DataFrame()

    df = df.sort_values("date").reset_index(drop=True)

    # ── Seasonality features ──────────────────────────────────────
    dates = pd.to_datetime(df["date"])
    df["day_of_year"] = dates.dt.dayofyear
    df["month"] = dates.dt.month
    df["day_of_week"] = dates.dt.dayofweek
    df["week_of_year"] = dates.dt.isocalendar().week.astype(int)

    # Cyclical encoding — captures wrap-around (Dec→Jan)
    df["sin_day_of_year"] = np.sin(2 * np.pi * df["day_of_year"] / 365.25)
    df["cos_day_of_year"] = np.cos(2 * np.pi * df["day_of_year"] / 365.25)
    df["sin_month"] = np.sin(2 * np.pi * df["month"] / 12)
    df["cos_month"] = np.cos(2 * np.pi * df["month"] / 12)

    # ── Lagged prices ─────────────────────────────────────────────
    for lag in LAG_DAYS:
        df[f"price_lag_{lag}"] = df["modal_price"].shift(lag)

    # ── Rolling averages and std ──────────────────────────────────
    for w in ROLLING_WINDOWS:
        df[f"price_ma_{w}"] = df["modal_price"].rolling(window=w, min_periods=1).mean()
        df[f"price_std_{w}"] = df["modal_price"].rolling(window=w, min_periods=1).std().fillna(0)
        df[f"arrivals_ma_{w}"] = df["arrivals_qty"].rolling(window=w, min_periods=1).mean()

    # ── Price change features ─────────────────────────────────────
    df["price_change_1d"] = df["modal_price"].pct_change(1).fillna(0)
    df["price_change_7d"] = df["modal_price"].pct_change(7).fillna(0)
    df["price_change_30d"] = df["modal_price"].pct_change(30).fillna(0)

    # ── Volatility (rolling coefficient of variation) ─────────────
    df["price_cv_7"] = (df["price_std_7"] / (df["price_ma_7"] + 1e-6)).fillna(0)
    df["price_cv_30"] = (df["price_std_30"] / (df["price_ma_30"] + 1e-6)).fillna(0)

    # ── Min/max range features ────────────────────────────────────
    df["price_range_7d"] = (
        df["modal_price"].rolling(7, min_periods=1).max()
        - df["modal_price"].rolling(7, min_periods=1).min()
    ).fillna(0)
    df["price_range_30d"] = (
        df["modal_price"].rolling(30, min_periods=1).max()
        - df["modal_price"].rolling(30, min_periods=1).min()
    ).fillna(0)

    # ── Arrival volume features ───────────────────────────────────
    for lag in [1, 7]:
        df[f"arrivals_lag_{lag}"] = df["arrivals_qty"].shift(lag)
    df["arrivals_change_7d"] = df["arrivals_qty"].pct_change(7).fillna(0)

    # ── Nearby-market features ────────────────────────────────────
    if include_nearby and nearby_dfs:
        for i, ndf in enumerate(nearby_dfs[:3]):
            ndf = ndf.sort_values("date").reset_index(drop=True)
            prefix = f"nearby_{i}"
            # Merge on date, take modal_price from nearby market
            if "date" in ndf.columns and "modal_price" in ndf.columns:
                nearby_prices = ndf.set_index("date")["modal_price"]
                df = df.set_index("date")
                df[f"{prefix}_price"] = nearby_prices.reindex(df.index, method="ffill")
                df = df.reset_index()
                df[f"{prefix}_price_ma_7"] = df[f"{prefix}_price"].rolling(7, min_periods=1).mean().fillna(0)
                df[f"{prefix}_price_diff"] = (df["modal_price"] - df[f"{prefix}_price"]).fillna(0)
                df.drop(columns=[f"{prefix}_price"], inplace=True, errors="ignore")

    # ── Target: price N days ahead ────────────────────────────────
    df[f"target_price_{target_horizon}d"] = df["modal_price"].shift(-target_horizon)

    # ── Drop rows with NaN target (end of series) ─────────────────
    df = df.dropna(subset=[f"target_price_{target_horizon}d"])

    # Fill remaining NaN in features with 0
    df = df.fillna(0)

    return df


def get_feature_columns(df: pd.DataFrame, target_horizon: int = TARGET_HORIZON) -> List[str]:
    """Return the list of feature columns (exclude target, date, and metadata)."""
    exclude_prefixes = ("target_", "date", "market_id", "crop_id")
    exclude_exact = {"date", "market_id", "crop_id"}
    cols = []
    for c in df.columns:
        if c.startswith(exclude_prefixes):
            continue
        if c in exclude_exact:
            continue
        cols.append(c)
    return cols


def prepare_training_data(
    price_records: List[dict],
    target_horizon: int = TARGET_HORIZON,
    nearby_records: Optional[List[List[dict]]] = None,
) -> Tuple[pd.DataFrame, List[str], str]:
    """
    Prepare training data from raw price records.

    Args:
        price_records: List of dicts with keys: date, modal_price, min_price, max_price, arrivals_qty
        target_horizon: Days ahead to predict
        nearby_records: Optional list of price record lists from nearby markets

    Returns:
        (feature_df, feature_columns, target_column)
    """
    df = pd.DataFrame(price_records)
    required_cols = {"date", "modal_price", "min_price", "max_price", "arrivals_qty"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        return pd.DataFrame(), [], ""

    nearby_dfs = None
    if nearby_records:
        nearby_dfs = [pd.DataFrame(r) for r in nearby_records if r]

    feature_df = build_features(
        df,
        target_horizon=target_horizon,
        include_nearby=bool(nearby_dfs),
        nearby_dfs=nearby_dfs,
    )

    if feature_df.empty:
        return pd.DataFrame(), [], ""

    feature_cols = get_feature_columns(feature_df, target_horizon)
    target_col = f"target_price_{target_horizon}d"

    return feature_df, feature_cols, target_col


def validate_data_quality(records: List[dict]) -> Dict:
    """
    §53: Data quality checks before training.
    Returns a dict with quality flags and issues.
    """
    if not records:
        return {
            "valid": False,
            "record_count": 0,
            "issues": ["No records provided"],
            "min_required": MIN_RECORDS_FOR_FEATURES,
        }

    df = pd.DataFrame(records)
    issues = []

    # Record count
    n = len(df)
    if n < MIN_RECORDS_FOR_FEATURES:
        issues.append(f"Only {n} records (minimum {MIN_RECORDS_FOR_FEATURES} needed)")

    # Date range
    if "date" in df.columns:
        dates = pd.to_datetime(df["date"])
        date_range_days = (dates.max() - dates.min()).days
        if date_range_days < 60:
            issues.append(f"Date range only {date_range_days} days (need ≥60)")
    else:
        issues.append("No 'date' column")
        date_range_days = 0

    # Missing dates
    if "date" in df.columns:
        dates_sorted = pd.to_datetime(df["date"]).sort_values()
        expected_days = (dates_sorted.max() - dates_sorted.min()).days
        actual_days = len(dates_sorted.unique())
        missing_pct = max(0, (expected_days - actual_days) / max(expected_days, 1)) * 100
        if missing_pct > 20:
            issues.append(f"{missing_pct:.0f}% dates missing (>20% threshold)")
    else:
        missing_pct = 0

    # Duplicate records
    if "date" in df.columns:
        dup_count = df.duplicated(subset=["date"]).sum()
        if dup_count > 0:
            issues.append(f"{dup_count} duplicate date records")
    else:
        dup_count = 0

    # Outliers — prices outside 3σ
    outlier_count = 0
    if "modal_price" in df.columns:
        prices = df["modal_price"].dropna()
        if len(prices) > 10:
            mean_p = prices.mean()
            std_p = prices.std()
            if std_p > 0:
                outlier_mask = (prices < mean_p - 3 * std_p) | (prices > mean_p + 3 * std_p)
                outlier_count = outlier_mask.sum()
                if outlier_count > len(prices) * 0.05:
                    issues.append(f"{outlier_count} outlier prices (>5% of data)")

    # Records per crop/mandi
    crop_counts = {}
    mandi_counts = {}
    if "crop_id" in df.columns:
        crop_counts = df["crop_id"].value_counts().to_dict()
    if "market_id" in df.columns:
        mandi_counts = df["market_id"].value_counts().to_dict()

    return {
        "valid": len(issues) == 0,
        "record_count": n,
        "date_range_days": date_range_days,
        "missing_date_pct": round(missing_pct, 1),
        "duplicate_records": dup_count,
        "outlier_count": outlier_count,
        "records_per_crop": crop_counts,
        "records_per_mandi": mandi_counts,
        "issues": issues,
        "min_required": MIN_RECORDS_FOR_FEATURES,
    }
