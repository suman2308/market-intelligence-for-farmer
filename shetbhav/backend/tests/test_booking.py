"""
Direct book-and-pay / lock-and-fulfil tests — the rework replacing
negotiated offers as the primary transaction path. A farmer's lot has a
fixed asking price; a buyer's "book" is a final commitment (no accept
needed), same for a farmer/FPO's "fulfil" of a buyer's demand. Payment
completion is the moment the seller gets notified the sale is done.
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


class TestStaleOfferCleanup:
    """P0 correctness fix: once a lot is booked/sold or a demand is filled,
    any other still-pending negotiated offers on it must be auto-rejected —
    otherwise a stale offer could later be accepted into a second,
    conflicting order against something that's already gone."""

    def test_direct_book_auto_rejects_a_pending_negotiated_offer_on_the_same_lot(self):
        farmer_token = _register_and_login("stale_farmer", "farmer")
        buyer_a = _register_and_login("stale_buyer_a", "buyer")
        buyer_b = _register_and_login("stale_buyer_b", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        # Buyer A negotiates a lower price instead of booking outright.
        offer_a = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2300, "quantity_kg": 500,
        }, headers=_auth(buyer_a)).json()
        assert offer_a["status"] == "pending"

        # Buyer B books it directly at the listed price.
        book_resp = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_b))
        assert book_resp.status_code == 200

        # Buyer A's dangling offer must now be rejected, not still pending.
        offers = client.get("/offers", headers=_auth(buyer_a)).json()
        stale = next(o for o in offers if o["id"] == offer_a["id"])
        assert stale["status"] == "rejected"

        notifs = client.get("/notifications", headers=_auth(buyer_a)).json()
        assert any(n["type"] == "offer_auto_rejected" for n in notifs)

        # And it can no longer be accepted by the farmer even if they try.
        accept_resp = client.post(f"/offers/{offer_a['id']}/accept", headers=_auth(farmer_token))
        assert accept_resp.status_code == 400

    def test_accepting_one_offer_auto_rejects_a_competing_offer_on_the_same_lot(self):
        farmer_token = _register_and_login("stale_farmer2", "farmer")
        buyer_a = _register_and_login("stale_buyer_c", "buyer")
        buyer_b = _register_and_login("stale_buyer_d", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 300, "price_per_q": 2200,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        offer_a = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2100, "quantity_kg": 300,
        }, headers=_auth(buyer_a)).json()
        offer_b = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2150, "quantity_kg": 300,
        }, headers=_auth(buyer_b)).json()

        accept_resp = client.post(f"/offers/{offer_b['id']}/accept", headers=_auth(farmer_token))
        assert accept_resp.status_code == 200

        offers = client.get("/offers", headers=_auth(buyer_a)).json()
        stale = next(o for o in offers if o["id"] == offer_a["id"])
        assert stale["status"] == "rejected"

    def test_cannot_counter_an_offer_on_a_no_longer_active_lot(self):
        farmer_token = _register_and_login("stale_farmer3", "farmer")
        buyer_a = _register_and_login("stale_buyer_e", "buyer")
        buyer_b = _register_and_login("stale_buyer_f", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2400,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        offer_a = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2300, "quantity_kg": 400,
        }, headers=_auth(buyer_a)).json()

        book_resp = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_b))
        assert book_resp.status_code == 200

        counter_resp = client.post(f"/offers/{offer_a['id']}/counter", json={"price_per_q": 2350}, headers=_auth(farmer_token))
        assert counter_resp.status_code == 400

    def test_fulfil_demand_auto_rejects_a_competing_offer_on_the_same_demand(self):
        buyer_token = _register_and_login("stale_buyer_g", "buyer")
        farmer_a = _register_and_login("stale_farmer_a", "farmer")
        farmer_b = _register_and_login("stale_farmer_b", "farmer")

        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 350, "district": "Nashik",
            "offered_price_per_q": 2500,
        }, headers=_auth(buyer_token)).json()

        lot_a = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 350, "price_per_q": 2300,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_a)).json()
        lot_b = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 350, "price_per_q": 2350,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_b)).json()

        # Farmer A proposes a counter-price against the demand instead of
        # locking it outright.
        offer_a = client.post("/offers", json={
            "lot_id": lot_a["id"], "demand_id": demand["id"],
            "price_per_q": 2450, "quantity_kg": 350,
        }, headers=_auth(farmer_a)).json()

        # Farmer B locks and fulfils the same demand directly.
        fulfil_resp = client.post(f"/demand/{demand['id']}/fulfil", json={"lot_id": lot_b["id"]}, headers=_auth(farmer_b))
        assert fulfil_resp.status_code == 200

        offers = client.get("/offers", headers=_auth(farmer_a)).json()
        stale = next(o for o in offers if o["id"] == offer_a["id"])
        assert stale["status"] == "rejected"


