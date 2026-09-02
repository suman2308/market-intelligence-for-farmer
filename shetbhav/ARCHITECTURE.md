# ShetBhav Architecture

## System Overview

ShetBhav is a full-stack web application with a Python/FastAPI backend and Next.js/TypeScript frontend.

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  Next.js 14 · TypeScript · Tailwind CSS     │
│  Zustand state · Axios API client           │
│  16 routes · EN/HI/MR i18n                  │
│  Mobile-first responsive design             │
└─────────────────┬───────────────────────────┘
                  │ REST API (JSON)
┌─────────────────▼───────────────────────────┐
│                  Backend                     │
│  FastAPI · Python 3.11 · Pydantic           │
│  50 API routes · JWT auth · RBAC            │
│  7 service modules · 1 ML pipeline          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│               Database                      │
│  SQLite (dev) · PostgreSQL/Supabase (prod)  │
│  30 tables · SQLAlchemy ORM                 │
│  Referential integrity · Indexes            │
└─────────────────────────────────────────────┘
```

## Backend Architecture

### Service Modules
1. **Smart Sell Decision Engine** (`smart_sell.py`) — Multi-factor scoring: net realization, buyer reliability, transport, storage, price forecast, quality match
2. **Market Data Service** (`market_data.py`) — Adapter pattern: external API → validation → normalization → DB → app. Fallback chain: live → cached → synthetic
3. **Forecasting Service** (`ml/forecasting.py`) — XGBoost/LightGBM price prediction with chronological train/test split, naive baseline comparison
4. **Logistics Service** (`logistics.py`) — Haversine distance, cost estimation, route consolidation
5. **FPO Aggregation** (`fpo_aggregation.py`) — Group farmer lots into aggregated orders
6. **Quality Grading** (`quality_grading.py`) — Prototype AI grading for Tomato, manual override for others
7. **Auth Service** (`services/auth.py`) — JWT tokens, password hashing, role verification

### Data Flow
```
External Source (AGMARKNET/synthetic)
    ↓
MarketDataAdapter (validate, normalize)
    ↓
Database (PostgreSQL/SQLite)
    ↓
API Layer (FastAPI + Pydantic validation)
    ↓
Frontend (Next.js)
    ↓
User Interface (mobile-first)
```

### Authorization
- JWT tokens with role claim
- `get_current_user` dependency extracts token
- `require_role(FARMER, BUYER, ADMIN)` gates endpoints
- Server-side enforcement: farmer cannot access buyer/admin endpoints

## Frontend Architecture

### Routing
| Path | Role | Description |
|------|------|-------------|
| `/login` | Public | Login with demo accounts |
| `/register` | Public | Create new account |
| `/farmer` | Farmer | Home dashboard |
| `/farmer/sell` | Farmer | Smart Sell 7-step wizard |
| `/farmer/prices` | Farmer | Market prices + forecast |
| `/farmer/buyers` | Farmer | Buyer directory |
| `/farmer/orders` | Farmer | Order tracking |
| `/farmer/earnings` | Farmer | Payment history |
| `/farmer/lots` | Farmer | My produce lots |
| `/farmer/profile` | Farmer | Profile + farm details |
| `/farmer/quality` | Farmer | Quality grading |
| `/buyer` | Buyer | Dashboard, lots, offers |
| `/admin` | Admin | Platform management |
| `/demo` | Public | SIH demo script |

### State Management
- **Zustand** for auth (user, token, loadUser, login, logout, register)
- Local `useState` for page-level state
- API responses cached in component state

### i18n
- Translation object in `i18n.ts` with `en`, `hi`, `mr` keys
- `useI18n()` hook returns `t(key)` function
- Language persisted in localStorage

## Database Schema (Key Relationships)

```
User (1) ─── (1) FarmerProfile ─── (N) ProduceLot
User (1) ─── (1) BuyerProfile ─── (N) DemandRequest
User (1) ─── (1) AdminProfile

ProduceLot (N) ─── (N) Offer ─── (1) DemandRequest
Offer (1) ─── (N) OfferHistory
Offer (1) ─── (0..1) Order ─── (1) Payment
Order (N) ─── (N) OrderItem

Crop (1) ─── (N) ProduceLot
Market (1) ─── (N) MarketPrice
Market (1) ─── (N) MarketArrival

Order (1) ─── (0..1) Logistics
Order (1) ─── (N) Grievance
User (1) ─── (N) Notification
```

## ML Pipeline

### Price Forecasting
1. **Data**: Historical synthetic market prices (90-day window per crop/market)
2. **Features**: day_of_week, month, day_of_month, seasonality, lag values, rolling averages
3. **Model**: XGBoost regressor (per-crop models)
4. **Training**: Chronological split (no data leakage)
5. **Evaluation**: MAE, RMSE vs naive baseline
6. **Prediction**: Next 7 days with confidence bands

### Smart Sell Scoring
Factors (0-100 scale):
- Net realization (30 points)
- Price advantage vs market average (15)
- Transport cost (15)
- Buyer reliability/payment history (10)
- Quality match (10)
- Quantity fit (5)
- Urgency alignment (5)
- Forecast trend (10)

## Deployment Targets

| Component | Target | Config |
|-----------|--------|--------|
| Frontend | Vercel | `npm run build` |
| Backend | Render/Railway | `uvicorn app.main:app` |
| Database | Supabase | PostgreSQL connection string |
| ML Models | Backend server | Trained at startup |
