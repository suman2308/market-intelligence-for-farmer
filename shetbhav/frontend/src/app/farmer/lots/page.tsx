"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function FarmerLots() {
  const router = useRouter();
  const { t } = useI18n();
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLotId, setExpandedLotId] = useState<number | null>(null);
  const [matchesByLot, setMatchesByLot] = useState<Record<number, any[]>>({});
  const [matchLoading, setMatchLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.get("/lots").then(r => { setLots(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const toggleMatches = (lotId: number) => {
    if (expandedLotId === lotId) { setExpandedLotId(null); return; }
    setExpandedLotId(lotId);
    if (!matchesByLot[lotId]) {
      setMatchLoading(prev => ({ ...prev, [lotId]: true }));
      api.get(`/matching/${lotId}`)
        .then(r => setMatchesByLot(prev => ({ ...prev, [lotId]: r.data.matches || [] })))
        .catch(() => setMatchesByLot(prev => ({ ...prev, [lotId]: [] })))
        .finally(() => setMatchLoading(prev => ({ ...prev, [lotId]: false })));
    }
  };

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("my_produce")}</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => router.push("/farmer/sell")}>
          ➕ {t("create_lot")}
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => router.push("/farmer/offers")}>
          📨 Offers
        </button>
      </div>
      <button className="btn-secondary" style={{ width: "100%", marginBottom: 16 }}
        onClick={() => router.push("/farmer/demands")}>
        📋 Browse buyer demands
      </button>

      {loading ? (
        <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
      ) : lots.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, margin: 0 }}>📦</p>
          <p style={{ fontSize: 16, color: "#6b7280", margin: "12px 0 0 0" }}>No lots yet. Create your first lot!</p>
        </div>
      ) : (
        lots.map(lot => (
          <div key={lot.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
              onClick={() => router.push(`/lots/${lot.id}`)}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {lot.crop_name || "Crop"} - {lot.quantity_kg}kg
                </p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                  Grade {lot.quality_grade} · {lot.urgency}
                  {lot.price_per_q ? ` · ₹${lot.price_per_q.toLocaleString("en-IN")}/q` : ""}
                </p>
                {lot.address && <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0 0" }}>{lot.address}</p>}
              </div>
              <span className={`badge ${lot.status === "active" ? "badge-active" : "badge-completed"}`}>
                {lot.status}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {lot.status === "active" && (
                <>
                  <button className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: 14 }}
                    onClick={() => router.push("/farmer/sell")}>
                    💰 Find Buyers
                  </button>
                  <button className="btn-secondary" style={{ flex: 1, padding: "10px", fontSize: 14 }}
                    onClick={() => toggleMatches(lot.id)}>
                    🔍 {expandedLotId === lot.id ? "Hide matches" : "Suggested buyers"}
                  </button>
                </>
              )}
            </div>

            {expandedLotId === lot.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--stone-100, #f5f5f4)" }}>
                {matchLoading[lot.id] ? (
                  <div className="skeleton" style={{ height: 60 }} />
                ) : (matchesByLot[lot.id] || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--stone-400)", margin: 0 }}>
                    No buyer demand currently matches this lot.
                  </p>
                ) : (
                  matchesByLot[lot.id].slice(0, 3).map(m => (
                    <div key={m.demand_id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: "1px solid var(--stone-100, #f5f5f4)",
                    }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{m.buyer_name}</p>
                        <p style={{ fontSize: 12, color: "var(--stone-400)", margin: "2px 0 0" }}>
                          Wants {m.quantity_needed}kg · {m.district || "—"}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>₹{m.offered_price?.toLocaleString("en-IN")}/q</p>
                        <span className="badge badge-green" style={{ fontSize: 10 }}>{m.score}% match</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
      </div>
      <FarmerBottomNav />
    </div>
  );
}
