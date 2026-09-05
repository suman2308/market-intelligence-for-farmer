"""
FPO aggregation flow: farmer self-service join requests, opting a lot in
for FPO pickup, FPO-initiated aggregation requests with per-farmer
confirm/decline, and payment distribution once a buyer pays an FPO order.
Also covers that this is purely additive — direct farmer->buyer flows are
untouched.
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


class TestFarmerJoinsFPO:
    def test_join_request_then_approve_makes_farmer_an_active_member(self):
        fpo_token = _register_and_login("fpo_flow_manager1", "fpo")
        farmer_token = _register_and_login("fpo_flow_farmer1", "farmer")

        fpos = client.get("/fpo/browse", headers=_auth(farmer_token)).json()
        fpo_id = next(f["id"] for f in fpos if f["name"] == "Fpo_Flow_Manager1")

        resp = client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        assert resp.status_code == 200
        membership_id = resp.json()["membership_id"]

        status_before = client.get("/farmer/fpo-status", headers=_auth(farmer_token)).json()
        assert status_before[0]["status"] == "pending"

        pending = client.get("/fpo/members/pending", headers=_auth(fpo_token)).json()
        assert any(p["membership_id"] == membership_id for p in pending)

        approve = client.put(f"/fpo/members/{membership_id}/approve", headers=_auth(fpo_token))
        assert approve.status_code == 200

        status_after = client.get("/farmer/fpo-status", headers=_auth(farmer_token)).json()
        assert status_after[0]["status"] == "active"

    def test_cannot_request_twice_while_pending(self):
        fpo_token = _register_and_login("fpo_flow_manager2", "fpo")
        farmer_token = _register_and_login("fpo_flow_farmer2", "farmer")
        fpo_id = next(f["id"] for f in client.get("/fpo/browse", headers=_auth(farmer_token)).json()
                      if f["name"] == "Fpo_Flow_Manager2")
        client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        resp = client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        assert resp.status_code == 400


class TestLeaveAndRemoveMembership:
    def _approved_member(self, suffix):
        fpo_token = _register_and_login(f"fpo_leave_manager{suffix}", "fpo")
        farmer_token = _register_and_login(f"fpo_leave_farmer{suffix}", "farmer")
        fpo_id = next(f["id"] for f in client.get("/fpo/browse", headers=_auth(farmer_token)).json()
                      if f["name"] == f"Fpo_Leave_Manager{suffix}")
        mid = client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token)).json()["membership_id"]
        client.put(f"/fpo/members/{mid}/approve", headers=_auth(fpo_token))
        return fpo_token, farmer_token, fpo_id

    def test_farmer_can_leave_and_status_becomes_left(self):
        fpo_token, farmer_token, fpo_id = self._approved_member("1")
        resp = client.post("/fpo/leave", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        assert resp.status_code == 200
        status = client.get("/farmer/fpo-status", headers=_auth(farmer_token)).json()
        assert status[0]["status"] == "left"
        # No longer listed as an active member from the FPO's side.
        members = client.get("/fpo/members", headers=_auth(fpo_token)).json()
        assert not any(m["name"] == "Fpo_Leave_Farmer1" for m in members)

    def test_leaving_without_active_membership_is_rejected(self):
        _, farmer_token, fpo_id = self._approved_member("2")
        client.post("/fpo/leave", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        resp = client.post("/fpo/leave", params={"fpo_id": fpo_id}, headers=_auth(farmer_token))
        assert resp.status_code == 404

    def test_fpo_can_remove_an_active_member(self):
        fpo_token, farmer_token, fpo_id = self._approved_member("3")
        members = client.get("/fpo/members", headers=_auth(fpo_token)).json()
        farmer_id = next(m["id"] for m in members if m["name"] == "Fpo_Leave_Farmer3")

        resp = client.put(f"/fpo/members/{farmer_id}/remove", headers=_auth(fpo_token))
        assert resp.status_code == 200

        status = client.get("/farmer/fpo-status", headers=_auth(farmer_token)).json()
        assert status[0]["status"] == "removed"
        members_after = client.get("/fpo/members", headers=_auth(fpo_token)).json()
        assert not any(m["id"] == farmer_id for m in members_after)

    def test_member_detail_endpoint_returns_lots(self):
        fpo_token, farmer_token, fpo_id = self._approved_member("4")
        client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 300, "price_per_q": 2100, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token))
        members = client.get("/fpo/members", headers=_auth(fpo_token)).json()
        farmer_id = next(m["id"] for m in members if m["name"] == "Fpo_Leave_Farmer4")

        detail = client.get(f"/fpo/members/{farmer_id}", headers=_auth(fpo_token))
        assert detail.status_code == 200
        body = detail.json()
        assert body["name"] == "Fpo_Leave_Farmer4"
        assert len(body["lots"]) == 1
        assert body["lots"][0]["quantity_kg"] == 300

    def test_another_fpo_cannot_remove_or_view_a_member_not_its_own(self):
        fpo_token, farmer_token, fpo_id = self._approved_member("5")
        other_fpo_token = _register_and_login("fpo_leave_other_manager", "fpo")
        members = client.get("/fpo/members", headers=_auth(fpo_token)).json()
        farmer_id = next(m["id"] for m in members if m["name"] == "Fpo_Leave_Farmer5")

        remove = client.put(f"/fpo/members/{farmer_id}/remove", headers=_auth(other_fpo_token))
        assert remove.status_code == 404
        detail = client.get(f"/fpo/members/{farmer_id}", headers=_auth(other_fpo_token))
        assert detail.status_code == 404


class TestAggregationWithConfirmation:
    def _setup_member(self, suffix):
        fpo_token = _register_and_login(f"fpo_agg_manager{suffix}", "fpo")
        farmer_token = _register_and_login(f"fpo_agg_farmer{suffix}", "farmer")
        fpo_id = next(f["id"] for f in client.get("/fpo/browse", headers=_auth(farmer_token)).json()
                      if f["name"] == f"Fpo_Agg_Manager{suffix}")
        mid = client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token)).json()["membership_id"]
        client.put(f"/fpo/members/{mid}/approve", headers=_auth(fpo_token))
        return fpo_token, farmer_token, fpo_id

    def test_farmer_can_still_sell_lot_directly_while_not_flagged_for_fpo(self):
        _, farmer_token, _ = self._setup_member("1")
        buyer_token = _register_and_login("fpo_agg_buyer1", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        assert lot["available_for_fpo"] is False
        # Existing direct book-and-pay flow must be completely unaffected.
        resp = client.post(f"/lots/{lot['id']}/book", headers=_auth(buyer_token))
        assert resp.status_code == 200

    def test_lot_opted_into_fpo_appears_in_available_pool(self):
        fpo_token, farmer_token, _ = self._setup_member("2")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A",
            "urgency": "soon", "available_for_fpo": True,
        }, headers=_auth(farmer_token)).json()
        assert lot["available_for_fpo"] is True

        pool = client.get("/fpo/available-lots", headers=_auth(fpo_token)).json()
        assert any(l["lot_id"] == lot["id"] for l in pool)

    def test_confirm_moves_lot_to_fpo_aggregated_and_activates_agg_lot(self):
        fpo_token, farmer_token, _ = self._setup_member("3")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A",
            "urgency": "soon", "available_for_fpo": True,
        }, headers=_auth(farmer_token)).json()

        req = client.post("/fpo/aggregate-request", json={
            "lot_ids": [lot["id"]], "expected_price_per_q": 2600,
        }, headers=_auth(fpo_token))
        assert req.status_code == 200
        agg_lot_id = req.json()["aggregated_lot_id"]

        # Farmer's original lot is held, not individually sellable, while pending.
        assert client.get(f"/lots/{lot['id']}").json()["status"] == "pending_fpo"

        requests = client.get("/farmer/fpo-requests", headers=_auth(farmer_token)).json()
        contribution_id = next(r["contribution_id"] for r in requests)

        confirm = client.post(f"/fpo/aggregation/{contribution_id}/confirm", headers=_auth(farmer_token))
        assert confirm.status_code == 200

        assert client.get(f"/lots/{lot['id']}").json()["status"] == "fpo_aggregated"
        agg_lot = client.get(f"/lots/{agg_lot_id}").json()
        assert agg_lot["status"] == "active"
        assert agg_lot["fpo_id"] is not None

    def test_decline_reverts_lot_to_active_and_cancels_agg_lot_if_sole_contributor(self):
        fpo_token, farmer_token, _ = self._setup_member("4")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 500, "price_per_q": 2500, "quality_grade": "A",
            "urgency": "soon", "available_for_fpo": True,
        }, headers=_auth(farmer_token)).json()
        agg_lot_id = client.post("/fpo/aggregate-request", json={
            "lot_ids": [lot["id"]],
        }, headers=_auth(fpo_token)).json()["aggregated_lot_id"]
        contribution_id = client.get("/farmer/fpo-requests", headers=_auth(farmer_token)).json()[0]["contribution_id"]

        decline = client.post(f"/fpo/aggregation/{contribution_id}/decline", headers=_auth(farmer_token))
        assert decline.status_code == 200

        assert client.get(f"/lots/{lot['id']}").json()["status"] == "active"
        assert client.get(f"/lots/{agg_lot_id}").json()["status"] == "cancelled"


class TestBuyerBuysFromFPOAndPaymentDistribution:
    def test_full_loop_buyer_pays_fpo_distributes_to_farmer(self):
        fpo_token = _register_and_login("fpo_pay_manager", "fpo")
        farmer_token = _register_and_login("fpo_pay_farmer", "farmer")
        buyer_token = _register_and_login("fpo_pay_buyer", "buyer")

        fpo_id = next(f["id"] for f in client.get("/fpo/browse", headers=_auth(farmer_token)).json()
                      if f["name"] == "Fpo_Pay_Manager")
        mid = client.post("/fpo/join-request", params={"fpo_id": fpo_id}, headers=_auth(farmer_token)).json()["membership_id"]
        client.put(f"/fpo/members/{mid}/approve", headers=_auth(fpo_token))

        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 1000, "price_per_q": 2000, "quality_grade": "A",
            "urgency": "soon", "available_for_fpo": True,
        }, headers=_auth(farmer_token)).json()
        agg_lot_id = client.post("/fpo/aggregate-request", json={
            "lot_ids": [lot["id"]], "expected_price_per_q": 2200,
        }, headers=_auth(fpo_token)).json()["aggregated_lot_id"]
        contribution_id = client.get("/farmer/fpo-requests", headers=_auth(farmer_token)).json()[0]["contribution_id"]
        client.post(f"/fpo/aggregation/{contribution_id}/confirm", headers=_auth(farmer_token))

        # Buyer can filter to FPO-only lots and books the aggregated lot directly.
        fpo_lots = client.get("/lots", params={"status": "active", "seller_type": "fpo"}, headers=_auth(buyer_token)).json()
        assert any(l["id"] == agg_lot_id for l in fpo_lots)
        farmer_lots = client.get("/lots", params={"status": "active", "seller_type": "farmer"}, headers=_auth(buyer_token)).json()
        assert not any(l["id"] == agg_lot_id for l in farmer_lots)

        order = client.post(f"/lots/{agg_lot_id}/book", headers=_auth(buyer_token)).json()
        client.post(f"/payments/{order['id']}/simulate", headers=_auth(buyer_token))

        dist = client.post(f"/fpo/orders/{order['id']}/distribute-payment", headers=_auth(fpo_token))
        assert dist.status_code == 200
        body = dist.json()
        assert body["breakdown"][0]["farmer_name"] == "Fpo_Pay_Farmer"
        assert body["breakdown"][0]["net_payable"] < body["breakdown"][0]["gross_amount"]

        # Farmer's original lot is now sold, and a second distribution attempt is rejected.
        assert client.get(f"/lots/{lot['id']}").json()["status"] == "sold"
        again = client.post(f"/fpo/orders/{order['id']}/distribute-payment", headers=_auth(fpo_token))
        assert again.status_code == 400


class TestExistingFlowsUnaffected:
    def test_direct_farmer_buyer_negotiated_offer_flow_still_works(self):
        farmer_token = _register_and_login("fpo_regress_farmer", "farmer")
        buyer_token = _register_and_login("fpo_regress_buyer", "buyer")
        lot = client.post("/lots", json={
            "crop_id": 1, "quantity_kg": 400, "price_per_q": 2500, "quality_grade": "A", "urgency": "soon",
        }, headers=_auth(farmer_token)).json()
        offer = client.post("/offers", json={
            "lot_id": lot["id"], "price_per_q": 2450, "quantity_kg": 400,
        }, headers=_auth(buyer_token)).json()
        accept = client.post(f"/offers/{offer['id']}/accept", headers=_auth(farmer_token))
        assert accept.status_code == 200
        assert accept.json()["status"] == "accepted"
