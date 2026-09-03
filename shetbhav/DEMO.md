# ShetBhav Demo Script

## Setup

| Environment | URL |
|-------------|-----|
| **Production** | `https://<your-app>.vercel.app` |
| **Local dev** | `http://localhost:3000` |
| **Backend API** | `https://shetbhav-backend.onrender.com` |
| **API Docs** | `https://shetbhav-backend.onrender.com/docs` |

1. Open the production or local URL above
2. Database is pre-seeded with demo data
3. All demo accounts use password: `demo123`

## Demo Flow (5 minutes)

### 1. Login as Farmer (30 sec)
- Click "👨‍🌾 Demo Farmer (Ramesh Patil)"
- **Show**: Greeting, today's tomato price ₹2,149/quintal, 6 active lots, earnings

### 2. Smart Sell Decision Engine (2 min)
- Click "Sell My Produce"
- Walk through 7-step wizard:
  1. Crop: Tomato 🍅
  2. Quantity: 2,000 kg
  3. Quality: Grade A ⭐
  4. Location: Nashik (auto-filled)
  5. Harvest: Select date + storage available
  6. Urgency: Within 2 days 📅
- Click "Find Best Options"
- **Show**: Best option with score, price breakdown, net realization, reasons, risks
- **Show**: 6 alternative options ranked
- **Show**: 3 What-If scenarios (sell now vs store vs different buyer)
- **Highlight**: "Expected net: ₹42,540" — total earnings displayed prominently

### 3. Market Intelligence (30 sec)
- Navigate to "Today's Prices"
- **Show**: Current price ₹2,149/quintal, range ₹1,800-2,509
- **Show**: Price forecast "Expected: ₹2,200-2,300 in 3 days"
- **Show**: Data source label "Synthetic demo data"

### 4. Buyer Dashboard (1 min)
- Logout → Login as "🏭 Demo Buyer (ABC Foods)"
- **Show**: 5 demands, 7 available lots, 6 offers
- Click "Make Offer" on a lot
- **Show**: Offer modal with price, quantity, delivery date, total value
- Submit offer
- Navigate to "Offers" tab to see offer status

### 5. Admin Dashboard (30 sec)
- Logout → Login as "⚙️ Demo Admin"
- **Show**: 7 farmers, 5 buyers, 7 active lots, 5 active demand
- **Show**: Platform health metrics
- Click "Grievances" tab
- **Show**: 4 open disputes with Resolve/Reject buttons

### 6. Multilingual (15 sec)
- Logout → Login as farmer
- Switch language to Hindi (हिन्दी) and Marathi (मराठी)
- **Show**: All UI text translates

## Key Talking Points

### Problem
Fragmented agricultural market information. Farmers don't know where, when, or to whom to sell.

### Solution
ShetBhav — AI-powered market intelligence + transaction platform.

### Innovation
Smart Sell Decision Engine: evaluates prices, forecasts, transport, storage, buyer reliability to recommend the best selling option.

### Technical Depth
- XGBoost price forecasting
- Multi-factor scoring algorithm
- Net realization calculator
- What-if simulator
- Route optimization

### Social Impact
Improved farmer price realization through informed decisions.

### Scalability
Maharashtra → India. Architecture supports adding crops, states, markets.

## Demo Data Summary
| Entity | Count |
|--------|-------|
| Farmers | 7 |
| Buyers | 5 |
| Markets | 5 |
| Crops | 3 (Tomato, Onion, Soybean) |
| Active lots | 7 |
| Active demands | 5 |
| Offers | 6 |
| Orders | 4 |
| Payments | 3 |
| Grievances | 4 |
| ML models | 3 (trained) |
