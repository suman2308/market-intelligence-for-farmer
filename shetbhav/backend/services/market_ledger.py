"""
Local Market Data Ledger — durable file copy of every real mandi price record.

Why this exists
---------------
Render's free-tier database is ephemeral: when the service restarts or the
database is recycled, every `market_prices` row vanishes. Re-fetching from
data.gov.in burns the API key's daily quota and only ever returns the most
recent pages, so history silently shrinks over time.

The ledger fixes this with a single append-only JSONL file
(`data/local_market_ledger.jsonl`, committed to git):

  1. Every real record fetched from the AGMARKNET API (or imported from CSV)
     is appended here exactly once — keyed by (crop, market, arrival_date),
     so re-fetches and re-imports never duplicate anything.
  2. On every startup the ledger is replayed into the database. After a
     database wipe the platform comes back with all previously accumulated
     real records instead of an empty shell.

Design rules (kept deliberately simple):
  - The ledger never blocks a request: every failure is swallowed and logged.
  - Only REAL sources (live / historical_dataset) are stored. Synthetic demo
    rows never enter the ledger.
  - The file is human-readable JSON lines, one record per line, easy to
    inspect, extend, or re-seed by hand.
"""
import json
import os
from datetime import datetime
from typing import Dict, Iterable, List, Optional

# Sources eligible for the ledger — anything else (synthetic demo rows) is
# deliberately excluded.
LEDGER_SOURCE_TYPES = {"live", "historical_dataset"}

LEDGER_FILENAME = "local_market_ledger.jsonl"


def ledger_path() -> str:
    """Resolve the ledger file path (env-overridable for tests/deploys).

    Reads the environment on every call so tests and tooling can redirect
    the ledger without reloading modules.
    """
    env_path = os.getenv("MARKET_DATA_LEDGER_PATH", "").strip()
    if env_path:
        return env_path
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    return os.path.join(base, LEDGER_FILENAME)


def dedupe_key(record: Dict) -> tuple:
    """Identity of a price record: one commodity in one mandi on one day."""
    return (
        (record.get("commodity") or "").strip().lower(),
        (record.get("market") or "").strip().lower(),
        (record.get("arrival_date") or "")[:10],
    )


def normalize_record(record: Dict) -> Optional[Dict]:
    """Normalize an AGMARKNET-style record to the ledger's flat shape.

    Returns None when the record is unusable (no date, no positive modal
    price) so malformed rows never reach the file.
    """
    date_raw = record.get("arrival_date") or record.get("date") or ""
    arrival_date = _parse_date(date_raw)
    if not arrival_date:
        return None
    try:
        modal = float(record.get("modal_price") or 0)
        min_p = float(record.get("min_price") or 0)
        max_p = float(record.get("max_price") or 0)
    except (TypeError, ValueError):
        return None
    if modal <= 0:
        return None
    try:
        qty = float(record.get("arrivals", record.get("arrival_quantity")) or 0)
    except (TypeError, ValueError):
        qty = 0
    return {
        "state": (record.get("state") or "Maharashtra").strip(),
        "district": (record.get("district") or "").strip(),
        "market": (record.get("market") or record.get("market_name") or "").strip(),
        "commodity": (record.get("commodity") or record.get("crop") or "").strip(),
        "variety": (record.get("variety") or "").strip(),
        "grade": (record.get("grade") or "").strip(),
        "arrival_date": arrival_date,
        "min_price": min_p,
        "max_price": max_p,
        "modal_price": modal,
        "arrival_quantity": qty or None,
        "fetched_at": record.get("fetched_at") or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }


def _parse_date(value) -> Optional[str]:
    """Parse DD/MM/YYYY or YYYY-MM-DD into an ISO date string."""
    s = str(value or "").strip()
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def read_ledger() -> List[Dict]:
    """Read every valid record from the ledger file (oldest line first)."""
    path = ledger_path()
    if not os.path.exists(path):
        return []
    records: List[Dict] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    if isinstance(rec, dict) and dedupe_key(rec)[2]:
                        records.append(rec)
                except json.JSONDecodeError:
                    continue  # skip a corrupted line, keep the rest
    except OSError as e:
        print(f"[ledger] Could not read {path}: {e}")
    return records


