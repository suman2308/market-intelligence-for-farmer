# ShetBhav (शेतभाव)

### *Know the market. Choose better. Earn more.*

AI-powered agricultural market intelligence platform for Indian farmers, FPOs, and buyers. Built for [Smart India Hackathon 2026 — SIH26132](https://www.sih.gov.in/).

[![SIH 2026](https://img.shields.io/badge/SIH-2026-blue)](https://www.sih.gov.in/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-green)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/Tests-175%2F175-brightgreen)](#testing)
[![License](https://img.shields.io/badge/License-Internal-red)](#license)

---

## What It Does

Farmers lose money because they lack real-time market intelligence and buyer access. ShetBhav solves this with an **AI-powered Smart Sell Decision Engine** that evaluates official mandi prices, forecasts, buyer reliability, transport costs, and storage options to recommend the **best selling strategy** for each farmer's specific crop lot.

| User | Core Value |
|------|-----------|
| **Farmer** | Smart Sell recommendations, market prices, buyer matching, negotiation, order tracking |
| **Buyer** | Lot discovery, demand posting, offer management, supplier verification |
| **FPO** | Member aggregation, collective lot creation, transaction visibility |
| **Admin** | Platform analytics, grievance resolution, user verification, ML model monitoring |

### Live Market Data

ShetBhav integrates with the **official data.gov.in AGMARKNET API** for real daily mandi prices. When the API is unavailable, the system falls back to imported historical datasets, then to clearly labeled demo data. Every price is source-tagged in the UI.

| Source | Description |
|--------|------------|
| 🟢 **Live** | Fetched from data.gov.in API (official daily mandi data) |
| 🟡 **Cached** | Previously fetched, within freshness window |
| 🟠 **Historical** | Imported AGMARKNET dataset |
| 🔴 **Demo** | Synthetic fallback data, clearly labeled |

---

## Quick Start

```bash
# Prerequisites: Node.js 18+, Python 3.11+

# 1. Install dependencies
cd shetbhav/backend && pip install -r requirements.txt
cd shetbhav/frontend && npm install

# 2. Start backend (seeds demo data on first run)
cd shetbhav/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. Start frontend
cd shetbhav/frontend
npm run dev
```

Open **http://localhost:3000**

### Demo Accounts

| Role | Username | Password | What to try |
|------|----------|----------|-------------|
| 👨‍🌾 Farmer | `ramesh` | `demo123` | Smart Sell wizard, view prices, manage lots |
| 🏭 Buyer | `abc_foods` | `demo123` | Post demand, find lots, make offers |
| ⚙️ Admin | `admin` | `demo123` | Sync market data, verify buyers, manage disputes |
| 🌾 FPO | `nashik_fpo` | `demo123` | View members, create collective lots |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, Python 3.11, SQLAlchemy ORM |
| Database | SQLite (dev) / PostgreSQL (prod-ready) |
| ML Forecasting | XGBoost, scikit-learn, pandas, joblib |
| CV Grading | PIL, numpy, rule-based crop-specific analysis |
| Market Data | data.gov.in AGMARKNET API + local import |
| Maps | Leaflet + OpenStreetMap |
| Analytics | Recharts |
| Auth | JWT with bcrypt (4 roles) |
| i18n | English, Hindi, Marathi |

---

## Project Structure

```
shetbhav/
├── backend/
│   ├── app/main.py              # FastAPI — 62 API endpoints
│   ├── config/
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   └── settings.py          # Environment config (.env loading)
│   ├── models/
│   │   ├── database.py          # 42 SQLAlchemy tables
│   │   └── schemas.py           # Pydantic validation
│   ├── services/
│   │   ├── auth.py              # JWT authentication
│   │   ├── smart_sell.py        # Smart Sell Decision Engine
│   │   ├── market_data.py       # Market data adapter (live → cached → synthetic)
│   │   ├── data_gov.py          # data.gov.in API client + sync
│   │   ├── logistics.py         # Transport cost estimation
│   │   ├── fpo_aggregation.py   # FPO lot aggregation
│   │   └── quality_grading.py   # AI quality grading service
│   ├── ml/
│   │   ├── forecasting.py       # XGBoost price forecasting pipeline
│   │   ├── feature_engineering.py # 40+ feature extraction
│   │   ├── baselines.py         # Naive, MA-7, MA-14 baselines
│   │   ├── model_training.py    # Chronological split, model selection
│   │   ├── model_registry.py    # joblib persistence + versioning
│   │   ├── evaluation.py        # MAE, RMSE, MAPE, naive comparison
│   │   └── crop_vision.py       # Computer vision quality grading
│   ├── tests/                   # 175 pytest tests
│   ├── .env                     # API keys (git-ignored)
│   ├── requirements.txt
│   └── data/                    # AGMARKNET imported datasets
├── frontend/
│   └── src/
│       ├── app/                 # 17 Next.js routes
│       ├── components/
│       │   ├── ui.tsx           # 19 shared UI components
│       │   └── MapView.tsx      # Leaflet map component
│       └── lib/
│           ├── api.ts           # Axios client + interceptors
│           ├── store.ts         # Zustand auth store
│           └── i18n.ts          # EN/HI/MR translations
├── ARCHITECTURE.md
├── API.md
├── ML.md
├── DATA_SOURCES.md
├── TESTING.md
├── LIMITATIONS.md
├── PROJECT_STATUS.md
└── DEMO.md
```

---

## Key Features

### Smart Sell Decision Engine
The core differentiator. A 7-step wizard that:
1. Asks ONE question per screen (progressive disclosure)
2. Evaluates **8 weighted factors**: net realization (30%), price advantage (15%), transport (10%), demand (10%), quality match (10%), payment reliability (10%), timing (10%), distance (5%)
3. Calculates **net realisation** as: gross value − transport − storage − loading − charges − spoilage
4. Returns a **single clear recommendation** with reasoning in simple language
5. Shows **what-if scenarios** (sell now vs. store 3/7 days)
6. Provides **alternative options** ranked by score
7. Integrates **7-day price forecast** as one input (not the sole decider)

### Complete Transaction Flow
```
Farmer creates lot → views mandi prices → Smart Sell recommends →
Buyer makes offer → Negotiate (counter-offer) → Accept → Order created →
Transport assigned → Pickup → Delivery → Simulated payment → Grievance if needed
```

### Price Forecasting
- XGBoost models trained per-crop (Onion, Tomato, Soybean)
- Chronological train/test split (70/15/15) — no future data leakage
- Naive baseline comparison — XGBoost only used if it beats naive by ≥2%
- Confidence intervals from training residuals
- Graceful fallback to moving-average or naive when data is insufficient

### Live Market Data
- **data.gov.in API** integration with admin sync endpoint
- AGMARKNET historical dataset import (219 records)
- Automatic fallback: live → cached → historical → synthetic
- Every record is source-tagged with date, freshness, and data origin

### Quality Grading
- Computer vision analysis for Tomato, Onion, Soybean
- Image quality checks (blur, darkness, resolution)
- Crop-specific visible indicators (7 for onion, 6 for tomato, 4 for soybean)
- Verification types: self-declared, AI-assisted, manual, lab-verified
- Revision history for corrections

---

## Running Tests

```bash
cd shetbhav/backend

# Full test suite (175 tests)
python -m pytest tests/ -v

# Or by category:
python -m pytest tests/test_api.py -v              # 47 — Auth, CRUD, RBAC
python -m pytest tests/test_smart_sell.py -v        # 15 — Smart Sell engine
python -m pytest tests/test_workflows.py -v         # 27 — E2E workflows
python -m pytest tests/test_forecasting.py -v       # 47 — Forecasting pipeline
python -m pytest tests/test_data_gov.py -v          # 15 — data.gov.in integration
python -m pytest tests/test_quality_grading.py -v   # 24 — Quality grading
```

---

## Market Data Commands

```bash
# Import AGMARKNET historical dataset
cd shetbhav/backend
python -m app.scripts.import_market_data --file data/market_prices.csv

# Sync live data from data.gov.in (requires admin API key in .env)
# Via API:
curl -X POST http://localhost:8000/sync/mandi \
  -H "Authorization: Bearer <admin_token>"

# Check sync status
curl http://localhost:8000/sync/status

# Test API connection
curl http://localhost:8000/sync/test
```

---

## API Documentation

Interactive API docs available at **http://localhost:8000/docs** when the backend is running.

Full API reference: [API.md](./API.md)

---

## Environment Variables

```bash
# Backend .env
DATABASE_URL=sqlite:///./shetbhav.db        # SQLite (dev)
DATABASE_URL=postgresql://...                # PostgreSQL (prod)
SECRET_KEY=your-secret-key                   # JWT signing
DEMO_MODE=true                               # Disable rate limiting for demo

# Market Data
DATA_GOV_API_KEY=your_data_gov_api_key       # data.gov.in API key
DATA_GOV_RESOURCE_ID=9ef84268-d588-465a-a308-a864a43d0070
MARKET_DATA_MODE=live                        # live | cached | demo
MARKET_DATA_CACHE_HOURS=24                   # Hours before cache refresh
REQUEST_TIMEOUT_SECONDS=30                   # API request timeout
```

> ⚠️ Never commit `.env` files to version control. The `.env` file is git-ignored.

---## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** | [Vercel](https://vercel.com) | `https://<your-app>.vercel.app` |
| **Backend** | [Render](https://render.com) | `https://shetbhav-backend.onrender.com` |
| **Database** | Render (PostgreSQL free tier) | Auto-wired by Blueprint |

### Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com) → Import GitHub repo
2. Set **Root Directory** to `shetbhav/frontend`
3. Add env var: `NEXT_PUBLIC_API_URL` = `https://shetbhav-backend.onrender.com`
4. Deploy

### Backend + Database (Render Blueprint)
1. Push to GitHub
2. Go to [render.com/blueprints](https://render.com/blueprints) → connect repo → Apply
3. Add `DATA_GOV_API_KEY` env var on backend service
4. Set up [UptimeRobot](https://uptimerobot.com) ping to `/health` (keeps free tier alive)

### Auto-Deploy
- **Vercel**: Auto-deploys on every push to `main`
- **Render**: `autoDeployTrigger: commit` — auto-deploys on every push to `main`

### Build Verification
```bash
cd shetbhav/frontend && npm run build # Should show 17 routes, 0 errors
cd shetbhav/backend && python -m pytest tests/ -v # Should show 175 pass
```

---

## Documentation

| File | What's in it |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow, deployment |
| [API.md](./API.md) | Full API reference (62 endpoints) |
| [ML.md](./ML.md) | Forecasting pipeline, model comparison, quality grading |
| [DATA_SOURCES.md](./DATA_SOURCES.md) | data.gov.in integration, AGMARKNET dataset, source labeling |
| [TESTING.md](./TESTING.md) | 175 test results with details |
| [LIMITATIONS.md](./LIMITATIONS.md) | Honest assessment of prototype scope |
| [DEMO.md](./DEMO.md) | SIH presentation script |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Current status overview |

---

## Limitations

This is an **MVP prototype** for SIH 2026, not a production system. Key limitations:

- **Market data**: Live data from data.gov.in API works, but covers limited markets/crops. Historical dataset covers Maharashtra, Onion/Tomato/Soybean.
- **Payments are simulated** — clearly labeled "Demo payment tracking — no real money movement"
- **Quality grading** is rule-based CV, not laboratory-certified testing
- **Forecasts are estimates** — not guaranteed prices
- **Scope**: Maharashtra, 3 crops, selected mandis
- **Transport/storage**: Estimated quotes, not live GPS tracking
- **Buyer reliability** is based on observed platform history only

See [LIMITATIONS.md](./LIMITATIONS.md) for the full honest assessment.

---

## License

Built for Smart India Hackathon 2026. Internal use only.

---

<p align="center">
  <strong>शेतभाव — ShetBhav</strong><br>
  <em>Empowering Indian farmers with market intelligence</em>
</p>
