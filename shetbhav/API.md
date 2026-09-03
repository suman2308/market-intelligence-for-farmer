# ShetBhav API Reference

**Last updated:** September 2026

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://shetbhav-backend.onrender.com` |
| **Local dev** | `http://localhost:8000` |
| **Interactive docs** | `https://shetbhav-backend.onrender.com/docs` |
| **Health check** | `https://shetbhav-backend.onrender.com/health` |

The backend exposes **73 paths (78 methods)**. All examples below use realistic values.

## Authentication

All protected endpoints require:

```
Authorization: Bearer <token>
```

### POST /auth/login

Signs in an existing user.

```json
// Request
{ "username": "ramesh", "password": "demo123" }

// Response
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "ramesh", "role": "farmer", "full_name": "Ramesh Patil" }
}
```

### POST /auth/register

Creates a new account. Returns an access token so the user is signed in immediately.

```json
{
  "username": "newfarmer",
  "email": "farmer@example.com",
  "password": "secret123",
  "full_name": "New Farmer",
  "phone": "9876543210",
  "role": "farmer"
}
```

### GET /auth/check

Checks whether a username or email is already taken. Used by the register page to show "username taken" before submit.

```
GET /auth/check?username=ramesh
GET /auth/check?email=farmer@example.com
```

```json
{ "username_available": false, "email_available": true }
```

### GET /auth/me

Returns the current user's profile. The frontend calls this on page load to restore the session.

---

## Public lookups

| Endpoint | What it returns |
|----------|-----------------|
| `GET /health` | `{ "status": "ok" }` — used by UptimeRobot |
| `GET /crops` | Supported crops (Tomato, Onion, Soybean) |
| `GET /markets` | Maharashtra mandis (Nashik APMC, Pune, Mumbai, …) |
| `GET /markets/overview` | Mandi snapshot with latest prices |
| `GET /markets/prices?crop_id=1` | Latest price per mandi for a crop |
| `GET /markets/prices/history?crop_id=1&market_id=1&days=30` | Price history for charts |
| `GET /buyers` | Verified buyers directory |
| `GET /buyers/{buyer_id}` | Single buyer profile with trust score |

`GET /markets/prices` includes source metadata so the frontend can badge it correctly:

```json
{
  "crop": "tomato",
  "market": "Nashik APMC",
  "prices": { "min_price": 1000, "max_price": 1800, "modal_price": 1400 },
  "source_name": "data.gov.in / AGMARKNET",
  "source_type": "live",
  "data_as_of": "2026-09-04",
  "retrieved_at": "2026-09-04T08:30:00Z",
  "is_demo": false
}
```

---

## Farmer

### GET /farmers/dashboard

```json
{
  "active_lots": 1,
  "total_lots": 2,
  "pending_orders": 0,
  "total_earnings": 42000,
  "unread_notifications": 0
}
```

### GET/PUT /farmers/profile

View or update farm address, GPS coordinates, and phone.

### POST /lots

Creates a crop lot.

```json
{
  "crop_id": 1,
  "quantity_kg": 2000,
  "quality_grade": "A",
  "location_lat": 20.0,
  "location_lng": 73.7,
  "storage_available": true,
  "urgency": "soon"
}
```

### GET /lots?status=active

Lists the farmer's lots, optionally filtered by status.

### GET /lots/{lot_id}

Single lot detail, including quality report and match info.

---

## Smart Sell Engine

### POST /smart-sell

Runs the recommendation engine for a lot.

```json
// Request
{
  "crop_id": 1,
  "quantity_kg": 2000,
  "quality_grade": "A",
  "location_lat": 19.9975,
  "location_lng": 73.7898,
  "storage_available": true,
  "urgency": "soon"
}

// Response
{
  "best_option": {
    "target_name": "Nashik APMC",
    "score": 90.2,
    "net_realization_per_q": 3469,
    "reasons": ["Good net realization", "Grade matches requirement"],
    "risks": ["Price may change by pickup day"]
  },
  "alternatives": [ /* ranked selling options */ ],
  "what_if_scenarios": [ /* sell now vs store vs different buyer */ ]
}
```

The engine never relies on a forecast alone — it compares mandi, buyer, storage, and FPO options.

---

## Forecasting

### GET /forecasts/predict?crop_id=1&market_id=1&current_price=1400

```json
{
  "crop": "tomato",
  "mandi": "Nashik APMC",
  "horizon_days": 7,
  "predicted_price": 1425,
  "expected_low": 1310,
  "expected_high": 1540,
  "confidence": 0.6,
  "model_name": "xgboost",
  "model_version": "1.0",
  "trained_until": "2026-09-03",
  "data_source": "data.gov.in / AGMARKNET",
  "forecast_status": "forecast_available",
  "explanation": "Based on 90 days of mandi price data"
}
```

If data is thin, `forecast_status` becomes `insufficient_data` and the model falls back to the naive baseline with low confidence.

### GET /forecasts/status

Model health: which crops are trained, trained-until dates, record counts.

### POST /forecasts/train?crop_id=1

Retrains the XGBoost model for a crop from current database records.

---

## Buyer

### GET/POST /demand

Post or list buyer demand:

```json
{
  "crop_id": 1,
  "quantity_kg": 5000,
  "quality_grade": "A",
  "district": "Pune",
  "offered_price_per_q": 2500
}
```

