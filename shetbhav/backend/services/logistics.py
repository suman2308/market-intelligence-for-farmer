"""
Logistics Service — §30, §31
Transport estimation, route calculation, storage matching.
Uses Haversine for distance, documented estimation for costs.
"""
import math
from typing import Optional, List
from sqlalchemy.orm import Session
from models.database import (
    StorageFacility, TransportProvider, ProduceLot, Crop
)

# Maharashtra major city coordinates for distance estimation
MAJOR_CITIES = {
    "nashik": (20.0057, 73.7229),
    "pune": (18.5204, 73.8567),
    "mumbai": (19.0760, 72.8777),
    "nagpur": (21.1458, 79.0882),
    "aurangabad": (19.8762, 75.3433),
    "kolhapur": (16.7050, 74.2433),
    "solapur": (17.6599, 75.9064),
}


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in km using Haversine formula."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def estimate_transport_cost(distance_km: float, quantity_kg: float) -> dict:
    """
    §30: Estimate transport cost.
    Labelled as "Estimated" — not a live quote.
    """
    # Cost model: base + per-km + weight factor
    base_cost = 50  # Rs base
    per_km_cost = 2.0  # Rs per km per quintal
    quantity_q = quantity_kg / 100

    total = base_cost + (distance_km * per_km_cost * quantity_q)
    estimated_duration_min = (distance_km / 40) * 60  # Assume 40 km/h average

    return {
        "distance_km": round(distance_km, 1),
        "estimated_duration_min": round(estimated_duration_min, 0),
        "estimated_cost": round(total, 0),
        "cost_per_q": round(total / quantity_q, 0) if quantity_q > 0 else 0,
        "label": "Estimated transport cost",
        "source": "Haversine distance + cost estimation model",
    }


def find_nearest_storage(
    db: Session,
    lat: float,
    lng: float,
    crop_name: str = "",
    max_results: int = 5,
) -> List[dict]:
    """§28: Find nearby storage facilities with capacity and cost info."""
    facilities = db.query(StorageFacility).filter(
        StorageFacility.is_active == True,
        StorageFacility.available_capacity_quintal > 0,
    ).all()

    results = []
    for f in facilities:
        if f.location_lat and f.location_lng:
            dist = haversine_distance(lat, lng, f.location_lat, f.location_lng)
        else:
            dist = 999

        # Filter by crop compatibility
        if crop_name and f.compatible_crops:
            if crop_name.lower() not in [c.lower() for c in f.compatible_crops]:
                continue

        results.append({
            "id": f.id,
            "name": f.name,
            "district": f.district,
            "distance_km": round(dist, 1),
            "capacity_q": f.capacity_quintal,
            "available_q": f.available_capacity_quintal,
            "cost_per_q_per_day": f.cost_per_quintal_per_day,
            "compatible_crops": f.compatible_crops,
        })

    results.sort(key=lambda r: r["distance_km"])
    return results[:max_results]


def estimate_storage_decision(
    current_price: float,
    future_price: float,
    quantity_kg: float,
    days_to_store: int,
    cost_per_q_per_day: float,
    spoilage_rate: float = 0.02,
) -> dict:
    """
    §29: Storage decision analysis.
    Calculate whether waiting is economically worthwhile.
    """
    qty_q = quantity_kg / 100
    storage_cost = cost_per_q_per_day * days_to_store * qty_q
    spoilage_loss = quantity_kg * spoilage_rate * days_to_store * 0.01 * 24  # Rs value

    current_revenue = current_price * qty_q
    future_revenue = future_price * qty_q
    net_future = future_revenue - storage_cost - spoilage_loss

    profit_diff = net_future - current_revenue

    return {
        "current_revenue": round(current_revenue, 0),
        "future_revenue": round(future_revenue, 0),
        "storage_cost": round(storage_cost, 0),
        "spoilage_loss": round(spoilage_loss, 0),
        "net_future_revenue": round(net_future, 0),
        "profit_difference": round(profit_diff, 0),
        "recommendation": "Store and sell later" if profit_diff > 100 else "Sell now is safer",
        "worth_storing": profit_diff > 100,
    }


def consolidate_routes(
    pickups: List[dict],
    delivery_lat: float,
    delivery_lng: float,
) -> dict:
    """
    §31: Route consolidation for multiple pickups going to same buyer.
    Compare consolidated vs separate routes.
    """
    if len(pickups) <= 1:
        return {"consolidated": False, "message": "Single pickup, no consolidation needed"}

    # Separate routes total
    separate_total = 0
    for p in pickups:
        dist = haversine_distance(p["lat"], p["lng"], delivery_lat, delivery_lng)
        separate_total += dist * 2  # round trip

    # Consolidated route (approximate: visit nearest first)
    sorted_pickups = sorted(pickups, key=lambda p: haversine_distance(
        p["lat"], p["lng"], delivery_lat, delivery_lng
    ))

    consolidated_total = 0
    prev_lat, prev_lng = delivery_lat, delivery_lng
    for p in sorted_pickups:
        dist = haversine_distance(prev_lat, prev_lng, p["lat"], p["lng"])
        consolidated_total += dist
        prev_lat, prev_lng = p["lat"], p["lng"]
    consolidated_total += haversine_distance(prev_lat, prev_lng, delivery_lat, delivery_lng)

    distance_saved = separate_total - consolidated_total
    cost_saved = distance_saved * 2  # Rs per km estimate

    return {
        "consolidated": True,
        "separate_distance_km": round(separate_total, 1),
        "consolidated_distance_km": round(consolidated_total, 1),
        "distance_saved_km": round(max(0, distance_saved), 1),
        "estimated_cost_saved": round(max(0, cost_saved), 0),
        "route_order": [p.get("name", f"Pickup {i+1}") for i, p in enumerate(sorted_pickups)],
    }
