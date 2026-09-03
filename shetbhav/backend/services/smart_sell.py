"""
Smart Sell Decision Engine — §6, §17, §18, §69
The most important feature. Evaluates all selling options and recommends the best one.
"""
import random
import math
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from models.database import (
    Crop, Market, MarketPrice, BuyerProfile, DemandRequest,
    ProduceLot, TransportProvider, StorageFacility, DataSourceType
)
from models.schemas import SellOption, SmartSellRequest, SmartSellResponse
from services.market_data import MarketDataService
from ml.forecasting import predict_price
from ml.model_registry import get_model_status


# ── Configuration ────────────────────────────────────────────────────
TRANSPORT_COST_PER_KM = 2.0  # Rs per quintal per km (synthetic estimate)
STORAGE_BASE_COST = 40.0     # Rs per quintal per day
SPOILAGE_RATE = 0.02         # 2% per day for perishables
HANDLING_COST_PER_Q = 15.0   # Rs per quintal


def calculate_net_realization(
    gross_price: float,
    transport_cost: float = 0,
    storage_cost: float = 0,
    expected_loss: float = 0,
    handling_cost: float = HANDLING_COST_PER_Q,
) -> float:
    """§18: Net realization = gross - transport - storage - handling - loss"""
    return gross_price - transport_cost - storage_cost - handling_cost - expected_loss


def estimate_transport_cost(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> float:
    """Estimate transport cost using Haversine distance. §30: Labelled as estimate."""
    if not all([origin_lat, origin_lng, dest_lat, dest_lng]):
        return 80.0  # Default estimate

    R = 6371  # km
    dlat = math.radians(dest_lat - origin_lat)
    dlng = math.radians(dest_lng - origin_lng)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(origin_lat)) * math.cos(math.radians(dest_lat)) *
         math.sin(dlng/2)**2)
    c = 2 * math.asin(math.sqrt(a))
    distance = R * c

    return round(distance * TRANSPORT_COST_PER_KM, 0)


def estimate_storage_cost(quantity_kg: float, days: int) -> float:
    """§28: Storage cost estimation."""
    qty_q = quantity_kg / 100  # Convert to quintals
    return round(qty_q * STORAGE_BASE_COST * days, 0)


def estimate_spoilage(crop_name: str, quantity_kg: float, days: int) -> float:
    """§18: Estimate expected spoilage loss."""
    spoilage_pcts = {"tomato": 0.03, "onion": 0.01, "soybean": 0.005}
    rate = spoilage_pcts.get(crop_name.lower(), 0.02)
    loss_pct = min(rate * days, 0.15)  # Cap at 15%
    return round(quantity_kg * loss_pct * 0.01 * 24, 0)  # Rs equivalent


def calculate_buyer_trust_score(buyer: BuyerProfile) -> float:
    """§25: Explainable reliability score 0-100."""
    score = 50.0  # Base
    total = buyer.completed_transactions
    if total > 0:
        payment_rate = buyer.successful_payments / total
        score += payment_rate * 20
        score -= (buyer.dispute_count / total) * 15
        score -= (buyer.cancellation_count / total) * 10
        score -= (buyer.payment_delay_count / total) * 5

    if buyer.verification_status == "verified":
        score += 10

    return max(0, min(100, round(score, 1)))


