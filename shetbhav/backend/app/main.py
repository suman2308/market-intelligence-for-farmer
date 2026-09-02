"""
ShetBhav — FastAPI Backend
§42: REST APIs organized by domain.
"""
import os
import sys
import random
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import get_db, init_db, SessionLocal
from config.settings import FRONTEND_URL, DEMO_MODE
from models.database import (
    User, FarmerProfile, FPOProfile, BuyerProfile, AdminProfile,
    Crop, Market, MarketPrice, ProduceLot, DemandRequest,
    Offer, OfferHistory, Order, Logistics, Payment,
    Grievance, Forecast, Recommendation, Notification,
    StorageFacility, TransportProvider, FPOMembership,
    DataSource, Farm, LotItem,
    UserRole, QualityGrade, OrderStatus, OfferStatus, GrievanceStatus,
    PaymentStatus, VerificationStatus, UrgencyLevel,
    DataSourceType
)
from models.schemas import (
    LoginRequest, TokenResponse, RegisterRequest,
    UserResponse, FarmerProfileCreate, FarmerProfileResponse,
    BuyerProfileResponse,
    CropResponse, MarketResponse,
    ProduceLotCreate, ProduceLotResponse,
    DemandRequestCreate, DemandRequestResponse,
    OfferCreate, OfferCounter, OfferResponse,
    OrderResponse, OrderStatusUpdate,
    PaymentResponse,
    GrievanceCreate, GrievanceResponse, GrievanceResolution,
    StorageFacilityResponse,
    SmartSellRequest, SmartSellResponse,
    NotificationResponse, AdminDashboardStats,
)
from services.auth import (
    hash_password, authenticate_user, create_access_token,
    get_current_user, require_role
)
from services.market_data import MarketDataService
from ml.forecasting import predict_price, evaluate_all_models

app = FastAPI(
    title="ShetBhav API",
    description="AI-powered agricultural market intelligence platform",
    version="1.0.0",
)

import re

def _cors_origins():
    """Allow the configured frontend URL plus any localhost port (dev)."""
    base = [FRONTEND_URL]
    # Allow any localhost origin in development
    return base

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"^https?://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security: Rate Limiting (simple in-memory) ──────────────────────
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse

_rate_limits: dict = defaultdict(list)
RATE_LIMIT_LOGIN = 10  # per minute
RATE_LIMIT_API = 200   # per minute


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Security headers
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not DEMO_MODE:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting in demo/test mode
    if DEMO_MODE:
        return await call_next(request)
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60  # 1 minute
    key = f"{client_ip}:{request.url.path}"
    # Stricter limit on login
    limit = RATE_LIMIT_LOGIN if "/auth/login" in request.url.path else RATE_LIMIT_API
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    if len(_rate_limits[key]) >= limit:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please try again later."})
    _rate_limits[key].append(now)
    return await call_next(request)


# ── Startup ──────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    _seed_demo_data()


