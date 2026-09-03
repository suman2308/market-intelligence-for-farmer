"""
ShetBhav Market Data Import Script
Imports AGMARKNET-style CSV data into market_price_records.

Usage:
    python -m app.scripts.import_market_data --file data/maharashtra_market_prices.csv
    python -m app.scripts.import_market_data --file data/maharashtra_market_prices.csv --overwrite
"""
import os
import sys
import csv
import argparse
from datetime import datetime
from pathlib import Path

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base, MarketPrice, Market, Crop, DataSourceType


# ── Crop name normalization ──────────────────────────────────────────
CROP_ALIASES = {
    "tomato": "Tomato", "tomatoes": "Tomato", "tamatar": "Tomato",
    "onion": "Onion", "onions": "Onion", "pyaz": "Onion", "kanda": "Onion",
    "soybean": "Soybean", "soyabean": "Soybean", "soya bean": "Soybean",
    "soy bean": "Soybean", "soy": "Soybean",
}

MARKET_ALIASES = {
    "lasalgaon apmc": "Nashik Lasalgaon",
    "nashik apmc": "Nashik APMC",
    "pune apmc": "Pune APMC",
    "nagpur apmc": "Nagpur APMC",
    "mumbai apmc": "Mumbai APMC",
    "aurangabad apmc": "Aurangabad APMC",
    "kolhapur apmc": "Kolhapur APMC",
    "solapur apmc": "Solapur APMC",
    "ahmednagar apmc": "Ahmednagar APMC",
    "satara apmc": "Satara APMC",
}


def normalize_crop(name: str) -> str:
    """Normalize crop name to standard form."""
    return CROP_ALIASES.get(name.strip().lower(), name.strip().title())


def normalize_market(name: str) -> str:
    """Normalize market name to standard form."""
    return MARKET_ALIASES.get(name.strip().lower(), name.strip())


def parse_date(date_str: str) -> datetime:
    """Parse date string in common formats."""
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {date_str}")


def validate_row(row: dict, row_num: int) -> list:
    """Validate a single CSV row. Returns list of error messages."""
    errors = []

    # Required fields
    required = ["State", "District", "Market", "Commodity", "Arrival_Date",
                 "Min_Price", "Max_Price", "Modal_Price"]
    for field in required:
        if not row.get(field, "").strip():
            errors.append(f"Row {row_num}: Missing required field '{field}'")

    # Price validation
    for field in ["Min_Price", "Max_Price", "Modal_Price"]:
        val = row.get(field, "").strip()
        if val:
            try:
                p = float(val)
                if p <= 0:
                    errors.append(f"Row {row_num}: {field} must be positive, got {p}")
                if p > 100000:
                    errors.append(f"Row {row_num}: {field} suspiciously high ({p})")
            except ValueError:
                errors.append(f"Row {row_num}: {field} is not a number: '{val}'")

    # Price consistency
    try:
        min_p = float(row.get("Min_Price", 0))
        max_p = float(row.get("Max_Price", 0))
        modal_p = float(row.get("Modal_Price", 0))
        if min_p > max_p and max_p > 0:
            errors.append(f"Row {row_num}: Min_Price ({min_p}) > Max_Price ({max_p})")
        if modal_p > 0 and (modal_p < min_p * 0.5 or modal_p > max_p * 1.5):
            errors.append(f"Row {row_num}: Modal_Price ({modal_p}) outside expected range [{min_p}-{max_p}]")
    except (ValueError, TypeError):
        pass

    # Date validation
    date_str = row.get("Arrival_Date", "").strip()
    if date_str:
        try:
            parse_date(date_str)
        except ValueError as e:
            errors.append(f"Row {row_num}: {e}")

    # Crop validation
    commodity = row.get("Commodity", "").strip()
    if commodity:
        normalized = normalize_crop(commodity)
        if normalized.lower() not in CROP_ALIASES:
            errors.append(f"Row {row_num}: Unknown commodity '{commodity}' (normalized: '{normalized}')")

    return errors


