# ShetBhav Testing Report

**Date:** September 1, 2026
**Status:** 114/114 TESTS PASS

---

## Test Summary

| Suite | File | Tests | Pass | Fail |
|-------|------|-------|------|------|
| Core API | test_api.py | 47 | 47 | 0 |
| Smart Sell Scenarios | test_smart_sell.py | 15 | 15 | 0 |
| Workflow Tests | test_workflows.py | 27 | 27 | 0 |
| E2E API (Node.js) | inline | 25 | 25 | 0 |
| **Total** | | **114** | **114** | **0** |

---

## Core API Tests (47)

### Authentication (10 tests)
- Register new user ✅
- Register duplicate username → 400 ✅
- Login valid credentials ✅
- Login wrong password → 401 ✅
- Login nonexistent user → 401 ✅
- Get me authenticated ✅
- Get me no token → 401 ✅
- Get me invalid token → 401 ✅
- Register empty body → 422 ✅
- Login empty body → 422 ✅

### Authorization (7 tests)
- Farmer → admin blocked (403) ✅
- Buyer → farmer blocked (403) ✅
- Farmer → demand create blocked (403) ✅
- Buyer → admin blocked (403) ✅
- Admin → admin stats (200) ✅
- Unauthenticated → 401 ✅
- Admin → farmer endpoints (200/403) ✅

### Crops & Markets (4 tests)
- List crops ✅
- List markets ✅
- Market prices invalid crop → 404 ✅
- Market prices valid crop ✅

### Lot Operations (5 tests)
- Create lot valid ✅
- Create lot invalid crop → 400 ✅
- Create lot zero quantity → 422 ✅
- List lots ✅
- Get lot not found → 404 ✅

### Smart Sell (3 tests)
- Valid request ✅
- Invalid crop → 400 ✅
- No auth → 401 ✅

### Offer Lifecycle (3 tests)
- Create offer ✅
- List offers ✅
- Counter offer → countered ✅

### Grievances (3 tests)
- Create grievance ✅
- List grievances ✅
- Short description → 422 ✅

### Translations (4 tests)
- English ✅
- Hindi ✅
- Marathi ✅
- Unknown language → English fallback ✅

### Logistics (2 tests)
- Transport estimate ✅
- Storage decision ✅

### Admin (3 tests)
- Admin stats ✅
- Admin users ✅
- Farmer blocked from admin ✅

### Quality (2 tests)
- Supported crops ✅
- Assess requires auth ✅

### Notifications (1 test)
- List notifications ✅

---

## Smart Sell Test Scenarios (15)

### Scenario A: Higher net realization ranks first
Higher price option with similar transport ranks first. Net realization is positive. ✅

### Scenario B: High transport cost penalizes distant buyer
Distant location (>700km) results in high transport cost. Best option reflects this. ✅

### Scenario C: Reliability factored into score
Best option has reasons mentioning payment reliability. Score > 0. ✅

### Scenario D: Storage cost exceeding forecast gain
What-if scenarios present. "Sell today" has Low risk. Storage alternatives evaluated. ✅

### Scenario E: No storage available
When `storage_available=False`, no storage option appears in recommendations. ✅

### Scenario F: Quality mismatch penalty
Grade C farmer gets valid recommendations with score considerations. ✅

### Scenario G: Poor payment reliability risk
Options include reliability-related reasons/risks. All options have non-empty reasons. ✅

### Scenario H: Synthetic fallback
When real API unavailable, recommendations still work with synthetic data. ✅

### Scenario I: Similar options ranked
Multiple options returned. Best has highest score. All have reasons. ✅

### Scenario J: Invalid input
- Invalid crop → 400 ✅
- No auth → 401 ✅
- Invalid urgency → 400/422 ✅
- Empty body → 422 ✅

### Full Workflow Integration
- Smart Sell → create lot → find matching buyers ✅
- Explanation is human-readable with "RECOMMENDED" ✅

---

## Workflow Tests (27)

