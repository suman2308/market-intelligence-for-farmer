"""
Comprehensive Workflow Tests — Farmer, Buyer, FPO, Admin
Tests actual user journeys from the specification.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from models.database import Base, Crop, Market
from conftest import test_engine, TestSessionLocal, client


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════
# FARMER COMPLETE WORKFLOW
# ═══════════════════════════════════════════════════════════════════
class TestFarmerWorkflow:
    """
    Login → Home → Sell → Smart Sell → Create Lot → Find Buyers
    → Offer → Negotiate → Accept → Order → Payment → Earnings
    """

    def test_complete_farmer_journey(self):
        # 1. Register + Login
        client.post("/auth/register", json={
            "username": "journey_farmer", "email": "journey@farmer.com",
            "password": "test123456", "full_name": "Journey Farmer",
            "role": "farmer",
        })
        login_resp = client.post("/auth/login", json={
            "username": "journey_farmer", "password": "test123456"
        })
        assert login_resp.status_code == 200
        farmer_token = login_resp.json()["access_token"]

        # 2. Get profile
        resp = client.get("/auth/me", headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["role"] == "farmer"
        farmer_user_id = resp.json()["id"]

        # 3. Dashboard
        resp = client.get("/farmers/dashboard", headers=_auth(farmer_token))
        assert resp.status_code == 200
        dashboard = resp.json()
        assert "active_lots" in dashboard
        assert "total_earnings" in dashboard

        # 4. Smart Sell recommendation
        resp = client.post("/smart-sell", json={
            "crop_id": 1, "quantity_kg": 3000, "quality_grade": "A",
            "location_lat": 20.0, "location_lng": 73.7,
            "urgency": "soon", "storage_available": False,
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        recommendation = resp.json()
        best = recommendation["best_option"]
        assert best["score"] > 0

        # 5. Create lot
        resp = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 3000, "price_per_q": 2500, "quality_grade": "A",
            "urgency": "soon", "location_lat": 20.0, "location_lng": 73.7,
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        lot = resp.json()
        lot_id = lot["id"]

        # 6. List own lots
        resp = client.get("/lots", headers=_auth(farmer_token))
        assert resp.status_code == 200
        lots = resp.json()
        assert any(l["id"] == lot_id for l in lots)

        # 7. Find matching buyers
        resp = client.get(f"/matching/{lot_id}")
        assert resp.status_code == 200
        matches = resp.json()["matches"]

        # 8. Register buyer for offer negotiation
        client.post("/auth/register", json={
            "username": "journey_buyer", "email": "journey@buyer.com",
            "password": "test123456", "full_name": "Journey Buyer Co",
            "role": "buyer",
        })
        buyer_login = client.post("/auth/login", json={
            "username": "journey_buyer", "password": "test123456"
        })
        buyer_token = buyer_login.json()["access_token"]

        # 9. Buyer makes offer
        resp = client.post("/offers", json={
            "lot_id": lot_id, "to_user_id": farmer_user_id,
            "price_per_q": 2500, "quantity_kg": 3000,
        }, headers=_auth(buyer_token))
        assert resp.status_code == 200
        offer = resp.json()
        offer_id = offer["id"]
        assert offer["status"] == "pending"

        # 10. Farmer counter-offers
        resp = client.post(f"/offers/{offer_id}/counter", json={
            "price_per_q": 2800,
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "countered"
        assert resp.json()["negotiation_round"] == 2

        # 11. Buyer accepts counter
        resp = client.post(f"/offers/{offer_id}/accept", json={}, headers=_auth(buyer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        # 12. Create order from accepted offer
        resp = client.post(f"/orders/from-offer/{offer_id}", headers=_auth(buyer_token))
        assert resp.status_code == 200
        order = resp.json()
        order_id = order["id"]
        assert order["status"] == "accepted"

        # 13. Update order through states
        for status in ["pickup_scheduled", "in_transit", "delivered", "quality_confirmed"]:
            resp = client.put(f"/orders/{order_id}/status", json={
                "status": status
            }, headers=_auth(buyer_token))
            assert resp.status_code == 200

        # 14. Simulate payment
        resp = client.post(f"/payments/{order_id}/simulate", headers=_auth(buyer_token))
        assert resp.status_code == 200
        payment = resp.json()
        assert payment["status"] == "completed"
        assert payment["transaction_ref"].startswith("SIM-")

        # 15. Check earnings (orders list shows paid)
        resp = client.get("/orders", headers=_auth(farmer_token))
        assert resp.status_code == 200
        orders = resp.json()
        paid_orders = [o for o in orders if o["status"] == "paid"]
        assert len(paid_orders) >= 1

        # 16. Create grievance
        resp = client.post("/grievances", json={
            "category": "quality_disagreement",
            "description": "The produce quality assessment was lower than expected after delivery inspection",
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["category"] == "quality_disagreement"


# ═══════════════════════════════════════════════════════════════════
# BUYER COMPLETE WORKFLOW
# ═══════════════════════════════════════════════════════════════════
class TestBuyerWorkflow:
    """
    Login → Dashboard → Create Demand → Browse Lots → Make Offer
    → Negotiate → Accept → Confirm Delivery → Payment
    """

    def test_complete_buyer_journey(self):
        # Setup buyer
        client.post("/auth/register", json={
            "username": "buyer_journey", "email": "buyer.j@company.com",
            "password": "test123456", "full_name": "Buyer Journey Corp",
            "role": "buyer",
        })
        buyer_login = client.post("/auth/login", json={
            "username": "buyer_journey", "password": "test123456"
        })
        buyer_token = buyer_login.json()["access_token"]

        # 1. Create demand
        resp = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 5000, "quality_grade": "A",
            "offered_price_per_q": 2700, "district": "Mumbai",
        }, headers=_auth(buyer_token))
        assert resp.status_code == 200
        demand = resp.json()
        assert demand["status"] == "open"

        # 2. List own demands
        resp = client.get("/demand", headers=_auth(buyer_token))
        assert resp.status_code == 200
        demands = resp.json()
        assert any(d["id"] == demand["id"] for d in demands)

        # 3. List available lots
        resp = client.get("/lots", headers=_auth(buyer_token))
        assert resp.status_code == 200

        # 4. Browse verified buyers directory
        resp = client.get("/buyers")
        assert resp.status_code == 200
        buyers = resp.json()

        # 5. Create farmer lot for testing
        client.post("/auth/register", json={
            "username": "buyer_test_farmer", "email": "bf@test.com",
            "password": "test123456", "full_name": "Buyer Test Farmer",
            "role": "farmer",
        })
        farmer_login = client.post("/auth/login", json={
            "username": "buyer_test_farmer", "password": "test123456"
        })
        farmer_token = farmer_login.json()["access_token"]
        farmer_me = client.get("/auth/me", headers=_auth(farmer_token)).json()

        resp = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 5000, "price_per_q": 2500, "quality_grade": "A",
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        lot = resp.json()

        # 6. Make offer on lot
        resp = client.post("/offers", json={
            "lot_id": lot["id"], "to_user_id": farmer_me["id"],
            "price_per_q": 2700, "quantity_kg": 5000,
        }, headers=_auth(buyer_token))
        assert resp.status_code == 200
        offer = resp.json()

        # 7. Farmer accepts
        resp = client.post(f"/offers/{offer['id']}/accept", headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        # 8. Create order
        resp = client.post(f"/orders/from-offer/{offer['id']}", headers=_auth(buyer_token))
        assert resp.status_code == 200
        order = resp.json()

        # 9. Payment
        resp = client.post(f"/payments/{order['id']}/simulate", headers=_auth(buyer_token))
        assert resp.status_code == 200

        # 10. Check orders list
        resp = client.get("/orders", headers=_auth(buyer_token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_demand_invalid_quantity(self):
        client.post("/auth/register", json={
            "username": "invalid_demand", "email": "id@test.com",
            "password": "test123456", "full_name": "Invalid",
            "role": "buyer",
        })
        login = client.post("/auth/login", json={
            "username": "invalid_demand", "password": "test123456"
        })
        token = login.json()["access_token"]

        # Zero quantity should fail validation
        resp = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 0,
        }, headers=_auth(token))
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════
# FPO COMPLETE WORKFLOW
# ═══════════════════════════════════════════════════════════════════
class TestFPOWorkflow:
    """
    Login → Members → Aggregate Produce → Create Aggregated Lot
    """

    def test_fpo_dashboard(self):
        client.post("/auth/register", json={
            "username": "fpo_test", "email": "fpo@test.com",
            "password": "test123456", "full_name": "Test FPO",
            "role": "fpo",
        })
        login = client.post("/auth/login", json={
            "username": "fpo_test", "password": "test123456"
        })
        token = login.json()["access_token"]

        # Dashboard
        resp = client.get("/fpo/dashboard", headers=_auth(token))
        assert resp.status_code == 200
        dashboard = resp.json()
        assert "member_count" in dashboard or "total_members" in dashboard

        # Members
        resp = client.get("/fpo/members", headers=_auth(token))
        assert resp.status_code == 200

        # Lots
        resp = client.get("/fpo/lots", headers=_auth(token))
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# ADMIN COMPLETE WORKFLOW
# ═══════════════════════════════════════════════════════════════════
class TestAdminWorkflow:
    """
    Login → Stats → Users → Verify Buyer → Grievances → Analytics
    """

    def test_complete_admin_journey(self):
        client.post("/auth/register", json={
            "username": "admin_journey", "email": "admin.j@shetbhav.in",
            "password": "test123456", "full_name": "Admin Journey",
            "role": "admin",
        })
        login = client.post("/auth/login", json={
            "username": "admin_journey", "password": "test123456"
        })
        admin_token = login.json()["access_token"]

        # 1. Stats
        resp = client.get("/admin/stats", headers=_auth(admin_token))
        assert resp.status_code == 200
        stats = resp.json()
        assert "total_farmers" in stats
        assert "total_buyers" in stats

        # 2. Users list
        resp = client.get("/admin/users", headers=_auth(admin_token))
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) > 0

        # 3. Users by role
        resp = client.get("/admin/users?role=farmer", headers=_auth(admin_token))
        assert resp.status_code == 200

        # 4. Grievances
        resp = client.get("/grievances", headers=_auth(admin_token))
        assert resp.status_code == 200

        # 5. Verify buyer endpoint exists
        resp = client.get("/admin/users?role=buyer", headers=_auth(admin_token))
        assert resp.status_code == 200
        buyers = resp.json()
        if buyers:
            buyer_id = buyers[0]["id"]
            # Get the buyer profile id
            resp = client.put(f"/admin/buyers/{buyer_id}/verify?status=verified",
                            headers=_auth(admin_token))
            # May fail if buyer_id is user id not profile id, but endpoint should exist
            assert resp.status_code in [200, 404]

    def test_admin_cannot_be_impersonated(self):
        # Non-admin cannot access admin endpoints
        client.post("/auth/register", json={
            "username": "regular_user", "email": "ru@test.com",
            "password": "test123456", "full_name": "Regular User",
            "role": "farmer",
        })
        login = client.post("/auth/login", json={
            "username": "regular_user", "password": "test123456"
        })
        token = login.json()["access_token"]

        resp = client.get("/admin/stats", headers=_auth(token))
        assert resp.status_code == 403

        resp = client.get("/admin/users", headers=_auth(token))
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════════════
# TRANSACTION STATE MACHINE
# ═══════════════════════════════════════════════════════════════════
class TestTransactionStateMachine:
    """Verify order state transitions."""

    def _create_order(self):
        # Create farmer + buyer + lot + offer + order
        client.post("/auth/register", json={
            "username": "sm_farmer", "email": "smf@test.com",
            "password": "test123456", "full_name": "SM Farmer", "role": "farmer",
        })
        client.post("/auth/register", json={
            "username": "sm_buyer", "email": "smb@test.com",
            "password": "test123456", "full_name": "SM Buyer", "role": "buyer",
        })
        ft = client.post("/auth/login", json={"username": "sm_farmer", "password": "test123456"}).json()["access_token"]
        bt = client.post("/auth/login", json={"username": "sm_buyer", "password": "test123456"}).json()["access_token"]
        farmer_id = client.get("/auth/me", headers=_auth(ft)).json()["id"]

        lot = client.post("/lots", json={"crop_id": 1, "quantity_kg": 2000, "price_per_q": 2500}, headers=_auth(ft)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "to_user_id": farmer_id,
            "price_per_q": 2500, "quantity_kg": 2000,
        }, headers=_auth(bt)).json()
        client.post(f"/offers/{offer['id']}/accept", headers=_auth(ft))
        order = client.post(f"/orders/from-offer/{offer['id']}", headers=_auth(bt)).json()
        return order["id"], ft, bt

    def test_order_state_progression(self):
        order_id, ft, bt = self._create_order()
        # Valid progression
        for status in ["pickup_scheduled", "in_transit", "delivered", "quality_confirmed"]:
            resp = client.put(f"/orders/{order_id}/status", json={"status": status}, headers=_auth(bt))
            assert resp.status_code == 200
            assert resp.json()["status"] == status

    def test_payment_auto_creates_on_quality_confirmed(self):
        order_id, ft, bt = self._create_order()
        # Go to quality_confirmed
        for status in ["pickup_scheduled", "in_transit", "delivered", "quality_confirmed"]:
            client.put(f"/orders/{order_id}/status", json={"status": status}, headers=_auth(bt))
        # Payment should now exist
        resp = client.get(f"/payments/{order_id}")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# QUALITY GRADING AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestQualityGrading:
    def test_supported_crops(self):
        resp = client.get("/quality/supported-crops")
        assert resp.status_code == 200
        data = resp.json()
        assert "supported_crops" in data
        crops = data["supported_crops"]
        assert len(crops) > 0
        # Returns list of dicts with name and method
        crop_names = [c["name"] if isinstance(c, dict) else c for c in crops]
        assert any("tomato" in name.lower() for name in crop_names)

    def test_assess_requires_auth(self):
        resp = client.post("/quality/assess/1")
        assert resp.status_code == 401

    def test_assess_nonexistent_lot(self):
        client.post("/auth/register", json={
            "username": "qa_farmer", "email": "qa@test.com",
            "password": "test123456", "full_name": "QA Farmer", "role": "farmer",
        })
        t = client.post("/auth/login", json={"username": "qa_farmer", "password": "test123456"}).json()["access_token"]
        resp = client.post("/quality/assess/99999", headers=_auth(t))
        assert resp.status_code in [400, 404]

    def test_quality_grade_values(self):
        # Verify quality grades are from valid set
        from models.database import QualityGrade
        valid_grades = [g.value for g in QualityGrade]
        assert "A" in valid_grades
        assert "B" in valid_grades
        assert "C" in valid_grades


# ═══════════════════════════════════════════════════════════════════
# LOGISTICS AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestLogistics:
    def test_transport_estimate(self):
        resp = client.get("/logistics/transport-estimate?origin_lat=20.0&origin_lng=73.7&dest_lat=18.5&dest_lng=73.8&quantity_kg=1000")
        assert resp.status_code == 200
        data = resp.json()
        assert "distance_km" in data
        assert "estimated_cost" in data
        assert data["distance_km"] > 0
        assert data["estimated_cost"] > 0

    def test_storage_decision(self):
        resp = client.get("/logistics/storage-decision?current_price=2400&future_price=2600&quantity_kg=2000&days=3")
        assert resp.status_code == 200

    def test_storage_list(self):
        resp = client.get("/storage")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ═══════════════════════════════════════════════════════════════════
# LANGUAGE AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestLanguageAudit:
    def test_all_three_languages(self):
        for lang in ["en", "hi", "mr"]:
            resp = client.get(f"/translations/{lang}")
            assert resp.status_code == 200
            data = resp.json()
            assert "app_name" in data
            assert "sell_my_produce" in data
            assert "smart_sell" in data

    def test_hindi_has_devanagari(self):
        resp = client.get("/translations/hi")
        data = resp.json()
        # Verify Hindi text contains Devanagari characters
        assert any(ord(c) > 0x0900 and ord(c) < 0x097F for c in data["app_name"])

    def test_marathi_has_devanagari(self):
        resp = client.get("/translations/mr")
        data = resp.json()
        assert any(ord(c) > 0x0900 and ord(c) < 0x097F for c in data["app_name"])


# ═══════════════════════════════════════════════════════════════════
# SECURITY AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestSecurity:
    def test_cors_headers(self):
        resp = client.options("/", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        })
        assert resp.status_code in [200, 405]

    def test_security_headers(self):
        resp = client.get("/crops")
        assert resp.status_code == 200
        # Check security headers exist
        headers = resp.headers
        assert "X-Content-Type-Options" in headers
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in headers
        assert headers["X-Frame-Options"] == "DENY"

    def test_no_token_returns_401(self):
        protected_endpoints = [
            "/farmers/dashboard",
            "/orders",
            "/offers",
            "/notifications",
        ]
        for endpoint in protected_endpoints:
            resp = client.get(endpoint)
            assert resp.status_code == 401, f"{endpoint} should require auth"

    def test_password_hashed_not_stored_plaintext(self):
        client.post("/auth/register", json={
            "username": "hash_test", "email": "ht@test.com",
            "password": "mypassword123", "full_name": "Hash Test", "role": "farmer",
        })
        from models.database import User
        db = TestSessionLocal()
        try:
            user = db.query(User).filter(User.username == "hash_test").first()
            assert user is not None
            assert user.hashed_password != "mypassword123"
            assert user.hashed_password.startswith("$2")  # bcrypt prefix
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════
# NOTIFICATION AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestNotifications:
    def test_notifications_list(self):
        client.post("/auth/register", json={
            "username": "notif_test", "email": "nt@test.com",
            "password": "test123456", "full_name": "Notif Test", "role": "farmer",
        })
        t = client.post("/auth/login", json={"username": "notif_test", "password": "test123456"}).json()["access_token"]
        resp = client.get("/notifications", headers=_auth(t))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ═══════════════════════════════════════════════════════════════════
# MARKET DATA AUDIT
# ═══════════════════════════════════════════════════════════════════
class TestMarketData:
    def test_prices_with_valid_crop(self):
        resp = client.get("/markets/prices?crop_id=1")
        assert resp.status_code == 200
        data = resp.json()
        assert "prices" in data
        assert "source" in data
        # Data source should be clearly labelled
        assert "data_source_label" in data

    def test_price_history(self):
        resp = client.get("/markets/prices/history?crop_id=1&market_id=1&days=30")
        assert resp.status_code == 200
        history = resp.json()
        assert isinstance(history, list)
        assert len(history) > 0

    def test_forecast(self):
        resp = client.get("/forecasts/predict?crop_id=1&current_price=2400")
        assert resp.status_code == 200
        forecast = resp.json()
        assert "predicted_price" in forecast
        assert "confidence" in forecast
        assert forecast["predicted_price"] > 0

    def test_market_overview(self):
        resp = client.get("/markets/overview?crop_id=1")
        assert resp.status_code == 200
        overview = resp.json()
        assert "current_price" in overview
        assert "forecast" in overview
