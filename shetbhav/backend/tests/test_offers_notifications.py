"""
Offer window + notification tests — covers the transaction-loop closing
work: offers_close_at derivation, expiry, ranked offer listing, and that
every state transition (offer sent/accepted/rejected/countered, order
status change, grievance resolution) notifies the right counterparty.
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import client, TestSessionLocal
from models.database import Offer, OfferStatus


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(username, role, extra=None):
    payload = {
        "username": username, "email": f"{username}@test.com",
        "password": "test123456", "full_name": username.title(), "role": role,
    }
    if extra:
        payload.update(extra)
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", json={"username": username, "password": "test123456"})
    return resp.json()["access_token"]


class TestOfferWindow:
    def test_lot_gets_offers_close_at_from_urgency(self):
        farmer_token = _register_and_login("win_farmer", "farmer")
        before = datetime.utcnow()
        resp = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A", "urgency": "urgent",
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        lot = resp.json()
        assert lot["offers_close_at"] is not None
        close_at = datetime.fromisoformat(lot["offers_close_at"])
        # urgent = +6h; allow slack for test runtime
        delta = close_at - before
        assert timedelta(hours=5, minutes=55) < delta < timedelta(hours=6, minutes=5)

    def test_offer_inherits_lot_expiry(self):
        farmer_token = _register_and_login("win_farmer2", "farmer")
        buyer_token = _register_and_login("win_buyer2", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A", "urgency": "flexible",
        }, headers=_auth(farmer_token)).json()

        offer_resp = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2500, "quantity_kg": 500,
        }, headers=_auth(buyer_token))
        offer = offer_resp.json()
        assert offer["expires_at"] == lot["offers_close_at"]


class TestOfferNotifications:
    def test_offer_created_notifies_farmer(self):
        farmer_token = _register_and_login("notif_farmer", "farmer")
        buyer_token = _register_and_login("notif_buyer", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2400, "quantity_kg": 200,
        }, headers=_auth(buyer_token))

        notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert any(n["type"] == "offer_received" for n in notifs)

    def test_accept_notifies_buyer_and_creates_order(self):
        farmer_token = _register_and_login("notif_farmer2", "farmer")
        buyer_token = _register_and_login("notif_buyer2", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2400, "quantity_kg": 200,
        }, headers=_auth(buyer_token)).json()

        resp = client.post(f"/offers/{offer['id']}/accept", headers=_auth(farmer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        orders = client.get("/orders", headers=_auth(farmer_token)).json()
        assert len(orders) >= 1

        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "offer_accepted" for n in buyer_notifs)

    def test_reject_notifies_buyer(self):
        farmer_token = _register_and_login("notif_farmer3", "farmer")
        buyer_token = _register_and_login("notif_buyer3", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2400, "quantity_kg": 200,
        }, headers=_auth(buyer_token)).json()

        client.post(f"/offers/{offer['id']}/reject", headers=_auth(farmer_token))
        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "offer_rejected" for n in buyer_notifs)

    def test_counter_notifies_counterparty(self):
        farmer_token = _register_and_login("notif_farmer4", "farmer")
        buyer_token = _register_and_login("notif_buyer4", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2400, "quantity_kg": 200,
        }, headers=_auth(buyer_token)).json()

        resp = client.post(f"/offers/{offer['id']}/counter", json={"price_per_q": 2600},
                            headers=_auth(farmer_token))
        assert resp.status_code == 200
        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "offer_countered" for n in buyer_notifs)

    def test_order_status_update_notifies_other_party(self):
        farmer_token = _register_and_login("notif_farmer5", "farmer")
        buyer_token = _register_and_login("notif_buyer5", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2400, "quantity_kg": 200,
        }, headers=_auth(buyer_token)).json()
        client.post(f"/offers/{offer['id']}/accept", headers=_auth(farmer_token))
        order = client.get("/orders", headers=_auth(farmer_token)).json()[0]

        # Farmer advances status -> buyer should be notified (not the farmer, who triggered it)
        resp = client.put(f"/orders/{order['id']}/status", json={"status": "pickup_scheduled"},
                           headers=_auth(farmer_token))
        assert resp.status_code == 200
        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "order_status" for n in buyer_notifs)


class TestLotOffersEndpoint:
    def test_ranked_by_price_and_authorized_to_owner_only(self):
        farmer_token = _register_and_login("rank_farmer", "farmer")
        other_farmer_token = _register_and_login("rank_farmer_other", "farmer")
        buyer_a = _register_and_login("rank_buyer_a", "buyer")
        buyer_b = _register_and_login("rank_buyer_b", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A", "urgency": "flexible",
        }, headers=_auth(farmer_token)).json()

        client.post("/offers", json={"lot_id": lot["id"], "price_per_q": 2200, "quantity_kg": 500}, headers=_auth(buyer_a))
        client.post("/offers", json={"lot_id": lot["id"], "price_per_q": 2700, "quantity_kg": 500}, headers=_auth(buyer_b))

        resp = client.get(f"/lots/{lot['id']}/offers", headers=_auth(farmer_token))
        assert resp.status_code == 200
        offers = resp.json()
        assert len(offers) == 2
        # Best (highest) price ranked first
        assert offers[0]["price_per_q"] == 2700

        # A different farmer must not see this lot's offers
        resp2 = client.get(f"/lots/{lot['id']}/offers", headers=_auth(other_farmer_token))
        assert resp2.status_code == 403

    def test_stale_offer_lazily_expires(self):
        farmer_token = _register_and_login("expire_farmer", "farmer")
        buyer_token = _register_and_login("expire_buyer", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A", "urgency": "urgent",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2200, "quantity_kg": 500,
        }, headers=_auth(buyer_token)).json()

        # Force the offer's window into the past directly in the DB.
        db = TestSessionLocal()
        try:
            row = db.query(Offer).filter(Offer.id == offer["id"]).first()
            row.expires_at = datetime.utcnow() - timedelta(hours=1)
            db.commit()
        finally:
            db.close()

        resp = client.get(f"/lots/{lot['id']}/offers", headers=_auth(farmer_token))
        offers = resp.json()
        assert offers[0]["status"] == "expired"


class TestDemandFulfilment:
    """Direction B: buyer posts a demand, farmer responds with an offer
    against one of their own lots. The recipient-resolution logic must
    address the buyer (not fall back to the lot's own farmer)."""

    def test_farmer_offer_on_demand_addresses_the_buyer(self):
        farmer_token = _register_and_login("dem_farmer", "farmer")
        buyer_token = _register_and_login("dem_buyer", "buyer")

        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 800, "district": "Pune",
            "offered_price_per_q": 2500,
        }, headers=_auth(buyer_token)).json()

        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 800, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        offer_resp = client.post("/offers", json={
            "lot_id": lot["id"], "demand_id": demand["id"],
            "price_per_q": 2550, "quantity_kg": 800,
        }, headers=_auth(farmer_token))
        assert offer_resp.status_code == 200
        offer = offer_resp.json()

        buyer_me = client.get("/auth/me", headers=_auth(buyer_token)).json()
        assert offer["to_user_id"] == buyer_me["id"]
        assert offer["from_user_id"] != buyer_me["id"]

        # Buyer, as the offer's recipient, must be able to accept it.
        accept_resp = client.post(f"/offers/{offer['id']}/accept", headers=_auth(buyer_token))
        assert accept_resp.status_code == 200
        assert accept_resp.json()["status"] == "accepted"

        farmer_notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert any(n["type"] == "offer_accepted" for n in farmer_notifs)

    def test_demand_listing_includes_crop_and_buyer_names(self):
        buyer_token = _register_and_login("dem_buyer2", "buyer")
        farmer_token = _register_and_login("dem_farmer2", "farmer")
        client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 300, "district": "Nashik",
            "offered_price_per_q": 2100,
        }, headers=_auth(buyer_token))

        resp = client.get("/demand", headers=_auth(farmer_token))
        assert resp.status_code == 200
        demands = resp.json()
        assert len(demands) >= 1
        assert demands[0]["crop_name"] is not None
        assert demands[0]["buyer_name"] is not None


class TestGrievanceNotification:
    def test_resolve_notifies_complainant(self):
        farmer_token = _register_and_login("griev_farmer", "farmer")
        admin_token = _register_and_login("griev_admin", "admin")

        grievance = client.post("/grievances", json={
            "category": "quality_disagreement", "description": "Buyer disputed my quality grade.",
        }, headers=_auth(farmer_token)).json()

        resp = client.put(f"/grievances/{grievance['id']}/resolve", json={
            "status": "resolved", "admin_response": "Reviewed and resolved in farmer's favor.",
        }, headers=_auth(admin_token))
        assert resp.status_code == 200

        notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert any(n["type"] == "grievance_update" for n in notifs)
