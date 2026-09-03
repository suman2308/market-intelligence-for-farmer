# ShetBhav — Machine Learning Pipeline

**Last Updated:** September 3, 2026

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
| Source | data.gov.in AGMARKNET + imported historical dataset |
| Records | 549 market price records (219 imported + seeded demo) |
| Crops | Onion, Tomato, Soybean |
| Markets | 7 Maharashtra mandis |
| Date range | Recent 93 days |
| Target | Next 7-day modal price per crop |

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

XGBoost is only used if it beats the naive baseline by ≥2% MAE. Otherwise, the naive or MA-7 baseline is used with low confidence.

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

### Insufficient Data

When data is insufficient for XGBoost (<50 records per crop):
- Returns `forecast_status = insufficient_data`
- Returns `confidence = low`
- Uses naive or MA-7 baseline
- Explains the limitation to the user

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
