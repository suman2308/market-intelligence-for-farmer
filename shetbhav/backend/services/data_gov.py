"""
data.gov.in AGMARKNET Client — Official Mandi Price Data

Fetches daily mandi prices from data.gov.in for Maharashtra crops:
Onion, Tomato, Soybean.

Flow:
  1. Check cache freshness (within MARKET_DATA_CACHE_HOURS)
  2. If cache fresh → return cached source type
  3. If stale/missing → fetch from live API
  4. Validate, normalize, store in DB
  5. If API fails → return cached data if available
  6. If no cache → synthetic fallback

Source labeling:
  - live: freshly fetched from data.gov.in
  - cached: from DB, within cache window
  - synthetic: fallback when no live or cached data

NEVER expose API key in responses, logs, or frontend.
"""
import os
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from models.database import MarketPrice, Crop, Market, DataSourceType
from config.settings import (
    DATA_GOV_API_KEY, DATA_GOV_RESOURCE_ID,
    MARKET_DATA_CACHE_HOURS, REQUEST_TIMEOUT_SECONDS,
    MARKET_DATA_MODE,
)


# ── Supported scope ─────────────────────────────────────────────────
MAHARASHTRA_STATES = ["Maharashtra"]
SUPPORTED_CROPS = {"onion", "tomato", "soybean"}
# Map DB crop names to data.gov.in commodity names
CROP_NAME_MAP = {
    "onion": "Onion",
    "tomato": "Tomato",
    "soybean": "Soybean",
}


def _check_api_key() -> bool:
    """Verify API key is configured. Never logs the key value."""
    return bool(DATA_GOV_API_KEY and len(DATA_GOV_API_KEY) > 10)


def _get_cache_cutoff(db: Session) -> datetime:
    """Return the cutoff time for cache freshness."""
    return datetime.utcnow() - timedelta(hours=MARKET_DATA_CACHE_HOURS)


def get_cached_data(
    db: Session,
    crop_id: int,
    market_id: Optional[int] = None,
) -> Optional[Dict]:
    """
    Check for fresh cached data in the database.
    Returns None if no cache or cache is stale.
    """
    cutoff = _get_cache_cutoff(db)
    query = db.query(MarketPrice).filter(
        MarketPrice.crop_id == crop_id,
        MarketPrice.source_type.in_(["live", "historical_dataset"]),
        MarketPrice.fetched_at >= cutoff,
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
        "arrivals_qty": latest.arrival_quantity or latest.arrivals_qty or 0,
        "date": (latest.arrival_date or latest.date).strftime("%Y-%m-%d") if (latest.arrival_date or latest.date) else "",
        "market_name": latest.market_name or "",
        "source_name": latest.source_name or "cached",
        "source_type": "cached",
        "fetched_at": latest.fetched_at.isoformat() if latest.fetched_at else "",
        "freshness_status": "fresh",
    }


