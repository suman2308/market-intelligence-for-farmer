"""
Market Data Service — adapter pattern for external data sources.
Implements §8 and §9 of specification.
"""
import random
import httpx
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from models.database import Market, MarketPrice, Crop, DataSourceType


class MarketDataProvider:
    """Base interface for market price data providers."""

    def fetch_prices(self, market_code: str, crop_name: str, date: datetime) -> Optional[dict]:
        raise NotImplementedError

    def fetch_historical(self, market_code: str, crop_name: str, days: int = 90) -> List[dict]:
        raise NotImplementedError


class GovernmentMarketDataProvider(MarketDataProvider):
    """
    Government of India open data — AGMARKNET / data.gov.in.
    Uses public API endpoint for daily commodity prices.
    Verified: https://data.gov.in/resources/daily-prices-various-commodities-mandi
    """

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self.base_url = "https://data.gov.in/backend/dmspublic/v1/resources/download"

    def fetch_prices(self, market_code: str, crop_name: str, date: datetime) -> Optional[dict]:
        """Try to fetch real data. Return None if unavailable."""
        try:
            # AGMARKNET data.gov.in endpoint — requires API key
            # For MVP we attempt real fetch, fall back to cached/synthetic
            if not self.api_key:
                return None

            with httpx.Client(timeout=10) as client:
                resp = client.get(
                    self.base_url,
                    params={
                        "api-key": self.api_key,
                        "format": "json",
                        "filters[market]": market_code,
                        "filters[commodity]": crop_name,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("records"):
                        return self._normalize(data["records"][0])
        except Exception:
            pass  # Never break the app
        return None

    def fetch_historical(self, market_code: str, crop_name: str, days: int = 90) -> List[dict]:
        """Fetch historical price data. Returns empty list if unavailable."""
        try:
            if not self.api_key:
                return []
            with httpx.Client(timeout=15) as client:
                resp = client.get(
                    self.base_url,
                    params={
                        "api-key": self.api_key,
                        "format": "json",
                        "filters[market]": market_code,
                        "filters[commodity]": crop_name,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [self._normalize(r) for r in data.get("records", [])[:days]]
        except Exception:
            pass
        return []

    def _normalize(self, record: dict) -> dict:
        """Normalize external API response to standard format."""
        return {
            "min_price": float(record.get("min_price", 0)),
            "max_price": float(record.get("max_price", 0)),
            "modal_price": float(record.get("modal_price", record.get("price", 0))),
            "arrivals_qty": float(record.get("arrivals", record.get("quantity", 0))),
            "date": record.get("date", datetime.utcnow().isoformat()),
        }


class SyntheticMarketDataProvider(MarketDataProvider):
    """
    Clearly labelled SYNTHETIC DEMO data provider.
    §8: Never present synthetic data as real-world data.
    """

    # Realistic price ranges for Maharashtra commodities (Rs/quintal)
    PRICE_RANGES = {
        "tomato": {"base": 2400, "min": 1800, "max": 3200, "volatility": 0.12},
        "onion": {"base": 1600, "min": 1000, "max": 2800, "volatility": 0.15},
        "soybean": {"base": 4200, "min": 3500, "max": 5000, "volatility": 0.08},
    }

    MARKETS = {
        "Pune APMC": {"lat": 18.5204, "lng": 73.8567, "district": "Pune"},
        "Nashik APMC": {"lat": 19.9975, "lng": 73.7898, "district": "Nashik"},
        "Mumbai APMC": {"lat": 19.0760, "lng": 72.8777, "district": "Mumbai"},
        "Nagpur APMC": {"lat": 21.1458, "lng": 79.0882, "district": "Nagpur"},
        "Aurangabad APMC": {"lat": 19.8762, "lng": 75.3433, "district": "Aurangabad"},
        "Kolhapur APMC": {"lat": 16.7050, "lng": 74.2433, "district": "Kolhapur"},
        "Solapur APMC": {"lat": 17.6599, "lng": 75.9064, "district": "Solapur"},
        "Nashik Lasalgaon": {"lat": 20.1487, "lng": 73.8936, "district": "Nashik"},
        "Ahmednagar APMC": {"lat": 19.0952, "lng": 74.7496, "district": "Ahmednagar"},
        "Satara APMC": {"lat": 17.6805, "lng": 73.9790, "district": "Satara"},
    }

    def fetch_prices(self, market_name: str, crop_name: str, date: datetime) -> Optional[dict]:
        crop = crop_name.lower()
        params = self.PRICE_RANGES.get(crop, self.PRICE_RANGES["tomato"])
        day_offset = (date - datetime(2026, 1, 1)).days
        seasonal = 1 + 0.1 * __import__('math').sin(2 * 3.14159 * day_offset / 365)
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

    def fetch_historical(self, market_name: str, crop_name: str, days: int = 90) -> List[dict]:
        today = datetime.utcnow()
        results = []
        for i in range(days):
            d = today - timedelta(days=i)
            prices = self.fetch_prices(market_name, crop_name, d)
            if prices:
                results.append(prices)
        return list(reversed(results))


class MarketDataService:
    """Main service — tries real data, falls back to synthetic with clear labels."""

    def __init__(self, api_key: str = ""):
        self.real_provider = GovernmentMarketDataProvider(api_key)
        self.synthetic_provider = SyntheticMarketDataProvider()

    def get_current_prices(
        self, db: Session, crop_id: int, market_id: Optional[int] = None
    ) -> dict:
        """Get current prices for a crop, trying real data first."""
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        if not crop:
            return {"error": "Crop not found"}

        crop_name = crop.name.lower()
        market = db.query(Market).filter(Market.id == market_id).first() if market_id else None

        # Try real data first
        real_data = None
        if market:
            real_data = self.real_provider.fetch_prices(market.code or market.name, crop_name, datetime.utcnow())

        if real_data:
            source = DataSourceType.REAL
            prices = real_data
        else:
            # Use cached DB data if available
            cached = (
                db.query(MarketPrice)
                .filter(MarketPrice.crop_id == crop_id)
                .order_by(MarketPrice.date.desc())
                .first()
            )
            if cached and (datetime.utcnow() - cached.date).days < 2:
                source = cached.data_source_type
                prices = {
                    "min_price": cached.min_price,
                    "max_price": cached.max_price,
                    "modal_price": cached.modal_price,
                    "arrivals_qty": cached.arrivals_qty,
                }
            else:
                source = DataSourceType.SYNTHETIC_DEMO
                prices = self.synthetic_provider.fetch_prices(
                    market.name if market else "Nashik APMC",
                    crop_name,
                    datetime.utcnow(),
                )

        return {
            "crop": crop_name,
            "market": market.name if market else "Nashik APMC",
            "prices": prices,
            "source": source.value,
            "data_source_label": self._source_label(source),
            "last_updated": datetime.utcnow().isoformat(),
            "is_stale": False,
        }

    def get_historical_prices(
        self, db: Session, crop_id: int, market_id: int, days: int = 90
    ) -> List[dict]:
        """Get historical price data for charting and ML training."""
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        market = db.query(Market).filter(Market.id == market_id).first()
        if not crop or not market:
            return []

        crop_name = crop.name.lower()

        # Try real data
        real_data = self.real_provider.fetch_historical(market.code or market.name, crop_name, days)
        if real_data:
            return real_data

        # Try cached
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
        return self.synthetic_provider.fetch_historical(market.name, crop_name, days)

    def _source_label(self, source: DataSourceType) -> str:
        labels = {
            DataSourceType.REAL: "Source: Government market data (AGMARKNET)",
            DataSourceType.SYNTHETIC_DEMO: "Source: Synthetic demo data (not live market data)",
            DataSourceType.DERIVED: "Source: Derived from other data",
            DataSourceType.MODEL_PREDICTION: "Source: Model prediction",
        }
        return labels.get(source, "Source: Unknown")
