"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Farmer Demands — the buyer-initiated direction of the transaction loop.
 * A buyer posts a demand; a farmer picks one of their own lots for that
 * crop and sends an offer against it. GET /demand already returns every
 * open demand to a farmer (no role-based filtering on that side), so this
 * page needed no backend changes beyond exposing crop/buyer names.
 */

type Demand = {
  id: number; crop_id: number; crop_name?: string; buyer_name?: string;
  quantity_kg: number; offered_price_per_q: number; district?: string;
  quality_grade?: string; required_by_date?: string; status: string;
};
type Lot = { id: number; crop_id: number; crop_name?: string; quantity_kg: number; status: string };

export default function FarmerDemands() {
  const router = useRouter();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [form, setForm] = useState({ lot_id: "", price_per_q: "", quantity_kg: "" });
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Demand[]>("/demand", { params: { status: "open" } }),
      api.get<Lot[]>("/lots", { params: { status: "active" } }),
    ]).then(([d, l]) => { setDemands(d.data); setLots(l.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRespond = (demand: Demand) => {
    setError("");
    setRespondingTo(demand.id);
    const matchingLot = lots.find(l => l.crop_id === demand.crop_id);
    setForm({
      lot_id: matchingLot ? String(matchingLot.id) : "",
      price_per_q: String(demand.offered_price_per_q || ""),
      quantity_kg: String(Math.min(demand.quantity_kg, matchingLot?.quantity_kg || demand.quantity_kg)),
    });
  };

  const sendOffer = async (demand: Demand) => {
    if (!form.lot_id || !form.price_per_q || !form.quantity_kg) return;
    setSending(true);
    setError("");
    try {
      await api.post("/offers", {
        lot_id: Number(form.lot_id),
        demand_id: demand.id,
        price_per_q: Number(form.price_per_q),
        quantity_kg: Number(form.quantity_kg),
      });
      setSentIds(prev => new Set(prev).add(demand.id));
      setRespondingTo(null);
    } catch {
      setError("Could not send the offer. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const lotsForCrop = (cropId: number) => lots.filter(l => l.crop_id === cropId);

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()}
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Buyer Demands</h1>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 12 }}>
            <span>⚠️</span><p>{error}</p>
          </div>
        )}

        {loading ? (
          <div>{[1, 2].map(i => <Skeleton key={i} height={100} />)}</div>
        ) : demands.length === 0 ? (
          <EmptyState icon="📋" title="No open demands right now"
            description="Buyers looking for produce will show up here." />
        ) : (
          demands.map(demand => {
            const cropLots = lotsForCrop(demand.crop_id);
            const sent = sentIds.has(demand.id);
            return (
              <div key={demand.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {demand.crop_name || "Crop"} · {demand.quantity_kg}kg
                    </p>
                    <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "4px 0 0" }}>
                      {demand.buyer_name || "Buyer"} · {demand.district || "—"}
                      {demand.quality_grade ? ` · Grade ${demand.quality_grade}` : ""}
                    </p>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                    ₹{demand.offered_price_per_q?.toLocaleString("en-IN")}/q
                  </p>
                </div>

                {sent ? (
                  <p style={{ fontSize: 13, color: "var(--green-600)", fontWeight: 600, marginTop: 10 }}>
                    ✓ Offer sent
                  </p>
                ) : respondingTo === demand.id ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--stone-100, #f5f5f4)" }}>
                    {cropLots.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--stone-400)" }}>
                        You have no active lot for this crop yet.{" "}
                        <a href="/farmer/sell" style={{ color: "var(--green-600)" }}>Create one</a>.
                      </p>
                    ) : (
                      <>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--stone-400)" }}>Which lot?</label>
                        <select className="select" value={form.lot_id}
                          onChange={e => setForm(f => ({ ...f, lot_id: e.target.value }))}
                          style={{ width: "100%", marginBottom: 8 }}>
                          {cropLots.map(l => (
                            <option key={l.id} value={l.id}>Lot #{l.id} · {l.quantity_kg}kg</option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input className="input" type="number" placeholder="Price ₹/q"
                            value={form.price_per_q} onChange={e => setForm(f => ({ ...f, price_per_q: e.target.value }))}
                            style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} />
                          <input className="input" type="number" placeholder="Quantity kg"
                            value={form.quantity_kg} onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))}
                            style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                            disabled={sending} onClick={() => sendOffer(demand)}>
                            {sending ? "Sending…" : "Send Offer"}
                          </button>
                          <button style={{
                            flex: 1, padding: "8px", fontSize: 13, borderRadius: 8,
                            border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                          }} onClick={() => setRespondingTo(null)}>
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button className="btn-primary" style={{ marginTop: 10, width: "100%", padding: "10px", fontSize: 14 }}
                    onClick={() => openRespond(demand)}>
                    Respond with an offer
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <FarmerBottomNav />
    </div>
  );
}
