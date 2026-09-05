"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from models.database import (
    UserRole, QualityGrade, OrderStatus, OfferStatus,
    GrievanceStatus, GrievanceCategory, PaymentStatus,
    VerificationStatus, UrgencyLevel, DataSourceType
)

# ── Auth ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, pattern=r"^\d{10}$")
    role: UserRole
    language: str = "en"

# ── User ─────────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    language: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CounterpartyProfileResponse(BaseModel):
    """What a user sees when viewing someone they're transacting with —
    name/role/contact plus whatever role-specific business info applies.
    Never includes email or credentials."""
    id: int
    username: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    # Buyer
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    trust_score: Optional[float] = None
    verification_status: Optional[str] = None
    completed_transactions: Optional[int] = None
    # FPO
    fpo_name: Optional[str] = None
    member_count: Optional[int] = None
    # Shared location fields (farmer/buyer/FPO)
    district: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True

class FarmerProfileCreate(BaseModel):
    farm_location_lat: Optional[float] = None
    farm_location_lng: Optional[float] = None
    farm_address: Optional[str] = None
    district: Optional[str] = None
    state: str = "Maharashtra"
    pincode: Optional[str] = None
    farm_size_acres: Optional[float] = None
    primary_crops: Optional[List[str]] = None
    storage_available: bool = False

class FarmerProfileResponse(BaseModel):
    id: int
    user_id: int
    farm_location_lat: Optional[float] = None
    farm_location_lng: Optional[float] = None
    farm_address: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    farm_size_acres: Optional[float] = None
    primary_crops: Optional[list] = None
    storage_available: bool

    class Config:
        from_attributes = True

class BuyerProfileCreate(BaseModel):
    business_name: str
    business_type: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    district: Optional[str] = None
    state: str = "Maharashtra"
    required_crops: Optional[List[str]] = None

class BuyerProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

class BuyerProfileResponse(BaseModel):
    id: int
    user_id: int
    business_name: str
    business_type: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    required_crops: Optional[list] = None
    verification_status: VerificationStatus
    trust_score: float
    completed_transactions: int
    successful_payments: int

    class Config:
        from_attributes = True

# ── Crop ─────────────────────────────────────────────────────────────
class CropResponse(BaseModel):
    id: int
    name: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    category: Optional[str] = None
    unit: str
    supports_ai_grading: bool

    class Config:
        from_attributes = True

# ── Market ───────────────────────────────────────────────────────────
class MarketResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

    class Config:
        from_attributes = True

class MarketPriceResponse(BaseModel):
    id: int
    market_id: int
    crop_id: int
    date: datetime
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    modal_price: Optional[float] = None
    arrivals_qty: Optional[float] = None
    source: Optional[str] = None
    data_source_type: DataSourceType

    class Config:
        from_attributes = True

class MarketPriceOverview(BaseModel):
    crop: CropResponse
    current_price: float
    min_price: float
    max_price: float
    price_trend: str  # up, down, stable
    trend_pct: float
    forecast_range: Optional[tuple[float, float]] = None
    recommendation: Optional[str] = None
    data_source: DataSourceType
    last_updated: datetime

# ── Produce Lot ──────────────────────────────────────────────────────
class ProduceLotCreate(BaseModel):
    crop_id: int
    quantity_kg: float = Field(gt=0)
    price_per_q: float = Field(gt=0)
    quality_grade: QualityGrade = QualityGrade.UNRATED
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    address: Optional[str] = None
    harvest_date: Optional[datetime] = None
    storage_available: bool = False
    urgency: UrgencyLevel = UrgencyLevel.FLEXIBLE

class ProduceLotResponse(BaseModel):
    id: int
    farmer_id: int
    farmer_user_id: Optional[int] = None
    farmer_username: Optional[str] = None
    farmer_name: Optional[str] = None
    fpo_id: Optional[int] = None
    fpo_user_id: Optional[int] = None
    fpo_name: Optional[str] = None
    crop_id: int
    crop_name: Optional[str] = None
    quantity_kg: float
    price_per_q: Optional[float] = None
    quality_grade: QualityGrade
    address: Optional[str] = None
    harvest_date: Optional[datetime] = None
    storage_available: bool
    urgency: UrgencyLevel
    status: str
    offers_close_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class FulfilDemandRequest(BaseModel):
    lot_id: int

# ── Demand ───────────────────────────────────────────────────────────
class DemandRequestCreate(BaseModel):
    crop_id: int
    quantity_kg: float = Field(gt=0)
    quality_grade: Optional[QualityGrade] = None
    required_by_date: Optional[datetime] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    district: Optional[str] = None
    offered_price_per_q: float = Field(gt=0)

class DemandRequestResponse(BaseModel):
    id: int
    buyer_id: int
    buyer_user_id: Optional[int] = None
    buyer_username: Optional[str] = None
    crop_id: int
    crop_name: Optional[str] = None
    buyer_name: Optional[str] = None
    quantity_kg: float
    quality_grade: Optional[QualityGrade] = None
    required_by_date: Optional[datetime] = None
    district: Optional[str] = None
    offered_price_per_q: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# ── Offers ───────────────────────────────────────────────────────────
class OfferCreate(BaseModel):
    lot_id: Optional[int] = None
    demand_id: Optional[int] = None
    to_user_id: Optional[int] = None  # Resolved from lot if not provided
    price_per_q: float = Field(gt=0)
    quantity_kg: float = Field(gt=0)
    delivery_date: Optional[datetime] = None
    notes: Optional[str] = None

