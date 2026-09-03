# ShetBhav — Machine Learning Pipeline

**Last Updated:** September 4, 2026

---

## Overview

ShetBhav uses two ML components:
1. **Price Forecasting** — XGBoost regression with baseline comparison
2. **Quality Grading** — Rule-based computer vision analysis

---

## Price Forecasting

### Training Data

| Field | Value |
|-------|-------|
| Source | data.gov.in AGMARKNET live API + imported historical dataset (real records only — synthetic demo rows are excluded from training) |
| Records (dev DB) | 863 market price records — 770 imported as `historical_dataset` + 93 live-fetched |
| Aggregation | Prices arrive per mandi per day; records are aggregated to **one daily series per crop** (mean modal/min/max across mandis) before training |
| Crops | Onion, Tomato (the AGMARKNET subset we pull contains no Soybean arrivals — Soybean forecasts are unavailable) |
| Markets | ~69 Maharashtra mandis mapped in the DB |
| Date range | 2026-06-05 → 2026-09-03 (~78 unique daily points per crop in the dev DB) |
| Target | Next 7-day modal price per crop |
| Reproducibility | A fresh database auto-imports the tracked real CSV (`IMPORT_HISTORICAL_CSV=true`) and re-evaluates models at boot (`TRAIN_ON_STARTUP=true`) |

### Features (40+)

- Lag prices: 1, 3, 7, 14, 28 days
- Rolling averages: 7, 14, 30 days
- Rolling volatility (std deviation)
- Coefficient of variation
- Arrival quantity and changes
- Seasonality: month, week of year
- Mandi, crop, variety, grade (categorical)
- Nearby mandi price features

### Models

| Model | Purpose |
|-------|---------|
| Naive baseline | Next price = latest price |
| MA-7 baseline | Next price = 7-day moving average |
| MA-14 baseline | Next price = 14-day moving average |
| XGBoost | Primary regression model |
| HistGBR (optional) | Alternative gradient boosting |

### Validation

- **Chronological split**: 70% train / 15% validation / 15% test
- **No random splitting** — time-series order preserved
- **No future data leakage** — lags are backward-only, target shifted forward
- **Rolling-origin** validation supported

### Model Selection

XGBoost is only used if it beats the naive baseline by ≥2% MAE on a chronological holdout. Otherwise the naive baseline is used **and clearly labeled** — no model artifact is reported as current.

**Current evaluation (September 4, 2026):** trained on the real aggregated series (~78 daily points per crop). XGBoost did not beat naive persistence on the 11-day holdout, so the system correctly fell back:

| Crop | Selected | Holdout MAE (₹/q) | Holdout RMSE | MAPE |
|------|----------|-------------------|--------------|------|
| Tomato | naive baseline | 25.94 | 33.51 | 2.0% |
| Onion | naive baseline | 94.58 | 132.2 | 2.45% |
| Soybean | none (no real data) | — | — | — |

Re-evaluate any time more data is available: `POST /forecasts/train?crop=tomato|onion` (admin). The forecast status endpoint reflects reality — it reports `model_available: false` while the baseline is in use, instead of claiming a stale model.

### Metrics

| Metric | Description |
|--------|-------------|
| MAE | Mean Absolute Error in Rs/quintal |
| RMSE | Root Mean Squared Error |
| MAPE | Mean Absolute Percentage Error (only when safe) |
| Naive comparison | % improvement over naive baseline |

### Forecast Output

```json
{
  "crop": "onion",
  "mandi": "Nashik APMC",
  "horizon_days": 7,
  "predicted_price": 2200,
  "expected_low": 2050,
  "expected_high": 2350,
  "confidence": 0.72,
  "model_name": "xgboost",
  "model_version": "1.0",
  "trained_until": "2026-09-01",
  "data_source": "data.gov.in / AGMARKNET",
  "forecast_status": "forecast_available",
  "explanation": "Based on 93 days of mandi price data"
}
```

### When XGBoost Isn't Used

XGBoost needs a long, clean daily series to beat persistence — a few months of daily mandi data isn't enough, and that's expected. When it can't beat naive:
- Forecasts still work (naive persistence + confidence intervals)
- `confidence = low` and the UI explains the limitation
- The API never labels a baseline prediction as an "ML forecast"

### Model Persistence

- Models saved via joblib
- Version tracking with metadata
- Auto-retrained on startup if data available
- Stored in `shetbhav/backend/data/models/`

---

## Quality Grading (Computer Vision)

### Approach

Rule-based analysis using PIL and numpy — **not a trained neural network**.

### Supported Crops

| Crop | Indicators |
|------|-----------|
| Tomato | Ripeness/color, size uniformity, bruising, cracking, visible rot, shape |
| Onion | Size uniformity, skin color, visible rot, sprouting, bruising, surface damage, foreign matter |
| Soybean | Visible foreign matter, color consistency, damaged beans, visible surface defects |

### Image Quality Checks

- Resolution validation (minimum 200x200)
- Blur detection (Laplacian variance)
- Darkness/brightness detection
- Overexposure detection

### Output

```json
{
  "crop": "tomato",
  "estimated_grade": "B",
  "confidence": 0.65,
  "visible_observations": ["Good color uniformity", "Minor bruising detected"],
  "detected_issues": ["Some surface bruising"],
  "missing_information": ["Internal quality not assessed"],
  "verification_type": "ai_assisted",
  "manual_verification_required": true,
  "model_name": "rule_based_cv",
  "model_version": "1.0"
}
```

### Verification Types

- `self_declared` — Farmer's own assessment
- `ai_assisted` — Computer vision estimate
- `manually_verified` — Admin/FPO verified
- `lab_verified` — Laboratory testing

### Limitations

- Cannot detect internal damage, moisture, pesticide residue, hidden rot
- Low confidence (<50%) returns "Unable to estimate confidently"
- Always labeled as "AI-assisted quality estimate" (not "certified grade")
- Manual verification recommended for commercial transactions

---

## Smart Sell Integration

The Smart Sell engine uses ML outputs as **one input among many**:

| Factor | Weight | ML Input |
|--------|--------|----------|
| Net realization | 30% | Price forecast, transport cost, storage cost |
| Price advantage | 15% | Mandi price comparison |
| Transport cost | 10% | Distance-based estimate |
| Buyer demand | 10% | Platform demand data |
| Quality match | 10% | Quality grading result |
| Payment reliability | 10% | Buyer transaction history |
| Timing | 10% | Urgency and forecast trend |
| Distance | 5% | GPS-based distance |

**Never relies on forecast alone** — always compares mandi, buyer, storage, and FPO options.