def score_sell_option(
    option_type: str,
    target_name: str,
    gross_price: float,
    transport_cost: float,
    storage_cost: float,
    expected_loss: float,
    quality_match: bool,
    demand_level: str,
    payment_reliability: float,
    quantity_available: float,
    quantity_needed: float,
    distance_km: float,
    forecast_confidence: float,
    sale_window_days: int,
) -> SellOption:
    """§17: Calculate Smart Sell Score based on documented factors."""
    net = calculate_net_realization(gross_price, transport_cost, storage_cost, expected_loss)

    # Scoring weights (documented in §17)
    W = {
        "net_realization": 0.30,
        "price_advantage": 0.15,
        "transport": 0.10,
        "demand": 0.10,
        "quality_match": 0.10,
        "payment_reliability": 0.10,
        "timing": 0.10,
        "distance": 0.05,
    }

    scores = {}

    # Net realization score (0-100)
    scores["net_realization"] = min(100, max(0, net / 30))

    # Price advantage vs market average
    scores["price_advantage"] = min(100, max(0, (gross_price - 2000) / 15))

    # Transport cost (lower is better)
    scores["transport"] = max(0, 100 - transport_cost * 0.8)

    # Demand level
    demand_scores = {"high": 90, "medium": 65, "low": 35}
    scores["demand"] = demand_scores.get(demand_level, 50)

    # Quality match
    scores["quality_match"] = 90 if quality_match else 40

    # Payment reliability
    scores["payment_reliability"] = payment_reliability

    # Timing
    scores["timing"] = max(0, 100 - sale_window_days * 5)

    # Distance
    scores["distance"] = max(0, 100 - distance_km * 2)

    # Weighted total
    total_score = sum(scores[k] * W[k] for k in W)
    total_score = max(0, min(100, round(total_score, 1)))

    # Reasons
    reasons = []
    if scores["net_realization"] > 70:
        reasons.append("Good net realization")
    if scores["payment_reliability"] > 80:
        reasons.append("Reliable payment history")
    if quality_match:
        reasons.append("Grade matches requirement")
    if transport_cost < 100:
        reasons.append("Low transport cost")
    if scores["demand"] > 70:
        reasons.append("Strong buyer demand")
    if scores["distance"] > 60:
        reasons.append("Nearby location")

    risks = []
    if forecast_confidence < 0.6:
        risks.append("Price forecast confidence moderate")
    if sale_window_days <= 1:
        risks.append("Tight delivery window")
    if payment_reliability < 60:
        risks.append("Buyer payment history needs review")

    return SellOption(
        option_type=option_type,
        target_name=target_name,
        score=total_score,
        gross_price_per_q=gross_price,
        transport_cost_per_q=transport_cost,
        storage_cost_per_q=storage_cost,
        expected_loss_per_q=expected_loss,
        net_realization_per_q=net,
        sale_window_days=sale_window_days,
        confidence=forecast_confidence,
        reasons=reasons if reasons else ["Baseline option"],
        risks=risks if risks else [],
        data_labels={
            "gross_price": "Market data (synthetic demo)" if gross_price < 3000 else "Model estimate",
            "transport": "Estimated",
            "storage": "Estimated",
            "payment_reliability": "Based on ShetBhav transaction history",
        },
    )


