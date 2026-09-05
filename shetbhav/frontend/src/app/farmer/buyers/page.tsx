"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import MapView, { MapPoint } from "@/components/MapView";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";
import { cropEmoji } from "@/lib/cropEmoji";

export default function BuyersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<"buyers" | "fpos">("buyers");
  const [buyers, setBuyers] = useState<any[]>([]);
  const [fpos, setFpos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/buyers"),
      api.get("/fpo/browse").catch(() => ({ data: [] })),
    ]).then(([b, f]) => { setBuyers(b.data); setFpos(f.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const trustColor = (score: number) => score >= 85 ? "#16a34a" : score >= 70 ? "#f59e0b" : "#ef4444";

  // Build map points from buyers (using district coordinates as fallback)
  const districtCoords: Record<string, [number, number]> = {
    Pune: [18.52, 73.86],
    Mumbai: [19.08, 72.88],
    Nashik: [20.0, 73.79],
    Kolhapur: [16.71, 74.24],
    Nagpur: [21.15, 79.09],
  };

  const mapPoints: MapPoint[] = buyers.map((b: any) => {
    const coords = districtCoords[b.district] || [19.75, 75.71];
    return {
      id: b.id,
      name: b.business_name,
      lat: coords[0] + (Math.random() - 0.5) * 0.05,
      lng: coords[1] + (Math.random() - 0.5) * 0.05,
      type: "buyer" as const,
      detail: `${b.business_type} · Trust: ${b.trust_score}`,
      badge: b.business_type,
    };
  });

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="page-header">
        <button onClick={() => router.back()} aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 12, margin: -4, minWidth: 44, minHeight: 44 }}>←</button>
        <h1 className="heading-md">Buyers &amp; FPOs</h1>
      </div>

      <div className="page-body">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("buyers")} className="toggle-btn" style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: tab === "buyers" ? "var(--green-600)" : "white",
          color: tab === "buyers" ? "white" : "var(--text-secondary)",
        }}>
          🤝 Buyers ({buyers.length})
        </button>
        <button onClick={() => setTab("fpos")} className="toggle-btn" style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: tab === "fpos" ? "var(--green-600)" : "white",
          color: tab === "fpos" ? "white" : "var(--text-secondary)",
        }}>
          🏢 FPOs ({fpos.length})
        </button>
      </div>

      {tab === "buyers" && (
        <>
      {/* Map Toggle */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowMap(!showMap)}
          className="toggle-btn"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10, fontSize: 13,
          }}
        >
          🗺️ {showMap ? "Hide Map" : "Show Buyers on Map"}
        </button>
      </div>

      {/* Map View */}
      {showMap && mapPoints.length > 0 && (
        <div className="section-gap">
          <MapView
            points={mapPoints}
            center={[19.75, 75.71]}
            zoom={7}
            height="280px"
          />
          <p className="text-xs" style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
            Buyer locations approximate to their registered district
          </p>
        </div>
      )}
      </>
      )}

      {tab === "fpos" && (
        loading ? (
          <div className="flex-col gap-3">{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}</div>
        ) : fpos.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32 }}>🏢</p>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No FPOs registered yet</p>
          </div>
        ) : (
          <div className="flex-col gap-3">
            {fpos.map((fpo: any) => (
              <div key={fpo.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 className="heading-sm" style={{ margin: 0 }}>{fpo.name}</h3>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                      {fpo.district || "—"} · {fpo.member_count} member{fpo.member_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {fpo.verification_status === "verified" && (
                    <span className="badge badge-verified">✓ Verified</span>
                  )}
                </div>
                <button className="btn-primary btn-sm" style={{ marginTop: 12, width: "100%" }}
                  onClick={() => router.push("/farmer/fpo")}>
                  View & Join
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "buyers" && (loading ? (
        <div className="flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
        </div>
      ) : (
        <div className="flex-col gap-3">
          {buyers.map(buyer => (
            <div key={buyer.id} className="card" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="heading-sm" style={{ margin: 0 }}>{buyer.business_name}</h3>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                    {buyer.business_type} · {buyer.district}
                  </p>
                </div>
                <span className="badge badge-verified" style={{ flexShrink: 0 }}>✓ {t("verified")}</span>
              </div>

              <div className="grid-3" style={{ marginTop: 14 }}>
                <div className="stat-card" style={{ padding: 0 }}>
                  <div className="stat-value" style={{ color: trustColor(buyer.trust_score), fontSize: "clamp(18px, 4vw, 22px)" }}>
                    {buyer.trust_score}
                  </div>
                  <div className="stat-label">{t("trust_score")}</div>
                </div>
                <div className="stat-card" style={{ padding: 0 }}>
                  <div className="stat-value" style={{ fontSize: "clamp(18px, 4vw, 22px)" }}>
                    {buyer.completed_transactions}
                  </div>
                  <div className="stat-label">{t("transactions")}</div>
                </div>
                <div className="stat-card" style={{ padding: 0 }}>
                  <div className="stat-value" style={{ color: "#3b82f6", fontSize: "clamp(18px, 4vw, 22px)" }}>
                    {buyer.completed_transactions > 0
                      ? Math.round((buyer.successful_payments / buyer.completed_transactions) * 100)
                      : 0}%
                  </div>
                  <div className="stat-label">{t("payment_reliability")}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {buyer.required_crops?.map((crop: string) => (
                  <span key={crop} style={{
                    padding: "3px 8px", borderRadius: 8, fontSize: 12,
                    background: "var(--color-success-light)", color: "var(--color-success)",
                  }}>
                    {cropEmoji(crop)} {crop}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      </div>

      <FarmerBottomNav />
    </div>
  );
}
