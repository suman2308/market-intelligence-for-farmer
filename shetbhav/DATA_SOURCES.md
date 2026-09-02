# ShetBhav Data Sources

## Data Classification

### 1. REAL
| Data | Source | Status |
|------|--------|--------|
| Market price schema | AGMARKNET format | Schema-compatible |
| Crop taxonomy | India crops | Real crops |

**Note**: The application is designed to consume real AGMARKNET data via the adapter pattern (`MarketDataProvider` interface), but currently uses synthetic fallback data because the external API is not reliably available in the demo environment.

### 2. SYNTHETIC DEMO
| Data | Description |
|------|-------------|
| Market prices | Generated price series for Nashik, Pune, Mumbai, Kolhapur, Nagpur |
| Market arrivals | Synthetic daily arrival volumes |
| Buyer demand | 5 demo demand requests |
| Buyer profiles | 5 buyer companies with trust scores |
| Farmer profiles | 7 demo farmers across Maharashtra |
| Buyer payment history | Synthetic transaction records for trust scoring |
| Storage facilities | 2 demo facilities in Nashik |
| Transport costs | Haversine + INR 20/km estimation model |
| Grievances | 4 demo disputes |

**Every synthetic data point is clearly labeled in the UI** with:
- "Synthetic demo data" badge
- Data source labels on prices, forecasts, and recommendations

### 3. DERIVED
| Data | Calculation |
|------|------------|
| Net realization | gross - transport - storage - loss |
| Smart Sell score | Weighted multi-factor scoring |
| Buyer trust score | Transaction history + payment reliability |
| Transport cost | Distance × rate per km |
| Storage decision | Future price - current price - storage cost - spoilage |

### 4. MODEL PREDICTION
| Data | Model |
|------|-------|
| 7-day price forecast | XGBoost regressor |
| Confidence bands | Model error metrics |
| Trend direction | Forecast slope |

---

## Geographic Scope
- **Primary**: Maharashtra (Nashik, Pune, Mumbai, Kolhapur, Nagpur)
- **Crops**: Tomato, Onion, Soybean
- **Scalable**: Architecture supports adding states and crops

## Synthetic Data Generation
- Market prices: Random walk with mean reversion around ₹2000-2800/quintal range
- Seasonal patterns: Simulated monsoon/winter/harvest variations
- Cross-market correlation: Prices correlated within ±10% across markets
- Generated at database seed time, stored in SQLite/PostgreSQL

## External API Integration
The system is designed with adapter pattern for:
- **AGMARKNET** (Government market prices)
- **OpenStreetMap/OSRM** (routing)
- **Leaflet** (maps)

Currently, all external calls fall back to synthetic data.