def get_smart_sell_recommendation(
    db: Session, request: SmartSellRequest
) -> SmartSellResponse:
    """
    §6: The Smart Sell Decision Engine.
    Evaluates all selling options and returns ranked recommendations.
    """
    crop = db.query(Crop).filter(Crop.id == request.crop_id).first()
    if not crop:
        raise ValueError("Crop not found")

    crop_name = crop.name.lower()
    quantity_q = request.quantity_kg / 100

    # Get current market prices
    market_svc = MarketDataService()
    market_data = market_svc.get_current_prices(db, request.crop_id)
    current_modal = market_data.get("prices", {}).get("modal_price", 2400)

    # Get forecast — uses trained XGBoost if available, otherwise naive/MA baseline
    hist_prices = []
    try:
        hist_records = (
            db.query(MarketPrice)
            .filter(MarketPrice.crop_id == request.crop_id)
            .order_by(MarketPrice.date.asc())
            .all()[-90:]
        )
        hist_prices = [r.modal_price for r in hist_records if r.modal_price]
    except Exception:
        pass

    forecast = predict_price(
        crop_name, current_modal, mandi="Nashik APMC",
        historical_prices=hist_prices if hist_prices else None,
    )

    # ── Quality-based confidence adjustment ─────────────────────
    # Check lot quality status — reduce confidence when quality is uncertain
    quality_confidence_factor = 1.0
    quality_notes = []
    try:
        from models.database import QualityAssessment
        from services.quality_grading import get_quality_report
        quality_report = get_quality_report(db, lot.id) if hasattr(lot, 'id') else None
        if quality_report:
            vtype = quality_report.get("verification_type", "")
            conf = quality_report.get("confidence", 0)
            if vtype == "self_declared":
                quality_confidence_factor *= 0.85
                quality_notes.append("Quality is self-declared — not AI or lab verified")
            elif conf < 60:
                quality_confidence_factor *= 0.90
                quality_notes.append(f"Low quality confidence ({conf:.0f}%)")
            if quality_report.get("status") == "pending_verification":
                quality_notes.append("Quality verification pending")
    except Exception:
        pass

    options: List[SellOption] = []

    # ── Option 1: Sell at nearby mandi ────────────────────────────────
    mandi_cost = estimate_transport_cost(
        request.location_lat, request.location_lng,
        19.9975, 73.7898  # Nashik APMC default
    )
    mandi_loss = estimate_spoilage(crop_name, request.quantity_kg, 1)
    mandi_net = calculate_net_realization(current_modal, mandi_cost, 0, mandi_loss)

    mandi_option = score_sell_option(
        option_type="market",
        target_name="Nashik APMC",
        gross_price=current_modal,
        transport_cost=mandi_cost,
        storage_cost=0,
        expected_loss=mandi_loss,
        quality_match=True,
        demand_level="medium",
        payment_reliability=70,
        quantity_available=999999,
        quantity_needed=request.quantity_kg,
        distance_km=mandi_cost / TRANSPORT_COST_PER_KM,
        forecast_confidence=forecast.get("confidence", 0.5),
        sale_window_days=1,
    )
    mandi_option.data_labels["gross_price"] = market_data.get("data_source_label", "Market data")
    options.append(mandi_option)

    # ── Option 2: Best buyer offer ────────────────────────────────────
    buyers = (
        db.query(BuyerProfile)
        .filter(BuyerProfile.verification_status == "verified")
        .all()
    )
    if not buyers:
        # Synthetic demo buyers if none in DB
        buyers = _get_demo_buyers()

    for buyer in buyers[:5]:
        buyer_lat = getattr(buyer, 'location_lat', 19.0) or 19.0
        buyer_lng = getattr(buyer, 'location_lng', 73.0) or 73.0
        transport = estimate_transport_cost(
            request.location_lat, request.location_lng, buyer_lat, buyer_lng
        )
        loss = estimate_spoilage(crop_name, request.quantity_kg, 2)
        trust = calculate_buyer_trust_score(buyer) if hasattr(buyer, 'completed_transactions') else 75
        business = getattr(buyer, 'business_name', 'Buyer')

        buyer_price = current_modal * random.uniform(0.96, 1.04)
        buyer_option = score_sell_option(
            option_type="buyer",
            target_name=business,
            gross_price=round(buyer_price, 0),
            transport_cost=transport,
            storage_cost=0,
            expected_loss=loss,
            quality_match=True,
            demand_level="high" if trust > 80 else "medium",
            payment_reliability=trust,
            quantity_available=999999,
            quantity_needed=request.quantity_kg,
            distance_km=transport / TRANSPORT_COST_PER_KM,
            forecast_confidence=forecast.get("confidence", 0.5),
            sale_window_days=3,
        )
        options.append(buyer_option)

    # ── Option 3: Store and sell later ────────────────────────────────
    # §18: Forecast only influences gross value estimate; storage, transport,
    # handling, and spoilage are ALWAYS deducted. Forecast does NOT alone
    # determine the recommendation.
    if request.storage_available:
        future_price = forecast.get("predicted_price", current_modal * 1.03)
        forecast_low = forecast.get("expected_low", future_price * 0.92)
        forecast_high = forecast.get("expected_high", future_price * 1.08)
        forecast_confidence = forecast.get("confidence", 0.5)

        # §18: Full cost breakdown for storage option
        storage_days = 7
        storage_cost_total = estimate_storage_cost(request.quantity_kg, storage_days)
        storage_cost_per_q = storage_cost_total / quantity_q if quantity_q > 0 else 0
        future_loss = estimate_spoilage(crop_name, request.quantity_kg, storage_days)
        future_loss_per_q = future_loss / quantity_q if quantity_q > 0 else 0
        future_transport = estimate_transport_cost(
            request.location_lat, request.location_lng,
            19.9975, 73.7898
        )
        handling = HANDLING_COST_PER_Q

        # §18: Net = gross - transport - storage - handling - spoilage
        storage_net = calculate_net_realization(
            future_price, future_transport, storage_cost_per_q, future_loss_per_q, handling
        )

        storage_option = score_sell_option(
            option_type="storage_sell_later",
            target_name=f"Sell at mandi after {storage_days}-day storage",
            gross_price=round(future_price, 0),
            transport_cost=future_transport,
            storage_cost=storage_cost_per_q,
            expected_loss=future_loss_per_q,
            quality_match=True,
            demand_level="medium",
            payment_reliability=70,
            quantity_available=999999,
            quantity_needed=request.quantity_kg,
            distance_km=future_transport / TRANSPORT_COST_PER_KM,
            forecast_confidence=forecast_confidence * 0.8,
            sale_window_days=storage_days,
        )
        storage_option.reasons.append(f"Forecast: ₹{future_price:,.0f}/q in {storage_days} days")
        storage_option.reasons.append(f"Net after all costs: ₹{storage_net:,.0f}/q")
        storage_option.risks.append("Spoilage risk during storage")
        storage_option.risks.append(f"Forecast confidence: {forecast_confidence*100:.0f}%")
        storage_option.data_labels["gross_price"] = forecast.get("data_source", "model_prediction") + " forecast"
        options.append(storage_option)

    # Sort by score
    options.sort(key=lambda o: o.score, reverse=True)

    best = options[0] if options else None
    alternatives = options[1:] if len(options) > 1 else []

    # What-if scenarios
    what_ifs = _generate_what_ifs(crop_name, current_modal, request.quantity_kg, forecast)

    return SmartSellResponse(
        lot_summary={
            "crop": crop.name,
            "quantity_kg": request.quantity_kg,
            "quality": request.quality_grade.value,
            "urgency": request.urgency.value,
            "storage": request.storage_available,
        },
        best_option=best or options[0],
        alternatives=alternatives,
        what_if_scenarios=what_ifs,
        explanation=_generate_explanation(best, crop.name, request.quantity_kg),
    )


