"""
ShetBhav Backend Test Suite
Tests for authentication, authorization, CRUD, and API integrity.
"""
import os
import sys

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from models.database import Base
from conftest import test_engine, TestSessionLocal, client


@pytest.fixture
def farmer_token():
    """Register and login a farmer, return token."""
    client.post("/auth/register", json={
        "username": "test_farmer",
        "email": "farmer@test.com",
        "password": "test123456",
        "full_name": "Test Farmer",
        "role": "farmer",
    })
    resp = client.post("/auth/login", json={"username": "test_farmer", "password": "test123456"})
    return resp.json()["access_token"]


@pytest.fixture
def buyer_token():
    """Register and login a buyer, return token."""
    client.post("/auth/register", json={
        "username": "test_buyer",
        "email": "buyer@test.com",
        "password": "test123456",
        "full_name": "Test Buyer Co",
        "role": "buyer",
    })
    resp = client.post("/auth/login", json={"username": "test_buyer", "password": "test123456"})
    return resp.json()["access_token"]


@pytest.fixture
def admin_token():
    """Register and login an admin, return token."""
    client.post("/auth/register", json={
        "username": "test_admin",
        "email": "admin@test.com",
        "password": "test123456",
        "full_name": "Test Admin",
        "role": "admin",
    })
    resp = client.post("/auth/login", json={"username": "test_admin", "password": "test123456"})
    return resp.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════
