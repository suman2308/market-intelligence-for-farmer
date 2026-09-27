"""
Market Data Service — multi-mode adapter for market price data.

Modes (MARKET_DATA_MODE env var):
  dataset  — official imported AGMARKNET data already in the database (default)
  live     — fetch data.gov.in API first (requires API key)
  cached   — database records only
  demo     — synthetic records only

Source labels are part of the product: a farmer must always be able to see
whether a price is official government data, imported history, or a synthetic
demo value. Resolution therefore prefers REAL rows (live / historical_dataset)
over synthetic ones, even when a synthetic demo row happens to be newer.
"""
import random
import math
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from config.settings import MARKET_DATA_MODE, AGMARKNET_API_KEY
from models.database import Market, MarketPrice, Crop

# Sources that carry real-world value (everything else is synthetic demo data).
REAL_SOURCE_TYPES = ("live", "historical_dataset")


# ═══════════════════════════════════════════════════════════════════════
# DATA PROVIDERS
# ═══════════════════════════════════════════════════════════════════════

class DatasetProvider:
    """
    Uses official imported AGMARKNET data from the database.
    Source type: historical_dataset — clearly marked as imported history.
    """

    def get_current_price(self, db: Session, crop_id: int, market_id: Optional[int] = None) -> Optional[dict]:
        """Get the most recent imported price for a crop/market."""
        query = db.query(MarketPrice).filter(
            MarketPrice.crop_id == crop_id,
            MarketPrice.source_type == "historical_dataset",
        )
        if market_id:
            query = query.filter(MarketPrice.market_id == market_id)

        latest = query.order_by(desc(MarketPrice.arrival_date)).first()
        if not latest:
            return None

        return {
            "min_price": latest.min_price,
            "max_price": latest.max_price,
            "modal_price": latest.modal_price,
            "arrivals_qty": latest.arrival_quantity or latest.arrivals_qty,
            "date": latest.arrival_date or latest.date,
            "market_name": latest.market_name or "",
            "variety": latest.variety or "",
            "grade": latest.grade or "",
            "price_unit": latest.price_unit or "Rs/quintal",
        }

    def get_historical(self, db: Session, crop_id: int, market_id: int, days: int = 90) -> List[dict]:
        """Get historical price data from imported dataset."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        records = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.crop_id == crop_id,
                MarketPrice.market_id == market_id,
                MarketPrice.source_type == "historical_dataset",
                MarketPrice.arrival_date >= cutoff,
            )
            .order_by(MarketPrice.arrival_date.asc())
            .all()
        )

        return [
            {
                "min_price": r.min_price,
                "max_price": r.max_price,
                "modal_price": r.modal_price,
                "arrivals_qty": r.arrival_quantity or r.arrivals_qty,
                "date": (r.arrival_date or r.date).strftime("%Y-%m-%d"),
                "source": "historical_dataset",
                "data_as_of": r.data_as_of.strftime("%Y-%m-%d") if r.data_as_of else None,
                "imported_at": r.imported_at.strftime("%Y-%m-%d") if r.imported_at else None,
            }
            for r in records
        ]


class SyntheticProvider:
    """
    Clearly labelled SYNTHETIC DEMO data provider.
    Never presented as real-world data.
    """

    PRICE_RANGES = {
        "tomato": {"base": 2400, "min": 1800, "max": 3200, "volatility": 0.12},
        "onion": {"base": 1600, "min": 1000, "max": 2800, "volatility": 0.15},
        "soybean": {"base": 4200, "min": 3500, "max": 5000, "volatility": 0.08},
    }

    def get_current_price(self, crop_name: str) -> dict:
        crop = crop_name.lower()
        params = self.PRICE_RANGES.get(crop, self.PRICE_RANGES["tomato"])
        now = datetime.utcnow()
        day_offset = (now - datetime(2026, 1, 1)).days
        seasonal = 1 + 0.1 * math.sin(2 * math.pi * day_offset / 365)
        noise = random.gauss(0, params["volatility"])

        modal = params["base"] * seasonal * (1 + noise)
        modal = max(params["min"], min(params["max"], modal))
        spread = params["base"] * 0.15

        return {
            "min_price": round(max(params["min"], modal - spread), 0),
            "max_price": round(min(params["max"], modal + spread), 0),
            "modal_price": round(modal, 0),
            "arrivals_qty": round(random.uniform(50, 500), 1),
            "date": now.strftime("%Y-%m-%d"),
        }

    def get_historical(self, crop_name: str, days: int = 90) -> List[dict]:
        today = datetime.utcnow()
        return [
            self._generate_day(crop_name, today - timedelta(days=i))
            for i in range(days)
        ]

    def _generate_day(self, crop_name: str, date: datetime) -> dict:
        crop = crop_name.lower()
        params = self.PRICE_RANGES.get(crop, self.PRICE_RANGES["tomato"])
        day_offset = (date - datetime(2026, 1, 1)).days
        seasonal = 1 + 0.1 * math.sin(2 * math.pi * day_offset / 365)
        noise = random.gauss(0, params["volatility"])
        modal = params["base"] * seasonal * (1 + noise)
        modal = max(params["min"], min(params["max"], modal))
        spread = params["base"] * 0.15
        return {
            "min_price": round(max(params["min"], modal - spread), 0),
            "max_price": round(min(params["max"], modal + spread), 0),
            "modal_price": round(modal, 0),
            "arrivals_qty": round(random.uniform(50, 500), 1),
            "date": date.strftime("%Y-%m-%d"),
        }


# ═══════════════════════════════════════════════════════════════════════
# MAIN SERVICE
# ═══════════════════════════════════════════════════════════════════════

class MarketDataService:
    """
    Multi-mode market data service.

    Resolution order for a "current" price:
      1. live fetch from data.gov.in (mode=live + API key configured)
      2. newest REAL database row (live / historical_dataset — incl. rows
         restored from the local market-data ledger)
      3. newest database row of any kind (labelled honestly)
      4. synthetic fallback (labelled "Synthetic demo data")

    Every response includes a plain-language data_source_label.
    """

    def __init__(self):
        self.dataset = DatasetProvider()
        self.synthetic = SyntheticProvider()

    def get_current_prices(
        self, db: Session, crop_id: int, market_id: Optional[int] = None
    ) -> dict:
        """Get current prices with mode-based resolution."""
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        if not crop:
            return {"error": "Crop not found"}

        crop_name = crop.name.lower()

        # ── 1. Live fetch (only in live mode with an API key) ──
        if MARKET_DATA_MODE == "live" and AGMARKNET_API_KEY:
            live_data = self._try_live_fetch(crop_name, market_id, db)
            if live_data:
                return self._build_response(crop_name, live_data, "live",
                    "Government market data (AGMARKNET live)")

        # ── 2. Newest REAL row in the database ──
        real = self._best_db_price(db, crop_id, market_id, only_real=True)
        if real:
            return self._build_response(crop_name, real, real["source_type"],
                                        self._label(real["source_type"], real["date"]))

        # ── 3. In dataset/cached modes fall back to the newest row of any
        #      kind (never silently: the label states what it is) ──
        if MARKET_DATA_MODE != "demo":
            any_row = self._best_db_price(db, crop_id, market_id, only_real=False)
            if any_row:
                return self._build_response(crop_name, any_row, any_row["source_type"],
                                            self._label(any_row["source_type"], any_row["date"]))

        # ── 4. Synthetic fallback ──
        data = self.synthetic.get_current_price(crop_name)
        return self._build_response(crop_name, data, "synthetic",
            "Synthetic demo data (not live market data)")

    def get_historical_prices(
        self, db: Session, crop_id: int, market_id: int, days: int = 90
    ) -> List[dict]:
        """Get historical prices for charting and ML training."""
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        if not crop:
            return []

        crop_name = crop.name.lower()

        # Imported dataset rows first (real, labelled)
        if MARKET_DATA_MODE != "demo":
            historical = self.dataset.get_historical(db, crop_id, market_id, days)
            if historical:
                return historical

        # Any real (non-synthetic) rows as a second choice
        cutoff = datetime.utcnow() - timedelta(days=days)
        real_rows = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.crop_id == crop_id,
                MarketPrice.market_id == market_id,
                MarketPrice.source_type != "synthetic",
                MarketPrice.date >= cutoff,
            )
            .order_by(MarketPrice.date.asc())
            .all()
        )
        if real_rows:
            return [
                {
                    "min_price": p.min_price,
                    "max_price": p.max_price,
                    "modal_price": p.modal_price,
                    "arrivals_qty": p.arrivals_qty,
                    "date": p.date.strftime("%Y-%m-%d"),
                }
                for p in real_rows
            ]

        # Synthetic fallback (demo mode or a market with no data at all)
        return self.synthetic.get_historical(crop_name, days)

    # ── internals ────────────────────────────────────────────────────

    def _best_db_price(
        self, db: Session, crop_id: int, market_id: Optional[int], only_real: bool
    ) -> Optional[dict]:
        """Newest row for the crop, preferring real sources over synthetic.

        With only_real=True the source filter is applied in SQL so a real row
        can always win, however far behind fresh synthetic demo rows it sits
        (a newest-N window would let a burst of demo rows hide it entirely).
        With only_real=False the newest row of any kind is returned.
        Returns the flat row dict from _row_to_price, or None.
        """
        query = db.query(MarketPrice).filter(MarketPrice.crop_id == crop_id)
        if market_id:
            query = query.filter(MarketPrice.market_id == market_id)

        if only_real:
            row = (
                query.filter(func.lower(MarketPrice.source_type).in_(REAL_SOURCE_TYPES))
                .order_by(desc(MarketPrice.date))
                .first()
            )
        else:
            row = query.order_by(desc(MarketPrice.date)).first()
        return self._row_to_price(row) if row else None

    def _row_to_price(self, r: MarketPrice) -> dict:
        return {
            "min_price": r.min_price,
            "max_price": r.max_price,
            "modal_price": r.modal_price,
            "arrivals_qty": r.arrival_quantity or r.arrivals_qty,
            "date": (r.arrival_date or r.date).strftime("%Y-%m-%d") if (r.arrival_date or r.date) else "",
            "market_name": r.market_name or "",
            "source_type": (r.source_type or "synthetic").lower(),
        }

    def _label(self, source_type: str, date: str) -> str:
        if source_type == "historical_dataset":
            return f"Imported AGMARKNET data (as of {date})"
        if source_type == "live":
            return f"Government market data (as of {date})"
        if source_type == "synthetic":
            return "Synthetic demo data (not live market data)"
        return f"Cached market data ({date})"

    def _try_live_fetch(self, crop_name: str, market_id: Optional[int], db: Session) -> Optional[dict]:
        """Attempt to fetch from data.gov.in live API."""
        try:
            import httpx
            url = "https://data.gov.in/backend/dmspublic/v1/resources/download"
            with httpx.Client(timeout=10) as client:
                resp = client.get(url, params={
                    "api-key": AGMARKNET_API_KEY,
                    "format": "json",
                    "filters[commodity]": crop_name.title(),
                })
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("records"):
                        r = data["records"][0]
                        return {
                            "min_price": float(r.get("min_price", 0)),
                            "max_price": float(r.get("max_price", 0)),
                            "modal_price": float(r.get("modal_price", r.get("price", 0))),
                            "arrivals_qty": float(r.get("arrivals", 0)),
                            "date": r.get("date", datetime.utcnow().isoformat()),
                        }
        except Exception:
            pass
        return None

    def _build_response(self, crop_name: str, data: dict, source_type: str, label: str) -> dict:
        """Build standardized price response."""
        return {
            "crop": crop_name,
            "market": data.get("market_name", "Nashik APMC"),
            "prices": {
                "min_price": data.get("min_price", 0),
                "max_price": data.get("max_price", 0),
                "modal_price": data.get("modal_price", 0),
                "arrivals_qty": data.get("arrivals_qty", 0),
            },
            "source": source_type,
            "data_source_label": label,
            "last_updated": datetime.utcnow().isoformat(),
            "is_stale": False,
        }
