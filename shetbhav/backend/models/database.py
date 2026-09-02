"""
ShetBhav Database Models
All tables as per spec §41 — relational PostgreSQL/SQLite schema.
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, Index, create_engine
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
    REAL = "real"
    SYNTHETIC_DEMO = "synthetic_demo"
    DERIVED = "derived"
    MODEL_PREDICTION = "model_prediction"

class UrgencyLevel(str, enum.Enum):
    URGENT = "urgent"         # within 1-2 days
    SOON = "soon"             # within 3-5 days
    FLEXIBLE = "flexible"     # can wait a week+

# ── Users & Profiles ────────────────────────────────────────────────
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
    notifications = relationship("Notification", back_populates="user")

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
    primary_crops = Column(JSON)  # ["tomato", "onion"]
    storage_available = Column(Boolean, default=False)
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
    business_type = Column(String(100))  # processor, retailer, wholesaler, exporter
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    required_crops = Column(JSON)  # ["tomato", "onion"]
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    trust_score = Column(Float, default=0.0)  # 0-100
    completed_transactions = Column(Integer, default=0)
    successful_payments = Column(Integer, default=0)
    payment_delay_count = Column(Integer, default=0)
    dispute_count = Column(Integer, default=0)
    cancellation_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="buyer_profile")

class AdminProfile(Base):
    __tablename__ = "admin_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="admin_profile")

# ── Crops ───────────────────────────────────────────────────────────
class Crop(Base):
    __tablename__ = "crops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    name_hi = Column(String(100))
    name_mr = Column(String(100))
    category = Column(String(100))  # vegetable, grain, oilseed
    unit = Column(String(20), default="kg")  # kg, quintal
    shelf_life_days = Column(Integer)
    supports_ai_grading = Column(Boolean, default=False)
    image_url = Column(String(500))

# ── Markets ──────────────────────────────────────────────────────────
class Market(Base):
    __tablename__ = "markets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True)
    district = Column(String(100))
    state = Column(String(100), default="Maharashtra")
    location_lat = Column(Float)
    location_lng = Column(Float)
    market_type = Column(String(50))  # APMC, private
    is_active = Column(Boolean, default=True)

class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, index=True)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    min_price = Column(Float)  # Rs per quintal
    max_price = Column(Float)
    modal_price = Column(Float)
    arrivals_qty = Column(Float)  # in quintals
    source = Column(String(50))  # agmarknet, synthetic
    data_source_type = Column(Enum(DataSourceType), default=DataSourceType.REAL)
    created_at = Column(DateTime, default=datetime.utcnow)

    market = relationship("Market")
    crop = relationship("Crop")

    __table_args__ = (
        Index("ix_market_prices_lookup", "market_id", "crop_id", "date"),
    )

# ── Produce Lots ─────────────────────────────────────────────────────
class ProduceLot(Base):
    __tablename__ = "produce_lots"
    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
    fpo_id = Column(Integer, ForeignKey("fpo_profiles.id"))
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade), default=QualityGrade.UNRATED)
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(String(500))
    harvest_date = Column(DateTime)
    storage_available = Column(Boolean, default=False)
    urgency = Column(Enum(UrgencyLevel), default=UrgencyLevel.FLEXIBLE)
    is_aggregated = Column(Boolean, default=False)
    status = Column(String(50), default="active")  # active, matched, sold, expired
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    farmer = relationship("FarmerProfile", back_populates="lots")
    crop = relationship("Crop")
    quality_assessments = relationship("QualityAssessment", back_populates="lot")

class LotItem(Base):
    """For FPO aggregated lots — tracks individual farmer contributions."""
    __tablename__ = "lot_items"
    id = Column(Integer, primary_key=True, index=True)
    aggregated_lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    farmer_lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade))
    expected_payout = Column(Float)

    aggregated_lot = relationship("ProduceLot", foreign_keys=[aggregated_lot_id])
    farmer_lot = relationship("ProduceLot", foreign_keys=[farmer_lot_id])

# ── Quality ──────────────────────────────────────────────────────────
class QualityAssessment(Base):
    __tablename__ = "quality_assessments"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    assessed_by = Column(String(50))  # ai, buyer, admin
    grade = Column(Enum(QualityGrade))
    confidence = Column(Float)  # 0-1
    image_url = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("ProduceLot", back_populates="quality_assessments")

# ── Storage ──────────────────────────────────────────────────────────
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
    compatible_crops = Column(JSON)  # ["tomato", "onion"]
    is_active = Column(Boolean, default=True)

# ── Transport ────────────────────────────────────────────────────────
class TransportProvider(Base):
    __tablename__ = "transport_providers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    vehicle_type = Column(String(100))  # truck, auto, pickup
    capacity_kg = Column(Float)
    cost_per_km = Column(Float)
    location_lat = Column(Float)
    location_lng = Column(Float)
    is_active = Column(Boolean, default=True)
    reliability_score = Column(Float, default=0.0)

# ── Demand ───────────────────────────────────────────────────────────
class DemandRequest(Base):
    __tablename__ = "demand_requests"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade))
    required_by_date = Column(DateTime)
    location_lat = Column(Float)
    location_lng = Column(Float)
    district = Column(String(100))
    offered_price_per_q = Column(Float)  # Rs per quintal
    status = Column(String(50), default="open")  # open, partially_filled, filled, expired
    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship("BuyerProfile")
    crop = relationship("Crop")

# ── Offers ───────────────────────────────────────────────────────────
class Offer(Base):
    __tablename__ = "offers"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    demand_id = Column(Integer, ForeignKey("demand_requests.id"))
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    price_per_q = Column(Float, nullable=False)
    quantity_kg = Column(Float, nullable=False)
    delivery_date = Column(DateTime)
    status = Column(Enum(OfferStatus), default=OfferStatus.PENDING)
    negotiation_round = Column(Integer, default=1)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lot = relationship("ProduceLot")
    demand = relationship("DemandRequest")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    history = relationship("OfferHistory", back_populates="offer")

class OfferHistory(Base):
    __tablename__ = "offer_history"
    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    price_per_q = Column(Float)
    quantity_kg = Column(Float)
    action = Column(String(50))  # sent, countered, accepted, rejected
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    offer = relationship("Offer", back_populates="history")

# ── Orders ───────────────────────────────────────────────────────────
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmer_profiles.id"), nullable=False)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    offer = relationship("Offer")
    farmer = relationship("FarmerProfile")
    buyer = relationship("BuyerProfile")
    crop = relationship("Crop")
    logistics = relationship("Logistics", back_populates="order", uselist=False)
    payment = relationship("Payment", back_populates="order", uselist=False)
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    """For FPO aggregated orders — individual farmer contributions."""
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

# ── Logistics ────────────────────────────────────────────────────────
class Logistics(Base):
    __tablename__ = "logistics"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    transport_provider_id = Column(Integer, ForeignKey("transport_providers.id"))
    route_distance_km = Column(Float)
    estimated_duration_min = Column(Float)
    estimated_cost = Column(Float)
    route_geometry = Column(JSON)  # GeoJSON line
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    delivery_lat = Column(Float)
    delivery_lng = Column(Float)
    status = Column(String(50), default="scheduled")  # scheduled, in_transit, delivered
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="logistics")
    transport_provider = relationship("TransportProvider")

# ── Payments ─────────────────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method = Column(String(50), default="simulated")
    transaction_ref = Column(String(200))
    paid_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="payment")

# ── Grievances ───────────────────────────────────────────────────────
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

# ── Forecasts ────────────────────────────────────────────────────────
class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False)
    forecast_date = Column(DateTime, nullable=False)
    predicted_price = Column(Float)
    price_low = Column(Float)
    price_high = Column(Float)
    confidence = Column(Float)  # 0-1
    model_version = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    crop = relationship("Crop")
    market = relationship("Market")

    __table_args__ = (
        Index("ix_forecasts_lookup", "crop_id", "market_id", "forecast_date"),
    )

# ── Recommendations ──────────────────────────────────────────────────
class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("produce_lots.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float)  # 0-100
    recommendation_type = Column(String(50))  # buyer, market, storage
    target_id = Column(Integer)  # buyer_id or market_id
    target_type = Column(String(50))  # buyer, market, storage
    net_realization = Column(Float)
    gross_price = Column(Float)
    transport_cost = Column(Float)
    storage_cost = Column(Float)
    expected_loss = Column(Float)
    reasons = Column(JSON)  # ["Strong demand", "Good price", ...]
    risks = Column(JSON)  # ["Forecast confidence moderate", ...]
    confidence = Column(Float)
    sale_window_days = Column(Integer)
    data_source_labels = Column(JSON)  # per-field source labels
    created_at = Column(DateTime, default=datetime.utcnow)

    lot = relationship("ProduceLot")
    user = relationship("User")

# ── Notifications ────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50))  # offer, order, payment, grievance, market
    is_read = Column(Boolean, default=False)
    link = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

# ── Audit Log ────────────────────────────────────────────────────────
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

# ── Data Source Tracking ─────────────────────────────────────────────
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
    status = Column(String(50))  # running, success, failed
    records_fetched = Column(Integer, default=0)
    records_stored = Column(Integer, default=0)
    error_message = Column(Text)

    data_source = relationship("DataSource")

# ── ML Model Metadata ───────────────────────────────────────────────
class MLModel(Base):
    __tablename__ = "ml_models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    version = Column(String(50), nullable=False)
    training_date = Column(DateTime)
    training_dataset = Column(Text)
    features = Column(JSON)
    evaluation_metrics = Column(JSON)  # {mae, rmse, mape}
    prediction_horizon_days = Column(Integer)
    model_path = Column(String(500))
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
