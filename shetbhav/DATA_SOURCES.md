# ShetBhav — Data Sources

**Last Updated:** September 26, 2026

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

### Local Market-Data Ledger (durable history)

| Field | Value |
|-------|-------|
| File | `shetbhav/backend/data/local_market_ledger.jsonl` (committed to git) |
| Records now | 1,469 real AGMARKNET records |
| Coverage | 74 Maharashtra mandis · Onion, Tomato, Soybean · 1 Jun – 3 Sep 2026 |
| Written by | Every live API fetch (`services/data_gov.py`) and every CSV import (`app/scripts/import_market_data.py`) |
| Restored by | `services/market_ledger.restore_to_db()` on every backend startup |
| Idempotence | Keyed by (commodity, market, arrival_date) — re-fetches never duplicate |
| Excludes | Synthetic/demo rows are never stored |
| Labels | Restored rows carry `source_type="historical_dataset"` and source name "AGMARKNET (local ledger)" |
| Visibility | `GET /sync/status` (admin) includes a `ledger` block: record count, crops, date range |

**Why it exists:** the production database (Render free tier) is ephemeral — a restart or recycle wipes every stored price. Re-fetching burns API quota and only returns the most recent pages, so history would shrink over time. The ledger banks every real record the moment it arrives; after any database wipe, the next startup replays the file and the platform comes back with its full accumulated history. Over time the file only grows.

### Historical AGMARKNET Dataset (bundled CSV)

| Field | Value |
|-------|-------|
| File | shetbhav/backend/data/maharashtra_market_prices.csv |
| Records | 222 (also mirrored into the ledger at import) |
| Crops | Onion, Tomato |
| Markets | ~69 Maharashtra mandis |
| Import command | `python -m app.scripts.import_market_data --file data/maharashtra_market_prices.csv` |
| Auto-bootstrap | Fresh databases import this CSV on first boot when `IMPORT_HISTORICAL_CSV=true` (set on Render) so a new deploy starts with real records, not blanks |

### Live API Fetches

| Field | Value |
|-------|-------|
| Endpoint | data.gov.in resource API (resource ID `9ef84268-d588-465a-a308-a864a43d0070`) |
| Frequency | Daily (the dataset refreshes once a day, not second-by-second) |
| Persistence | Every fetched record is appended to the local ledger, so live history now **accumulates** instead of cycling |
| Sync trigger | `POST /sync/mandi` (admin) or the sync command |
| Ceiling | The API currently serves only ~100 recent Maharashtra records per crop per fetch — the ledger is what turns repeated fetches into real history |

### Seeded Demo Data

| Field | Value |
|-------|-------|
| Purpose | Fallback when live and cached data unavailable |
| Markets | 7 seeded Maharashtra markets |
| Transporters | 2 seeded transport providers |
| Storage | 2 seeded storage facilities |
| Labeling | Clearly marked as "Demo data"; never stored in the ledger |

---

## Data Modes

| Mode | Behavior |
|------|----------|
| live | Try data.gov.in API first, then fall back to the newest real database row |
| cached | Use most recent database records |
| dataset | Use imported AGMARKNET historical records |
| demo | Use synthetic fallback data only |

**Resolution order:** live fetch → newest **real** row (live / historical_dataset, including ledger-restored rows) → newest row of any kind → synthetic fallback.

Real sources are always preferred over newer synthetic demo rows, and every response carries a plain-language `data_source_label`, e.g.:

- "Government market data (AGMARKNET live)"
- "Imported AGMARKNET data (as of 2026-09-02)"
- "Synthetic demo data (not live market data)"

---

## Source Labels

Every market-price record displays:
- **Source name** (e.g., "data.gov.in / AGMARKNET", "AGMARKNET (local ledger)")
- **Source type** (live, cached, historical_dataset, synthetic)
- **Observed date** (arrival_date / data_as_of)
- **Freshness** (fresh, recent, stale)
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
MARKET_DATA_LEDGER_PATH=
```

`MARKET_DATA_LEDGER_PATH` overrides the default ledger location (`backend/data/local_market_ledger.jsonl`) — useful for tests or mounting a persistent volume.

---

## API Limitations

- Daily data only (not real-time)
- Limited to Maharashtra mandis initially
- Soybean may have seasonal gaps
- API may have rate limits
- Offline fallback to cached/synthetic data
