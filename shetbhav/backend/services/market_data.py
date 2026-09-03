"""
Market Data Service — Multi-mode adapter for market price data.

Modes:
  dataset  — official imported AGMARKNET CSV data (default for dev/demo)
  live     — fetch data.gov.in API (requires API key)
  cached   — use database records only
  demo     — synthetic records as final fallback

Set MARKET_DATA_MODE env var to switch modes.
Never label historical dataset data as real-time.
"""
import os
import random
import math
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.database import Market, MarketPrice, Crop, DataSourceType


# ── Mode Configuration ──────────────────────────────────────────────
MARKET_DATA_MODE = os.getenv("MARKET_DATA_MODE", "dataset").lower()
AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY", "")


# ═══════════════════════════════════════════════════════════════════════
# DATA PROVIDERS
# ═══════════════════════════════════════════════════════════════════════

class DatasetProvider:
    """
    Uses official imported AGMARKNET data from the database.
    Source type: historical_dataset
    Labels: clearly marked as imported historical data with data_as_of date.
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

    def get_all_market_prices(self, db: Session, crop_id: int) -> dict:
        """Get latest prices across all markets for a crop."""
        markets = {}
        records = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.crop_id == crop_id,
                MarketPrice.source_type == "historical_dataset",
            )
            .order_by(desc(MarketPrice.arrival_date))
            .all()
        )
        for r in records:
            mid = r.market_id
            if mid not in markets:
                markets[mid] = {
                    "market_name": r.market_name or "",
                    "market_id": mid,
                    "min_price": r.min_price,
                    "max_price": r.max_price,
                    "modal_price": r.modal_price,
                    "arrivals_qty": r.arrival_quantity or r.arrivals_qty,
                    "date": (r.arrival_date or r.date).strftime("%Y-%m-%d"),
                    "variety": r.variety or "",
                    "grade": r.grade or "",
                }
        return markets


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

    Resolution order:
    1. dataset  → imported AGMARKNET CSV data
    2. live     → data.gov.in API (if API key available)
    3. cached   → database records
    4. demo     → synthetic fallback

    Each response includes clear source labels:
    - "Imported AGMARKNET data (as of YYYY-MM-DD)"
    - "Government market data (live)"
    - "Synthetic demo data (not real market data)"
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
        mode = MARKET_DATA_MODE

        # ── Mode: dataset ──
        if mode == "dataset":
            data = self.dataset.get_current_price(db, crop_id, market_id)
            if data:
                return self._build_response(crop_name, data, "historical_dataset",
                    f"Imported AGMARKNET data (as of {data['date']})")

        # ── Mode: live ──
        if mode == "live" and AGMARKNET_API_KEY:
            live_data = self._try_live_fetch(crop_name, market_id, db)
            if live_data:
                return self._build_response(crop_name, live_data, "live",
                    "Government market data (AGMARKNET live)")

        # ── Mode: cached — check any database record ──
        if mode in ("dataset", "live", "cached"):
            cached = self._get_cached_price(db, crop_id, market_id)
            if cached:
                source_label = self._cached_label(cached)
                return self._build_response(crop_name, cached, cached["source_type"], source_label)

        # ── Mode: demo — synthetic fallback ──
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
        mode = MARKET_DATA_MODE

        # Try dataset first
        if mode in ("dataset", "live", "cached"):
            historical = self.dataset.get_historical(db, crop_id, market_id, days)
            if historical:
                return historical

        # Try cached (any source)
        cached = (
            db.query(MarketPrice)
            .filter(MarketPrice.crop_id == crop_id, MarketPrice.market_id == market_id)
            .order_by(MarketPrice.date.desc())
            .limit(days)
            .all()
        )
        if cached:
            return [
                {
                    "min_price": p.min_price,
                    "max_price": p.max_price,
                    "modal_price": p.modal_price,
                    "arrivals_qty": p.arrivals_qty,
                    "date": p.date.strftime("%Y-%m-%d"),
                }
                for p in reversed(cached)
            ]

        # Synthetic fallback
        return self.synthetic.get_historical(crop_name, days)

    def get_market_overview(self, db: Session, crop_id: int) -> dict:
        """Get market overview with prices and forecast."""
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        if not crop:
            return {"error": "Crop not found"}

        prices = self.get_current_prices(db, crop_id)

        # Get forecast
        from ml.forecasting import predict_price
        modal = prices.get("prices", {}).get("modal_price", 2400)
        forecast = predict_price(crop.name.lower(), modal)

        return {
            "crop": {
                "id": crop.id,
                "name": crop.name,
                "name_hi": crop.name_hi,
            },
            "current_price": modal,
            "min_price": prices.get("prices", {}).get("min_price", 0),
            "max_price": prices.get("prices", {}).get("max_price", 0),
            "price_trend": "stable",
            "trend_pct": 0,
            "forecast": forecast,
            "data_source": prices.get("source", "synthetic"),
            "data_source_label": prices.get("data_source_label", ""),
            "last_updated": prices.get("last_updated", datetime.utcnow().isoformat()),
        }

    def _try_live_fetch(self, crop_name: str, market_id: Optional[int], db: Session) -> Optional[dict]:
        """Attempt to fetch from data.gov.in live API."""
        try:
            import httpx
            market = db.query(Market).filter(Market.id == market_id).first() if market_id else None
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

    def _get_cached_price(self, db: Session, crop_id: int, market_id: Optional[int]) -> Optional[dict]:
        """Get latest price from any database source."""
        query = db.query(MarketPrice).filter(MarketPrice.crop_id == crop_id)
        if market_id:
            query = query.filter(MarketPrice.market_id == market_id)
        latest = query.order_by(desc(MarketPrice.date)).first()
        if not latest:
            return None
        return {
            "min_price": latest.min_price,
            "max_price": latest.max_price,
            "modal_price": latest.modal_price,
            "arrivals_qty": latest.arrivals_qty,
            "date": latest.date.strftime("%Y-%m-%d") if latest.date else "",
            "market_name": latest.market_name or "",
            "source_type": latest.source_type or "cached",
        }

    def _cached_label(self, cached: dict) -> str:
        """Generate source label for cached data."""
        st = cached.get("source_type", "cached")
        date = cached.get("date", "")
        if st == "historical_dataset":
            return f"Imported AGMARKNET data (as of {date})"
        elif st == "live":
            return f"Government market data (cached, {date})"
        elif st == "synthetic":
            return "Synthetic demo data (not live market data)"
        return f"Cached market data ({date})"

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