class TestBookLot:
    def test_book_creates_payment_pending_order_at_listed_price(self):
        farmer_token = _register_and_login("book_farmer", "farmer")
        buyer_token = _register_and_login("book_buyer", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2600,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        resp = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))
        assert resp.status_code == 200
        order = resp.json()
        assert order["price_per_q"] == 2600
        assert order["quantity_kg"] == 500
        assert order["status"] == "payment_pending"

        lot_after = client.get(f"/lots/{lot['id']}").json()
        assert lot_after["status"] == "booked"

        farmer_notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert any(n["type"] == "lot_booked" for n in farmer_notifs)

    def test_cannot_book_an_already_booked_lot(self):
        farmer_token = _register_and_login("book_farmer2", "farmer")
        buyer_token = _register_and_login("book_buyer2", "buyer")
        other_buyer_token = _register_and_login("book_buyer3", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 300, "price_per_q": 2400,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        first = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))
        assert first.status_code == 200

        second = client.post(f"/lots/{lot['id']}/book", headers=_auth(other_buyer_token))
        assert second.status_code == 400

    def test_payment_notifies_seller_lot_sold(self):
        farmer_token = _register_and_login("book_farmer3", "farmer")
        buyer_token = _register_and_login("book_buyer4", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2500,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        order = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token)).json()

        resp = client.post(f"/payments/{order['id']}/simulate", headers=_auth(buyer_token))
        assert resp.status_code == 200

        farmer_notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert any(n["type"] == "payment_received" and "sold" in n["title"].lower() for n in farmer_notifs)


class TestFulfilDemand:
    def test_farmer_fulfils_demand_with_own_lot(self):
        buyer_token = _register_and_login("fulfil_buyer", "buyer")
        farmer_token = _register_and_login("fulfil_farmer", "farmer")
        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 400, "district": "Nashik",
            "offered_price_per_q": 2450,
        }, headers=_auth(buyer_token)).json()
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2300,  # lot's own price is irrelevant here
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()

        resp = client.post(f"/demand/{demand['id']}/fulfil", json={"lot_id": lot["id"]}, headers=_auth(farmer_token))
        assert resp.status_code == 200
        order = resp.json()
        # Order takes the DEMAND's price, not the lot's — the buyer fixed the terms.
        assert order["price_per_q"] == 2450
        assert order["quantity_kg"] == 400
        assert order["status"] == "payment_pending"

        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "demand_fulfilled" for n in buyer_notifs)

    def test_cannot_fulfil_with_someone_elses_lot(self):
        buyer_token = _register_and_login("fulfil_buyer2", "buyer")
        farmer_a = _register_and_login("fulfil_farmer_a", "farmer")
        farmer_b = _register_and_login("fulfil_farmer_b", "farmer")
        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 200, "district": "Pune",
            "offered_price_per_q": 2200,
        }, headers=_auth(buyer_token)).json()
        lot_a = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 200, "price_per_q": 2200,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_a)).json()

        resp = client.post(f"/demand/{demand['id']}/fulfil", json={"lot_id": lot_a["id"]}, headers=_auth(farmer_b))
        assert resp.status_code == 403

    def test_fpo_fulfils_demand_and_orders_are_correctly_scoped(self):
        buyer_token = _register_and_login("fulfil_buyer3", "buyer")
        member_farmer_token = _register_and_login("fulfil_member_farmer", "farmer")
        fpo_token = _register_and_login("fulfil_fpo", "fpo", full_name="Test FPO Co-op")

        demand = client.post("/demand", json={
            "crop_id": 1, "quantity_kg": 600, "district": "Nashik",
            "offered_price_per_q": 2500,
        }, headers=_auth(buyer_token)).json()

        member_lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 600, "price_per_q": 2300,
            "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(member_farmer_token)).json()

        agg = client.post(
            "/fpo/aggregate",
            params={"target_quantity_kg": 600},
            json=[member_lot["id"]],
            headers=_auth(fpo_token),
        )
        assert agg.status_code == 200
        agg_lot_id = agg.json()["aggregated_lot_id"]

        resp = client.post(f"/demand/{demand['id']}/fulfil", json={"lot_id": agg_lot_id}, headers=_auth(fpo_token))
        assert resp.status_code == 200
        order = resp.json()
        assert order["fpo_id"] is not None

        # FPO sees this order in its own list...
        fpo_orders = client.get("/orders", headers=_auth(fpo_token)).json()
        assert any(o["id"] == order["id"] for o in fpo_orders)

        # ...but the representative member-farmer's personal order list does NOT
        # (the order belongs to the FPO, not to them individually).
        farmer_orders = client.get("/orders", headers=_auth(member_farmer_token)).json()
        assert all(o["id"] != order["id"] for o in farmer_orders)

        buyer_notifs = client.get("/notifications", headers=_auth(buyer_token)).json()
        assert any(n["type"] == "demand_fulfilled" for n in buyer_notifs)

        # Payment should notify the FPO's own account, not the member farmer's.
        pay = client.post(f"/payments/{order['id']}/simulate", headers=_auth(buyer_token))
        assert pay.status_code == 200
        fpo_notifs = client.get("/notifications", headers=_auth(fpo_token)).json()
        assert any(n["type"] == "payment_received" for n in fpo_notifs)
        farmer_notifs = client.get("/notifications", headers=_auth(member_farmer_token)).json()
        assert not any(n["type"] == "payment_received" for n in farmer_notifs)
