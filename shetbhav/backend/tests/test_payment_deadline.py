"""
Payment deadline — a farmer chooses a payment window when accepting a
buyer's offer; if the buyer doesn't pay in time, the order is lazily
cancelled and the lot (or demand) becomes available again for others.
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import client, TestSessionLocal
from models.database import Order


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


def _expire_order(order_id: int):
    """Force an order's payment_deadline into the past, bypassing the API
    (there's no legitimate way to wait out a real window in a test)."""
    with TestSessionLocal() as db:
        order = db.query(Order).filter(Order.id == order_id).first()
        order.payment_deadline = datetime.utcnow() - timedelta(hours=1)
        db.commit()


class TestAcceptOfferPaymentWindow:
    def test_farmer_chosen_window_is_stored_on_the_order(self):
        farmer_token = _register_and_login("pd_farmer", "farmer")
        buyer_token = _register_and_login("pd_buyer", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2450, "quantity_kg": 400,
        }, headers=_auth(buyer_token)).json()

        before = datetime.utcnow()
        resp = client.post(f"/offers/{offer['id']}/accept", json={"payment_window_hours": 6}, headers=_auth(farmer_token))
        assert resp.status_code == 200
        orders = client.get("/orders", headers=_auth(farmer_token)).json()
        order = next(o for o in orders if o["price_per_q"] == 2450)
        deadline = datetime.fromisoformat(order["payment_deadline"])
        assert timedelta(hours=5, minutes=55) < (deadline - before) < timedelta(hours=6, minutes=5)

    def test_default_window_applies_when_farmer_does_not_choose_one(self):
        farmer_token = _register_and_login("pd_farmer2", "farmer")
        buyer_token = _register_and_login("pd_buyer2", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2450, "quantity_kg": 400,
        }, headers=_auth(buyer_token)).json()

        resp = client.post(f"/offers/{offer['id']}/accept", headers=_auth(farmer_token))
        assert resp.status_code == 200
        orders = client.get("/orders", headers=_auth(farmer_token)).json()
        order = next(o for o in orders if o["price_per_q"] == 2450)
        assert order["payment_deadline"] is not None


class TestPaymentWindowExpiry:
    def test_lot_reverts_to_active_when_window_expires_unpaid(self):
        farmer_token = _register_and_login("pd_farmer3", "farmer")
        buyer_token = _register_and_login("pd_buyer3", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        book_resp = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))
        order = book_resp.json()
        assert client.get(f"/lots/{lot['id']}").json()["status"] == "booked"

        _expire_order(order["id"])

        # Any lot read lazily runs the expiry sweep.
        refreshed = client.get(f"/lots/{lot['id']}").json()
        assert refreshed["status"] == "active"

        order_after = next(o for o in client.get("/orders", headers=_auth(buyer_token)).json() if o["id"] == order["id"])
        assert order_after["status"] == "cancelled"

    def test_expired_order_cannot_be_paid(self):
        farmer_token = _register_and_login("pd_farmer4", "farmer")
        buyer_token = _register_and_login("pd_buyer4", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        order = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token)).json()
        _expire_order(order["id"])

        resp = client.post(f"/payments/{order['id']}/simulate", headers=_auth(buyer_token))
        assert resp.status_code == 400

    def test_demand_reopens_when_accepted_offers_payment_window_expires(self):
        farmer_token = _register_and_login("pd_farmer5", "farmer")
        buyer_token = _register_and_login("pd_buyer5", "buyer")
        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 300, "offered_price_per_q": 2200,
        }, headers=_auth(buyer_token)).json()

        order = client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer_token)).json()
        assert client.get(f"/demand/{demand['id']}").json()["status"] == "filled"

        _expire_order(order["id"])

        # A lazy sweep runs on GET /demand too.
        client.get("/demand", headers=_auth(farmer_token))
        assert client.get(f"/demand/{demand['id']}").json()["status"] == "open"
