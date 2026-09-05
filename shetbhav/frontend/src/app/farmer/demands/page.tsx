"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { cropEmoji } from "@/lib/cropEmoji";
import { totalAmount, formatINR } from "@/lib/money";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Farmer Demands — the buyer-initiated direction of the transaction loop.
 * A buyer posts a demand at their stated price/quantity; a farmer can
 * accept it directly (no lot required — a lightweight bookkeeping lot is
 * auto-created server-side), reject it (hides it from just this farmer),
 * or negotiate a different price (sends a counter-offer the buyer can
 * accept/reject/counter back through the normal offer flow).
 */

type Demand = {
  id: number; crop_id: number; crop_name?: string; buyer_name?: string;
  quantity_kg: number; offered_price_per_q: number; district?: string;
  quality_grade?: string; required_by_date?: string; status: string;
};
type Offer = { id: number; demand_id?: number | null; from_user_id: number; price_per_q: number; status: string };

export default function FarmerDemands() {
  const router = useRouter();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [negotiatingId, setNegotiatingId] = useState<number | null>(null);
  const [negotiatePrice, setNegotiatePrice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.get<Demand[]>("/demand", { params: { status: "open" } }),
      api.get<Offer[]>("/offers"),
    ]).then(([d, o]) => { setDemands(d.data); setMyOffers(o.data); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const myOfferOn = (demandId: number) =>
    myOffers.find(o => o.demand_id === demandId && ["pending", "countered"].includes(o.status));

  const accept = async (demand: Demand) => {
    setBusyId(demand.id);
    setError("");
    try {
      await api.post(`/demand/${demand.id}/accept`);
      setAcceptedIds(prev => new Set(prev).add(demand.id));
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not accept this demand. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (demand: Demand) => {
    setBusyId(demand.id);
    setError("");
    try {
      await api.post(`/demand/${demand.id}/reject`);
      setDismissedIds(prev => new Set(prev).add(demand.id));
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not dismiss this demand. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const openNegotiate = (demand: Demand) => {
    setError("");
    setNegotiatingId(demand.id);
    setNegotiatePrice(String(demand.offered_price_per_q));
  };

  const sendNegotiate = async (demand: Demand) => {
    if (!negotiatePrice) return;
    setBusyId(demand.id);
    setError("");
    try {
      const { data } = await api.post<Offer>("/offers", {
        demand_id: demand.id, price_per_q: Number(negotiatePrice), quantity_kg: demand.quantity_kg,
      });
      setMyOffers(prev => [...prev, data]);
      setNegotiatingId(null);
      setNegotiatePrice("");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not send your counter-offer. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const visibleDemands = demands.filter(d => !dismissedIds.has(d.id));

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} aria-label="Go back"
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
          <h1 className="heading-md" style={{ margin: 0 }}>Buyer Demands</h1>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 12 }}>
            <span>⚠️</span><p>{error}</p>
          </div>
        )}

        {loading ? (
          <div>{[1, 2].map(i => <Skeleton key={i} height={120} />)}</div>
        ) : loadError ? (
          <EmptyState icon="⚠️" title="Couldn't load demands" description="Check your connection and try again."
            action={{ label: "Retry", onClick: load }} />
        ) : visibleDemands.length === 0 ? (
          <EmptyState icon="📥" title="No open demands right now"
            description="Buyers looking for produce will show up here." />
        ) : (
          visibleDemands.map(demand => {
            const pendingOffer = myOfferOn(demand.id);
            const busy = busyId === demand.id;
            return (
              <div key={demand.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                  onClick={() => router.push(`/demands/${demand.id}`)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {cropEmoji(demand.crop_name)} {demand.crop_name || "Crop"} · {demand.quantity_kg}kg
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                      {demand.buyer_name || "Buyer"} · {demand.district || "—"}
                      {demand.quality_grade ? ` · Grade ${demand.quality_grade}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                      ₹{demand.offered_price_per_q?.toLocaleString("en-IN")}/q
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                      Total: {formatINR(totalAmount(demand.offered_price_per_q, demand.quantity_kg))}
                    </p>
                  </div>
                </div>

                {acceptedIds.has(demand.id) ? (
                  <p style={{ fontSize: 13, color: "var(--green-600)", fontWeight: 600, marginTop: 10 }}>
                    ✓ Accepted — buyer notified to pay
                  </p>
                ) : pendingOffer ? (
                  <p style={{ fontSize: 13, color: "var(--info)", fontWeight: 600, marginTop: 10 }}>
                    🤝 Counter-offer sent: ₹{pendingOffer.price_per_q.toLocaleString("en-IN")}/q — awaiting buyer response
                  </p>
                ) : negotiatingId === demand.id ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--stone-100, #f5f5f4)" }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                      Your counter-price (₹/quintal)
                    </label>
                    <input className="input" type="number" value={negotiatePrice}
                      onChange={e => setNegotiatePrice(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", fontSize: 16, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: 13 }}
                        disabled={!negotiatePrice || busy} onClick={() => sendNegotiate(demand)}>
                        {busy ? "Sending…" : "Send"}
                      </button>
                      <button style={{
                        padding: "10px 16px", fontSize: 13, borderRadius: 8,
                        border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                      }} onClick={() => { setNegotiatingId(null); setNegotiatePrice(""); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: 13 }}
                      disabled={busy} onClick={() => accept(demand)}>
                      {busy ? "…" : "✅ Accept"}
                    </button>
                    <button style={{
                      flex: 1, padding: "10px", fontSize: 13, borderRadius: 8,
                      border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                    }} disabled={busy} onClick={() => openNegotiate(demand)}>
                      🤝 Negotiate
                    </button>
                    <button style={{
                      flex: 1, padding: "10px", fontSize: 13, borderRadius: 8,
                      border: "1px solid var(--stone-200)", background: "white", cursor: "pointer", color: "var(--danger)",
                    }} disabled={busy} onClick={() => reject(demand)}>
                      ✕ Reject
                    </button>
                  </div>
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
