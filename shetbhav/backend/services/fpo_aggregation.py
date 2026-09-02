"""
FPO Aggregation Service — §22
Aggregates individual farmer lots into buyer-ready lots.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from models.database import (
    ProduceLot, LotItem, FPOProfile, FPOMembership,
    Crop, QualityGrade, BuyerProfile
)


def aggregate_lots(
    db: Session,
    fpo_id: int,
    lot_ids: List[int],
    target_quantity_kg: float,
) -> dict:
    """
    §22: Aggregate individual farmer lots into one buyer-ready lot.
    Preserves farmer identity, quantity, quality, expected payout.
    """
    fpo = db.query(FPOProfile).filter(FPOProfile.id == fpo_id).first()
    if not fpo:
        return {"error": "FPO not found"}

    farmer_lots = (
        db.query(ProduceLot)
        .filter(ProduceLot.id.in_(lot_ids), ProduceLot.status == "active")
        .all()
    )

    if not farmer_lots:
        return {"error": "No active lots found"}

    total_qty = sum(l.quantity_kg for l in farmer_lots)
    if total_qty < target_quantity_kg:
        return {
            "error": f"Insufficient quantity: {total_qty}kg available, {target_quantity_kg}kg needed",
            "available_kg": total_qty,
            "needed_kg": target_quantity_kg,
        }

    # Determine dominant quality grade
    grade_counts = {}
    for lot in farmer_lots:
        g = lot.quality_grade.value if lot.quality_grade else "unrated"
        grade_counts[g] = grade_counts.get(g, 0) + lot.quantity_kg
    dominant_grade = max(grade_counts, key=grade_counts.get)

    # Create aggregated lot
    agg_lot = ProduceLot(
        farmer_id=farmer_lots[0].farmer_id,  # FPO primary contact
        fpo_id=fpo_id,
        crop_id=farmer_lots[0].crop_id,
        quantity_kg=min(total_qty, target_quantity_kg),
        quality_grade=QualityGrade(dominant_grade),
        location_lat=fpo.location_lat,
        location_lng=fpo.location_lng,
        address=f"{fpo.name}, {fpo.district}",
        is_aggregated=True,
        status="active",
    )
    db.add(agg_lot)
    db.flush()

    # Track contributions
    remaining = target_quantity_kg
    contributions = []
    for lot in farmer_lots:
        if remaining <= 0:
            break
        contrib_qty = min(lot.quantity_kg, remaining)
        item = LotItem(
            aggregated_lot_id=agg_lot.id,
            farmer_lot_id=lot.id,
            quantity_kg=contrib_qty,
            quality_grade=lot.quality_grade,
        )
        db.add(item)
        remaining -= contrib_qty
        contributions.append({
            "farmer_lot_id": lot.id,
            "farmer_id": lot.farmer_id,
            "quantity_kg": contrib_qty,
            "quality": lot.quality_grade.value if lot.quality_grade else "unrated",
        })

    db.commit()
    db.refresh(agg_lot)

    return {
        "aggregated_lot_id": agg_lot.id,
        "total_quantity_kg": agg_lot.quantity_kg,
        "crop": db.query(Crop).filter(Crop.id == agg_lot.crop_id).first().name if agg_lot.crop_id else None,
        "quality_grade": dominant_grade,
        "contributions": contributions,
        "farmer_count": len(contributions),
    }


def find_suitable_lots_for_demand(
    db: Session,
    demand_id: int,
) -> List[dict]:
    """Find individual lots and aggregated lots that match a demand request."""
    from models.database import DemandRequest

    demand = db.query(DemandRequest).filter(DemandRequest.id == demand_id).first()
    if not demand:
        return []

    # Find matching individual lots
    lots = (
        db.query(ProduceLot)
        .filter(
            ProduceLot.crop_id == demand.crop_id,
            ProduceLot.status == "active",
            ProduceLot.quantity_kg >= demand.quantity_kg * 0.5,
        )
        .all()
    )

    results = []
    for lot in lots:
        score = 60
        if demand.quality_grade and lot.quality_grade == demand.quality_grade:
            score += 15
        if lot.quantity_kg >= demand.quantity_kg:
            score += 10
        crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
        results.append({
            "lot_id": lot.id,
            "crop": crop.name if crop else "Unknown",
            "quantity_kg": lot.quantity_kg,
            "quality": lot.quality_grade.value if lot.quality_grade else "unrated",
            "is_aggregated": lot.is_aggregated,
            "score": min(100, score),
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results