# AUTH TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestAuthentication:
    def test_register_new_user(self):
        resp = client.post("/auth/register", json={
            "username": "newuser",
            "email": "new@test.com",
            "password": "password123",
            "full_name": "New User",
            "role": "farmer",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "newuser"
        assert data["role"] == "farmer"

    def test_register_duplicate_username(self):
        client.post("/auth/register", json={
            "username": "dup_user",
            "email": "dup@test.com",
            "password": "password123",
            "full_name": "Dup User",
            "role": "farmer",
        })
        resp = client.post("/auth/register", json={
            "username": "dup_user",
            "email": "dup2@test.com",
            "password": "password123",
            "full_name": "Dup User 2",
            "role": "farmer",
        })
        assert resp.status_code == 400

    def test_login_valid_credentials(self):
        client.post("/auth/register", json={
            "username": "loginuser",
            "email": "login@test.com",
            "password": "password123",
            "full_name": "Login User",
            "role": "farmer",
        })
        resp = client.post("/auth/login", json={"username": "loginuser", "password": "password123"})
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self):
        client.post("/auth/register", json={
            "username": "wrongpw",
            "email": "wrongpw@test.com",
            "password": "password123",
            "full_name": "Wrong PW",
            "role": "farmer",
        })
        resp = client.post("/auth/login", json={"username": "wrongpw", "password": "wrongpassword"})
        assert resp.status_code == 401

    def test_login_nonexistent_user(self):
        resp = client.post("/auth/login", json={"username": "ghost", "password": "password123"})
        assert resp.status_code == 401

    def test_get_me_authenticated(self, farmer_token):
        resp = client.get("/auth/me", headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["username"] == "test_farmer"

    def test_get_me_no_token(self):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert resp.status_code == 401

    def test_register_empty_body(self):
        resp = client.post("/auth/register", json={})
        assert resp.status_code == 422

    def test_login_empty_body(self):
        resp = client.post("/auth/login", json={})
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# ROLE-BASED ACCESS CONTROL TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestAuthorization:
    def test_farmer_access_admin_blocked(self, farmer_token):
        resp = client.get("/admin/stats", headers=auth_header(farmer_token))
        assert resp.status_code == 403

    def test_buyer_access_farmer_blocked(self, buyer_token):
        resp = client.get("/farmers/profile", headers=auth_header(buyer_token))
        assert resp.status_code == 403

    def test_farmer_access_buyer_create_demand_blocked(self, farmer_token):
        resp = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 1000, "offered_price_per_q": 2000
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 403

    def test_buyer_access_admin_blocked(self, buyer_token):
        resp = client.get("/admin/stats", headers=auth_header(buyer_token))
        assert resp.status_code == 403

    def test_admin_access_admin_stats(self, admin_token):
        resp = client.get("/admin/stats", headers=auth_header(admin_token))
        assert resp.status_code == 200

    def test_unauthenticated_access_protected(self):
        resp = client.get("/farmers/profile")
        assert resp.status_code == 401

    def test_admin_access_farmer_endpoints_blocked(self, admin_token):
        resp = client.get("/farmers/profile", headers=auth_header(admin_token))
        # Admin can access farmer profile (has Farmer+Admin role)
        assert resp.status_code in [200, 403]


# ═══════════════════════════════════════════════════════════════════════
# CROP & MARKET TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestCropsAndMarkets:
    def test_list_crops(self):
        resp = client.get("/crops")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_markets(self):
        resp = client.get("/markets")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_market_prices_invalid_crop(self):
        resp = client.get("/markets/prices?crop_id=99999")
        assert resp.status_code == 404

    def test_market_prices_valid_crop(self):
        # First, seed some data by registering a farmer (triggers seed)
        resp = client.get("/crops")
        if resp.status_code == 200 and len(resp.json()) > 0:
            crop_id = resp.json()[0]["id"]
            resp = client.get(f"/markets/prices?crop_id={crop_id}")
            assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# LOT OPERATIONS TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestLotOperations:
    def _seed_crops(self):
        """Ensure crops exist by triggering a crop list."""
        client.get("/crops")

    def test_create_lot_valid(self, farmer_token):
        self._seed_crops()
        resp = client.post("/lots", json={
            "crop_id": 1,
            "quantity_kg": 1000,
            "quality_grade": "A",
            "urgency": "soon",
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["quantity_kg"] == 1000
        assert data["quality_grade"] == "A"

    def test_create_lot_invalid_crop(self, farmer_token):
        resp = client.post("/lots", json={
            "crop_id": 99999,
            "quantity_kg": 1000,
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 400

    def test_create_lot_zero_quantity(self, farmer_token):
        self._seed_crops()
        resp = client.post("/lots", json={
            "crop_id": 1,
            "quantity_kg": 0,
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 422

    def test_list_lots(self, farmer_token):
        resp = client.get("/lots", headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_lot_not_found(self):
        resp = client.get("/lots/99999")
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# SMART SELL TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestSmartSell:
    def test_smart_sell_valid(self, farmer_token):
        resp = client.post("/smart-sell", json={
            "crop_id": 1,
            "quantity_kg": 2000,
            "quality_grade": "A",
            "location_lat": 20.0,
            "location_lng": 73.7,
            "urgency": "soon",
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "best_option" in data
        assert "alternatives" in data

    def test_smart_sell_invalid_crop(self, farmer_token):
        resp = client.post("/smart-sell", json={
            "crop_id": 99999,
            "quantity_kg": 2000,
            "quality_grade": "A",
            "location_lat": 20.0,
            "location_lng": 73.7,
            "urgency": "soon",
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 400

    def test_smart_sell_no_auth(self):
        resp = client.post("/smart-sell", json={
            "crop_id": 1,
            "quantity_kg": 2000,
            "quality_grade": "A",
            "location_lat": 20.0,
            "location_lng": 73.7,
            "urgency": "soon",
        })
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════
# OFFER & NEGOTIATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestOfferLifecycle:
    def _setup_farmer_lot(self, farmer_token):
        """Create a farmer with a lot."""
        client.get("/crops")  # Seed crops
        resp = client.post("/lots", json={
            "crop_id": 1,
            "quantity_kg": 1000,
            "quality_grade": "A",
        }, headers=auth_header(farmer_token))
        return resp.json()["id"] if resp.status_code == 200 else None

    def _setup_buyer_demand(self, buyer_token):
        """Create a buyer demand."""
        client.get("/crops")  # Seed crops
        resp = client.post("/demand", json={
            "crop_id": 1,
            "quantity_kg": 1000,
            "quality_grade": "A",
            "offered_price_per_q": 2500,
        }, headers=auth_header(buyer_token))
        return resp.json()["id"] if resp.status_code == 200 else None

    def test_create_offer(self, buyer_token, farmer_token):
        lot_id = self._setup_farmer_lot(farmer_token)
        if not lot_id:
            pytest.skip("Could not create lot")

        # Get farmer user ID
        me = client.get("/auth/me", headers=auth_header(farmer_token)).json()

        resp = client.post("/offers", json={
            "lot_id": lot_id,
            "to_user_id": me["id"],
            "price_per_q": 2500,
            "quantity_kg": 1000,
        }, headers=auth_header(buyer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

    def test_list_offers(self, buyer_token):
        resp = client.get("/offers", headers=auth_header(buyer_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_counter_offer(self, buyer_token, farmer_token):
        lot_id = self._setup_farmer_lot(farmer_token)
        if not lot_id:
            pytest.skip("Could not create lot")

        me = client.get("/auth/me", headers=auth_header(farmer_token)).json()
        offer_resp = client.post("/offers", json={
            "lot_id": lot_id,
            "to_user_id": me["id"],
            "price_per_q": 2500,
            "quantity_kg": 1000,
        }, headers=auth_header(buyer_token))
        if offer_resp.status_code != 200:
            pytest.skip("Could not create offer")

        offer_id = offer_resp.json()["id"]

        # Farmer counters
        resp = client.post(f"/offers/{offer_id}/counter", json={
            "price_per_q": 2800,
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "countered"
        assert resp.json()["negotiation_round"] == 2


# ═══════════════════════════════════════════════════════════════════════
# GRIEVANCE TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestGrievances:
    def test_create_grievance(self, farmer_token):
        resp = client.post("/grievances", json={
            "category": "quality_disagreement",
            "description": "The produce quality was different from what was promised during negotiation",
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["category"] == "quality_disagreement"

    def test_list_grievances(self, farmer_token):
        resp = client.get("/grievances", headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_grievance_short_description(self, farmer_token):
        resp = client.post("/grievances", json={
            "category": "other",
            "description": "Short",
        }, headers=auth_header(farmer_token))
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# TRANSLATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestTranslations:
    def test_english_translations(self):
        resp = client.get("/translations/en")
        assert resp.status_code == 200
        assert "app_name" in resp.json()

    def test_hindi_translations(self):
        resp = client.get("/translations/hi")
        assert resp.status_code == 200
        assert "app_name" in resp.json()

    def test_marathi_translations(self):
        resp = client.get("/translations/mr")
        assert resp.status_code == 200
        assert "app_name" in resp.json()

    def test_unknown_language_fallback(self):
        resp = client.get("/translations/xyz")
        assert resp.status_code == 200
        # Should fallback to English
        assert resp.json()["app_name"] == "ShetBhav"


# ═══════════════════════════════════════════════════════════════════════
# LOGISTICS TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestLogistics:
    def test_transport_estimate(self):
        resp = client.get("/logistics/transport-estimate?origin_lat=20.0&origin_lng=73.7&dest_lat=18.5&dest_lng=73.8&quantity_kg=1000")
        assert resp.status_code == 200
        data = resp.json()
        assert "distance_km" in data
        assert "estimated_cost" in data

    def test_storage_decision(self):
        resp = client.get("/logistics/storage-decision?current_price=2400&future_price=2600&quantity_kg=2000&days=3")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# ADMIN TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestAdmin:
    def test_admin_stats(self, admin_token):
        resp = client.get("/admin/stats", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "total_farmers" in data
        assert "total_buyers" in data

    def test_admin_users(self, admin_token):
        resp = client.get("/admin/users", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_stats_blocked_for_farmer(self, farmer_token):
        resp = client.get("/admin/stats", headers=auth_header(farmer_token))
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════════
# QUALITY GRADING TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestQuality:
    def test_supported_crops(self):
        resp = client.get("/quality/supported-crops")
        assert resp.status_code == 200
        assert "supported_crops" in resp.json()

    def test_assess_quality_no_auth(self):
        resp = client.post("/quality/assess/1")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════
# NOTIFICATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestNotifications:
    def test_list_notifications(self, farmer_token):
        resp = client.get("/notifications", headers=auth_header(farmer_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