class OfferCounter(BaseModel):
    price_per_q: float = Field(gt=0)
    notes: Optional[str] = None

class OfferAccept(BaseModel):
    # Hours the buyer has to pay before this order is auto-cancelled and the
    # lot becomes available again. Farmer-chosen at accept time; a sane
    # default applies if omitted.
    payment_window_hours: Optional[int] = Field(default=None, gt=0, le=168)

class OfferResponse(BaseModel):
    id: int
    lot_id: int
    demand_id: Optional[int] = None
    from_user_id: int
    to_user_id: int
    price_per_q: float
    quantity_kg: float
    delivery_date: Optional[datetime] = None
    status: OfferStatus
    negotiation_round: int
    notes: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    # Enrichment (populated by list/detail endpoints only — see
    # _offer_to_response in app.main) so the UI can show the lot's crop and
    # counterparty without a second round-trip.
    crop_name: Optional[str] = None
    quality_grade: Optional[str] = None
    lot_address: Optional[str] = None
    farmer_name: Optional[str] = None

    class Config:
        from_attributes = True

# ── Orders ───────────────────────────────────────────────────────────
class OrderResponse(BaseModel):
    id: int
    offer_id: Optional[int] = None
    farmer_id: int
    fpo_id: Optional[int] = None
    buyer_id: int
    crop_id: int
    quantity_kg: float
    price_per_q: float
    total_value: float
    status: OrderStatus
    delivery_date: Optional[datetime] = None
    payment_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Enrichment (populated by list/detail endpoints only — see
    # _order_to_response in app.main) so the UI can show the lot's crop and
    # counterparty without a second round-trip.
    crop_name: Optional[str] = None
    quality_grade: Optional[str] = None
    address: Optional[str] = None
    farmer_name: Optional[str] = None
    buyer_name: Optional[str] = None

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

# ── Logistics ────────────────────────────────────────────────────────
class LogisticsResponse(BaseModel):
    id: int
    order_id: int
    route_distance_km: Optional[float] = None
    estimated_duration_min: Optional[float] = None
    estimated_cost: Optional[float] = None
    route_geometry: Optional[dict] = None
    status: str

    class Config:
        from_attributes = True

# ── Payments ─────────────────────────────────────────────────────────
class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    status: PaymentStatus
    payment_method: str
    transaction_ref: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ── Grievances ───────────────────────────────────────────────────────
class GrievanceCreate(BaseModel):
    order_id: Optional[int] = None
    category: GrievanceCategory
    description: str = Field(min_length=10)
    evidence_url: Optional[str] = None

class GrievanceResponse(BaseModel):
    id: int
    order_id: Optional[int] = None
    user_id: int
    category: GrievanceCategory
    description: str
    status: GrievanceStatus
    admin_response: Optional[str] = None
    resolution: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GrievanceResolution(BaseModel):
    status: GrievanceStatus
    admin_response: str
    resolution: Optional[str] = None

class GrievanceStatusEventResponse(BaseModel):
    id: int
    from_status: Optional[GrievanceStatus] = None
    to_status: GrievanceStatus
    note: Optional[str] = None
    changed_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ── Storage ──────────────────────────────────────────────────────────
class StorageFacilityResponse(BaseModel):
    id: int
    name: str
    district: Optional[str] = None
    capacity_quintal: Optional[float] = None
    available_capacity_quintal: Optional[float] = None
    cost_per_quintal_per_day: Optional[float] = None
    compatible_crops: Optional[list] = None

    class Config:
        from_attributes = True

# ── Forecast ─────────────────────────────────────────────────────────
class ForecastResponse(BaseModel):
    crop_id: int
    market_id: int
    forecast_date: datetime
    predicted_price: float
    price_low: float
    price_high: float
    confidence: float
    model_version: str

    class Config:
        from_attributes = True

# ── Smart Sell ───────────────────────────────────────────────────────
class SmartSellRequest(BaseModel):
    crop_id: int
    quantity_kg: float
    quality_grade: QualityGrade = QualityGrade.A
    location_lat: float
    location_lng: float
    harvest_date: Optional[datetime] = None
    storage_available: bool = False
    urgency: UrgencyLevel = UrgencyLevel.FLEXIBLE

class SellOption(BaseModel):
    option_type: str  # buyer, market, storage_sell_later
    target_id: Optional[int] = None
    target_name: str
    score: float  # 0-100
    gross_price_per_q: float
    transport_cost_per_q: float
    storage_cost_per_q: float
    expected_loss_per_q: float
    net_realization_per_q: float
    sale_window_days: int
    confidence: float
    reasons: List[str]
    risks: List[str]
    data_labels: dict  # {field: source_type}

class SmartSellResponse(BaseModel):
    lot_summary: dict
    best_option: SellOption
    alternatives: List[SellOption]
    what_if_scenarios: List[dict]
    explanation: str

# ── Notifications ────────────────────────────────────────────────────
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: Optional[str] = None
    is_read: bool
    link: Optional[str] = None
    counterparty_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ── Admin ────────────────────────────────────────────────────────────
class AdminDashboardStats(BaseModel):
    total_farmers: int
    total_fpos: int
    total_buyers: int
    verified_buyers: int
    active_lots: int
    active_demand: int
    completed_transactions: int
    total_volume_kg: float
    avg_farmer_realization: float
    transaction_success_rate: float
    payment_completion_rate: float
    dispute_rate: float
    open_grievances: int

class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    verification_status: Optional[VerificationStatus] = None
