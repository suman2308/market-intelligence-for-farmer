# ShetBhav — Data Sources

**Last Updated:** September 3, 2026

---

## Primary Data Source

### data.gov.in AGMARKNET API

| Field | Value |
|-------|-------|
| Provider | data.gov.in / Directorate of Marketing & Inspection |
| Resource ID | 9ef84268-d588-465a-a308-a864a43d0070 |
| Dataset | Current Daily Price of Various Commodities from Various Markets (Mandi) |
| Coverage | Maharashtra, selected mandis |
| Crops | Onion, Tomato, Soybean |
| Fields | State, District, Market, Commodity, Variety, Grade, Arrival_Date, Min_Price, Max_Price, Modal_Price |
| Access | Backend API client via backend/.env (DATA_GOV_API_KEY) |
| Rate | Daily updates (not real-time) |

**Important:** This is daily mandi price data, not second-by-second real-time prices. Display as "Official daily mandi data."

### Historical AGMARKNET Dataset

| Field | Value |
|-------|-------|
| File | shetbhav/backend/data/maharashtra_market_prices.csv |
| Records | 219 |
| Crops | Onion, Tomato, Soybean |
| Markets | 6 Maharashtra mandis |
| Import command | `python -m app.scripts.import_market_data --file data/maharashtra_market_prices.csv` |

### Seeded Demo Data

| Field | Value |
|-------|-------|
| Purpose | Fallback when live and cached data unavailable |
| Markets | 7 seeded Maharashtra markets |
| Transporters | 2 seeded transport providers |
| Storage | 2 seeded storage facilities |
| Labeling | Clearly marked as "Demo data" |

---

## Data Modes

| Mode | Behavior |
|------|----------|
| live | Fetch from data.gov.in API |
| cached | Use most recent database records |
| dataset | Use imported AGMARKNET historical records |
| demo | Use synthetic fallback data |

**Fallback chain:** live → cached → dataset → demo

---

## Source Labels

Every market-price record displays:
- **Source name** (e.g., "data.gov.in / AGMARKNET")
- **Source type** (live, cached, dataset, synthetic)
- **Observed date** (arrival_date)
- **Retrieved time** (retrieved_at)
- **Freshness** (fresh, stale)
- **Demo warning** when applicable

---

## API Configuration

Environment variables in backend/.env:

```
DATA_GOV_API_KEY=your_api_key_here
DATA_GOV_RESOURCE_ID=9ef84268-d588-465a-a308-a864a43d0070
MARKET_DATA_MODE=live
MARKET_DATA_CACHE_HOURS=24
REQUEST_TIMEOUT_SECONDS=30
```

---

## API Limitations

- Daily data only (not real-time)
- Limited to Maharashtra mandis initially
- Soybean may have seasonal gaps
- API may have rate limits
- Offline fallback to cached/synthetic data