### GET /matching/{lot_id}

Ranked buyer-demand matches for a lot, with quantity/quality/location/timing match scores and a plain-language explanation.

---

## Offers & Negotiation

| Endpoint | What it does |
|----------|--------------|
| `POST /offers` | Buyer makes an offer on a lot |
| `GET /offers` | List offers (buyer sees sent, farmer sees received) |
| `POST /offers/{id}/counter` | Counter-offer (history preserved, nothing overwritten) |
| `POST /offers/{id}/accept` | Accept → creates an order |
| `POST /offers/{id}/reject` | Reject the offer |

```json
// POST /offers
{ "lot_id": 1, "price_per_q": 2500, "quantity_kg": 2000, "delivery_date": "2026-09-10" }

// POST /offers/5/counter
{ "price_per_q": 2550, "message": "Can you match 2550?" }
```

---

## Orders & Payments

| Endpoint | What it does |
|----------|--------------|
| `POST /orders/from-offer/{offer_id}` | Create an order from an accepted offer |
| `GET /orders` | List my orders |
| `GET /orders/{id}` | Order detail |
| `GET /orders/{id}/events` | Order timeline |
| `POST /orders/{id}/events` | Add a timeline event |
| `PUT /orders/{id}/status` | Advance order status |
| `GET /payments/{order_id}` | Payment status |
| `POST /payments/{order_id}/simulate` | Simulate a payment (clearly labeled — no real money) |

```json
// GET /payments/3
{
  "order_id": 3,
  "amount_due": 42000,
  "amount_paid": 42000,
  "due_date": "2026-09-12",
  "status": "paid",
  "reference_id": "SIM-2026-0001",
  "is_simulated": true
}
```

Payments are simulated in the MVP. The UI always shows "Demo payment tracking — no real money movement."

---

## Logistics

| Endpoint | What it does |
|----------|--------------|
| `GET /logistics/transport-estimate?origin_lat=..&origin_lng=..&dest_lat=..&dest_lng=..` | Distance, duration, cost estimate |
| `GET /logistics/nearby-storage` | Storage facilities near a location |
| `GET /logistics/storage-decision` | Sell-now vs store recommendation |
| `GET /logistics/route-consolidation` | Combine multiple pickups |
| `GET /storage` | Seeded storage facility list |

Transport and storage numbers are **estimates** — they come from seeded data, not a live transporter API.

---

## Grievances

| Endpoint | What it does |
|----------|--------------|
| `POST /grievances` | Open a grievance |
| `GET /grievances` | List grievances |
| `PUT /grievances/{id}/resolve` | Admin resolves/rejects with notes |

```json
// POST /grievances
{ "category": "quality_disagreement", "description": "Buyer said grade B, lot was graded A", "order_id": 3 }

// PUT /grievances/2/resolve
{ "resolution": "Refunded the difference", "status": "resolved" }
```

---

## Quality Grading

| Endpoint | What it does |
|----------|--------------|
| `POST /quality/upload/{lot_id}` | Upload crop photos (multipart) |
| `POST /quality/assess/{lot_id}` | Run AI-assisted estimate on the photos |
| `GET /quality/report/{lot_id}` | Latest quality report |
| `GET /quality/history/{lot_id}` | Revision history |
| `POST /quality/confirm/{assessment_id}` | Farmer accepts the estimate |
| `POST /quality/request-verification/{assessment_id}` | Request manual verification |
| `POST /quality/verify/{assessment_id}` | Admin/FPO verifies or corrects |
| `GET /quality/supported-crops` | Tomato, Onion, Soybean |

Every result carries `verification_type` (self_declared / ai_assisted / manually_verified / lab_verified) and is labeled "AI-assisted quality estimate" — never "certified grade".

---

## FPO

| Endpoint | What it does |
|----------|--------------|
| `GET /fpo/dashboard` | Member count, lots, volume, orders |
| `GET /fpo/members` | Member farmers with their produce |
| `GET /fpo/lots` | Collective lots |
| `POST /fpo/aggregate` | Combine member lots into a collective lot |

---

## Admin

| Endpoint | What it does |
|----------|--------------|
| `GET /admin/stats` | Platform metrics (users, lots, transactions) |
| `GET /admin/users` | All users with verification status |
| `PUT /admin/buyers/{id}/verify` | Verify or reject a buyer account |

---

## Market Data Sync

| Endpoint | What it does |
|----------|--------------|
| `GET /sync/test` | Test the data.gov.in connection (reports key validity, fetch count) |
| `POST /sync/mandi` | Trigger a live sync from data.gov.in |
| `GET /sync/status` | Last sync: fetched, inserted, skipped, rejected, latest date |

The sync flow: fetch → validate → deduplicate → insert → report. If the API is unreachable, the app serves cached records and clearly labels them.

---

## Notifications & Translations

| Endpoint | What it does |
|----------|--------------|
| `GET /notifications` | List user notifications |
| `POST /notifications/{id}/read` | Mark as read |
| `GET /translations/{lang}` | UI strings for `en`, `hi`, `mr` |

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created (e.g., lot, offer, grievance) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Wrong role for the endpoint |
| 404 | Resource not found |
| 500 | Server error (check `/health` and logs) |

## Error Shape

Errors come back as `{ "detail": "Human-readable message" }`.

```json
{ "detail": "Username or password is incorrect" }
```