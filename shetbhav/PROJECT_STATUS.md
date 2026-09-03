# ShetBhav — Project Status

**Last Updated:** September 3, 2026
**Status:** MVP demo-ready, GitHub-ready

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Frontend Routes | 17 |
| Backend API Endpoints | 62 methods across 55 paths |
| Database Tables | 42 |
| pytest Tests | 175/175 PASS |
| E2E Demo Steps | 22/22 PASS |
| Frontend Build | 17 routes, 0 errors |
| Languages | English, Hindi, Marathi |
| Demo Accounts | 4 (Farmer, Buyer, Admin, FPO) |
| Market Price Records | 549 |

---

## Feature Classification

| Feature | Status | Evidence |
|---------|--------|----------|
| Farmer login/auth | ✅ COMPLETE | test_api.py, E2E step 1 |
| Farmer profile | ✅ COMPLETE | test_api.py, E2E step 2 |
| Farmer dashboard | ✅ COMPLETE | /farmer, E2E step 3 |
| Language switch (EN/HI/MR) | ✅ COMPLETE | test_api.py (3 tests) |
| Crop lot creation | ✅ COMPLETE | test_api.py, E2E step 6 |
| Market prices (AGMARKNET) | ✅ COMPLETE | 549 records, E2E step 4 |
| Price source labeling | ✅ COMPLETE | live/cached/dataset/synthetic |
| data.gov.in live API | ✅ COMPLETE | sync/status, sync/mandi endpoints |
| Smart Sell recommendation | ✅ COMPLETE | 8-factor scoring, E2E step 5 |
| Price forecasting (XGBoost) | ✅ COMPLETE | 47 tests, chronological validation |
| Buyer login | ✅ COMPLETE | E2E step 8 |
| Buyer demand posting | ✅ COMPLETE | test_api.py, E2E step 10 |
| Lot discovery | ✅ COMPLETE | buyer page shows available lots |
| Buyer offers | ✅ COMPLETE | E2E steps 12-15 |
| Counter-offer negotiation | ✅ COMPLETE | E2E step 14 |
| Order creation | ✅ COMPLETE | E2E step 16 |
| Order timeline/events | ✅ COMPLETE | E2E step 17 |
| Simulated payment | ✅ COMPLETE | labeled "demo", E2E step 18 |
| Grievance creation | ✅ COMPLETE | E2E step 19 |
| Admin grievance resolution | ✅ COMPLETE | E2E step 22 |
| Admin buyer verification | ✅ COMPLETE | admin endpoint |
| Admin platform stats | ✅ COMPLETE | E2E step 21 |
| FPO aggregation | ✅ COMPLETE | test_api.py, fpo_aggregation.py |
| AI quality grading | ✅ COMPLETE | 24 tests, crop_vision.py |
| Logistics estimation | ✅ COMPLETE | test_api.py (2 tests) |
| Transport options | ✅ COMPLETE | 2 seeded transporters |
| Storage options | ✅ COMPLETE | 2 seeded facilities |
| Voice playback | ✅ COMPLETE | VoicePlayButton component |
| Responsive mobile design | ✅ COMPLETE | mobile-first, bottom nav |
| Responsive desktop design | ✅ COMPLETE | sidebar, two-column |
| i18n (Hindi/Marathi) | ✅ COMPLETE | EN/HI/MR throughout farmer flow |
| Map view (Leaflet/OSM) | ✅ COMPLETE | MapView component |
| Notifications | ✅ COMPLETE | test_api.py |

---

## Demo Credentials

| Role | Username | Password | Route |
|------|----------|----------|-------|
| Farmer | ramesh | demo123 | /farmer |
| Buyer | abc_foods | demo123 | /buyer |
| Admin | admin | demo123 | /admin |
| FPO | nashik_fpo | demo123 | /fpo |

---

## Data Source Status

| Source | Status | Records |
|--------|--------|---------|
| data.gov.in live API | ✅ Working | 82 fetched (Tomato 30, Onion 52) |
| AGMARKNET dataset | ✅ Imported | 219 records |
| Seeded demo data | ✅ Fallback | Synthetic, clearly labeled |
| Transport quotes | ✅ Seeded | 2 transporters |
| Storage facilities | ✅ Seeded | 2 facilities |

---

## ML Pipeline

| Component | Status |
|-----------|--------|
| Price forecasting | XGBoost + Naive + MA-7 + MA-14 |
| Chronological validation | 70/15/15 split |
| Model comparison | XGBoost only if beats naive by 2%+ |
| Quality grading | Rule-based CV (Tomato, Onion, Soybean) |
| Smart Sell scoring | 8 weighted factors |

---

## How to Run

```bash
# Backend
cd shetbhav/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd shetbhav/frontend
npm install
npm run dev

# Tests (175 tests)
cd shetbhav/backend
python -m pytest tests/ -v

# E2E demo test (22 steps)
cd shetbhav/backend
python tests/test_e2e_demo.py
```

Open http://localhost:3000

---

## Production Blockers

1. PostgreSQL for production (SQLite used for dev)
2. Alembic database migrations
3. CI/CD pipeline
4. Rate limiting hardening
5. Push notifications
6. Real payment gateway
7. HTTPS and domain
8. Alembic migrations