def ledger_keys() -> set:
    """Set of dedupe keys already present in the ledger file."""
    return {dedupe_key(r) for r in read_ledger()}


def append_records(records: Iterable[Dict]) -> int:
    """Append records that are not yet in the ledger. Returns count appended.

    Never raises: a ledger problem must never break the API call or import
    that produced the records.
    """
    try:
        path = ledger_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        existing = ledger_keys()
        added = 0
        with open(path, "a", encoding="utf-8") as f:
            for raw in records:
                if not raw:
                    continue
                rec = normalize_record(raw)
                if not rec:
                    continue
                key = dedupe_key(rec)
                if key in existing:
                    continue
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                existing.add(key)
                added += 1
        if added:
            print(f"[ledger] Appended {added} new record(s) to {os.path.basename(path)}")
        return added
    except Exception as e:
        print(f"[ledger] Append failed (ignored): {e}")
        return 0


def append_real_records(api_records: Iterable[Dict], source_type: str = "live") -> int:
    """Append API records but only if they carry a real source type."""
    if source_type not in LEDGER_SOURCE_TYPES:
        return 0
    return append_records(api_records)


def restore_to_db(db) -> int:
    """Replay the ledger into market_prices. Idempotent; returns rows written.

    Rows are written as source_type='historical_dataset' — the same real,
    clearly-labelled category the CSV import produces. Existing rows (same
    crop/market/day) are refreshed rather than duplicated.
    """
    from models.database import MarketPrice, Market, Crop

    records = read_ledger()
    if not records:
        return 0

    # Wrap everything in a transaction so a mid-restore failure cannot leave
    # the database half-filled. Per-row savepoints keep one bad record from
    # aborting the rest.
    written = 0
    try:
        crops = {c.name.lower(): c for c in db.query(Crop).all()}
        markets = {m.name.strip().lower(): m for m in db.query(Market).all()}
        used_codes = {m.code for m in markets.values() if m.code}

        for rec in records:
            try:
                with db.begin_nested():
                    written += _restore_one(db, rec, crops, markets, used_codes)
            except Exception as e:
                print(f"[ledger] Skipped one record ({rec.get('commodity')} @ "
                      f"{rec.get('market')} {rec.get('arrival_date')}): {e}")
                continue
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[ledger] Restore failed (ignored): {e}")
        return 0
    return written