def fetch_from_api(
    db: Session,
    crop_name: str,
    market_id: Optional[int] = None,
) -> Tuple[Optional[Dict], Dict]:
    """
    Fetch live data from data.gov.in API.

    Returns:
        (price_data_or_None, sync_metadata)
    """
    sync_meta = {
        "source_name": "data.gov.in / AGMARKNET",
        "source_type": "live",
        "records_fetched": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "records_skipped": 0,
        "records_rejected": 0,
        "errors": [],
        "api_status": "not_attempted",
        "data_as_of": None,
    }

    if not _check_api_key():
        sync_meta["errors"].append("API key not configured")
        sync_meta["api_status"] = "no_api_key"
        return None, sync_meta

    commodity = CROP_NAME_MAP.get(crop_name.lower(), crop_name.title())

    try:
        # data.gov.in OGD v3 API (official endpoint)
        import urllib.parse, urllib.request, json as _json

        params = urllib.parse.urlencode({
            "api-key": DATA_GOV_API_KEY,
            "format": "json",
            "limit": 1000,
            "filters[commodity]": commodity,
            "filters[state]": "Maharashtra",
        })
        url = f"https://api.data.gov.in/resource/{DATA_GOV_RESOURCE_ID}?{params}"

        req = urllib.request.Request(url, headers={"User-Agent": "ShetBhav/1.0"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            data_bytes = response.read()
            resp_data = _json.loads(data_bytes)

            # Build a simple response-like object
            class SimpleResponse:
                status_code = response.status
                text = data_bytes.decode("utf-8", errors="replace")
                def json(self): return resp_data

            resp = SimpleResponse()

            if resp.status_code == 401:
                sync_meta["errors"].append("Invalid API key")
                sync_meta["api_status"] = "auth_error"
                return None, sync_meta
            elif resp.status_code == 429:
                sync_meta["errors"].append("Rate limited")
                sync_meta["api_status"] = "rate_limited"
                return None, sync_meta
            elif resp.status_code != 200:
                sync_meta["errors"].append(f"API returned HTTP {resp.status_code}")
                sync_meta["api_status"] = "http_error"
                return None, sync_meta

            data = resp.json()
            records = data.get("records", data.get("data", []))

            if not records:
                sync_meta["errors"].append("Empty response from API")
                sync_meta["api_status"] = "empty"
                return None, sync_meta

            # Filter for Maharashtra + target crop
            filtered = [
                r for r in records
                if (r.get("state", "").lower() in ["maharashtra", "mh"]
                    and r.get("commodity", "").lower() == commodity.lower())
            ]

            if not filtered:
                filtered = records[:50]  # Use first 50 if no Maharashtra filter matches

            sync_meta["records_fetched"] = len(filtered)

            # Normalize and store
            inserted, updated, skipped, rejected = _store_records(
                db, filtered, crop_name, market_id
            )
            sync_meta["records_inserted"] = inserted
            sync_meta["records_updated"] = updated
            sync_meta["records_skipped"] = skipped
            sync_meta["records_rejected"] = rejected
            sync_meta["api_status"] = "success"

            # Return latest record
            if filtered:
                latest = filtered[0]
                from datetime import datetime as dt
                date_str = latest.get("arrival_date", latest.get("date", ""))
                try:
                    if "/" in str(date_str):
                        data_as_of = dt.strptime(str(date_str), "%d/%m/%Y")
                    else:
                        data_as_of = dt.strptime(str(date_str), "%Y-%m-%d") if date_str else datetime.utcnow()
                except (ValueError, TypeError):
                    data_as_of = datetime.utcnow()
                    date_str = data_as_of.strftime("%Y-%m-%d")

                price_data = {
                    "min_price": float(latest.get("min_price", 0)),
                    "max_price": float(latest.get("max_price", 0)),
                    "modal_price": float(latest.get("modal_price", latest.get("price", 0))),
                    "arrivals_qty": float(latest.get("arrivals", latest.get("arrival_quantity", 0))),
                    "date": date_str,
                    "market_name": latest.get("market", latest.get("market_name", "")),
                    "source_name": "data.gov.in / AGMARKNET",
                    "source_type": "live",
                    "fetched_at": datetime.utcnow().isoformat(),
                    "freshness_status": "fresh",
                }
                sync_meta["data_as_of"] = date_str
                return price_data, sync_meta

    except (TimeoutError, OSError) as e:
        sync_meta["errors"].append(f"Timeout or network error: {str(e)[:100]}")
        sync_meta["api_status"] = "timeout"
        return None, sync_meta
        return None, sync_meta
    except Exception as e:
        sync_meta["errors"].append(f"API error: {str(e)[:100]}")
        sync_meta["api_status"] = "error"
        return None, sync_meta

    return None, sync_meta


def _store_records(
    db: Session,
    api_records: List[Dict],
    crop_name: str,
    market_id: Optional[int] = None,
) -> Tuple[int, int, int, int]:
    """
    Normalize and store API records in market_prices table.
    Returns (inserted, updated, skipped, rejected) counts.
    """
    crop = db.query(Crop).filter(Crop.name.ilike(crop_name)).first()
    if not crop:
        return 0, 0, 0, len(api_records)

    inserted = updated = skipped = rejected = 0
    now = datetime.utcnow()

    for record in api_records:
        try:
            # Parse date
            date_str = record.get("arrival_date", record.get("date", ""))
            if not date_str:
                rejected += 1
                continue

            try:
                # API returns DD/MM/YYYY format
                if "/" in date_str:
                    arrival_date = datetime.strptime(date_str, "%d/%m/%Y")
                else:
                    arrival_date = datetime.strptime(date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                rejected += 1
                continue

            # Parse prices
            try:
                min_p = float(record.get("min_price", 0))
                max_p = float(record.get("max_price", 0))
                modal_p = float(record.get("modal_price", record.get("price", 0)))
            except (ValueError, TypeError):
                rejected += 1
                continue

            if modal_p <= 0 or min_p < 0:
                rejected += 1
                continue

            arrivals = float(record.get("arrivals", record.get("arrival_quantity", 0)))
            market_name = record.get("market", record.get("market_name", ""))
            variety = record.get("variety", "")
            grade = record.get("grade", "")

            # Find or assign market
            if not market_id:
                existing_market = db.query(Market).filter(Market.name == market_name).first()
                if existing_market:
                    market_id = existing_market.id

            if not market_id:
                # Use first available market
                first_market = db.query(Market).first()
                market_id = first_market.id if first_market else 1

            # Check for duplicate (same crop + market + date)
            existing = db.query(MarketPrice).filter(
                MarketPrice.crop_id == crop.id,
                MarketPrice.market_id == market_id,
                MarketPrice.date == arrival_date,
            ).first()

            if existing:
                # Update existing record
                existing.min_price = min_p
                existing.max_price = max_p
                existing.modal_price = modal_p
                existing.arrivals_qty = arrivals
                existing.source_type = "live"
                existing.source_name = "data.gov.in / AGMARKNET"
                existing.fetched_at = now
                existing.data_as_of = arrival_date
                updated += 1
            else:
                # Insert new record
                mp = MarketPrice(
                    market_id=market_id,
                    crop_id=crop.id,
                    date=arrival_date,
                    arrival_date=arrival_date,
                    min_price=min_p,
                    max_price=max_p,
                    modal_price=modal_p,
                    arrivals_qty=arrivals,
                    source_type="live",
                    source_name="data.gov.in / AGMARKNET",
                    fetched_at=now,
                    data_as_of=arrival_date,
                    is_demo=False,
                    market_name=market_name,
                    commodity=crop.name,
                    variety=variety,
                    grade=grade,
                    state="Maharashtra",
                )
                db.add(mp)
                inserted += 1

            # Reset market_id for next iteration
            if not market_id:
                market_id = None

        except Exception:
            rejected += 1
            continue

    try:
        db.commit()
    except Exception:
        db.rollback()
        inserted = updated = 0

    return inserted, updated, skipped, rejected


def sync_mandi_data(
    db: Session,
    crop_name: str = "all",
    force: bool = False,
) -> Dict:
    """
    Main sync entry point. Checks cache, fetches if needed, stores results.

    Args:
        db: database session
        crop_name: specific crop or "all"
        force: bypass cache and force API call

    Returns:
        sync_result dict with status, records, and source info
    """
    crops_to_sync = (
        list(SUPPORTED_CROPS) if crop_name.lower() == "all"
        else [crop_name.lower()]
    )

    results = {}
    overall_status = "success"

    for crop in crops_to_sync:
        crop_obj = db.query(Crop).filter(Crop.name.ilike(crop)).first()
        if not crop_obj:
            results[crop] = {"status": "crop_not_found"}
            continue

        # Check cache first (unless forced)
        if not force:
            cached = get_cached_data(db, crop_obj.id)
            if cached:
                results[crop] = {
                    "status": "cached",
                    "source_type": "cached",
                    "data": cached,
                }
                continue

        # Fetch from API
        price_data, sync_meta = fetch_from_api(db, crop)

        if price_data:
            results[crop] = {
                "status": "live",
                "source_type": "live",
                "data": price_data,
                "sync": sync_meta,
            }
        else:
            # API failed — check for older cached data
            stale_cutoff = datetime.utcnow() - timedelta(days=30)
            stale = db.query(MarketPrice).filter(
                MarketPrice.crop_id == crop_obj.id,
            ).order_by(desc(MarketPrice.date)).first()

            if stale and stale.modal_price:
                results[crop] = {
                    "status": "cached_stale",
                    "source_type": "cached",
                    "data": {
                        "min_price": stale.min_price,
                        "max_price": stale.max_price,
                        "modal_price": stale.modal_price,
                        "arrivals_qty": stale.arrivals_qty,
                        "date": stale.date.strftime("%Y-%m-%d") if stale.date else "",
                        "source_name": stale.source_name or "cached",
                        "source_type": "cached",
                        "freshness_status": "stale",
                    },
                    "sync": sync_meta,
                    "warning": "Live API unavailable, using cached data",
                }
                overall_status = "partial"
            else:
                results[crop] = {
                    "status": "no_data",
                    "source_type": "none",
                    "sync": sync_meta,
                    "warning": "No live or cached data available",
                }
                overall_status = "partial"

    return {
        "overall_status": overall_status,
        "crops": results,
        "api_key_configured": _check_api_key(),
        "market_data_mode": MARKET_DATA_MODE,
        "timestamp": datetime.utcnow().isoformat(),
    }


def get_sync_status(db: Session) -> Dict:
    """Get current data sync status for all crops."""
    status = {}
    for crop_name in SUPPORTED_CROPS:
        crop_obj = db.query(Crop).filter(Crop.name.ilike(crop_name)).first()
        if not crop_obj:
            status[crop_name] = {"available": False}
            continue

        latest = db.query(MarketPrice).filter(
            MarketPrice.crop_id == crop_obj.id,
        ).order_by(desc(MarketPrice.date)).first()

        if latest:
            days_old = (datetime.utcnow() - (latest.date or datetime.utcnow())).days if latest.date else 999
            status[crop_name] = {
                "available": True,
                "latest_date": latest.date.strftime("%Y-%m-%d") if latest.date else "unknown",
                "source_type": latest.source_type or "unknown",
                "source_name": latest.source_name or "unknown",
                "days_old": days_old,
                "freshness": "fresh" if days_old <= 3 else "recent" if days_old <= 14 else "stale",
            }
        else:
            status[crop_name] = {"available": False}

    return {
        "api_key_configured": _check_api_key(),
        "market_data_mode": MARKET_DATA_MODE,
        "cache_hours": MARKET_DATA_CACHE_HOURS,
        "crops": status,
    }
