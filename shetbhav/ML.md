# ShetBhav ML Pipeline

## Price Forecasting

### Model
- **Algorithm**: XGBoost Regressor (per-crop, per-market)
- **Alternative**: LightGBM available as fallback
- **Training**: 90 days of historical synthetic market prices
- **Features**: day_of_week, month, day_of_month, seasonality, lag values (1-7 days), rolling averages (3/7 day)

### Training Pipeline
1. Fetch historical prices for crop + market
2. Engineer time-series features
3. Chronological train/test split (80/20)
4. Train XGBoost with default hyperparameters
5. Evaluate against naive baseline (yesterday's price)
6. Store model metadata and evaluation metrics

### Evaluation
| Crop | Model MAE | Baseline MAE | Beats Baseline |
|------|-----------|-------------|----------------|
| Tomato | ~160 | ~160 | Marginal |
| Onion | ~145 | ~120 | No (use baseline) |
| Soybean | ~128 | ~174 | Yes |

### Prediction
- 7-day ahead forecast
- Confidence bands based on model error
- Low confidence: "Price outlook is uncertain"

### Limitations
- Trained on synthetic data, not real AGMARKNET prices
- No external feature integration (weather, policy, supply chain)
- Model retraining available via API but not scheduled

## Smart Sell Decision Engine

### Scoring Methodology (0-100)
| Factor | Weight | Source |
|--------|--------|--------|
| Net realization | 30 | Calculated from gross price - costs |
| Price advantage | 15 | vs market average |
| Transport cost | 15 | Haversine distance + cost model |
| Buyer reliability | 10 | Transaction history, payment rate |
| Quality match | 10 | Lot grade vs buyer requirement |
| Quantity fit | 5 | Lot size vs demand |
| Urgency alignment | 5 | Sell window vs urgency |
| Forecast trend | 10 | Price direction prediction |

### Net Realization Formula
```
net = gross_price - transport_cost - storage_cost - expected_loss
```

### What-If Scenarios
- Sell now at current price
- Store and sell later (with storage cost and forecast)
- Sell to different buyers/markets
- Risk levels: Low / Medium / High

## Quality Grading

### Current Implementation
- **Tomato**: Prototype model with fixed scoring rules
- **Others**: Manual grade selection only
- **Confidence**: Reported but based on synthetic data

### Future
- Computer vision model for image-based grading
- Multi-crop support
- Buyer feedback integration

## Data Sources
- Market prices: Synthetic demo data (clearly labeled)
- Transport costs: Haversine distance + INR 20/km estimation
- Storage costs: Synthetic demo data
- Buyer reliability: Calculated from demo transaction history
