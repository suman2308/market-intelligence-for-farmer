"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import {
  DataSourceBadge, Skeleton, ConfidenceBadge,
  WhyExplainer, VoicePlayButton,
} from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Farmer Dashboard — शेतभाव
 * Mobile-first. One main action per screen.
 * Shows: greeting → Smart Sell recommendation → quick actions → market price → stats.
 */
export default function FarmerHome() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [dashboard, setDashboard] = useState<any>(null);
  const [prices, setPrices] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser().then(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user) {
      Promise.all([
        api.get("/farmers/dashboard").catch(() => ({ data: null })),
        api.get("/markets/prices?crop_id=1").catch(() => ({ data: null })),
        api.get("/lots").catch(() => ({ data: [] })),
      ]).then(([d, p, l]) => {
        setDashboard(d.data); setPrices(p.data); setLots(l.data);
      }).catch(() => {});
      // Get Smart Sell recommendation
      api.post("/smart-sell", {
        crop_id: 2, quantity_kg: 1000, quality_grade: "A",
        location_lat: 20.0057, location_lng: 73.7229,
        storage_available: true, urgency: "soon",
      }).then(r => setRecommendation(r.data)).catch(() => {});
    }
  }, [user]);

  if (loading) return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="page-body">
        <div style={{ padding: "10px 0 14px" }}>
          <Skeleton height={14} />
          <div style={{ height: 6 }} />
          <Skeleton height={30} />
        </div>
        <Skeleton height={150} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "14px 0" }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </div>
        <Skeleton height={130} />
        <div style={{ height: 12 }} />
        <Skeleton height={70} count={2} />
      </div>
      <FarmerBottomNav />
    </div>
  );
  if (!user) { router.push("/login"); return null; }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return lang === "hi" ? "सुप्रभात" : lang === "mr" ? "सुप्रभात" : "Good Morning";
    if (h < 17) return lang === "hi" ? "नमस्कार" : lang === "mr" ? "नमस्कार" : "Good Afternoon";
    return lang === "hi" ? "शुभ संध्या" : lang === "mr" ? "शुभ संध्या" : "Good Evening";
  };

  const best = recommendation?.best_option;

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="page-body">
      {/* ── Greeting ── */}
      <div style={{ padding: "8px 0 12px" }}>
        <p className="text-xs" style={{ margin: 0 }}>{greeting()},</p>
        <h1 className="heading-xl" style={{ background: "linear-gradient(135deg, var(--green-700), var(--green-600))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "2px 0 0" }}>
          {user.full_name.split(" ")[0]}
        </h1>
        <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--stone-400)" }}>📍 Nashik, Maharashtra</p>
      </div>

      {/* ── Smart Sell Recommendation Card ── */}
      {best && (
        <div className="card section-gap" style={{
          background: "linear-gradient(135deg, var(--saffron-500), var(--saffron-700))",
          color: "white", border: "none", cursor: "pointer",
          boxShadow: "0 6px 18px rgba(217, 119, 6, 0.25)",
        }} onClick={() => router.push("/farmer/sell")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, margin: 0, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🧠 Smart Sell Recommendation
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 0" }}>
                ₹{best.net_realization_per_q.toLocaleString("en-IN")}<span style={{ fontSize: 13, fontWeight: 400, opacity: 0.75 }}> /q net</span>
              </p>
            </div>
            <span style={{
              background: "white", color: "var(--saffron-700)", padding: "4px 10px",
              borderRadius: 20, fontSize: 13, fontWeight: 800,
            }}>
              {best.score}/100
            </span>
          </div>
          <p style={{ fontSize: 14, margin: "0 0 8px", opacity: 0.95 }}>
            → {best.target_name}
          </p>
          {best.reasons?.slice(0, 2).map((r: string, i: number) => (
            <p key={i} style={{ fontSize: 12, margin: "2px 0", opacity: 0.85 }}>✓ {r}</p>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button className="btn-sm" style={{
              background: "white", color: "var(--saffron-700)", border: "none",
              fontWeight: 800, padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>
              View Details →
            </button>
            <VoicePlayButton text={recommendation.explanation} label="🔊 Listen" />
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { icon: "📊", label: t("todays_prices") || "Prices", route: "/farmer/prices" },
          { icon: "🌾", label: t("sell_my_produce") || "Sell", route: "/farmer/sell" },
          { icon: "🏭", label: t("find_buyers") || "Buyers", route: "/farmer/buyers" },
        ].map((a, i) => (
          <button key={i} onClick={() => router.push(a.route)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "14px 8px", borderRadius: 14, border: "1.5px solid var(--stone-200)",
            background: "white", cursor: "pointer", fontFamily: "inherit", minHeight: 72,
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--stone-600)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── Market Price Snapshot ── */}
      {prices && (
        <div className="card section-gap" style={{ cursor: "pointer" }} onClick={() => router.push("/farmer/prices")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p className="heading-sm" style={{ margin: 0 }}>📊 {t("todays_prices") || "Today's Prices"}</p>
            <span style={{ fontSize: 14, color: "var(--stone-400)" }}>→</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div className="price-big" style={{ fontSize: "clamp(26px, 6vw, 34px)" }}>
                ₹{prices.prices?.modal_price?.toLocaleString("en-IN") || "---"}
              </div>
              <p className="text-xs" style={{ margin: "4px 0 0" }}>Tomato · Nashik APMC</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="text-xs">Range</p>
              <p style={{ fontSize: 13, fontWeight: 600 }}>
                ₹{prices.prices?.min_price?.toLocaleString("en-IN")} — ₹{prices.prices?.max_price?.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <DataSourceBadge source={prices.data_source_label || "Synthetic demo data"} />
        </div>
      )}

      {/* ── Dashboard Stats ── */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { value: dashboard.active_lots, label: t("active_lots") || "Active Lots", icon: "📦", color: "var(--green-600)" },
            { value: dashboard.pending_orders, label: t("pending_orders") || "Pending Orders", icon: "🚚", color: "var(--saffron-500)" },
            { value: dashboard.total_earnings > 0 ? `₹${(dashboard.total_earnings / 1000).toFixed(1)}K` : "₹0", label: t("my_earnings") || "Earnings", icon: "💰", color: "var(--sky-500)" },
            { value: "→", label: t("find_buyers") || "Find Buyers", icon: "🔍", color: "var(--stone-500)" },
          ].map((s, i) => (
            <div key={i} className="stat-card-premium"
              onClick={() => router.push(i === 3 ? "/farmer/buyers" : i === 0 ? "/farmer/lots" : i === 1 ? "/farmer/orders" : "/farmer/earnings")}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── My Lots ── */}
      {lots.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p className="heading-sm">My Produce</p>
            <button onClick={() => router.push("/farmer/lots")} style={{ background: "none", border: "none", color: "var(--green-600)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              View all →
            </button>
          </div>
          {lots.slice(0, 3).map((lot: any) => (
            <div key={lot.id} className="card" style={{ marginBottom: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>
                    {lot.crop_name?.toLowerCase() === "tomato" ? "🍅" : lot.crop_name?.toLowerCase() === "onion" ? "🧅" : "🫘"}
                  </span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{lot.crop_name} · {lot.quantity_kg}kg</p>
                    <p className="text-xs" style={{ margin: "1px 0 0" }}>Grade {lot.quality_grade}</p>
                  </div>
                </div>
                <span className={`badge badge-${lot.status === "active" ? "active" : "completed"}`}>{lot.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Data Disclaimer ── */}
      <p className="data-source data-source-synthetic" style={{ textAlign: "center", marginTop: 8 }}>
        🧪 {prices?.source === "synthetic_demo" ? "Demo data — not live market prices" : "Live market data"}
      </p>
      </div>

      <FarmerBottomNav />
    </div>
  );
}
