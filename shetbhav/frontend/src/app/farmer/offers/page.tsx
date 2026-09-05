"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Farmer Offers — the ranked-offer side of the offer-window deal model.
 * A lot collects offers until `offers_close_at`; the farmer can accept the
 * best one at any time (early accept) or wait out the window to compare
 * more (bidding-like), but never has to wait past it.
 */

type Lot = { id: number; crop_name?: string; quantity_kg: number; status: string; offers_close_at?: string };
type Offer = {
  id: number; lot_id: number; price_per_q: number; quantity_kg: number;
  status: string; from_user_id: number; expires_at?: string; created_at: string;
};

function formatCountdown(closeAt?: string): { label: string; expired: boolean } {
  if (!closeAt) return { label: "", expired: false };
  const ms = new Date(closeAt).getTime() - Date.now();
  if (ms <= 0) return { label: "Offers closed", expired: true };
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 1) return { label: `Closes in ${hours}h ${mins}m`, expired: false };
  return { label: `Closes in ${mins}m`, expired: false };
}

export default function FarmerOffers() {
  const router = useRouter();
  const [groups, setGroups] = useState<{ lot: Lot; offers: Offer[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [counterOfferId, setCounterOfferId] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: lots } = await api.get<Lot[]>("/lots");
      // Only lots that can still receive/act on offers are worth checking.
      const relevant = lots.filter(l => l.status === "active" || l.status === "offered");
      const results = await Promise.all(
        relevant.map(async lot => {
          try {
            const { data: offers } = await api.get<Offer[]>(`/lots/${lot.id}/offers`);
            return { lot, offers };
          } catch {
            return { lot, offers: [] as Offer[] };
          }
        })
      );
      setGroups(results.filter(g => g.offers.length > 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (offerId: number, action: "accept" | "reject" | "counter", price?: string) => {
    setError("");
    setBusyOfferId(offerId);
    try {
      if (action === "counter") {
        await api.post(`/offers/${offerId}/counter`, { price_per_q: Number(price) });
        setCounterOfferId(null);
        setCounterPrice("");
        await load();
        return;
      }
      await api.post(`/offers/${offerId}/${action}`);
      if (action === "accept") {
        const { data: orders } = await api.get("/orders");
        const order = orders.find((o: any) => o.offer_id === offerId);
        if (order) { router.push(`/farmer/orders/${order.id}`); return; }
      }
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyOfferId(null);
    }
  };

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} aria-label="Go back"
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Offers</h1>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 12 }}>
            <span>⚠️</span><p>{error}</p>
          </div>
        )}

        {loading ? (
          <div>{[1, 2].map(i => <Skeleton key={i} height={120} />)}</div>
        ) : groups.length === 0 ? (
          <EmptyState icon="📨" title="No offers yet"
            description="Offers from buyers on your active lots will show up here."
            action={{ label: "View my produce", onClick: () => router.push("/farmer/lots") }} />
        ) : (
          groups.map(({ lot, offers }) => {
            const countdown = formatCountdown(lot.offers_close_at);
            return (
              <div key={lot.id} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {lot.crop_name || "Crop"} · {lot.quantity_kg}kg
                    </p>
                    <p style={{ fontSize: 12, color: "var(--stone-400)", margin: "2px 0 0" }}>
                      {offers.length} offer{offers.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {countdown.label && (
                    <span className={`badge ${countdown.expired ? "badge-gray" : "badge-amber"}`}>
                      {countdown.label}
                    </span>
                  )}
                </div>

                {offers.map((offer, i) => {
                  const actionable = offer.status === "pending" || offer.status === "countered";
                  return (
                    <div key={offer.id} style={{
                      padding: "10px 12px", borderRadius: 10,
                      border: i === 0 && actionable ? "1.5px solid var(--green-300)" : "1px solid var(--stone-200)",
                      background: i === 0 && actionable ? "var(--green-50, #f0fdf4)" : "white",
                      marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 16, fontWeight: 800 }}>₹{offer.price_per_q.toLocaleString("en-IN")}/q</span>
                          {i === 0 && actionable && (
                            <span className="badge badge-green" style={{ marginLeft: 8 }}>Best offer</span>
                          )}
                        </div>
                        <span className={`badge ${
                          offer.status === "accepted" ? "badge-green" :
                          offer.status === "rejected" || offer.status === "expired" ? "badge-gray" :
                          offer.status === "countered" ? "badge-blue" : "badge-amber"
                        }`}>
                          {offer.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--stone-400)", margin: "4px 0 0" }}>
                        {offer.quantity_kg}kg requested
                      </p>

                      {actionable && counterOfferId !== offer.id && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                            disabled={busyOfferId === offer.id}
                            onClick={() => act(offer.id, "accept")}>
                            {busyOfferId === offer.id ? "…" : "Accept"}
                          </button>
                          <button className="btn-secondary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                            disabled={busyOfferId === offer.id}
                            onClick={() => setCounterOfferId(offer.id)}>
                            Counter
                          </button>
                          <button style={{
                            flex: 1, padding: "8px", fontSize: 13, borderRadius: 8,
                            border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                          }} disabled={busyOfferId === offer.id}
                            onClick={() => act(offer.id, "reject")}>
                            Reject
                          </button>
                        </div>
                      )}

                      {counterOfferId === offer.id && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <input className="input" type="number" placeholder="Your price ₹/q"
                            value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
                            style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} />
                          <button className="btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}
                            disabled={!counterPrice || busyOfferId === offer.id}
                            onClick={() => act(offer.id, "counter", counterPrice)}>
                            Send
                          </button>
                          <button style={{
                            padding: "8px 10px", fontSize: 13, borderRadius: 8,
                            border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                          }} onClick={() => { setCounterOfferId(null); setCounterPrice(""); }}>
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      <FarmerBottomNav />
    </div>
  );
}
