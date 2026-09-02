# ShetBhav (शेतभाव)

### *Know the market. Choose better. Earn more.*

AI-powered agricultural market intelligence platform for Indian farmers, FPOs, and buyers. Built for [Smart India Hackathon 2026 — SIH26132](https://www.sih.gov.in/).

[![SIH 2026](https://img.shields.io/badge/SIH-2026-blue)](https://www.sih.gov.in/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-green)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-Internal-red)](#license)

---

## What It Does

Farmers lose money because they lack real-time market intelligence and buyer access. ShetBhav solves this with an **AI-powered Smart Sell Decision Engine** that evaluates market prices, forecasts, buyer reliability, transport costs, and storage options to recommend the **best selling strategy** for each farmer's specific crop lot.

| User | Core Value |
|------|-----------|
| **Farmer** | Smart Sell recommendations, market prices, buyer matching, negotiation, order tracking |
| **Buyer** | Lot discovery, demand posting, offer management, supplier verification |
| **FPO** | Member aggregation, collective lot creation, transaction visibility |
| **Admin** | Platform analytics, grievance resolution, user verification, ML model monitoring |

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

| Role | Username | Password |
|------|----------|----------|
| 👨‍🌾 Farmer | `ramesh` | `demo123` |
| 🏭 Buyer | `abc_foods` | `demo123` |
| ⚙️ Admin | `admin` | `demo123` |
| 🌾 FPO | `nashik_fpo` | `demo123` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, Python 3.11, SQLAlchemy ORM |
| Database | SQLite (dev) / PostgreSQL (prod-ready) |
| ML | XGBoost, scikit-learn, pandas |
| Maps | Leaflet + OpenStreetMap |
| Analytics | Recharts |
| Auth | JWT with bcrypt (4 roles) |
| i18n | English, Hindi, Marathi |

---

## Project Structure

```
shetbhav/
├── backend/
│   ├── app/main.py              # FastAPI — 58+ API endpoints
│   ├── config/
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   └── settings.py          # Environment config
│   ├── models/
│   │   ├── database.py          # 30 SQLAlchemy tables
│   │   └── schemas.py           # Pydantic validation
│   ├── services/
│   │   ├── auth.py              # JWT authentication
│   │   ├── smart_sell.py        # Smart Sell Decision Engine
│   │   ├── market_data.py       # Market data adapter (real → cached → synthetic)
│   │   ├── logistics.py         # Transport cost estimation
│   │   ├── fpo_aggregation.py   # FPO lot aggregation
│   │   └── quality_grading.py   # AI quality grading service
│   ├── ml/
│   │   ├── forecasting.py       # XGBoost price forecasting
│   │   └── crop_vision.py       # Computer vision quality grading
│   ├── tests/                   # 89 pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/                 # 15 Next.js routes
│       ├── components/
│       │   ├── ui.tsx           # 14 shared UI components
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
└── DEMO.md
```

---

## Key Features

### Smart Sell Decision Engine
The core differentiator. A 6-step wizard that:
1. Asks ONE question per screen (progressive disclosure)
2. Evaluates **8 weighted factors**: net realization (30%), price advantage (15%), transport (10%), demand (10%), quality match (10%), payment reliability (10%), timing (10%), distance (5%)
3. Returns a **single clear recommendation** with reasoning
4. Shows **what-if scenarios** (sell now vs. store 3/7 days)
5. Provides **alternative options** ranked by score

### Complete Transaction Flow
```
Farmer creates lot → Smart Sell recommends → Buyer makes offer →
Negotiate (counter-offer) → Accept → Order → Logistics → Payment
```

### Price Forecasting
XGBoost models trained per-crop with chronological train/test split and naive baseline comparison. Includes confidence intervals — never false precision.

### Market Data Adapter
Real API pattern (AGMARKNET) → cached DB fallback → synthetic demo. Every data point is source-labeled in the UI.

---

## Running Tests

```bash
cd shetbhav/backend

# Core API tests (47)
python -m pytest tests/test_api.py -v

# Smart Sell scenarios (15)
python -m pytest tests/test_smart_sell.py -v

# Full workflow tests (27)
python -m pytest tests/test_workflows.py -v
```

**Total: 89/89 pytest tests passing**

---

## API Documentation

Interactive API docs available at **http://localhost:8000/docs** when the backend is running.

Full API reference: [shetbhav/API.md](./shetbhav/API.md)

---

## Environment Variables

```bash
# Backend
DATABASE_URL=sqlite:///./shetbhav.db     # SQLite (dev)
DATABASE_URL=postgresql://...             # PostgreSQL (prod)
SECRET_KEY=your-secret-key                # JWT signing
DEMO_MODE=true                            # Disable rate limiting for demo
```

See [shetbhav/backend/.env.example](./shetbhav/backend/.env.example) for the full template.

---

## Deployment

| Service | How |
|---------|-----|
| **Frontend** | Push to GitHub → Vercel auto-deploys |
| **Backend** | Push to GitHub → Render/Railway deploy |
| **Database** | Supabase (free tier) → set `DATABASE_URL` |

```bash
# Build verification
cd shetbhav/frontend && npm run build  # Should show 15 routes, 0 errors
cd shetbhav/backend && python -m pytest tests/ -v  # Should show 89 pass
```

---

## Documentation

| File | What's in it |
|------|-------------|
| [shetbhav/ARCHITECTURE.md](./shetbhav/ARCHITECTURE.md) | System design, data flow, deployment |
| [shetbhav/API.md](./shetbhav/API.md) | Full API reference (58+ endpoints) |
| [shetbhav/ML.md](./shetbhav/ML.md) | XGBoost training pipeline, evaluation |
| [shetbhav/DATA_SOURCES.md](./shetbhav/DATA_SOURCES.md) | Real vs synthetic data classification |
| [shetbhav/TESTING.md](./shetbhav/TESTING.md) | 89 test results with details |
| [shetbhav/LIMITATIONS.md](./shetbhav/LIMITATIONS.md) | Honest assessment of prototype scope |
| [shetbhav/DEMO.md](./shetbhav/DEMO.md) | SIH presentation script |
| [shetbhav/PROJECT_STATUS.md](./shetbhav/PROJECT_STATUS.md) | Current status overview |

---

## Limitations

This is an **MVP prototype**, not a production system. Key limitations:

- **Market data is synthetic** — real AGMARKNET integration requires API key registration
- **Payments are simulated** — not real financial transactions
- **Quality grading** works for Tomato, Onion, Soybean (computer vision prototype)
- **Scope**: Maharashtra, 3 crops, 5 markets

See [shetbhav/LIMITATIONS.md](./shetbhav/LIMITATIONS.md) for the full honest assessment.

---

## License

Built for Smart India Hackathon 2026. Internal use only.

---

<p align="center">
  <strong>शेतभाव — ShetBhav</strong><br>
  <em>Empowering Indian farmers with market intelligence</em>
</p>