# ── Auth Routes ──────────────────────────────────────────────────────
@app.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@app.post("/auth/register", response_model=UserResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.username == req.username) | (User.email == req.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        phone=req.phone,
        role=req.role,
        language=req.language,
    )
    db.add(user)
    db.flush()

    # Create role-specific profile
    if req.role == UserRole.FARMER:
        profile = FarmerProfile(user_id=user.id)
        db.add(profile)
    elif req.role == UserRole.BUYER:
        profile = BuyerProfile(user_id=user.id, business_name=req.full_name)
        db.add(profile)
    elif req.role == UserRole.FPO:
        profile = FPOProfile(user_id=user.id, name=req.full_name)
        db.add(profile)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@app.get("/auth/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


# ── Farmer Routes ────────────────────────────────────────────────────
@app.get("/farmers/profile", response_model=FarmerProfileResponse)
def get_farmer_profile(
    user: User = Depends(require_role(UserRole.FARMER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = db.query(FarmerProfile).filter(FarmerProfile.user_id == user.id).first()
    if not profile:
        profile = FarmerProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@app.put("/farmers/profile", response_model=FarmerProfileResponse)
def update_farmer_profile(
    data: FarmerProfileCreate,
    user: User = Depends(require_role(UserRole.FARMER)),
    db: Session = Depends(get_db),
):
    profile = db.query(FarmerProfile).filter(FarmerProfile.user_id == user.id).first()
    if not profile:
        profile = FarmerProfile(user_id=user.id)
        db.add(profile)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/farmers/dashboard")
def farmer_dashboard(
    user: User = Depends(require_role(UserRole.FARMER)),
    db: Session = Depends(get_db),
):
    lots = db.query(ProduceLot).filter(
        ProduceLot.farmer_id == user.farmer_profile.id if user.farmer_profile else False
    ).all()
    orders = db.query(Order).filter(Order.farmer_id == user.farmer_profile.id if user.farmer_profile else False).all()
    notifications = db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read == False
    ).count()
    return {
        "active_lots": len([l for l in lots if l.status == "active"]),
        "total_lots": len(lots),
        "pending_orders": len([o for o in orders if o.status.value in ["accepted", "pickup_scheduled"]]),
        "total_earnings": sum(o.total_value for o in orders if o.status == OrderStatus.PAID),
        "unread_notifications": notifications,
    }


# ── Produce Lot Routes ──────────────────────────────────────────────
@app.post("/lots", response_model=ProduceLotResponse)
def create_lot(
    data: ProduceLotCreate,
    user: User = Depends(require_role(UserRole.FARMER, UserRole.FPO)),
    db: Session = Depends(get_db),
):
    farmer_profile = db.query(FarmerProfile).filter(FarmerProfile.user_id == user.id).first()
    if not farmer_profile:
        raise HTTPException(status_code=400, detail="Farmer profile not found")
    crop = db.query(Crop).filter(Crop.id == data.crop_id).first()
    if not crop:
        raise HTTPException(status_code=400, detail=f"Crop with id {data.crop_id} not found")
    lot = ProduceLot(
        farmer_id=farmer_profile.id,
        crop_id=data.crop_id,
        quantity_kg=data.quantity_kg,
        quality_grade=data.quality_grade,
        location_lat=data.location_lat or farmer_profile.farm_location_lat,
        location_lng=data.location_lng or farmer_profile.farm_location_lng,
        address=data.address or farmer_profile.farm_address,
        harvest_date=data.harvest_date,
        storage_available=data.storage_available,
        urgency=data.urgency,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
    return ProduceLotResponse(
        id=lot.id, farmer_id=lot.farmer_id, crop_id=lot.crop_id,
        crop_name=crop.name if crop else None,
        quantity_kg=lot.quantity_kg, quality_grade=lot.quality_grade,
        address=lot.address, harvest_date=lot.harvest_date,
        storage_available=lot.storage_available, urgency=lot.urgency,
        status=lot.status, created_at=lot.created_at,
    )


@app.get("/lots", response_model=List[ProduceLotResponse])
def list_lots(
    user: User = Depends(get_current_user),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ProduceLot)
    if user.role == UserRole.FARMER and user.farmer_profile:
        query = query.filter(ProduceLot.farmer_id == user.farmer_profile.id)
    if status:
        query = query.filter(ProduceLot.status == status)
    lots = query.order_by(ProduceLot.created_at.desc()).limit(50).all()
    results = []
    for lot in lots:
        crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
        results.append(ProduceLotResponse(
            id=lot.id, farmer_id=lot.farmer_id, crop_id=lot.crop_id,
            crop_name=crop.name if crop else None,
            quantity_kg=lot.quantity_kg, quality_grade=lot.quality_grade,
            address=lot.address, harvest_date=lot.harvest_date,
            storage_available=lot.storage_available, urgency=lot.urgency,
            status=lot.status, created_at=lot.created_at,
        ))
    return results


@app.get("/lots/{lot_id}", response_model=ProduceLotResponse)
def get_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(ProduceLot).filter(ProduceLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
    return ProduceLotResponse(
        id=lot.id, farmer_id=lot.farmer_id, crop_id=lot.crop_id,
        crop_name=crop.name if crop else None,
        quantity_kg=lot.quantity_kg, quality_grade=lot.quality_grade,
        address=lot.address, harvest_date=lot.harvest_date,
        storage_available=lot.storage_available, urgency=lot.urgency,
        status=lot.status, created_at=lot.created_at,
    )


# ── Crop Routes ──────────────────────────────────────────────────────
@app.get("/crops", response_model=List[CropResponse])
def list_crops(db: Session = Depends(get_db)):
    crops = db.query(Crop).all()
    return crops


# ── Market Routes ────────────────────────────────────────────────────
@app.get("/markets", response_model=List[MarketResponse])
def list_markets(db: Session = Depends(get_db)):
    return db.query(Market).filter(Market.is_active == True).all()


@app.get("/markets/prices")
def get_market_prices(
    crop_id: int = Query(...),
    market_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail=f"Crop with id {crop_id} not found")
    svc = MarketDataService()
    return svc.get_current_prices(db, crop_id, market_id)


@app.get("/markets/prices/history")
def get_price_history(
    crop_id: int = Query(...),
    market_id: int = Query(...),
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    svc = MarketDataService()
    return svc.get_historical_prices(db, crop_id, market_id, days)


@app.get("/markets/overview")
def market_overview(
    crop_id: int = Query(...),
    db: Session = Depends(get_db),
):
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail=f"Crop with id {crop_id} not found")

    svc = MarketDataService()
    current = svc.get_current_prices(db, crop_id)
    forecast = predict_price(crop.name.lower(), current.get("prices", {}).get("modal_price", 2400))

    modal = current.get("prices", {}).get("modal_price", 2400)
    prev_day = svc.get_current_prices(db, crop_id)
    prev_modal = prev_day.get("prices", {}).get("modal_price", modal)
    trend = "up" if modal > prev_modal else ("down" if modal < prev_modal else "stable")
    trend_pct = round(((modal - prev_modal) / prev_modal) * 100, 1) if prev_modal else 0

    return {
        "crop": CropResponse.model_validate(crop),
        "current_price": modal,
        "min_price": current.get("prices", {}).get("min_price", 0),
        "max_price": current.get("prices", {}).get("max_price", 0),
        "price_trend": trend,
        "trend_pct": trend_pct,
        "forecast": forecast,
        "data_source": current.get("source", "synthetic_demo"),
        "data_source_label": current.get("data_source_label", ""),
        "last_updated": current.get("last_updated", datetime.utcnow().isoformat()),
    }


# ── Forecast Routes ──────────────────────────────────────────────────
@app.get("/forecasts/predict")
def forecast_price(
    crop_id: int = Query(...),
    current_price: float = Query(...),
    arrivals: float = Query(200.0),
):
    crop = None
    with SessionLocal() as db:
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
    crop_name = crop.name.lower() if crop else "tomato"
    return predict_price(crop_name, current_price, arrivals)


@app.post("/forecasts/train")
def train_forecast_models(
    user: User = Depends(require_role(UserRole.ADMIN)),
):
    return evaluate_all_models()


# ── Smart Sell Route ─────────────────────────────────────────────────
@app.post("/smart-sell", response_model=SmartSellResponse)
def smart_sell(
    request: SmartSellRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.smart_sell import get_smart_sell_recommendation
    try:
        return get_smart_sell_recommendation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Demand Routes ────────────────────────────────────────────────────
@app.post("/demand", response_model=DemandRequestResponse)
def create_demand(
    data: DemandRequestCreate,
    user: User = Depends(require_role(UserRole.BUYER)),
    db: Session = Depends(get_db),
):
    buyer_profile = db.query(BuyerProfile).filter(BuyerProfile.user_id == user.id).first()
    if not buyer_profile:
        raise HTTPException(status_code=400, detail="Buyer profile not found")
    demand = DemandRequest(
        buyer_id=buyer_profile.id,
        crop_id=data.crop_id,
        quantity_kg=data.quantity_kg,
        quality_grade=data.quality_grade,
        required_by_date=data.required_by_date,
        location_lat=data.location_lat,
        location_lng=data.location_lng,
        district=data.district,
        offered_price_per_q=data.offered_price_per_q,
    )
    db.add(demand)
    db.commit()
    db.refresh(demand)
    return demand


@app.get("/demand", response_model=List[DemandRequestResponse])
def list_demand(
    user: User = Depends(get_current_user),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(DemandRequest)
    if user.role == UserRole.BUYER and user.buyer_profile:
        query = query.filter(DemandRequest.buyer_id == user.buyer_profile.id)
    if status:
        query = query.filter(DemandRequest.status == status)
    return query.order_by(DemandRequest.created_at.desc()).limit(50).all()


# ── Offer Routes ─────────────────────────────────────────────────────
@app.post("/offers", response_model=OfferResponse)
def create_offer(
    data: OfferCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = Offer(
        lot_id=data.lot_id,
        demand_id=data.demand_id,
        from_user_id=user.id,
        to_user_id=data.to_user_id,
        price_per_q=data.price_per_q,
        quantity_kg=data.quantity_kg,
        delivery_date=data.delivery_date,
        notes=data.notes,
    )
    db.add(offer)
    db.flush()
    # Record in history
    history = OfferHistory(
        offer_id=offer.id,
        price_per_q=data.price_per_q,
        quantity_kg=data.quantity_kg,
        action="sent",
        notes=data.notes,
        created_by=user.id,
    )
    db.add(history)
    db.commit()
    db.refresh(offer)
    return offer


@app.get("/offers", response_model=List[OfferResponse])
def list_offers(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offers = db.query(Offer).filter(
        (Offer.from_user_id == user.id) | (Offer.to_user_id == user.id)
    ).order_by(Offer.created_at.desc()).limit(50).all()
    return offers


@app.post("/offers/{offer_id}/accept", response_model=OfferResponse)
def accept_offer(
    offer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.to_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if offer.status not in (OfferStatus.PENDING, OfferStatus.COUNTERED):
        raise HTTPException(status_code=400, detail=f"Cannot accept offer in {offer.status.value} status")
    offer.status = OfferStatus.ACCEPTED
    history = OfferHistory(
        offer_id=offer.id, price_per_q=offer.price_per_q,
        action="accepted", created_by=user.id,
    )
    db.add(history)
    db.commit()
    db.refresh(offer)
    return offer


@app.post("/offers/{offer_id}/reject", response_model=OfferResponse)
def reject_offer(
    offer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.to_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if offer.status not in (OfferStatus.PENDING, OfferStatus.COUNTERED):
        raise HTTPException(status_code=400, detail=f"Cannot reject offer in {offer.status.value} status")
    offer.status = OfferStatus.REJECTED
    history = OfferHistory(
        offer_id=offer.id, action="rejected", created_by=user.id,
    )
    db.add(history)
    db.commit()
    db.refresh(offer)
    return offer


@app.post("/offers/{offer_id}/counter", response_model=OfferResponse)
def counter_offer(
    offer_id: int,
    data: OfferCounter,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.to_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if offer.status not in (OfferStatus.PENDING, OfferStatus.COUNTERED):
        raise HTTPException(status_code=400, detail=f"Cannot counter offer in {offer.status.value} status")
    # Swap roles: counter-offer makes the current recipient the new offerer
    old_from = offer.from_user_id
    offer.from_user_id = offer.to_user_id
    offer.to_user_id = old_from
    offer.price_per_q = data.price_per_q
    offer.status = OfferStatus.COUNTERED
    offer.negotiation_round += 1
    history = OfferHistory(
        offer_id=offer.id, price_per_q=data.price_per_q,
        action="countered", notes=data.notes, created_by=user.id,
    )
    db.add(history)
    db.commit()
    db.refresh(offer)
    return offer


# ── Order Routes ─────────────────────────────────────────────────────
@app.post("/orders", response_model=OrderResponse)
def create_order(
    offer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Convenience endpoint: create order from accepted offer."""
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer or offer.status != OfferStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Offer not accepted")
    lot = db.query(ProduceLot).filter(ProduceLot.id == offer.lot_id).first()
    if not lot:
        raise HTTPException(status_code=400, detail="Lot not found")
    # lot.farmer_id is a FarmerProfile ID, not a User ID
    farmer_profile = db.query(FarmerProfile).filter(FarmerProfile.id == lot.farmer_id).first()
    farmer_user_id = farmer_profile.user_id if farmer_profile else 0
    # Buyer is the user in the offer who is NOT the farmer
    buyer_user_id = offer.from_user_id if offer.from_user_id != farmer_user_id else offer.to_user_id
    buyer_profile = db.query(BuyerProfile).filter(BuyerProfile.user_id == buyer_user_id).first()
    order = Order(
        offer_id=offer.id,
        farmer_id=lot.farmer_id,
        buyer_id=buyer_profile.id if buyer_profile else 0,
        crop_id=lot.crop_id,
        quantity_kg=offer.quantity_kg,
        price_per_q=offer.price_per_q,
        total_value=offer.price_per_q * offer.quantity_kg / 100,
        delivery_date=offer.delivery_date,
        status=OrderStatus.ACCEPTED,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.post("/orders/from-offer/{offer_id}", response_model=OrderResponse)
def create_order_from_offer(
    offer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer or offer.status != OfferStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Offer not accepted")
    lot = db.query(ProduceLot).filter(ProduceLot.id == offer.lot_id).first()
    if not lot:
        raise HTTPException(status_code=400, detail="Lot not found")
    # lot.farmer_id is a FarmerProfile ID, not a User ID
    farmer_profile = db.query(FarmerProfile).filter(FarmerProfile.id == lot.farmer_id).first()
    farmer_user_id = farmer_profile.user_id if farmer_profile else 0
    # Buyer is the user in the offer who is NOT the farmer
    buyer_user_id = offer.from_user_id if offer.from_user_id != farmer_user_id else offer.to_user_id
    buyer_profile = db.query(BuyerProfile).filter(BuyerProfile.user_id == buyer_user_id).first()
    order = Order(
        offer_id=offer.id,
        farmer_id=lot.farmer_id,
        buyer_id=buyer_profile.id if buyer_profile else 0,
        crop_id=lot.crop_id,
        quantity_kg=offer.quantity_kg,
        price_per_q=offer.price_per_q,
        total_value=offer.price_per_q * offer.quantity_kg / 100,
        delivery_date=offer.delivery_date,
        status=OrderStatus.ACCEPTED,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.get("/orders", response_model=List[OrderResponse])
def list_orders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == UserRole.FARMER and user.farmer_profile:
        orders = db.query(Order).filter(Order.farmer_id == user.farmer_profile.id).all()
    elif user.role == UserRole.BUYER and user.buyer_profile:
        orders = db.query(Order).filter(Order.buyer_id == user.buyer_profile.id).all()
    else:
        orders = db.query(Order).all()
    return orders[:50]


@app.put("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = data.status

    # Auto-create payment when quality confirmed
    if data.status == OrderStatus.QUALITY_CONFIRMED:
        payment = Payment(order_id=order.id, amount=order.total_value)
        db.add(payment)

    db.commit()
    db.refresh(order)
    return order


# ── Payment Routes ───────────────────────────────────────────────────
@app.post("/payments/{order_id}/simulate", response_model=PaymentResponse)
def simulate_payment(
    order_id: int,
    user: User = Depends(require_role(UserRole.BUYER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """§33: Simulate payment. Clearly not a real financial transaction."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        payment = Payment(order_id=order_id, amount=order.total_value)
        db.add(payment)
    payment.status = PaymentStatus.COMPLETED
    payment.transaction_ref = f"SIM-{random.randint(100000, 999999)}"
    payment.paid_at = datetime.utcnow()
    order.status = OrderStatus.PAID

    # Notify farmer (resolve from order relationship)
    farmer_profile = db.query(FarmerProfile).filter(FarmerProfile.id == order.farmer_id).first()
    if farmer_profile:
        notification = Notification(
            user_id=farmer_profile.user_id,
            title="Payment Received!",
            message=f"INR {order.total_value:,.0f} payment received for order #{order.id}",
            type="payment",
        )
        db.add(notification)
    db.commit()
    db.refresh(payment)
    return payment


@app.get("/payments/{order_id}", response_model=PaymentResponse)
def get_payment(order_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


# ── Grievance Routes ────────────────────────────────────────────────
@app.post("/grievances", response_model=GrievanceResponse)
def create_grievance(
    data: GrievanceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    grievance = Grievance(
        order_id=data.order_id,
        user_id=user.id,
        category=data.category,
        description=data.description,
        evidence_url=data.evidence_url,
    )
    db.add(grievance)
    db.commit()
    db.refresh(grievance)
    return grievance


@app.get("/grievances", response_model=List[GrievanceResponse])
def list_grievances(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == UserRole.ADMIN:
        return db.query(Grievance).order_by(Grievance.created_at.desc()).limit(50).all()
    return db.query(Grievance).filter(Grievance.user_id == user.id).all()


@app.put("/grievances/{grievance_id}/resolve", response_model=GrievanceResponse)
def resolve_grievance(
    grievance_id: int,
    data: GrievanceResolution,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    grievance.status = data.status
    grievance.admin_response = data.admin_response
    grievance.resolution = data.resolution
    db.commit()
    db.refresh(grievance)
    return grievance


# ── Storage Routes ───────────────────────────────────────────────────
@app.get("/storage", response_model=List[StorageFacilityResponse])
def list_storage(
    district: Optional[str] = None,
    crop: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(StorageFacility).filter(StorageFacility.is_active == True)
    if district:
        query = query.filter(StorageFacility.district == district)
    facilities = query.all()
    if crop:
        facilities = [f for f in facilities if not f.compatible_crops or crop.lower() in [c.lower() for c in f.compatible_crops]]
    return facilities


# ── Buyer Routes ─────────────────────────────────────────────────────
@app.get("/buyers", response_model=List[BuyerProfileResponse])
def list_buyers(db: Session = Depends(get_db)):
    return db.query(BuyerProfile).filter(BuyerProfile.verification_status == VerificationStatus.VERIFIED).all()


@app.get("/buyers/{buyer_id}", response_model=BuyerProfileResponse)
def get_buyer(buyer_id: int, db: Session = Depends(get_db)):
    buyer = db.query(BuyerProfile).filter(BuyerProfile.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    return buyer


# ── Matching Route ───────────────────────────────────────────────────
@app.get("/matching/{lot_id}")
def find_matching_buyers(
    lot_id: int,
    db: Session = Depends(get_db),
):
    lot = db.query(ProduceLot).filter(ProduceLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
    crop_name = crop.name.lower() if crop else ""

    # Find matching demands
    demands = db.query(DemandRequest).filter(
        DemandRequest.crop_id == lot.crop_id,
        DemandRequest.status == "open",
    ).all()

    matches = []
    for demand in demands:
        buyer = db.query(BuyerProfile).filter(BuyerProfile.id == demand.buyer_id).first()
        if not buyer:
            continue
        score = 70  # Base
        if demand.quality_grade == lot.quality_grade:
            score += 10
        if demand.quantity_kg >= lot.quantity_kg:
            score += 5
        price_diff = abs(demand.offered_price_per_q - 2400) / 2400
        score += max(0, 15 - price_diff * 100)

        matches.append({
            "demand_id": demand.id,
            "buyer_id": buyer.id,
            "buyer_name": buyer.business_name,
            "crop": crop_name,
            "quantity_needed": demand.quantity_kg,
            "offered_price": demand.offered_price_per_q,
            "quality": demand.quality_grade.value if demand.quality_grade else "any",
            "score": round(min(100, score), 1),
            "district": demand.district,
        })

    matches.sort(key=lambda m: m["score"], reverse=True)
    return {"lot_id": lot_id, "matches": matches}


# ── Notification Routes ──────────────────────────────────────────────
@app.get("/notifications", response_model=List[NotificationResponse])
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.created_at.desc()).limit(20).all()


@app.post("/notifications/{notif_id}/read")
def mark_read(notif_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user.id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"status": "ok"}


# ── Admin Routes ─────────────────────────────────────────────────────
@app.get("/admin/stats", response_model=AdminDashboardStats)
def admin_stats(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    total_farmers = db.query(FarmerProfile).count()
    total_fpos = db.query(FPOProfile).count()
    total_buyers = db.query(BuyerProfile).count()
    verified_buyers = db.query(BuyerProfile).filter(BuyerProfile.verification_status == VerificationStatus.VERIFIED).count()
    active_lots = db.query(ProduceLot).filter(ProduceLot.status == "active").count()
    active_demand = db.query(DemandRequest).filter(DemandRequest.status == "open").count()
    completed = db.query(Order).filter(Order.status == OrderStatus.COMPLETED).count()
    total_orders = db.query(Order).count()
    total_volume = db.query(func.sum(Order.quantity_kg)).filter(Order.status == OrderStatus.COMPLETED).scalar() or 0
    avg_realization = db.query(func.avg(Order.price_per_q)).filter(Order.status == OrderStatus.COMPLETED).scalar() or 0
    paid = db.query(Payment).filter(Payment.status == PaymentStatus.COMPLETED).count()
    disputes = db.query(Grievance).filter(Grievance.status != GrievanceStatus.RESOLVED).count()
    open_grievances = db.query(Grievance).filter(Grievance.status == GrievanceStatus.OPEN).count()

    return AdminDashboardStats(
        total_farmers=total_farmers,
        total_fpos=total_fpos,
        total_buyers=total_buyers,
        verified_buyers=verified_buyers,
        active_lots=active_lots,
        active_demand=active_demand,
        completed_transactions=completed,
        total_volume_kg=total_volume,
        avg_farmer_realization=round(avg_realization, 0),
        transaction_success_rate=round((completed / total_orders * 100) if total_orders else 0, 1),
        payment_completion_rate=round((paid / total_orders * 100) if total_orders else 0, 1),
        dispute_rate=min(100.0, round((disputes / total_orders * 100) if total_orders else 0, 1)),
        open_grievances=open_grievances,
    )


@app.get("/admin/users")
def admin_list_users(
    user: User = Depends(require_role(UserRole.ADMIN)),
    role: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return [UserResponse.model_validate(u) for u in query.limit(100).all()]


@app.put("/admin/buyers/{buyer_id}/verify")
def verify_buyer(
    buyer_id: int,
    status: VerificationStatus,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    buyer = db.query(BuyerProfile).filter(BuyerProfile.id == buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")
    buyer.verification_status = status
    db.commit()
    return {"status": "updated"}


# ── Language / i18n Route ────────────────────────────────────────────
@app.get("/translations/{lang}")
def get_translations(lang: str):
    translations = {
        "en": {
            "app_name": "ShetBhav",
            "tagline": "Know the market. Choose better. Earn more.",
            "sell_my_produce": "Sell My Produce",
            "todays_prices": "Today's Prices",
            "find_buyers": "Find Buyers",
            "my_orders": "My Orders",
            "my_earnings": "My Earnings",
            "help": "Help",
            "my_produce": "My Produce",
            "create_lot": "Create Lot",
            "smart_sell": "Smart Sell Recommendation",
            "best_option": "Best Option",
            "net_realization": "Net Realization",
            "sell_now": "Sell Now",
            "store_and_sell": "Store & Sell Later",
            "greeting": "Namaskar!",
            "welcome": "Welcome to ShetBhav",
        },
        "hi": {
            "app_name": "शेतभाव",
            "tagline": "बाज़ार जानो। बेहतर चुनो। ज़्यादा कमाओ।",
            "sell_my_produce": "मेरी फ़सल बेचें",
            "todays_prices": "आज के भाव",
            "find_buyers": "ख़रीददार ढूंढें",
            "my_orders": "मेरे ऑर्डर",
            "my_earnings": "मेरी कमाई",
            "help": "मदद",
            "my_produce": "मेरी फ़सल",
            "create_lot": "लॉट बनाएं",
            "smart_sell": "स्मार्ट बेचने की सलाह",
            "best_option": "सबसे अच्छा विकल्प",
            "net_realization": "शुद्ध आमदनी",
            "sell_now": "अभी बेचें",
            "store_and_sell": "स्टोर करें और बाद में बेचें",
            "greeting": "नमस्कार!",
            "welcome": "शेतभाव में आपका स्वागत है",
        },
        "mr": {
            "app_name": "शेतभाव",
            "tagline": "बाजार जाणा. चांगले निवडा. जास्त कमवा.",
            "sell_my_produce": "माझे पीक विका",
            "todays_prices": "आजचे भाव",
            "find_buyers": "विकतदार शोधा",
            "my_orders": "माझे ऑर्डर",
            "my_earnings": "माझी कमाई",
            "help": "मदत",
            "my_produce": "माझे पीक",
            "create_lot": "लॉट तयार करा",
            "smart_sell": "स्मार्ट विक्री शिफारस",
            "best_option": "सर्वोत्तम पर्याय",
            "net_realization": "शुद्ध मिळवणी",
            "sell_now": "आता विका",
            "store_and_sell": "साठवा आणि नंतर विका",
            "greeting": "नमस्कार!",
            "welcome": "शेतभावमध्ये आपले स्वागत आहे",
        },
    }
    return translations.get(lang, translations["en"])


# ── Demo Data Seeding ────────────────────────────────────────────────
def _seed_demo_data():
    """§47, §48: Seed realistic demo data for Maharashtra farmers."""
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Crop).count() > 0:
            return

        # Crops
        crops = [
            Crop(name="Tomato", name_hi="टमाटर", name_mr="टोमॅटो",
                 category="vegetable", unit="kg", shelf_life_days=5, supports_ai_grading=True),
            Crop(name="Onion", name_hi="प्याज़", name_mr="कांदा",
                 category="vegetable", unit="kg", shelf_life_days=14, supports_ai_grading=False),
            Crop(name="Soybean", name_hi="सोयाबीन", name_mr="सोयाबीन",
                 category="grain", unit="kg", shelf_life_days=90, supports_ai_grading=False),
        ]
        db.add_all(crops)
        db.flush()

        # Markets
        markets = [
            Market(name="Nashik APMC", code="MH_NSK_001", district="Nashik", state="Maharashtra",
                   location_lat=19.9975, location_lng=73.7898, market_type="APMC"),
            Market(name="Pune APMC", code="MH_PUN_001", district="Pune", state="Maharashtra",
                   location_lat=18.5204, location_lng=73.8567, market_type="APMC"),
            Market(name="Mumbai APMC", code="MH_MUM_001", district="Mumbai", state="Maharashtra",
                   location_lat=19.0760, location_lng=72.8777, market_type="APMC"),
            Market(name="Nagpur APMC", code="MH_NGP_001", district="Nagpur", state="Maharashtra",
                   location_lat=21.1458, location_lng=79.0882, market_type="APMC"),
            Market(name="Nashik Lasalgaon", code="MH_NSK_002", district="Nashik", state="Maharashtra",
                   location_lat=20.1487, location_lng=73.8936, market_type="APMC"),
        ]
        db.add_all(markets)
        db.flush()

        # Storage facilities
        storage = [
            StorageFacility(name="Nashik Cold Storage", district="Nashik", location_lat=20.01, location_lng=73.79,
                          capacity_quintal=500, available_capacity_quintal=200, cost_per_quintal_per_day=40,
                          compatible_crops=["tomato", "onion"]),
            StorageFacility(name="Pune Agri Warehouse", district="Pune", location_lat=18.53, location_lng=73.86,
                          capacity_quintal=800, available_capacity_quintal=350, cost_per_quintal_per_day=35,
                          compatible_crops=["tomato", "onion", "soybean"]),
        ]
        db.add_all(storage)

        # Transport providers
        transport = [
            TransportProvider(name="Shree Transport", vehicle_type="truck", capacity_kg=5000,
                            cost_per_km=2.0, location_lat=19.99, location_lng=73.79, reliability_score=85),
            TransportProvider(name="Quick Deliver", vehicle_type="pickup", capacity_kg=1000,
                            cost_per_km=3.5, location_lat=18.52, location_lng=73.86, reliability_score=90),
        ]
        db.add_all(transport)

        # Demo users
        from services.auth import hash_password

        # §48: Demo Farmer — Ramesh Patil
        farmer_user = User(
            username="ramesh", email="ramesh@demo.shetbhav.in",
            hashed_password=hash_password("demo123"),
            full_name="Ramesh Patil", phone="9876543210",
            role=UserRole.FARMER, language="en",
        )
        db.add(farmer_user)
        db.flush()

        farmer_profile = FarmerProfile(
            user_id=farmer_user.id,
            farm_location_lat=20.0057, farm_location_lng=73.7229,
            farm_address="Village Pimpri, Taluka Nashik, Nashik",
            district="Nashik", state="Maharashtra", pincode="422010",
            farm_size_acres=3.5, primary_crops=["tomato", "onion"],
            storage_available=True,
        )
        db.add(farmer_profile)
        db.flush()

        # More farmers
        farmer_names = [
            ("suresh", "Suresh Jadhav", "suresh@demo.shetbhav.in", "Nashik", 20.01, 73.80),
            ("priya", "Priya Deshmukh", "priya@demo.shetbhav.in", "Pune", 18.53, 73.87),
            ("anil", "Anil More", "anil@demo.shetbhav.in", "Nagpur", 21.15, 79.09),
            ("meena", "Meena Pawar", "meena@demo.shetbhav.in", "Aurangabad", 19.88, 75.34),
            ("ganesh", "Ganesh Shinde", "ganesh@demo.shetbhav.in", "Kolhapur", 16.71, 74.24),
        ]
        farmer_ids = []
        for uname, fname, email, dist, lat, lng in farmer_names:
            u = User(username=uname, email=email, hashed_password=hash_password("demo123"),
                     full_name=fname, role=UserRole.FARMER)
            db.add(u)
            db.flush()
            p = FarmerProfile(user_id=u.id, farm_location_lat=lat, farm_location_lng=lng,
                            district=dist, state="Maharashtra", primary_crops=["tomato"],
                            storage_available=random.choice([True, False]))
            db.add(p)
            db.flush()
            farmer_ids.append((u.id, p.id))

        # §47: Buyers
        buyer_data = [
            ("abc_foods", "ABC Foods Pvt Ltd", "buyer1@demo.shetbhav.in", "Pune", "processor", ["tomato", "onion"], 92),
            ("fresh_harvest", "FreshHarvest Trading", "buyer2@demo.shetbhav.in", "Mumbai", "retailer", ["tomato"], 88),
            ("nashik_exports", "Nashik Agro Exports", "buyer3@demo.shetbhav.in", "Nashik", "exporter", ["tomato", "soybean"], 85),
            ("metro_fresh", "Metro Fresh Procurement", "buyer4@demo.shetbhav.in", "Mumbai", "wholesaler", ["tomato", "onion"], 95),
            ("kolhapur_coop", "Kolhapur Coop Society", "buyer5@demo.shetbhav.in", "Kolhapur", "cooperative", ["tomato", "onion"], 78),
        ]
        buyer_ids = []
        for uname, bname, email, dist, btype, crop_list, trust in buyer_data:
            u = User(username=uname, email=email, hashed_password=hash_password("demo123"),
                     full_name=bname, role=UserRole.BUYER)
            db.add(u)
            db.flush()
            p = BuyerProfile(
                user_id=u.id, business_name=bname, business_type=btype,
                district=dist, state="Maharashtra", required_crops=crop_list,
                verification_status=VerificationStatus.VERIFIED,
                trust_score=trust, completed_transactions=random.randint(20, 60),
                payment_delay_count=random.randint(0, 3),
                dispute_count=random.randint(0, 2),
                cancellation_count=random.randint(0, 1),
            )
            db.add(p)
            db.flush()
            # Derive successful_payments from completed_transactions (must be <=)
            p.successful_payments = max(0, p.completed_transactions - p.payment_delay_count - p.dispute_count - p.cancellation_count)
            db.flush()
            buyer_ids.append((u.id, p.id))

        # Admin user
        admin = User(username="admin", email="admin@shetbhav.in",
                    hashed_password=hash_password("demo123"),
                    full_name="Platform Admin", role=UserRole.ADMIN)
        db.add(admin)
        db.flush()
        db.add(AdminProfile(user_id=admin.id, department="Platform Operations"))

        # FPO demo user
        fpo_user = User(username="nashik_fpo", email="fpo@demo.shetbhav.in",
                       hashed_password=hash_password("demo123"),
                       full_name="Nashik Farmers Producer Organization", role=UserRole.FPO)
        db.add(fpo_user)
        db.flush()
        fpo_profile = FPOProfile(
            user_id=fpo_user.id,
            name="Nashik Farmers Producer Organization",
            registration_number="FPO-MH-2024-001",
            location_lat=20.01, location_lng=73.79,
            district="Nashik", state="Maharashtra",
            member_count=3,
        )
        db.add(fpo_profile)
        db.flush()

        # Add first 3 farmers as FPO members
        for uid, pid in farmer_ids[:3]:
            membership = FPOMembership(fpo_id=fpo_profile.id, farmer_id=pid)
            db.add(membership)

        # Demo farmer Ramesh's lot
        tomato_crop = db.query(Crop).filter(Crop.name == "Tomato").first()
        ramesh_farmer = db.query(FarmerProfile).filter(FarmerProfile.user_id == farmer_user.id).first()

        lot = ProduceLot(
            farmer_id=ramesh_farmer.id,
            crop_id=tomato_crop.id,
            quantity_kg=2000,
            quality_grade=QualityGrade.A,
            location_lat=20.0057,
            location_lng=73.7229,
            address="Village Pimpri, Nashik",
            harvest_date=datetime.utcnow() + timedelta(days=2),
            storage_available=True,
            urgency=UrgencyLevel.SOON,
            status="active",
        )
        db.add(lot)

        # Demo demand from ABC Foods
        demand = DemandRequest(
            buyer_id=buyer_ids[0][1],
            crop_id=tomato_crop.id,
            quantity_kg=5000,
            quality_grade=QualityGrade.A,
            required_by_date=datetime.utcnow() + timedelta(days=5),
            location_lat=18.52, location_lng=73.86,
            district="Pune",
            offered_price_per_q=2500,
            status="open",
        )
        db.add(demand)

        # Seed some historical prices
        for market in markets[:3]:
            for crop in crops:
                svc = MarketDataService()
                hist = svc.synthetic_provider.fetch_historical(market.name, crop.name, 90)
                for h in hist:
                    mp = MarketPrice(
                        market_id=market.id, crop_id=crop.id,
                        date=datetime.strptime(h["date"], "%Y-%m-%d"),
                        min_price=h["min_price"], max_price=h["max_price"],
                        modal_price=h["modal_price"], arrivals_qty=h["arrivals_qty"],
                        source="synthetic", data_source_type=DataSourceType.SYNTHETIC_DEMO,
                    )
                    db.add(mp)

        db.commit()
        print("[OK] Demo data seeded successfully")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Seeding error: {e}")
    finally:
        db.close()


# ── FPO Routes ────────────────────────────────────────────────────
@app.get("/fpo/dashboard")
def fpo_dashboard(
    user: User = Depends(require_role(UserRole.FPO)),
    db: Session = Depends(get_db),
):
    """FPO dashboard: members, aggregated lots, transactions."""
    fpo = db.query(FPOProfile).filter(FPOProfile.user_id == user.id).first()
    if not fpo:
        raise HTTPException(status_code=400, detail="FPO profile not found")
    members = db.query(FPOMembership).filter(
        FPOMembership.fpo_id == fpo.id, FPOMembership.is_active == True
    ).all()
    agg_lots = db.query(ProduceLot).filter(ProduceLot.fpo_id == fpo.id).all()
    orders = db.query(Order).filter(Order.farmer_id == fpo.id).all()  # FPO as seller
    return {
        "fpo_name": fpo.name,
        "district": fpo.district,
        "member_count": len(members),
        "total_lots": len(agg_lots),
        "active_lots": len([l for l in agg_lots if l.status == "active"]),
        "total_orders": len(orders),
        "completed_orders": len([o for o in orders if o.status == OrderStatus.COMPLETED]),
        "total_volume_kg": sum(l.quantity_kg for l in agg_lots),
    }


@app.get("/fpo/members")
def fpo_members(
    user: User = Depends(require_role(UserRole.FPO)),
    db: Session = Depends(get_db),
):
    """List FPO member farmers."""
    fpo = db.query(FPOProfile).filter(FPOProfile.user_id == user.id).first()
    if not fpo:
        return []
    memberships = db.query(FPOMembership).filter(
        FPOMembership.fpo_id == fpo.id, FPOMembership.is_active == True
    ).all()
    result = []
    for m in memberships:
        farmer = db.query(FarmerProfile).filter(FarmerProfile.id == m.farmer_id).first()
        if farmer:
            u = db.query(User).filter(User.id == farmer.user_id).first()
            lots = db.query(ProduceLot).filter(ProduceLot.farmer_id == farmer.id).all()
            result.append({
                "id": farmer.id,
                "name": u.full_name if u else "Unknown",
                "district": farmer.district,
                "farm_size_acres": farmer.farm_size_acres,
                "primary_crops": farmer.primary_crops or [],
                "total_lots": len(lots),
                "active_lots": len([l for l in lots if l.status == "active"]),
                "total_quantity_kg": sum(l.quantity_kg for l in lots),
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })
    return result


@app.get("/fpo/lots")
def fpo_lots(
    user: User = Depends(require_role(UserRole.FPO)),
    db: Session = Depends(get_db),
):
    """List FPO lots (aggregated and individual)."""
    fpo = db.query(FPOProfile).filter(FPOProfile.user_id == user.id).first()
    if not fpo:
        return []
    lots = db.query(ProduceLot).filter(ProduceLot.fpo_id == fpo.id).order_by(
        ProduceLot.created_at.desc()
    ).limit(50).all()
    results = []
    for lot in lots:
        crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
        items = db.query(LotItem).filter(LotItem.aggregated_lot_id == lot.id).all()
        results.append({
            "id": lot.id,
            "crop_name": crop.name if crop else "Unknown",
            "quantity_kg": lot.quantity_kg,
            "quality_grade": lot.quality_grade.value if lot.quality_grade else "unrated",
            "status": lot.status,
            "is_aggregated": lot.is_aggregated,
            "contributor_count": len(items),
            "created_at": lot.created_at.isoformat() if lot.created_at else None,
        })
    return results


@app.post("/fpo/aggregate")
def fpo_aggregate(
    lot_ids: List[int],
    target_quantity_kg: float,
    user: User = Depends(require_role(UserRole.FPO)),
    db: Session = Depends(get_db),
):
    from services.fpo_aggregation import aggregate_lots
    fpo_profile = db.query(FPOProfile).filter(FPOProfile.user_id == user.id).first()
    if not fpo_profile:
        raise HTTPException(status_code=400, detail="FPO profile not found")
    result = aggregate_lots(db, fpo_profile.id, lot_ids, target_quantity_kg)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Quality Grading Routes ──────────────────────────────────────────
@app.post("/quality/assess/{lot_id}")
def assess_quality(
    lot_id: int,
    image_url: Optional[str] = None,
    filepath: Optional[str] = None,
    override_grade: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.quality_grading import assess_quality as do_assess
    # Use filepath if provided (from upload), else fall back to image_url
    effective_path = filepath or image_url
    result = do_assess(db, lot_id, effective_path, override_grade)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/quality/upload/{lot_id}")
async def upload_quality_image(
    lot_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload image for quality grading."""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed. Use JPEG, PNG, or WebP.")
    # Validate file size (10MB max)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    # Verify lot exists
    lot = db.query(ProduceLot).filter(ProduceLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    # Save file
    import uuid
    file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"lot_{lot_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(contents)
    # Return URL + absolute filepath for AI analysis
    return {
        "url": f"/uploads/{filename}",
        "filepath": filepath,
        "filename": filename,
        "size_bytes": len(contents),
        "content_type": file.content_type,
    }


@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    """Serve uploaded files."""
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    filepath = os.path.join(upload_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)


@app.get("/quality/supported-crops")
def supported_crops():
    from services.quality_grading import get_supported_crops
    return {"supported_crops": get_supported_crops()}


# ── Logistics Routes ─────────────────────────────────────────────────
@app.get("/logistics/transport-estimate")
def transport_estimate(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    quantity_kg: float = Query(1000),
):
    from services.logistics import haversine_distance, estimate_transport_cost
    dist = haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    return estimate_transport_cost(dist, quantity_kg)


@app.get("/logistics/nearby-storage")
def nearby_storage(
    lat: float = Query(...),
    lng: float = Query(...),
    crop: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from services.logistics import find_nearest_storage
    return find_nearest_storage(db, lat, lng, crop or "")


@app.get("/logistics/route-consolidation")
def route_consolidation(
    delivery_lat: float = Query(...),
    delivery_lng: float = Query(...),
    db: Session = Depends(get_db),
):
    from services.logistics import consolidate_routes
    pickups = [
        {"name": "Farmer A", "lat": 20.01, "lng": 73.79},
        {"name": "Farmer B", "lat": 20.05, "lng": 73.75},
        {"name": "Farmer C", "lat": 19.99, "lng": 73.82},
    ]
    return consolidate_routes(pickups, delivery_lat, delivery_lng)


@app.get("/logistics/storage-decision")
def storage_decision(
    current_price: float = Query(...),
    future_price: float = Query(...),
    quantity_kg: float = Query(2000),
    days: int = Query(3),
    cost_per_q_per_day: float = Query(40),
):
    from services.logistics import estimate_storage_decision
    return estimate_storage_decision(current_price, future_price, quantity_kg, days, cost_per_q_per_day)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