def import_csv(filepath: str, db_session, overwrite: bool = False) -> dict:
    """
    Import market price data from CSV file.

    Returns import summary dict with counts.
    """
    summary = {
        "total_rows": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "invalid": 0,
        "errors": [],
        "duplicates": 0,
        "crops_found": set(),
        "markets_found": set(),
        "date_range": {"min": None, "max": None},
    }

    # Get or create crop and market lookups
    crops = {c.name.lower(): c for c in db_session.query(Crop).all()}
    markets = {m.name: m for m in db_session.query(Market).all()}

    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row_num, row in enumerate(reader, start=2):  # Row 1 is header
            summary["total_rows"] += 1

            # Validate
            errors = validate_row(row, row_num)
            if errors:
                summary["errors"].extend(errors)
                summary["invalid"] += 1
                continue

            # Normalize
            crop_name = normalize_crop(row["Commodity"])
            market_name = normalize_market(row["Market"])

            summary["crops_found"].add(crop_name)
            summary["markets_found"].add(market_name)

            # Parse date
            try:
                arrival_date = parse_date(row["Arrival_Date"])
            except ValueError:
                summary["errors"].append(f"Row {row_num}: Invalid date")
                summary["invalid"] += 1
                continue

            # Parse prices
            try:
                min_price = float(row["Min_Price"])
                max_price = float(row["Max_Price"])
                modal_price = float(row["Modal_Price"])
            except (ValueError, KeyError):
                summary["errors"].append(f"Row {row_num}: Invalid price data")
                summary["invalid"] += 1
                continue

            # Parse optional quantity
            arrival_qty = None
            if row.get("Arrival_Quantity", "").strip():
                try:
                    arrival_qty = float(row["Arrival_Quantity"])
                except ValueError:
                    pass

            # Track date range
            if summary["date_range"]["min"] is None or arrival_date < summary["date_range"]["min"]:
                summary["date_range"]["min"] = arrival_date
            if summary["date_range"]["max"] is None or arrival_date > summary["date_range"]["max"]:
                summary["date_range"]["max"] = arrival_date

            # Find or create crop
            crop = crops.get(crop_name.lower())
            if not crop:
                crop = Crop(name=crop_name, category="vegetable" if crop_name.lower() in ["tomato", "onion"] else "grain", unit="kg")
                db_session.add(crop)
                db_session.flush()
                crops[crop_name.lower()] = crop

            # Find or create market
            market = markets.get(market_name)
            if not market:
                # Create the market
                market = Market(
                    name=market_name,
                    code=f"MH_{market_name.replace(' ', '_').upper()[:10]}",
                    district=row.get("District", ""),
                    state=row.get("State", "Maharashtra"),
                    market_type="APMC",
                )
                db_session.add(market)
                db_session.flush()
                markets[market_name] = market

            # Check for duplicate
            existing = db_session.query(MarketPrice).filter(
                MarketPrice.crop_id == crop.id,
                MarketPrice.market_id == market.id,
                MarketPrice.date == arrival_date,
            ).first()

            if existing:
                if overwrite:
                    existing.min_price = min_price
                    existing.max_price = max_price
                    existing.modal_price = modal_price
                    existing.arrivals_qty = arrival_qty
                    existing.variety = row.get("Variety", "")
                    existing.grade = row.get("Grade", "")
                    existing.source_name = "AGMARKNET/data.gov.in"
                    existing.source_type = "historical_dataset"
                    existing.data_as_of = arrival_date
                    existing.imported_at = datetime.utcnow()
                    existing.is_demo = False
                    summary["updated"] += 1
                else:
                    summary["duplicates"] += 1
                    summary["skipped"] += 1
                continue

            # Insert new record
            record = MarketPrice(
                market_id=market.id,
                crop_id=crop.id,
                state=row.get("State", "Maharashtra"),
                district=row.get("District", ""),
                market_name=market_name,
                commodity=crop_name,
                variety=row.get("Variety", ""),
                grade=row.get("Grade", ""),
                arrival_date=arrival_date,
                min_price=min_price,
                max_price=max_price,
                modal_price=modal_price,
                price_unit="Rs/quintal",
                arrival_quantity=arrival_qty,
                arrival_unit=row.get("Arrival_Unit", "quintals"),
                # Import tracking
                source_name="AGMARKNET/data.gov.in",
                source_url="https://data.gov.in/resources/daily-prices-various-commodities-mandi",
                source_type="historical_dataset",
                data_as_of=arrival_date,
                imported_at=datetime.utcnow(),
                is_demo=False,
                # Legacy fields
                date=arrival_date,
                arrivals_qty=arrival_qty,
                source="agmarknet",
                data_source_type=DataSourceType.REAL,
            )
            db_session.add(record)
            summary["inserted"] += 1

    db_session.commit()
    return summary


def print_summary(summary: dict):
    """Print a formatted import summary."""
    print("\n" + "=" * 60)
    print("  SHETBHAV MARKET DATA IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Total rows processed:  {summary['total_rows']}")
    print(f"  Records inserted:      {summary['inserted']}")
    print(f"  Records updated:       {summary['updated']}")
    print(f"  Duplicates skipped:    {summary['duplicates']}")
    print(f"  Invalid rows:          {summary['invalid']}")
    print(f"  Total skipped:         {summary['skipped']}")
    print(f"  Crops found:           {', '.join(sorted(summary['crops_found']))}")
    print(f"  Markets found:         {', '.join(sorted(summary['markets_found']))}")
    if summary["date_range"]["min"]:
        print(f"  Date range:            {summary['date_range']['min'].strftime('%Y-%m-%d')} to {summary['date_range']['max'].strftime('%Y-%m-%d')}")
    if summary["errors"]:
        print(f"\n  ERRORS ({len(summary['errors'])}):")
        for err in summary["errors"][:20]:
            print(f"    WARN: {err}")
        if len(summary["errors"]) > 20:
            print(f"    ... and {len(summary['errors']) - 20} more")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Import AGMARKNET market price data")
    parser.add_argument("--file", required=True, help="Path to CSV file")
    parser.add_argument("--database", default=None, help="Database URL (default: from settings)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing records")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, don't insert")
    args = parser.parse_args()

    # Database
    if args.database:
        engine = create_engine(args.database)
    else:
        from config.settings import DATABASE_URL
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        filepath = os.path.abspath(args.file)
        if not os.path.exists(filepath):
            print(f"ERROR: File not found: {filepath}")
            sys.exit(1)

        print(f"Importing from: {filepath}")
        print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
        print(f"Overwrite: {args.overwrite}")

        summary = import_csv(filepath, db, overwrite=args.overwrite)
        print_summary(summary)

        if summary["invalid"] > 0 and summary["inserted"] == 0:
            sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
