"""
ShetBhav Database Models — Complete Spec-Aligned Schema
All tables per spec §41 — relational PostgreSQL/SQLite compatible.
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, Index, Numeric, create_engine,
    UniqueConstraint, CheckConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# ── Enums ────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    FARMER = "farmer"
    FPO = "fpo"
    BUYER = "buyer"
    ADMIN = "admin"

class QualityGrade(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    UNRATED = "unrated"

class OrderStatus(str, enum.Enum):
    CREATED = "created"
    MATCHED = "matched"
    OFFER_RECEIVED = "offer_received"
    NEGOTIATING = "negotiating"
    ACCEPTED = "accepted"
    PICKUP_SCHEDULED = "pickup_scheduled"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    QUALITY_CONFIRMED = "quality_confirmed"
    PAYMENT_PENDING = "payment_pending"
    PAID = "paid"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"

class OfferStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COUNTERED = "countered"
    EXPIRED = "expired"

class GrievanceStatus(str, enum.Enum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    ACTION_REQUIRED = "action_required"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class GrievanceCategory(str, enum.Enum):
    WRONG_QUANTITY = "wrong_quantity"
    QUALITY_DISAGREEMENT = "quality_disagreement"
    PAYMENT_DELAYED = "payment_delayed"
    TRANSPORT_ISSUE = "transport_issue"
    BUYER_ISSUE = "buyer_issue"
    SELLER_ISSUE = "seller_issue"
    OTHER = "other"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class VerificationStatus(str, enum.Enum):
    VERIFIED = "verified"
    PENDING = "pending"
    REJECTED = "rejected"

class DataSourceType(str, enum.Enum):
    LIVE = "live"
    CACHED = "cached"
    SYNTHETIC = "synthetic"
    MANUAL = "manual"
    BUYER_OFFER = "buyer_offer"
    # Legacy aliases
    REAL = "real"
    SYNTHETIC_DEMO = "synthetic_demo"
    DERIVED = "derived"
    MODEL_PREDICTION = "model_prediction"

class UrgencyLevel(str, enum.Enum):
    URGENT = "urgent"
    SOON = "soon"
    FLEXIBLE = "flexible"

class AssessmentType(str, enum.Enum):
    SELF_DECLARED = "self_declared"
    AI_ASSISTED = "ai_assisted"
    MANUALLY_VERIFIED = "manually_verified"
    LAB_VERIFIED = "lab_verified"

class LotStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    MATCHED = "matched"
    OFFERED = "offered"
    SOLD = "sold"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


# ═══════════════════════════════════════════════════════════════════════
# USERS & PROFILES
# ═══════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    full_name = Column(String(200), nullable=False)
    phone = Column(String(20))
    language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    farmer_profile = relationship("FarmerProfile", back_populates="user", uselist=False)
    fpo_profile = relationship("FPOProfile", back_populates="user", uselist=False)
    buyer_profile = relationship("BuyerProfile", back_populates="user", uselist=False)
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")


class FarmerProfile(Base):
    __tablename__ = "farmer_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    farm_location_lat = Column(Float)
    farm_location_lng = Column(Float)
    farm_address = Column(String(500))
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    pincode = Column(String(10))
    farm_size_acres = Column(Float)
    primary_crops = Column(JSON)
    storage_available = Column(Boolean, default=False)
    # New spec fields
    aadhaar_last4 = Column(String(4))  # masked ID for verification
    bank_account_last4 = Column(String(4))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="farmer_profile")
    farms = relationship("Farm", back_populates="farmer")
    lots = relationship("ProduceLot", back_populates="farmer")


class Farm(Base):
    __tablename__ = "farms"
    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    name = Column(String(200))
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(String(500))
    area_acres = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    farmer = relationship("FarmerProfile", back_populates="farms")


class FPOProfile(Base):
    __tablename__ = "fpo_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    registration_number = Column(String(100))
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    member_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="fpo_profile")
    members = relationship("FPOMembership", back_populates="fpo")


class FPOMembership(Base):
    __tablename__ = "fpo_memberships"
    id = Column(Integer, primary_key=True, index=True)
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    fpo = relationship("FPOProfile", back_populates="members")
    farmer = relationship("FarmerProfile")


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String(200), nullable=False)
    business_type = Column(String(100))
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    required_crops = Column(JSON)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    trust_score = Column(Float, default=0.0)
    completed_transactions = Column(Integer, default=0)
    successful_payments = Column(Integer, default=0)
    payment_delay_count = Column(Integer, default=0)
    dispute_count = Column(Integer, default=0)
    cancellation_count = Column(Integer, default=0)
    # New spec fields
    average_payment_days = Column(Float, default=0.0)
    cancellation_rate = Column(Float, default=0.0)
    dispute_rate = Column(Float, default=0.0)
    payment_reliability_label = Column(String(50), default="Insufficient history")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="buyer_profile")


class AdminProfile(Base):
    __tablename__ = "admin_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="admin_profile")


# ═══════════════════════════════════════════════════════════════════════
# USER VERIFICATIONS
# ═══════════════════════════════════════════════════════════════════════

class UserVerification(Base):
    """Tracks verification documents submitted by users."""
    __tablename__ = "user_verifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = Column(String(50), nullable=False)  # aadhaar, pan, gst, license
    document_number = Column(String(100))
    document_url = Column(String(500))
    status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    verifier = relationship("User", foreign_keys=[verified_by])


# ═══════════════════════════════════════════════════════════════════════
# CROPS & VARIETIES
# ═══════════════════════════════════════════════════════════════════════

class Crop(Base):
    __tablename__ = "crops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    name_hi = Column(String(100))
    name_mr = Column(String(100))
    category = Column(String(100))
    unit = Column(String(20), default="kg")
    shelf_life_days = Column(Integer)
    supports_ai_grading = Column(Boolean, default=False)
    image_url = Column(String(500))


class CropVariety(Base):
    """Varieties within a crop (e.g., Tomato → Roma, Cherry, Beefsteak)."""
    __tablename__ = "crop_varieties"
    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    name = Column(String(100), nullable=False)
    name_hi = Column(String(100))
    description = Column(Text)
    growing_season = Column(String(100))
    shelf_life_days = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    crop = relationship("Crop")
    __table_args__ = (UniqueConstraint("crop_id", "name"),)


class QualityGradeConfig(Base):
    """Quality grade definitions per crop with structured parameters."""
    __tablename__ = "quality_grade_configs"
    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    grade = Column(Enum(QualityGrade), nullable=False)
    min_size_mm = Column(Float)
    max_size_mm = Column(Float)
    min_weight_g = Column(Float)
    color_min_hue = Column(Float)
    color_max_hue = Column(Float)
    max_blemish_pct = Column(Float)
    max_moisture_pct = Column(Float)
    description = Column(Text)
    description_hi = Column(Text)

    crop = relationship("Crop")
    __table_args__ = (UniqueConstraint("crop_id", "grade"),)


# ═══════════════════════════════════════════════════════════════════════
# MARKETS & PRICES
# ═══════════════════════════════════════════════════════════════════════

class Market(Base):
    """Mandis / APMC markets."""
    __tablename__ = "markets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True)
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    location_lat = Column(Float)
    location_lng = Column(Float)
    market_type = Column(String(50))
    is_active = Column(Boolean, default=True)


class MarketPrice(Base):
    """AGMARKNET-style market price records with full source tracking."""
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    # AGMARKNET fields
    state = Column(String(100))
    district = Column(String(100))
    market_name = Column(String(200))
    commodity = Column(String(100))
    variety = Column(String(100))
    grade = Column(String(50))
    arrival_date = Column(DateTime)
    min_price = Column(Float)
    max_price = Column(Float)
    modal_price = Column(Float)
    price_unit = Column(String(20), default="Rs/quintal")
    arrival_quantity = Column(Float)
    arrival_unit = Column(String(20), default="quintals")
    # Source tracking
    source_name = Column(String(100))
    source_url = Column(String(500))
    source_type = Column(String(50), default="synthetic")  # live/cached/synthetic/manual/buyer_offer
    fetched_at = Column(DateTime)
    # Import tracking
    imported_at = Column(DateTime)
    data_as_of = Column(DateTime)  # Date the data represents (not when imported)
    is_demo = Column(Boolean, default=False)
    # Legacy
    date = Column(DateTime, nullable=False)
    arrivals_qty = Column(Float)
    source = Column(String(50))
    data_source_type = Column(Enum(DataSourceType), default=DataSourceType.SYNTHETIC)
    created_at = Column(DateTime, default=datetime.utcnow)

    market = relationship("Market")
    crop = relationship("Crop")

    __table_args__ = (
        Index("ix_market_prices_lookup", "market_id", "crop_id", "date"),
        Index("ix_market_prices_crop_mandi_date", "crop_id", "market_id", "arrival_date"),
    )


class MarketDataSyncLog(Base):
    """Logs of data sync runs from external sources."""
    __tablename__ = "market_data_sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(200), nullable=False)
    source_url = Column(String(500))
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    status = Column(String(50))
    records_fetched = Column(Integer, default=0)
    records_stored = Column(Integer, default=0)
    error_message = Column(Text)


# ═══════════════════════════════════════════════════════════════════════
# FORECASTS
# ═══════════════════════════════════════════════════════════════════════

class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False)
    forecast_date = Column(DateTime, nullable=False)
    predicted_price = Column(Float)
    price_low = Column(Float)
    price_high = Column(Float)
    confidence = Column(Float)
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    crop = relationship("Crop")
    market = relationship("Market")

    __table_args__ = (
        Index("ix_forecasts_lookup", "crop_id", "market_id", "forecast_date"),
    )


# ═══════════════════════════════════════════════════════════════════════
# LOTS
# ═══════════════════════════════════════════════════════════════════════

class ProduceLot(Base):
    """Central business entity — a crop lot for sale."""
    __tablename__ = "produce_lots"
    __table_args__ = (
        Index("ix_lots_farmer_status", "farmer_id", "status"),
        Index("ix_lots_crop_status", "crop_id", "status"),
    )
    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"))
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    # New spec fields
    variety_id = Column(Integer, ForeignKey("crop_varieties.id"))
    quantity_kg = Column(Float, nullable=False)
    unit = Column(String(20), default="kg")
    quality_grade = Column(Enum(QualityGrade), default=QualityGrade.UNRATED)
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(String(500))
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    harvest_date = Column(DateTime)
    availability_date = Column(DateTime)
    expected_price_per_q = Column(Float)
    storage_available = Column(Boolean, default=False)
    storage_requirement = Column(String(200))
    urgency = Column(Enum(UrgencyLevel), default=UrgencyLevel.FLEXIBLE)
    is_aggregated = Column(Boolean, default=False)
    quality_status = Column(String(50), default="unrated")  # unrated/pending/verified/rejected
    status = Column(String(50), default="active")
    # How long this lot collects offers before the farmer is expected to act
    # on the best one so far — derived from `urgency` at creation time.
    offers_close_at = Column(DateTime)
    # True for a lightweight lot auto-created behind the scenes when a
    # farmer/FPO accepts or negotiates a buyer demand directly, with no lot
    # of their own — bookkeeping only, hidden from the farmer's own lot list.
    is_demand_offer = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    farmer = relationship("FarmerProfile", back_populates="lots")
    crop = relationship("Crop")
    variety = relationship("CropVariety")
    quality_assessments = relationship("QualityAssessment", back_populates="lot")
    photos = relationship("LotPhoto", back_populates="lot")


class LotMemberContribution(Base):
    """FPO aggregated lot — tracks individual farmer contributions."""
    __tablename__ = "lot_items"
    id = Column(Integer, primary_key=True, index=True)
    aggregated_lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    farmer_lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"))
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade))
    expected_payout = Column(Float)
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    aggregated_lot = relationship("ProduceLot", foreign_keys=[aggregated_lot_id])
    farmer_lot = relationship("ProduceLot", foreign_keys=[farmer_lot_id])


class LotPhoto(Base):
    """Photos uploaded for quality grading of a lot."""
    __tablename__ = "lot_photos"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    photo_url = Column(String(500), nullable=False)
    photo_type = Column(String(50))  # front, side, detail, stem
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("ProduceLot", back_populates="photos")


# ═══════════════════════════════════════════════════════════════════════
# QUALITY
# ═══════════════════════════════════════════════════════════════════════

class QualityAssessment(Base):
    """Quality reports — AI, manual, self-declared, lab verified."""
    __tablename__ = "quality_assessments"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    assessment_type = Column(String(50), default="ai_assisted")  # self_declared/ai_assisted/manually_verified/lab_verified
    assessed_by = Column(String(50))  # ai, buyer, admin, lab
    assessor_user_id = Column(Integer, ForeignKey("users.id"))
    grade = Column(Enum(QualityGrade))
    confidence = Column(Float)  # 0-1
    image_url = Column(String(500))
    # Structured quality parameters
    size_mm = Column(Float)
    weight_g = Column(Float)
    color_hue = Column(Float)
    blemish_pct = Column(Float)
    moisture_pct = Column(Float)
    freshness_score = Column(Float)
    uniformity_score = Column(Float)
    notes = Column(Text)
    report_file_url = Column(String(500))
    lab_report_url = Column(String(500))
    status = Column(String(50), default="draft")  # draft/accepted/corrected/verified
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lot = relationship("ProduceLot", back_populates="quality_assessments")
    revisions = relationship("QualityReportRevision", back_populates="assessment")


class QualityReportRevision(Base):
    """History of quality report corrections — never overwrite."""
    __tablename__ = "quality_report_revisions"
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("quality_assessments.id"), nullable=False)
    revised_by = Column(Integer, ForeignKey("users.id"))
    revision_type = Column(String(50))  # farmer_confirm/farmer_edit/admin_correct/lab_verify
    previous_grade = Column(String(10))
    new_grade = Column(String(10))
    previous_verification = Column(String(50))
    new_verification = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("QualityAssessment", back_populates="revisions")


class QualityObservation(Base):
    """Buyer quality observations after delivery."""
    __tablename__ = "quality_observations"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    observed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    grade = Column(Enum(QualityGrade))
    notes = Column(Text)
    photo_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# DEMANDS
# ═══════════════════════════════════════════════════════════════════════

class BuyerDemand(Base):
    """Buyer demand requests with structured requirements."""
    __tablename__ = "demand_requests"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    variety = Column(String(100))
    quantity_kg = Column(Float, nullable=False)
    unit = Column(String(20), default="kg")
    quality_grade = Column(Enum(QualityGrade))
    # Structured quality requirements
    min_size_mm = Column(Float)
    max_blemish_pct = Column(Float)
    color_requirement = Column(String(100))
    packaging_requirement = Column(String(200))
    payment_terms = Column(String(200))
    # Location & timing
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    delivery_location = Column(String(300))
    required_by_date = Column(DateTime)
    offered_price_per_q = Column(Float)
    # Status
    expiry_date = Column(DateTime)
    status = Column(String(50), default="open")  # open, partially_filled, filled, expired
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship("BuyerProfile")
    crop = relationship("Crop")

    __table_args__ = (
        Index("ix_buyer_demands_crop_status", "crop_id", "status", "required_by_date"),
    )


# ═══════════════════════════════════════════════════════════════════════
# LOT MATCHING
# ═══════════════════════════════════════════════════════════════════════

class DemandDismissal(Base):
    """A farmer/FPO's personal 'not interested' on a buyer demand — the demand
    stays open for everyone else, this just hides it from this user's own
    list going forward."""
    __tablename__ = "demand_dismissals"
    __table_args__ = (UniqueConstraint("demand_id", "user_id"),)
    id = Column(Integer, primary_key=True, index=True)
    demand_id = Column(Integer, ForeignKey("demand_requests.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LotMatch(Base):
    """Matches between lots and buyer demands."""
    __tablename__ = "lot_matches"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    demand_id = Column(Integer, ForeignKey("demand_requests.id"), nullable=False)
    match_score = Column(Float)  # 0-100
    quality_match = Column(Boolean, default=False)
    price_match = Column(Boolean, default=False)
    quantity_match = Column(Boolean, default=False)
    distance_km = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("ProduceLot")
    demand = relationship("BuyerDemand")


# ═══════════════════════════════════════════════════════════════════════
# OFFERS & NEGOTIATION
# ═══════════════════════════════════════════════════════════════════════

class Offer(Base):
    """Buyer offers on lots — must not overwrite on counter."""
    __tablename__ = "offers"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    demand_id = Column(Integer, ForeignKey("demand_requests.id"))
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    price_per_q = Column(Float, nullable=False)
    quantity_kg = Column(Float, nullable=False)
    delivery_date = Column(DateTime)
    delivery_terms = Column(String(200))
    payment_terms = Column(String(200))
    packaging_terms = Column(String(200))
    notes = Column(Text)
    status = Column(Enum(OfferStatus), default=OfferStatus.PENDING)
    negotiation_round = Column(Integer, default=1)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lot = relationship("ProduceLot")
    demand = relationship("BuyerDemand")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    history = relationship("CounterOffer", back_populates="offer", order_by="CounterOffer.created_at")

    __table_args__ = (
        Index("ix_offers_lot_status", "lot_id", "status"),
    )


class CounterOffer(Base):
    """Complete negotiation history — preserves every offer and counter-offer."""
    __tablename__ = "offer_history"
    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    round_number = Column(Integer, default=1)
    price_per_q = Column(Float)
    quantity_kg = Column(Float)
    delivery_date = Column(DateTime)
    delivery_terms = Column(String(200))
    payment_terms = Column(String(200))
    notes = Column(Text)
    action = Column(String(50), nullable=False)  # sent, countered, accepted, rejected
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    offer = relationship("Offer", back_populates="history")
    creator = relationship("User")


# ═══════════════════════════════════════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════════════════════════════════════

class Order(Base):
    """Separate from offers. Created when an offer is accepted."""
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    # A direct Book / Lock & Fulfil transaction still gets a lightweight,
    # already-ACCEPTED Offer row created under the hood (see app.main
    # book_lot / fulfil_demand) purely so this stays required — relaxing
    # NOT NULL on an existing SQLite column needs a full table rebuild,
    # which the additive-only auto-migration in config/database.py can't do.
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    # Set when an FPO (rather than an individual farmer) is the seller —
    # farmer_id still holds the FPO's representative contact farmer, same
    # convention services/fpo_aggregation.py already uses for ProduceLot.
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"), nullable=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    price_per_q = Column(Float, nullable=False)
    total_value = Column(Float, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.CREATED)
    delivery_date = Column(DateTime)
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    delivery_lat = Column(Float)
    delivery_lng = Column(Float)
    # If set and still unpaid past this time, the order is lazily cancelled
    # and its lot reverts to "active" so other buyers can book/offer on it
    # again — see app.main._expire_unpaid_orders. For an accepted negotiated
    # offer the farmer picks this window at accept time; direct book/fulfil
    # paths use a fixed default.
    payment_deadline = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    offer = relationship("Offer")
    farmer = relationship("FarmerProfile")
    buyer = relationship("BuyerProfile")
    crop = relationship("Crop")
    logistics = relationship("Logistics", back_populates="order", uselist=False)
    payment = relationship("Payment", back_populates="order", uselist=False)
    items = relationship("OrderItem", back_populates="order")
    events = relationship("OrderEvent", back_populates="order", order_by="OrderEvent.created_at")

    __table_args__ = (
        Index("ix_orders_buyer_seller_status", "buyer_id", "farmer_id", "status"),
    )


class OrderItem(Base):
    """FPO aggregated orders — individual farmer contributions."""
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    farmer_lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    price_per_q = Column(Float)
    payout_amount = Column(Float)

    order = relationship("Order", back_populates="items")
    farmer_lot = relationship("ProduceLot")
    farmer = relationship("FarmerProfile")


class OrderEvent(Base):
    """Timeline events for order tracking — 10 standard events."""
    __tablename__ = "order_events"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    metadata_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="events")
    user = relationship("User")

    __table_args__ = (
        Index("ix_order_events_order_time", "order_id", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════════════
# STORAGE
# ═══════════════════════════════════════════════════════════════════════

class StorageFacility(Base):
    __tablename__ = "storage_facilities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    capacity_quintal = Column(Float)
    available_capacity_quintal = Column(Float)
    cost_per_quintal_per_day = Column(Float)
    compatible_crops = Column(JSON)
    is_active = Column(Boolean, default=True)


class StorageQuote(Base):
    """Storage cost quotes for specific lots."""
    __tablename__ = "storage_quotes"
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("storage_facilities.id"), nullable=False)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    cost_per_quintal_per_day = Column(Float, nullable=False)
    estimated_days = Column(Integer)
    total_estimated_cost = Column(Float)
    available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    facility = relationship("StorageFacility")
    lot = relationship("ProduceLot")


# ═══════════════════════════════════════════════════════════════════════
# TRANSPORT
# ═══════════════════════════════════════════════════════════════════════

class Transporter(Base):
    __tablename__ = "transport_providers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    vehicle_type = Column(String(100))
    capacity_kg = Column(Float)
    cost_per_km = Column(Float)
    location_lat = Column(Float)
    location_lng = Column(Float)
    is_active = Column(Boolean, default=True)
    reliability_score = Column(Float, default=0.0)


class TransportQuote(Base):
    """Transport cost quotes for specific orders/lots."""
    __tablename__ = "transport_quotes"
    id = Column(Integer, primary_key=True, index=True)
    transporter_id = Column(Integer, ForeignKey("transport_providers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    lot_id = Column(Integer, ForeignKey("produce_lots.id"))
    origin_lat = Column(Float)
    origin_lng = Column(Float)
    dest_lat = Column(Float)
    dest_lng = Column(Float)
    distance_km = Column(Float)
    estimated_cost = Column(Float)
    estimated_duration_min = Column(Float)
    vehicle_type = Column(String(100))
    status = Column(String(50), default="quoted")  # quoted, accepted, in_transit, delivered
    created_at = Column(DateTime, default=datetime.utcnow)

    transporter = relationship("Transporter")
    order = relationship("Order")
    lot = relationship("ProduceLot")


class Logistics(Base):
    """Active transport for an order."""
    __tablename__ = "logistics"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    transport_provider_id = Column(Integer, ForeignKey("transport_providers.id"))
    route_distance_km = Column(Float)
    estimated_duration_min = Column(Float)
    estimated_cost = Column(Float)
    route_geometry = Column(JSON)
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    delivery_lat = Column(Float)
    delivery_lng = Column(Float)
    status = Column(String(50), default="scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="logistics")
    transport_provider = relationship("Transporter")


# ═══════════════════════════════════════════════════════════════════════
# PAYMENTS
# ═══════════════════════════════════════════════════════════════════════

class Payment(Base):
    """Payment records — simulated for MVP, clearly labelled."""
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_order_id", "order_id"),
        Index("ix_payments_status", "status"),
    )
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method = Column(String(50), default="simulated")
    transaction_ref = Column(String(200))
    due_date = Column(DateTime)
    paid_at = Column(DateTime)
    is_simulated = Column(Boolean, default=True)
    delay_warning = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="payment")


# ═══════════════════════════════════════════════════════════════════════
# GRIEVANCES
# ═══════════════════════════════════════════════════════════════════════

class Grievance(Base):
    __tablename__ = "grievances"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(Enum(GrievanceCategory), nullable=False)
    description = Column(Text, nullable=False)
    evidence_url = Column(String(500))
    status = Column(Enum(GrievanceStatus), default=GrievanceStatus.OPEN)
    admin_response = Column(Text)
    resolution = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order")
    user = relationship("User")

    __table_args__ = (
        Index("ix_grievances_order_status", "order_id", "status"),
    )


class GrievanceMessage(Base):
    """Threaded messages within a grievance."""
    __tablename__ = "grievance_messages"
    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    attachment_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    grievance = relationship("Grievance")
    sender = relationship("User")


class GrievanceStatusEvent(Base):
    """Audit trail of every status transition a grievance goes through."""
    __tablename__ = "grievance_status_events"
    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"), nullable=False)
    from_status = Column(Enum(GrievanceStatus))
    to_status = Column(Enum(GrievanceStatus), nullable=False)
    note = Column(Text)
    changed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    grievance = relationship("Grievance")
    user = relationship("User")

    __table_args__ = (
        Index("ix_grievance_status_events_grievance", "grievance_id", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════════════
# RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════

class RecommendationSnapshot(Base):
    """Preserves full Smart Sell recommendation for audit."""
    __tablename__ = "recommendation_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Input data snapshot
    input_crop_id = Column(Integer)
    input_quantity_kg = Column(Float)
    input_quality_grade = Column(String(10))
    input_location_lat = Column(Float)
    input_location_lng = Column(Float)
    input_urgency = Column(String(20))
    # Output
    best_option_type = Column(String(50))
    best_option_name = Column(String(200))
    score = Column(Float)
    confidence = Column(Float)
    confidence_label = Column(String(20))  # high/medium/low
    net_realization = Column(Float)
    gross_price = Column(Float)
    price_range_low = Column(Float)
    price_range_high = Column(Float)
    transport_cost = Column(Float)
    storage_cost = Column(Float)
    handling_cost = Column(Float)
    expected_loss = Column(Float)
    reasons = Column(JSON)
    risks = Column(JSON)
    assumptions = Column(JSON)
    all_options = Column(JSON)  # Full ranked list
    what_if_scenarios = Column(JSON)
    explanation = Column(Text)
    # Metadata
    data_source_dates = Column(JSON)
    model_version = Column(String(50))
    rule_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("ProduceLot")
    user = relationship("User")


# ═══════════════════════════════════════════════════════════════════════
# BUYER PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════

class BuyerPerformance(Base):
    """Tracks observed buyer behavior for trust scoring."""
    __tablename__ = "buyer_performance"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    payment_days = Column(Integer)
    was_delayed = Column(Boolean, default=False)
    was_disputed = Column(Boolean, default=False)
    was_cancelled = Column(Boolean, default=False)
    farmer_rating = Column(Float)  # 1-5 from farmer
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship("BuyerProfile")
    order = relationship("Order")


# ═══════════════════════════════════════════════════════════════════════
# NOTIFICATIONS & AUDIT
# ═══════════════════════════════════════════════════════════════════════

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50))
    is_read = Column(Boolean, default=False)
    link = Column(String(500))
    # Who this notification is about, if it's about a specific counterparty
    # (the other party in an offer/booking/order) — lets the frontend offer
    # a direct "View Profile" shortcut without re-deriving it from the link.
    counterparty_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    details = Column(JSON)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# ML & DATA SOURCES
# ═══════════════════════════════════════════════════════════════════════

class DataSource(Base):
    __tablename__ = "data_sources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    source_type = Column(Enum(DataSourceType))
    url = Column(String(500))
    description = Column(Text)
    last_sync_at = Column(DateTime)
    is_healthy = Column(Boolean, default=True)
    record_count = Column(Integer, default=0)


class DataSyncRun(Base):
    __tablename__ = "data_sync_runs"
    id = Column(Integer, primary_key=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    status = Column(String(50))
    records_fetched = Column(Integer, default=0)
    records_stored = Column(Integer, default=0)
    error_message = Column(Text)
    data_source = relationship("DataSource")


class MLModel(Base):
    __tablename__ = "ml_models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    version = Column(String(50), nullable=False)
    training_date = Column(DateTime)
    training_dataset = Column(Text)
    features = Column(JSON)
    evaluation_metrics = Column(JSON)
    prediction_horizon_days = Column(Integer)
    model_path = Column(String(500))
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════
# BACKWARD-COMPATIBLE ALIASES
# Existing code references old table names — map them to new models.
# ═══════════════════════════════════════════════════════════════════════

# Old name -> New model
LotItem = LotMemberContribution
OfferHistory = CounterOffer
TransportProvider = Transporter
DemandRequest = BuyerDemand
Recommendation = RecommendationSnapshot
