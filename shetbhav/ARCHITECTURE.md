# ShetBhav Architecture

**Last updated:** September 2026

This document explains how ShetBhav is built — the pieces, how they talk to each other, and how data flows from data.gov.in all the way to the farmer's phone.

---

## System Overview

ShetBhav is a full-stack web app with a Python backend and a Next.js frontend.

```
┌────────────────────────────────────────────────┐
│                   Frontend                     │
│  Next.js 16 · TypeScript · Tailwind CSS        │
│  Zustand state · Axios API client              │
│  17 routes · EN/HI/MR i18n                     │
│  Mobile-first (farmer) + desktop (business)    │
└───────────────────┬────────────────────────────┘
                    │ REST API (JSON + JWT)
┌───────────────────▼────────────────────────────┐
│                   Backend                      │
│  FastAPI · Python 3.11 · Pydantic              │
│  69 API endpoints) · JWT auth · RBAC   │
│  7 service modules · 1 ML pipeline             │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│                 Database                       │
│  SQLite (dev) · PostgreSQL (Render prod)       │
│  43 tables · SQLAlchemy ORM                    │
│  Referential integrity · Indexes               │
└────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Service Modules

1. **Smart Sell Decision Engine** (`services/smart_sell.py`) — Compares selling options (mandi now, verified buyer, store-and-sell-later, FPO collective) using multi-factor scoring. Net realisation = gross value − transport − storage − handling − charges − spoilage.
2. **Market Data Service** (`services/market_data.py`) — Adapter pattern: external API → validation → normalization → DB → app. Fallback chain: **live → cached → demo**.
3. **data.gov.in Client** (`services/data_gov.py`) — Fetches official AGMARKNET mandi prices, validates records, deduplicates, stores with full source metadata.
4. **Forecasting Service** (`ml/forecasting.py`) — XGBoost price prediction with chronological train/test split and naive-baseline comparison. Falls back gracefully when data is thin.
5. **Logistics Service** (`services/logistics.py`) — Haversine distance, cost estimation, storage decisions.
6. **FPO Aggregation** (`services/fpo_aggregation.py`) — Groups member farmer lots into collective lots for better bargaining.
7. **Quality Grading** (`services/quality_grading.py` + `ml/crop_vision.py`) — Rule-based computer-vision estimate for Tomato, Onion, Soybean. Always labeled "AI-assisted estimate", never "certified".
8. **Auth Service** (`services/auth.py`) — JWT tokens, bcrypt password hashing, role verification.

### Data Flow

```
data.gov.in API (official daily mandi prices)
    ↓ validate, normalize, deduplicate
Database cache (market_price_records)
    ↓ FastAPI + Pydantic validation
Frontend (Next.js)
    ↓
Farmer sees price cards with source badges
```

If the live API fails: cached official data → clearly-labeled demo data. We never show cached or demo data as live.

### Authorization

- JWT tokens carry a role claim.
- `get_current_user` dependency extracts and validates the token.
- `require_role(FARMER, BUYER, ADMIN)` gates endpoints server-side.
- A farmer token cannot access buyer or admin endpoints.

---

## Frontend Architecture

### Routing

| Path | Role | Description |
|------|------|-------------|
| `/login` | Public | Sign in (credentials → role selection) |
| `/register` | Public | Create account (details → role selection) |
| `/farmer` | Farmer | Home dashboard with Smart Sell recommendation |
| `/farmer/sell` | Farmer | Smart Sell wizard (one question per screen) |
| `/farmer/prices` | Farmer | Market prices + forecast |
| `/farmer/buyers` | Farmer | Buyer directory |
| `/farmer/orders` | Farmer | Order tracking |
| `/farmer/earnings` | Farmer | Payment history |
| `/farmer/lots` | Farmer | My produce lots |
| `/farmer/profile` | Farmer | Profile + farm details |
| `/farmer/quality` | Farmer | Quality grading |
| `/buyer` | Buyer | Dashboard, lots, offers |
| `/fpo` | FPO | Members, lots, aggregation |
| `/admin` | Admin | Platform management |

### Layouts

- **Farmer pages** are mobile-first. On desktop browsers the app still renders the phone-width experience (`farmer-shell`, centered, max 420px) so the farmer interface is identical everywhere.
- **Buyer, FPO, Admin pages** use the desktop sidebar layout (`has-sidebar`) on wide screens and collapse to single column on mobile.

### State Management

- **Zustand** for auth (user, token, loadUser, login, logout, register).
- Local `useState` for page-level state.
- Language and session persisted in localStorage.

### i18n

- Translation dictionary in `lib/i18n.ts` for `en`, `hi`, `mr`.
- `useI18n()` hook returns `t(key)`.
- Language persists and switches instantly; Devanagari renders via Noto Sans Devanagari.

---

## Database Schema (Key Relationships)

```
User (1) ─── (1) FarmerProfile ─── (N) ProduceLot
User (1) ─── (1) BuyerProfile ─── (N) DemandRequest
User (1) ─── (1) AdminProfile
User (1) ─── (1) FPOProfile ─── (N) FPOMember

