# ShetBhav API Reference

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://shetbhav-backend.onrender.com` |
| **Local dev** | `http://localhost:8000` |
| **API Docs** | `https://shetbhav-backend.onrender.com/docs` |
| **Health Check** | `https://shetbhav-backend.onrender.com/health` |

All authenticated endpoints require: `Authorization: Bearer <token>`

## Authentication

### POST /auth/login
```json
{ "username": "ramesh", "password": "demo123" }
→ { "access_token": "eyJ...", "token_type": "bearer", "user": { "id": 1, "role": "farmer", ... } }
```

### POST /auth/register
```json
{ "username": "newfarmer", "email": "f@demo.shetbhav.in", "password": "pass123", "full_name": "New Farmer", "role": "farmer" }
```

### GET /auth/me
Returns current user profile.

---

## Crops & Markets (Public)

### GET /crops
List all supported crops: Tomato, Onion, Soybean.

### GET /markets
List all Maharashtra markets: Nashik APMC, Pune Market Yard, Mumbai APMC, etc.

### GET /markets/prices?crop_id=1
```json
{ "crop": "tomato", "market": "Nashik APMC", "prices": { "min_price": 1800, "max_price": 2509, "modal_price": 2149 }, "source": "synthetic_demo" }
```

### GET /markets/prices/history?crop_id=1&market_id=1&days=30
Array of historical price records.

---

## Farmer

### GET /farmers/dashboard
```json
{ "active_lots": 6, "total_lots": 7, "pending_orders": 1, "total_earnings": 267500, "unread_notifications": 0 }
```

### GET/PUT /farmers/profile
View or update farm address, coordinates, phone.

### POST /lots
```json
{ "crop_id": 1, "quantity_kg": 2000, "quality_grade": "A", "location_lat": 20.0, "location_lng": 73.7, "storage_available": true, "urgency": "soon" }
```

### GET /lots?status=active
List farmer's lots.

---

## Smart Sell Engine

### POST /smart-sell
```json
{ "crop_id": 1, "quantity_kg": 2000, "quality_grade": "A", "location_lat": 19.9975, "location_lng": 73.7898, "storage_available": true, "urgency": "soon" }
→ {
    "best_option": { "target_name": "Nashik APMC", "score": 78, "net_realization_per_q": 2127, "reasons": [...], "risks": [...] },
    "alternatives": [...],
    "what_if_scenarios": [...]
  }
```

---

## Forecasting

### GET /forecasts/predict?crop_id=1&market_id=1&current_price=2149
```json
{ "predicted_prices": [2155, 2162, ...], "confidence": 0.75 }
```

### POST /forecasts/train?crop_id=1
Retrains XGBoost model for specified crop.

---

## Buyer

### POST /demand
```json
{ "crop_id": 1, "quantity_kg": 5000, "quality_grade": "A", "district": "Pune", "offered_price_per_q": 2500 }
```

### GET /matching/{lot_id}
Returns ranked buyer-demand matches for a lot.

---

## Offers & Negotiation

### POST /offers
```json
{ "lot_id": 1, "demand_id": 1, "to_user_id": 1, "price_per_q": 2500, "quantity_kg": 2000, "delivery_date": "2026-09-05" }
```

### POST /offers/{id}/counter
```json
{ "price_per_q": 2550 }
```

### POST /offers/{id}/accept
### POST /offers/{id}/reject

---

## Orders & Payment

### POST /orders?offer_id=1
Creates order from accepted offer.

### PUT /orders/{id}/status
```json
{ "status": "delivered" }
```

### POST /payments/{id}/simulate
Simulates payment (clearly labeled as simulation).

---

## Logistics

### GET /logistics/transport-estimate?origin_lat=...&origin_lng=...&dest_lat=...&dest_lng=...
```json
{ "distance_km": 140, "estimated_duration_min": 210, "estimated_cost": 2852, "cost_per_q": 285 }
```

### GET /logistics/storage-facilities?crop=tomato&lat=...&lng=...

### GET /logistics/route-consolidation

### GET /logistics/storage-decision

---

## Grievances

### POST /grievances
```json
{ "category": "quality_disagreement", "description": "Wrong grade", "order_id": 1 }
```

### PUT /grievances/{id}/resolve
```json
{ "resolution": "Issue addressed, refund issued" }
```

---

## Admin

### GET /admin/stats
Platform-wide metrics: farmers, buyers, lots, transactions, dispute rate.

### GET /admin/users
All registered users.

### PUT /admin/buyers/{id}/verify
Verify or reject buyer accounts.

---

## Quality Grading

### POST /quality/assess/{lot_id}?image_url=demo://sample.jpg
AI-assisted grading (Tomato prototype).

### POST /quality/assess/{lot_id}?override_grade=A
Manual grade override.

---

## Notifications

### GET /notifications
List user notifications.

### POST /notifications/{id}/read
Mark as read.

---

## Translations

### GET /translations/{lang}
Returns UI translation keys for `en`, `hi`, `mr`.
