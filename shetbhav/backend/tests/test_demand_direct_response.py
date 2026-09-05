"""
Direct demand response — a farmer/FPO can accept, reject, or negotiate a
buyer's posted demand without first owning a matching lot. Covers the
lightweight auto-created lot bookkeeping and per-user dismissal filtering.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import client


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


def _post_demand(buyer_token, **overrides):
    payload = {
        "crop_id": 1, "quantity_kg": 300, "offered_price_per_q": 2200,
    }
    payload.update(overrides)
    return client.post("/demand", json=payload, headers=_auth(buyer_token)).json()


class TestAcceptDemandWithoutLot:
    def test_accept_creates_order_with_no_prior_lot(self):
        farmer_token = _register_and_login("accdem_farmer", "farmer")
        buyer_token = _register_and_login("accdem_buyer", "buyer")
        demand = _post_demand(buyer_token)

        # Farmer owns zero lots at this point.
        assert client.get("/lots", headers=_auth(farmer_token)).json() == []

        resp = client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer_token))
        assert resp.status_code == 200
        order = resp.json()
        assert order["quantity_kg"] == 300
        assert order["price_per_q"] == 2200
        assert order["status"] == "payment_pending"

        demand_after = client.get(f"/demand/{demand['id']}").json()
        assert demand_after["status"] == "filled"

    def test_accepted_demand_auto_lot_hidden_from_farmers_lot_list(self):
        farmer_token = _register_and_login("accdem_farmer2", "farmer")
        buyer_token = _register_and_login("accdem_buyer2", "buyer")
        demand = _post_demand(buyer_token)
        client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer_token))

        lots = client.get("/lots", headers=_auth(farmer_token)).json()
        assert lots == []

    def test_cannot_accept_already_filled_demand(self):
        farmer_token = _register_and_login("accdem_farmer3", "farmer")
        farmer2_token = _register_and_login("accdem_farmer4", "farmer")
        buyer_token = _register_and_login("accdem_buyer3", "buyer")
        demand = _post_demand(buyer_token)
        client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer_token))

        resp = client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer2_token))
        assert resp.status_code == 400

    def test_buyer_is_notified_on_accept(self):
        farmer_token = _register_and_login("accdem_farmer5", "farmer")
        buyer_token = _register_and_login("accdem_buyer5", "buyer")
        demand = _post_demand(buyer_token)
        client.post(f"/demand/{demand['id']}/accept", headers=_auth(farmer_token))

        notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "demand_fulfilled" for n in notifs)


class TestRejectDemand:
    def test_reject_hides_demand_from_this_farmer_only(self):
        farmer_token = _register_and_login("rejdem_farmer", "farmer")
        farmer2_token = _register_and_login("rejdem_farmer2", "farmer")
        buyer_token = _register_and_login("rejdem_buyer", "buyer")
        demand = _post_demand(buyer_token)

        resp = client.post(f"/demand/{demand['id']}/reject", headers=_auth(farmer_token))
        assert resp.status_code == 200

        my_demands = client.get("/demand", headers=_auth(farmer_token)).json()
        assert not any(d["id"] == demand["id"] for d in my_demands)

        other_farmers_demands = client.get("/demand", headers=_auth(farmer2_token)).json()
        assert any(d["id"] == demand["id"] for d in other_farmers_demands)

    def test_reject_is_idempotent(self):
        farmer_token = _register_and_login("rejdem_farmer3", "farmer")
        buyer_token = _register_and_login("rejdem_buyer2", "buyer")
        demand = _post_demand(buyer_token)

        assert client.post(f"/demand/{demand['id']}/reject", headers=_auth(farmer_token)).status_code == 200
        assert client.post(f"/demand/{demand['id']}/reject", headers=_auth(farmer_token)).status_code == 200


class TestNegotiateDemandWithoutLot:
    def test_farmer_can_counter_propose_without_a_lot(self):
        farmer_token = _register_and_login("negdem_farmer", "farmer")
        buyer_token = _register_and_login("negdem_buyer", "buyer")
        demand = _post_demand(buyer_token)

        resp = client.post("/offers", json={
            "demand_id": demand["id"], "price_per_q": 2400, "quantity_kg": 300,
        }, headers=_auth(farmer_token))
        assert resp.status_code == 200
        offer = resp.json()
        assert offer["demand_id"] == demand["id"]
        assert offer["lot_id"] is not None  # auto-created bookkeeping lot

        # The bookkeeping lot must not show up in the farmer's own lot list.
        assert client.get("/lots", headers=_auth(farmer_token)).json() == []

    def test_buyer_can_accept_the_negotiated_offer(self):
        farmer_token = _register_and_login("negdem_farmer2", "farmer")
        buyer_token = _register_and_login("negdem_buyer2", "buyer")
        demand = _post_demand(buyer_token)

        offer = client.post("/offers", json={
            "demand_id": demand["id"], "price_per_q": 2400, "quantity_kg": 300,
        }, headers=_auth(farmer_token)).json()

        resp = client.post(f"/offers/{offer['id']}/accept", headers=_auth(buyer_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

        orders = client.get("/orders", headers=_auth(farmer_token)).json()
        assert any(o["price_per_q"] == 2400 for o in orders)