def _restore_one(db, rec: Dict, crops: Dict, markets: Dict, used_codes: set) -> int:
    """Write one ledger record. Runs inside a per-row savepoint."""
    from models.database import MarketPrice, Market, Crop

    commodity = rec["commodity"]
    crop = crops.get(commodity.lower())
    if crop is None:
        # A commodity we have not seen before — register it so the price
        # history survives even for crops beyond the original three.
        display_name = commodity.title() if commodity.islower() else commodity
        crop = Crop(name=display_name, category="other", unit="kg")
        db.add(crop)
        db.flush()
        crops[crop.name.lower()] = crop

    market = markets.get(rec["market"].lower())
    if market is None:
        code = _next_market_code(rec["market"], used_codes)
        market = Market(
            name=rec["market"], code=code,
            district=rec.get("district") or "", state=rec.get("state") or "Maharashtra",
            market_type="APMC",
        )
        db.add(market)
        db.flush()
        markets[market.name.strip().lower()] = market

    arrival = datetime.strptime(rec["arrival_date"], "%Y-%m-%d")
    fetched = None
    try:
        fetched = datetime.strptime(rec.get("fetched_at", "")[:19], "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        pass
    fetched = fetched or datetime.utcnow()

    existing = db.query(MarketPrice).filter(
        MarketPrice.crop_id == crop.id,
        MarketPrice.market_id == market.id,
        MarketPrice.date == arrival,
    ).first()

    if existing:
        existing.min_price = rec["min_price"]
        existing.max_price = rec["max_price"]
        existing.modal_price = rec["modal_price"]
        existing.arrival_quantity = rec.get("arrival_quantity")
        existing.source_type = "historical_dataset"
        existing.source_name = "AGMARKNET (local ledger)"
        existing.fetched_at = fetched
        existing.data_as_of = arrival
        existing.imported_at = datetime.utcnow()
    else:
        db.add(MarketPrice(
            market_id=market.id, crop_id=crop.id,
            state=rec.get("state") or "Maharashtra",
            district=rec.get("district") or "",
            market_name=market.name, commodity=crop.name,
            variety=rec.get("variety") or "", grade=rec.get("grade") or "",
            arrival_date=arrival, min_price=rec["min_price"],
            max_price=rec["max_price"], modal_price=rec["modal_price"],
            price_unit="Rs/quintal", arrival_quantity=rec.get("arrival_quantity"),
            source_name="AGMARKNET (local ledger)",
            source_url="https://data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
            source_type="historical_dataset", fetched_at=fetched,
            data_as_of=arrival, is_demo=False,
            date=arrival, arrivals_qty=rec.get("arrival_quantity"),
            source="agmarknet",
        ))
    return 1


def _next_market_code(name: str, used_codes: set) -> str:
    """Generate a unique market code from the name.

    markets.code has a UNIQUE constraint, so two similar names truncated to
    the same 10 characters would collide and abort the whole restore. Strip
    non-alphanumerics and add a numeric suffix when needed.
    """
    base = "MH_" + "".join(ch for ch in name.upper() if ch.isalnum())[:10]
    code, n = base, 2
    while code in used_codes:
        suffix = f"{n:02d}"
        code = base[: 18 - len(suffix)] + suffix
        n += 1
    used_codes.add(code)
    return code


def sync_db_to_ledger(db) -> int:
    """Copy real DB rows into the ledger (e.g. after a manual CSV import).

    Keeps the file and the database in lock-step in the cheap direction:
    DB → file. Returns how many rows were appended.
    """
    from models.database import MarketPrice

    try:
        rows = (
            db.query(MarketPrice)
            .filter(MarketPrice.source_type.in_(LEDGER_SOURCE_TYPES))
            .order_by(MarketPrice.date.asc())
            .all()
        )
    except Exception as e:
        print(f"[ledger] DB read failed (ignored): {e}")
        return 0

    def _iso(dt):
        return dt.strftime("%Y-%m-%d") if dt else ""

    payloads = [
        {
            "state": r.state or "Maharashtra",
            "district": r.district or "",
            "market": r.market_name or "",
            "commodity": r.commodity or "",
            "variety": r.variety or "",
            "grade": r.grade or "",
            "arrival_date": _iso(r.arrival_date or r.date),
            "min_price": r.min_price or 0,
            "max_price": r.max_price or 0,
            "modal_price": r.modal_price or 0,
            "arrival_quantity": r.arrival_quantity or r.arrivals_qty,
            "fetched_at": r.fetched_at.strftime("%Y-%m-%dT%H:%M:%S") if r.fetched_at
                          else (r.imported_at.strftime("%Y-%m-%dT%H:%M:%S") if r.imported_at else None),
        }
        for r in rows if (r.arrival_date or r.date) and r.commodity
    ]
    return append_records(payloads)


def ledger_stats() -> Dict:
    """Small summary for the admin /sync/status endpoint."""
    records = read_ledger()
    dates = sorted({r["arrival_date"] for r in records}) if records else []
    return {
        "file": os.path.basename(ledger_path()),
        "records": len(records),
        "crops": sorted({r["commodity"] for r in records}) if records else [],
        "date_range": {"from": dates[0] if dates else None, "to": dates[-1] if dates else None},
    }
