"""
Tests for the P1 batch: counterparty profile viewing, lot/demand detail
enrichment (poster identity), and admin visibility into lots/demands/orders.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import client


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(username, role, full_name=None):
    client.post("/auth/register", json={
        "username": username, "email": f"{username}@example.com",
        "password": "test123456", "full_name": full_name or username.title(), "role": role,
    })
    resp = client.post("/auth/login", json={"username": username, "password": "test123456"})
    return resp.json()["access_token"]


class TestCounterpartyProfile:
    def test_view_farmer_profile(self):
        farmer_token = _register_and_login("prof_farmer", "farmer", full_name="Prof Farmer")
        buyer_token = _register_and_login("prof_buyer", "buyer")
        farmer_me = client.get("/auth/me", headers=_auth(farmer_token)).json()

        resp = client.get(f"/users/{farmer_me['id']}/profile", headers=_auth(buyer_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "prof_farmer"
        assert data["full_name"] == "Prof Farmer"
        assert data["role"] == "farmer"

    def test_view_buyer_profile_includes_business_info(self):
        buyer_token = _register_and_login("prof_buyer2", "buyer", full_name="Prof Buyer Co")
        farmer_token = _register_and_login("prof_farmer2", "farmer")
        buyer_me = client.get("/auth/me", headers=_auth(buyer_token)).json()

        resp = client.get(f"/users/{buyer_me['id']}/profile", headers=_auth(farmer_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["business_name"] == "Prof Buyer Co"
        assert "trust_score" in data

    def test_view_fpo_profile_includes_fpo_info(self):
        fpo_token = _register_and_login("prof_fpo", "fpo", full_name="Prof FPO Co-op")
        buyer_token = _register_and_login("prof_buyer3", "buyer")
        fpo_me = client.get("/auth/me", headers=_auth(fpo_token)).json()

        resp = client.get(f"/users/{fpo_me['id']}/profile", headers=_auth(buyer_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["fpo_name"] == "Prof FPO Co-op"

    def test_profile_never_exposes_email(self):
        farmer_token = _register_and_login("prof_farmer3", "farmer")
        buyer_token = _register_and_login("prof_buyer4", "buyer")
        farmer_me = client.get("/auth/me", headers=_auth(farmer_token)).json()

        resp = client.get(f"/users/{farmer_me['id']}/profile", headers=_auth(buyer_token))
        assert "email" not in resp.json()

    def test_profile_not_found(self):
        buyer_token = _register_and_login("prof_buyer5", "buyer")
        resp = client.get("/users/9999999/profile", headers=_auth(buyer_token))
        assert resp.status_code == 404


class TestLotAndDemandEnrichment:
    def test_lot_response_includes_farmer_identity(self):
        farmer_token = _register_and_login("enrich_farmer", "farmer", full_name="Enrich Farmer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        assert lot["farmer_username"] == "enrich_farmer"
        assert lot["farmer_name"] == "Enrich Farmer"
        assert lot["farmer_user_id"] is not None

    def test_demand_response_includes_buyer_identity(self):
        buyer_token = _register_and_login("enrich_buyer", "buyer", full_name="Enrich Buyer Co")
        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 300, "district": "Pune",
            "offered_price_per_q": 2200,
        }, headers=_auth(buyer_token)).json()

        assert demand["buyer_username"] == "enrich_buyer"
        assert demand["buyer_user_id"] is not None

    def test_get_single_demand_detail(self):
        buyer_token = _register_and_login("enrich_buyer2", "buyer")
        farmer_token = _register_and_login("enrich_farmer2", "farmer")
        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 250, "district": "Nashik",
            "offered_price_per_q": 2300,
        }, headers=_auth(buyer_token)).json()

        resp = client.get(f"/demand/{demand['id']}", headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["id"] == demand["id"]

    def test_get_single_demand_not_found(self):
        farmer_token = _register_and_login("enrich_farmer3", "farmer")
        resp = client.get("/demand/9999999", headers=_auth(farmer_token))
        assert resp.status_code == 404


class TestAdminVisibility:
    def test_admin_can_list_lots(self):
        admin_token = _register_and_login("adminvis_admin", "admin")
        farmer_token = _register_and_login("adminvis_farmer", "farmer")
        client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2400,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token))

        resp = client.get("/admin/lots", headers=_auth(admin_token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_admin_can_list_demands(self):
        admin_token = _register_and_login("adminvis_admin2", "admin")
        buyer_token = _register_and_login("adminvis_buyer", "buyer")
        client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 400, "district": "Pune",
            "offered_price_per_q": 2300,
        }, headers=_auth(buyer_token))

        resp = client.get("/admin/demands", headers=_auth(admin_token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_admin_can_list_orders_with_seller_and_buyer_names(self):
        admin_token = _register_and_login("adminvis_admin3", "admin")
        farmer_token = _register_and_login("adminvis_farmer2", "farmer", full_name="Order Farmer")
        buyer_token = _register_and_login("adminvis_buyer2", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))

        resp = client.get("/admin/orders", headers=_auth(admin_token))
        assert resp.status_code == 200
        orders = resp.json()
        assert len(orders) >= 1
        assert any(o["seller_name"] == "Order Farmer" for o in orders)

    def test_admin_endpoints_blocked_for_non_admin(self):
        farmer_token = _register_and_login("adminvis_farmer3", "farmer")
        for path in ("/admin/lots", "/admin/demands", "/admin/orders"):
            resp = client.get(path, headers=_auth(farmer_token))
            assert resp.status_code == 403
