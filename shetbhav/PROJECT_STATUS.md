# ShetBhav — Project Status

**Last Updated:** September 5, 2026
**Status:** MVP demo-ready, GitHub-ready

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Frontend Routes | 24 (incl. dynamic `[id]`/`[userId]` routes) |
| Backend API Endpoints | 104 |
| Database Tables | 45 |
| pytest Tests | 246/246 PASS (14 files) |
| Playwright E2E Tests | 15/15 PASS (4 spec files — both servers must be running) |
| E2E Demo Steps | 22/22 PASS (manual run with backend) |
| Frontend Build | 24 routes, 0 errors |
| UI component layer | shadcn/ui (Base UI) — full redesign across all 24 pages |
| Languages | English, Hindi, Marathi |
| Demo Accounts | 4 (Farmer, Buyer, Admin, FPO) |
| Market Price Records | 863 (770 historical + 93 live) |

---

## Feature Classification

| Feature | Status | Evidence |
|---------|--------|----------|
| Farmer login/auth | ✅ COMPLETE | test_api.py, E2E step 1 |
| Farmer profile | ✅ COMPLETE | test_api.py, E2E step 2 |
| Farmer dashboard | ✅ COMPLETE | /farmer, E2E step 3 |
| Language switch (EN/HI/MR) | ✅ COMPLETE | test_api.py (3 tests) |
| Crop lot creation | ✅ COMPLETE | test_api.py, E2E step 6 |
| Market prices (AGMARKNET) | ✅ COMPLETE | 863 real records, E2E step 4 |
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
| FPO aggregation (with farmer confirmation) | ✅ COMPLETE | test_fpo_flow.py, fpo_aggregation.py |
| FPO join request / leave | ✅ COMPLETE | test_fpo_flow.py, /fpo/join-request, /fpo/leave |
| FPO member approve/reject/remove | ✅ COMPLETE | test_fpo_flow.py, /fpo/members/{id}/* |
| FPO member detail view | ✅ COMPLETE | test_fpo_flow.py, GET /fpo/members/{farmer_id} |
| FPO payment distribution (volume share) | ✅ COMPLETE | test_fpo_flow.py, /fpo/orders/{id}/distribute-payment |
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
| data.gov.in live API | ✅ Working | 91 records labeled `live` |
| AGMARKNET dataset | ✅ Imported | 770 records labeled `historical_dataset` |
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

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | `https://market-intelligence-for-farmer.vercel.app` (Vercel) |
| Backend API | `https://shetbhav-backend.onrender.com` |
| API Docs | `https://shetbhav-backend.onrender.com/docs` |
| Health Check | `https://shetbhav-backend.onrender.com/health` |

## How to Run Locally

```bash
# Backend
cd shetbhav/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd shetbhav/frontend
npm install
npm run dev

# Tests (246 tests)
cd shetbhav/backend
python -m pytest tests/ -v

# Playwright E2E (15 tests, needs both servers running)
cd shetbhav/frontend
npx playwright test

# Manual E2E demo script (22 steps)
cd shetbhav/backend
python scripts/e2e_demo.py
```

Open http://localhost:3000

---

## Deployment

- **Platform**: Render Blueprint (`render.yaml`)
- **Auto-deploy**: Every push to `main` triggers both frontend + backend
- **Database**: PostgreSQL (free tier, auto-wired by Blueprint)
- **Keep-alive**: UptimeRobot pings `/health` every 5 min

---

## Production Blockers

1. Alembic database migrations (currently using `create_all()` + additive-column bootstrap)
2. Rate limiting hardening (Redis-based)
3. Push notifications (WebSocket/Firebase)
4. Real payment gateway (Razorpay/PayU)

> CI/CD (GitHub Actions) is no longer a blocker — see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), which runs the backend pytest suite, frontend build/typecheck/lint, and the Playwright E2E suite on every push.