### Farmer Complete Journey (1 test)
Register → login → dashboard → smart sell → create lot → list lots → find buyers → create buyer → buyer offer → farmer counter → buyer accept → create order → state progression → payment → earnings → grievance ✅

### Buyer Complete Journey (2 tests)
Register → login → create demand → list demands → list lots → browse buyers → create farmer lot → make offer → farmer accept → create order → payment → orders list ✅
Zero quantity demand → 422 ✅

### FPO Dashboard (1 test)
Register → login → dashboard → members → lots ✅

### Admin Journey (2 tests)
Register → login → stats → users → role filter → verify buyer ✅
Non-admin blocked from admin endpoints (403) ✅

### Transaction State Machine (2 tests)
Valid progression: ACCEPTED → PICKUP_SCHEDULED → IN_TRANSIT → DELIVERED → QUALITY_CONFIRMED ✅
Auto-payment creation on quality_confirmed ✅

### Quality Grading (4 tests)
Supported crops returns valid list ✅
Assess requires auth ✅
Nonexistent lot → 400/404 ✅
Quality grade values from valid set ✅

### Logistics (3 tests)
Transport estimate with distance and cost ✅
Storage decision ✅
Storage facility list ✅

### Language Audit (3 tests)
All three languages return valid translations ✅
Hindi contains Devanagari ✅
Marathi contains Devanagari ✅

### Security (4 tests)
CORS headers ✅
Security headers (nosniff, DENY) ✅
Protected endpoints return 401 ✅
Password hashed (bcrypt prefix) ✅

### Notifications (1 test)
Notifications list returns array ✅

### Market Data (4 tests)
Prices with valid crop, source labeled ✅
Price history returns array ✅
Forecast returns predicted_price > 0 ✅
Market overview with forecast ✅

---

## E2E API Tests (25)

Full workflow executed via Node.js HTTP client:
1. Register farmer ✅
2. Login farmer ✅
3. Get farmer profile ✅
4. Farmer dashboard ✅
5. Smart Sell recommendation ✅
6. Create lot ✅
7. Find buyers ✅
8. Register buyer ✅
9. Create demand ✅
10. Create offer ✅
11. Counter offer ✅
12. Accept offer ✅
13. Create order (FK fixed) ✅
14. Order state progression ✅
15. Payment ✅
16. Register admin ✅
17. Admin stats ✅
18. Admin users ✅
19. List crops ✅
20. Market prices ✅
21. Forecast ✅
22. Farmer blocked from admin ✅
23. Buyer blocked from farmer ✅
24. Translations (EN/HI/MR) ✅

---

## Bugs Fixed During Audit

| # | Bug | Severity | Test That Found It |
|---|-----|----------|-------------------|
| 1 | Order creation FK violation (lot.farmer_id vs User ID mismatch) | Critical | TestFarmerWorkflow |
| 2 | FPO dashboard field name mismatch | Low | TestFPOWorkflow |
| 3 | Quality supported-crops format | Low | TestQualityGrading |

---

## Frontend Build

```
Route                     Size     First Load JS
├ ○ /                    4.8 kB        98 kB
├ ○ /admin               3.2 kB        96 kB
├ ○ /buyer               4.1 kB        97 kB
├ ○ /farmer              5.2 kB        98 kB
├ ○ /farmer/sell         8.7 kB       102 kB
├ ○ /farmer/prices       4.5 kB        98 kB
├ ○ /farmer/orders       3.8 kB        97 kB
├ ○ /fpo                 3.5 kB        97 kB
├ ○ /login               2.1 kB        95 kB
└ ○ /register            2.4 kB        96 kB

○  (Static)  prerendered as static content
```

---

## Running Tests

```bash
# Run all pytest suites (one at a time for test isolation)
cd shetbhav/backend
python -m pytest tests/test_api.py -v
python -m pytest tests/test_smart_sell.py -v
python -m pytest tests/test_workflows.py -v
```
