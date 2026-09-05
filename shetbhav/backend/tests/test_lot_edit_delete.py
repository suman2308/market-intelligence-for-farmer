"""
Farmer can edit or withdraw (soft-delete) a lot while it's still active
and unclaimed, and delete their own notifications individually.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import client


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(username, role):
    client.post("/auth/register", json={
        "username": username, "email": f"{username}@test.com",
        "password": "test123456", "full_name": username.title(), "role": role,
    })
    resp = client.post("/auth/login", json={"username": username, "password": "test123456"})
    return resp.json()["access_token"]


class TestEditLot:
    def test_farmer_can_update_price_and_quantity(self):
        token = _register_and_login("editlot_farmer1", "farmer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(token)).json()

        resp = client.put(f"/lots/{lot['id']}", json={"price_per_q": 2200, "quantity_kg": 600}, headers=_auth(token))
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["price_per_q"] == 2200
        assert updated["quantity_kg"] == 600

    def test_cannot_edit_someone_elses_lot(self):
        owner_token = _register_and_login("editlot_farmer2", "farmer")
        other_token = _register_and_login("editlot_farmer3", "farmer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(owner_token)).json()

        resp = client.put(f"/lots/{lot['id']}", json={"price_per_q": 999}, headers=_auth(other_token))
        assert resp.status_code == 403

    def test_cannot_edit_a_booked_lot(self):
        farmer_token = _register_and_login("editlot_farmer4", "farmer")
        buyer_token = _register_and_login("editlot_buyer1", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))

        resp = client.put(f"/lots/{lot['id']}", json={"price_per_q": 2500}, headers=_auth(farmer_token))
        assert resp.status_code == 400


class TestDeleteLot:
    def test_farmer_can_withdraw_an_active_lot(self):
        token = _register_and_login("dellot_farmer1", "farmer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(token)).json()

        resp = client.delete(f"/lots/{lot['id']}", headers=_auth(token))
        assert resp.status_code == 200

        after = client.get(f"/lots/{lot['id']}").json()
        assert after["status"] == "cancelled"
        active_lots = client.get("/lots", params={"status": "active"}, headers=_auth(token)).json()
        assert not any(l["id"] == lot["id"] for l in active_lots)

    def test_withdrawing_a_lot_auto_rejects_pending_offers_on_it(self):
        farmer_token = _register_and_login("dellot_farmer2", "farmer")
        buyer_token = _register_and_login("dellot_buyer1", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 1900, "quantity_kg": 500,
        }, headers=_auth(buyer_token)).json()

        client.delete(f"/lots/{lot['id']}", headers=_auth(farmer_token))

        offers = client.get("/offers", headers=_auth(buyer_token)).json()
        assert next(o for o in offers if o["id"] == offer["id"])["status"] == "rejected"

    def test_cannot_delete_someone_elses_lot(self):
        owner_token = _register_and_login("dellot_farmer3", "farmer")
        other_token = _register_and_login("dellot_farmer4", "farmer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(owner_token)).json()

        resp = client.delete(f"/lots/{lot['id']}", headers=_auth(other_token))
        assert resp.status_code == 403


class TestDeleteNotification:
    def test_can_delete_own_notification(self):
        farmer_token = _register_and_login("delnotif_farmer1", "farmer")
        buyer_token = _register_and_login("delnotif_buyer1", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))

        notifs = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert len(notifs) > 0
        notif_id = notifs[0]["id"]

        resp = client.delete(f"/notifications/{notif_id}", headers=_auth(farmer_token))
        assert resp.status_code == 200
        after = client.get("/notifications", headers=_auth(farmer_token)).json()
        assert not any(n["id"] == notif_id for n in after)

    def test_cannot_delete_someone_elses_notification(self):
        farmer_token = _register_and_login("delnotif_farmer2", "farmer")
        buyer_token = _register_and_login("delnotif_buyer2", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2000, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))
        notif_id = client.get("/notifications", headers=_auth(farmer_token)).json()[0]["id"]

        resp = client.delete(f"/notifications/{notif_id}", headers=_auth(buyer_token))
        assert resp.status_code == 404
