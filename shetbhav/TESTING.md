# ShetBhav Testing Report

**Date:** September 5, 2026
**Status:** ✅ 246/246 BACKEND TESTS PASS + 15/15 PLAYWRIGHT E2E PASS + 22/22 MANUAL E2E DEMO PASS

---

## Test Summary

| Suite | File | Tests | Pass | Fail |
|-------|------|-------|------|------|
| Core API | test_api.py | 47 | 47 | 0 |
| Smart Sell | test_smart_sell.py | 16 | 16 | 0 |
| Workflows | test_workflows.py | 27 | 27 | 0 |
| Forecasting | test_forecasting.py | 47 | 47 | 0 |
| data.gov.in | test_data_gov.py | 15 | 15 | 0 |
| Quality Grading | test_quality_grading.py | 24 | 24 | 0 |
| Booking | test_booking.py | 10 | 10 | 0 |
| Direct demand response | test_demand_direct_response.py | 8 | 8 | 0 |
| FPO flow (join/leave/aggregation/payout) | test_fpo_flow.py | 13 | 13 | 0 |
| Lot edit/delete | test_lot_edit_delete.py | 8 | 8 | 0 |
| Offers & notifications | test_offers_notifications.py | 13 | 13 | 0 |
| Payment deadline | test_payment_deadline.py | 5 | 5 | 0 |
| Profiles & admin | test_profiles_and_admin.py | 13 | 13 | 0 |
| **Total pytest** | | **246** | **246** | **0** |

### Playwright E2E (frontend, browser-driven)

| Spec file | Covers |
|---|---|
| `transaction-loop.spec.ts` | Full two-account book-and-pay loop in both directions, login, password toggle |
| `counterparty-detail.spec.ts` | Lot/demand detail pages, counterparty profile navigation |
| `lots-tab-create.spec.ts` | My Lots tab's direct create-lot form |
| `smart-sell-wizard.spec.ts` | Smart Sell wizard → hands off to My Lots create-lot form |

15/15 passing — run with `npx playwright test` from `shetbhav/frontend` (both the backend on :8000 and frontend on :3000 must be running).

---

## E2E Demo Flow (22 steps)

Complete end-to-end flow through the live API:

| Step | Action | Status |
|------|--------|--------|
| 1 | Farmer login (ramesh) | ✅ |
| 2 | Farmer profile | ✅ |
| 3 | Farmer dashboard | ✅ |
| 4 | Market prices (AGMARKNET) | ✅ |
| 5 | Smart Sell recommendation | ✅ |
| 6 | Create crop lot | ✅ |
| 7 | List lots | ✅ |
| 8 | Buyer login (abc_foods) | ✅ |
| 9 | Buyer profiles | ✅ |
| 10 | Create buyer demand | ✅ |
| 11 | List demands | ✅ |
| 12 | Buyer makes offer | ✅ |
| 13 | Farmer lists offers | ✅ |
| 14 | Farmer counter-offers | ✅ |
| 15 | Buyer accepts offer | ✅ |
| 16 | Order created from offer | ✅ |
| 17 | Order timeline events | ✅ |
| 18 | Simulated payment | ✅ |
| 19 | Farmer raises grievance | ✅ |
| 20 | Admin login | ✅ |
| 21 | Admin platform stats | ✅ |
| 22 | Admin resolves grievance | ✅ |

---

## Frontend Build

```
Route                          Type
├ ○ /                          Static
├ ○ /admin                     Static
├ ○ /buyer                     Static
├ ƒ /demands/[id]              Dynamic
├ ○ /farmer                    Static
├ ○ /farmer/buyers             Static
├ ○ /farmer/demands            Static
├ ○ /farmer/earnings           Static
├ ○ /farmer/fpo                Static
├ ○ /farmer/grievance          Static
├ ○ /farmer/lots               Static
├ ○ /farmer/notifications      Static
├ ○ /farmer/offers             Static
├ ○ /farmer/orders             Static
├ ƒ /farmer/orders/[id]        Dynamic
├ ○ /farmer/prices             Static
├ ○ /farmer/profile            Static
├ ○ /farmer/quality            Static
├ ○ /farmer/sell               Static
├ ○ /fpo                       Static
├ ○ /login                     Static
├ ƒ /lots/[id]                 Dynamic
├ ƒ /profile/[userId]          Dynamic
└ ○ /register                  Static

24 routes, 0 errors
```

---

## Running Tests

```bash
# Full backend suite (246 tests)
cd shetbhav/backend
python -m pytest tests/ -v

# By category:
python -m pytest tests/test_api.py -v                    # 47
python -m pytest tests/test_smart_sell.py -v              # 16
python -m pytest tests/test_workflows.py -v               # 27
python -m pytest tests/test_forecasting.py -v             # 47
python -m pytest tests/test_data_gov.py -v                # 15
python -m pytest tests/test_quality_grading.py -v         # 24
python -m pytest tests/test_fpo_flow.py -v                 # 13
python -m pytest tests/test_booking.py -v                  # 10
python -m pytest tests/test_offers_notifications.py -v     # 13
python -m pytest tests/test_profiles_and_admin.py -v       # 13
python -m pytest tests/test_demand_direct_response.py -v   # 8
python -m pytest tests/test_lot_edit_delete.py -v          # 8
python -m pytest tests/test_payment_deadline.py -v         # 5

# Playwright E2E (15 tests — start both servers first)
cd shetbhav/frontend
npx playwright test

# Manual E2E demo script (22 steps, hits a running backend)
cd shetbhav/backend
python scripts/e2e_demo.py

# Frontend build
cd shetbhav/frontend && npm run build
```