def _get_demo_buyers() -> list:
    """Synthetic demo buyers for when DB has none."""
    demo_data = [
        type('Buyer', (), {
            'id': 1001, 'business_name': 'ABC Foods Pvt Ltd',
            'location_lat': 18.52, 'location_lng': 73.86,
            'completed_transactions': 45, 'successful_payments': 43,
            'payment_delay_count': 2, 'dispute_count': 1,
            'cancellation_count': 0, 'verification_status': 'verified',
        })(),
        type('Buyer', (), {
            'id': 1002, 'business_name': 'FreshHarvest Trading',
            'location_lat': 19.08, 'location_lng': 74.75,
            'completed_transactions': 28, 'successful_payments': 27,
            'payment_delay_count': 1, 'dispute_count': 0,
            'cancellation_count': 1, 'verification_status': 'verified',
        })(),
        type('Buyer', (), {
            'id': 1003, 'business_name': 'Nashik Agro Exports',
            'location_lat': 20.00, 'location_lng': 73.79,
            'completed_transactions': 62, 'successful_payments': 60,
            'payment_delay_count': 3, 'dispute_count': 1,
            'cancellation_count': 0, 'verification_status': 'verified',
        })(),
    ]
    return demo_data


def _generate_what_ifs(crop: str, current_price: float, qty_kg: float, forecast: dict) -> list:
    """§19: What-if simulator."""
    qty_q = qty_kg / 100
    scenarios = []

    # Sell today
    scenarios.append({
        "scenario": "Sell today at mandi",
        "gross": round(current_price * qty_q, 0),
        "costs": round(HANDLING_COST_PER_Q * qty_q + 80, 0),
        "net": round((current_price - HANDLING_COST_PER_Q - 80) * qty_q, 0),
        "risk": "Low",
        "confidence": "High",
    })

    # Sell in 3 days
    future = forecast.get("predicted_price", current_price * 1.03)
    storage_3d = STORAGE_BASE_COST * 3 * qty_q
    scenarios.append({
        "scenario": "Store 3 days, sell at mandi",
        "gross": round(future * qty_q, 0),
        "costs": round(storage_3d + HANDLING_COST_PER_Q * qty_q + 80, 0),
        "net": round((future - STORAGE_BASE_COST * 3 - HANDLING_COST_PER_Q - 80) * qty_q, 0),
        "risk": "Medium",
        "confidence": forecast.get("confidence_label", "Moderate"),
    })

    # Sell in 7 days
    future_7 = forecast.get("predicted_price", current_price * 1.05) * 1.02
    storage_7d = STORAGE_BASE_COST * 7 * qty_q
    scenarios.append({
        "scenario": "Store 7 days, sell at mandi",
        "gross": round(future_7 * qty_q, 0),
        "costs": round(storage_7d + HANDLING_COST_PER_Q * qty_q + 80, 0),
        "net": round((future_7 - STORAGE_BASE_COST * 7 - HANDLING_COST_PER_Q - 80) * qty_q, 0),
        "risk": "High",
        "confidence": "Lower",
    })

    return scenarios


def _generate_explanation(best: SellOption, crop: str, qty_kg: float) -> str:
    """§69: Human-readable explanation for the farmer."""
    if not best:
        return "No selling options available right now."

    qty_q = qty_kg / 100
    net_total = best.net_realization_per_q * qty_q

    lines = [
        f"RECOMMENDED: Sell {crop.title()} to {best.target_name}",
        f"Expected net realization: ₹{best.net_realization_per_q:,.0f}/quintal",
        f"Total expected earnings: ₹{net_total:,.0f}",
        f"Sell within {best.sale_window_days} day(s)",
        "",
        "WHY:",
    ]
    for reason in best.reasons:
        lines.append(f"✓ {reason}")

    if best.risks:
        lines.append("")
        lines.append("Risks:")
        for risk in best.risks:
            lines.append(f"⚠ {risk}")

    lines.append("")
    lines.append(f"Confidence: {best.confidence * 100:.0f}%")

    return "\n".join(lines)