ProduceLot (N) ─── (N) Offer ─── (1) DemandRequest
Offer (1) ─── (N) OfferHistory (every counter-offer preserved)
Offer (1) ─── (0..1) Order ─── (1) Payment
Order (N) ─── (N) OrderEvent (timeline)

Crop (1) ─── (N) ProduceLot
Market (1) ─── (N) MarketPrice
MarketPrice carries source_name, source_type, data_as_of, retrieved_at, is_demo

Order (1) ─── (0..1) Logistics
Order (1) ─── (N) Grievance
User (1) ─── (N) Notification
Lot (1) ─── (1) QualityReport (verification_type, grade, confidence)
```

43 tables total, defined in `models/database.py`.

---

## ML Pipeline

### Price Forecasting

1. **Data**: 863 real market-price records in the database — 770 imported AGMARKNET historical records + 93 records fetched live from the data.gov.in API. No synthetic data used for training.
2. **Features**: lag prices (1, 3, 7, 14, 28 days), rolling averages (7/14/30), rolling volatility, arrival quantity, month/week-of-year seasonality, mandi + crop + variety + grade.
3. **Model**: XGBoost regressor, one per crop. Naive (last value) and moving-average (7/14-day) baselines for comparison.
4. **Validation**: chronological split only — never random shuffling on time-series data. No future leakage (lags are backward-only, target shifted forward).
5. **Evaluation**: MAE (₹/quintal), RMSE, MAPE (only when safe), % improvement over naive baseline.
6. **Honesty rule**: XGBoost is only used when it beats the naive baseline by at least 2% MAE. Otherwise the naive/MA baseline is used with low confidence.

### Smart Sell Scoring

Factors (0–100 scale):

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Net realisation | 30% | Gross value minus all costs |
| Price advantage | 15% | vs market average |
| Transport cost | 10% | Distance-based estimate |
| Buyer demand | 10% | Platform demand for the crop |
| Quality match | 10% | Lot vs buyer requirements |
| Payment reliability | 10% | Buyer transaction history |
| Timing | 10% | Urgency + forecast trend |
| Distance | 5% | Farmer ↔ buyer distance |

The forecast is **one input among many** — never the sole basis for a recommendation.

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `https://market-intelligence-for-farmer.vercel.app` |
| Backend | Render | `https://shetbhav-backend.onrender.com` |
| Database | Render PostgreSQL | Auto-provisioned by Blueprint |
| Health Check | /health | `https://shetbhav-backend.onrender.com/health` |
| API Docs | /docs | `https://shetbhav-backend.onrender.com/docs` |

### Auto-Deploy

- **Vercel** deploys the frontend on every push to `main`.
- **Render** deploys the backend on every push (`autoDeployTrigger: commit`).
- **UptimeRobot** pings `/health` every 5 minutes so the free Render instance stays awake.

### ML Models

- Trained at startup from imported market data.
- Persisted via joblib.
- No separate model-serving infrastructure (fine for an MVP).