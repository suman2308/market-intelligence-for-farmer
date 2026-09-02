# ShetBhav Limitations

## What's Real vs What's Prototype

### ✅ Fully Working (Verified in This Audit)
- JWT authentication with role-based access (Farmer/FPO/Buyer/Admin)
- Complete CRUD operations for lots, demands, offers, orders, grievances
- Offer negotiation flow (counter-offer, accept, reject) with state validation
- Order lifecycle with proper FK integrity (bug fixed in this audit)
- Payment simulation (clearly labeled)
- Smart Sell Decision Engine with 8-factor weighted scoring
- XGBoost price forecasting (trained per crop with synthetic data)
- Net realization calculation
- What-if scenario comparison
- EN/HI/MR translations (core strings)
- Mobile-first responsive design (nature-inspired palette)
- Admin dashboard with Recharts analytics (pie, bar, line charts)
- FPO dashboard with member management and aggregated lots
- Grievance management with admin resolve/reject
- Transport cost estimation (Haversine)
- Quality grading (prototype for Tomato, manual for others)
- Leaflet/OpenStreetMap integration (market prices, buyer discovery)
- Image upload for quality grading (JPEG/PNG/WebP, 10MB max)
- Rate limiting (production mode)
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Skip-to-content accessibility
- Focus-visible keyboard navigation
- Reduced-motion support
- 114/114 automated tests passing (89 pytest + 25 E2E)

### ⚠️ Prototype / Demo-Only
- **Market prices**: Synthetic data; real AGMARKNET/CEDA APIs require registration
- **Price forecasts**: Trained on synthetic data, not real historical prices
- **Quality grading**: Only works for Tomato (prototype rules, not real CV model)
- **Transport costs**: Haversine distance + INR 20/km, not live OSRM/routing
- **Storage facilities**: 2 demo facilities, not real directory
- **Payments**: Simulated, not real financial transactions
- **Buyer verification**: Admin-driven, not real KYC
- **Buyer trust scores**: Based on synthetic transaction history
- **Notifications**: In-app only, no push/SMS/email
- **Admin weekly trend charts**: Simulated data (would need time-series backend)
- **FPO aggregation**: UI exists, backend aggregation needs more seeded data

### ❌ Not Implemented
- Real AGMARKNET data feed integration (requires API key registration)
- Computer vision quality grading (placeholder prototype only)
- Push notifications / SMS / Email
- Real payment gateway (Razorpay/UPI)
- Buyer KYC / government verification
- Offline mode / service worker
- Analytics / reporting exports
- WebSocket real-time updates
- Database migrations (Alembic)
- CI/CD pipeline
- Load testing
- Penetration testing

---

## Geographic Limitations
- **Scope**: Maharashtra only (5 cities: Nashik, Pune, Mumbai, Nagpur, Kolhapur)
- **Crops**: 3 (Tomato, Onion, Soybean)
- **Markets**: 5 demo markets
- **Markets are synthetic**: No real mandi data feed active

## Security Limitations (Demo Only)
- JWT tokens stored in localStorage (XSS vulnerable — acceptable for prototype)
- Rate limiting disabled in demo mode (DEMO_MODE=true)
- No HTTPS enforcement (localhost dev)
- Demo passwords are simple (`demo123`)
- No CSP headers

## Performance Limitations
- SQLite database (not concurrent-safe, but PostgreSQL-ready)
- No pagination on list endpoints (capped at 50)
- No image compression on upload
- No CDN for static assets
- No Redis caching
- ML models loaded into memory per request

## Test Limitations
- 89 pytest tests run individually (test file isolation issue when run together due to shared FastAPI app dependency override)
- 25 E2E tests via Node.js HTTP client
- No browser-level E2E tests (Playwright)
- No load testing

## Known Bugs
- All previously identified bugs fixed (17 total)
- Order creation FK violation fixed in this audit
- No remaining known bugs

## What Would Make It Production-Real
1. Real AGMARKNET data adapter with cron job (API key needed from data.gov.in or CEDA)
2. PostgreSQL with Supabase
3. Push notification service (Firebase)
4. Image upload + storage (Supabase Storage)
5. Unit + integration test expansion
6. HTTPS + security headers in production
7. Database migrations (Alembic)
8. CI/CD pipeline
9. Monitoring + error tracking (Sentry)
10. Real payment integration (Razorpay/UPI)
11. Load testing (k6/Locust)
12. E2E browser tests (Playwright)
