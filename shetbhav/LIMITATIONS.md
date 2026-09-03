# ShetBhav — Limitations

**Last Updated:** September 3, 2026

---

## Honest Assessment

ShetBhav is an **MVP prototype** built for Smart India Hackathon 2026. It is **not** a production system.

---

## Scope Limitations

| Item | Current State | Production Need |
|------|---------------|-----------------|
| Region | Maharashtra only | Pan-India coverage |
| Crops | Onion, Tomato, Soybean | All major crops |
| Users | 4 demo accounts | Real user registration |
| Payments | Simulated (clearly labeled) | Real payment gateway |
| Transport | Estimated/seeded quotes | Live transporter API |
| Storage | Estimated/seeded facilities | Real warehouse inventory |
| Quality grading | Rule-based CV prototype | Trained ML model + lab verification |
| Forecasts | XGBoost estimates | Production-grade forecasting pipeline |

---

## Data Limitations

- **Daily mandi data** — not real-time second-by-second prices
- **AGMARKNET coverage** — some mandis may not report daily
- **Soybean seasonal gaps** — not always available in API
- **Historical depth** — 219 imported records (limited for ML training)
- **No real buyer transactions** — buyer reliability is based on seeded data

---

## ML Limitations

- XGBoost trained on limited historical data (219 records)
- Confidence intervals are approximate
- Model retraining requires fresh data
- Quality grading is rule-based CV, not trained neural network
- Forecasts are estimates, not guaranteed prices
- Naive baseline used when data is insufficient

---

## Payment Limitations

- All payments are simulated
- No real money movement
- Clearly labeled as "Demo payment tracking"
- No payment gateway integration
- No bank account verification

---

## Buyer Reliability

- Based only on observed platform history
- New buyers show "Insufficient transaction history"
- No external credit checks
- No bank verification
- Reliability label is internal to ShetBhav

---

## Quality Grading

- AI grading is **not** certified laboratory testing
- Rule-based computer vision (not trained model)
- Cannot detect: internal damage, moisture content, pesticide residue, hidden rot
- Requires manual verification for final grade
- Lab verification recommended for commercial transactions

---

## What Works End-to-End

✅ Farmer login → create lot → market prices → Smart Sell → publish lot
✅ Buyer login → find lot → make offer → counter-offer → accept → order
✅ Order timeline → transport → simulated payment → grievance → admin resolve
✅ data.gov.in API sync → cached fallback → synthetic fallback
✅ Price forecasting with XGBoost + baselines
✅ AI-assisted quality grading for Tomato, Onion, Soybean
✅ English, Hindi, Marathi localization
✅ Mobile-first responsive design

---

## What Requires Production Work

- PostgreSQL database (SQLite for dev only)
- Alembic migrations
- Real payment gateway (Razorpay, PayU, etc.)
- Live transporter/warehouse APIs
- Trained quality grading model
- Comprehensive XGBoost training data
- CI/CD pipeline
- HTTPS and domain
- Rate limiting hardening
- Push notifications
- Real user registration and KYC
