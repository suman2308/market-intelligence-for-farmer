"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { SourceLabel, BottomNav, Skeleton } from "@/components/ui";

export default function FarmerHome() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [dashboard, setDashboard] = useState<any>(null);
  const [prices, setPrices] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser().then(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user) {
      api.get("/farmers/dashboard").then(r => setDashboard(r.data)).catch(() => {});
      api.get("/markets/prices?crop_id=1").then(r => setPrices(r.data)).catch(() => {});
    }
  }, [user]);

  if (loading) return <div style={{ padding: 16 }}><Skeleton height={60} count={4} /></div>;
  if (!user) { router.push("/login"); return null; }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return lang === "hi" ? "सुप्रभात" : lang === "mr" ? "सुप्रभात" : "Good Morning";
    if (hour < 17) return lang === "hi" ? "नमस्कार" : lang === "mr" ? "नमस्कार" : "Good Afternoon";
    return lang === "hi" ? "शुभ संध्या" : lang === "mr" ? "शुभ संध्या" : "Good Evening";
  };

  return (
    <div className="page-bg-organic">
      {/* ── Greeting Header ── */}
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, margin: 0, color: "#6b7280", letterSpacing: "0.3px" }}>{greeting()},</p>
            <h1 style={{
              fontSize: "clamp(24px, 5vw, 30px)",
              fontWeight: 800,
              margin: "4px 0 0 0",
              background: "linear-gradient(135deg, #166534, #15803d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>{user.full_name.split(" ")[0]}</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0 0" }}>
              📍 {user.language === "hi" ? "नाशिक, महाराष्ट्र" : user.language === "mr" ? "नाशिक, महाराष्ट्र" : "Nashik, Maharashtra"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={lang} onChange={e => setLang(e.target.value as any)}
              aria-label="Select language"
              style={{
                width: "auto", padding: "6px 10px", fontSize: 12, borderRadius: 10, minHeight: 36,
                border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", fontWeight: 600, color: "#374151",
              }}>
              <option value="en">EN</option>
              <option value="hi">हिं</option>
              <option value="mr">मरा</option>
            </select>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: "linear-gradient(135deg, #166534, #15803d)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "white", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(22, 101, 52, 0.3)",
            }}>
              {user.full_name.charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero Sell Card ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="featured-card" onClick={() => router.push("/farmer/sell")}
          role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && router.push("/farmer/sell")}
          style={{ minHeight: 150, cursor: "pointer" }}>
          <div style={{
            fontSize: 42, marginBottom: 4, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))",
            position: "relative", zIndex: 1,
          }}>🌾</div>
          <span style={{
            fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 800, letterSpacing: "0.3px",
            position: "relative", zIndex: 1,
          }}>{t("sell_my_produce")}</span>
          <span style={{
            fontSize: 13, opacity: 0.8, fontWeight: 500,
            position: "relative", zIndex: 1,
          }}>{t("find_best_options")}</span>
        </div>
      </div>

      {/* ── Today's Market Price ── */}
      {prices && (
        <div className="price-card-premium section-gap" style={{ cursor: "pointer" }}
          onClick={() => router.push("/farmer/prices")}
          role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && router.push("/farmer/prices")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10,
                background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>📊</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t("todays_prices")}</span>
            </div>
            <span style={{ fontSize: 18, color: "#9ca3af" }}>→</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{
                  fontSize: "clamp(30px, 7vw, 38px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.5px",
                  background: "linear-gradient(135deg, #166534, #15803d)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  ₹{prices.prices?.modal_price?.toLocaleString("en-IN") || "---"}
                </span>
                <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 400 }}>/q</span>
              </div>
              <p style={{ fontSize: 12, margin: "6px 0 0 0", color: "#6b7280" }}>
                Tomato · Nashik APMC
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, margin: 0, color: "#9ca3af" }}>Range</p>
              <p style={{ fontSize: 14, margin: "2px 0 0 0", fontWeight: 600, color: "#374151" }}>
                ₹{prices.prices?.min_price?.toLocaleString("en-IN")} — {prices.prices?.max_price?.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <SourceLabel source={prices.data_source_label || "Synthetic demo data"} />
        </div>
      )}

      {/* ── Dashboard Stats ── */}
      {dashboard && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 12 }}>{t("dashboard")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { value: dashboard.active_lots, label: t("active_lots"), color: "#166534", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", icon: "📦", route: "/farmer/lots" },
              { value: dashboard.pending_orders, label: t("pending_orders"), color: "#92400e", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", icon: "🚚", route: "/farmer/orders" },
              { value: dashboard.total_earnings > 0 ? `₹${(dashboard.total_earnings / 1000).toFixed(1)}K` : "₹0", label: t("my_earnings"), color: "#1e40af", bg: "linear-gradient(135deg, #eff6ff, #dbeafe)", icon: "💰", route: "/farmer/earnings" },
              { value: "→", label: t("find_buyers"), color: "#6b21a8", bg: "linear-gradient(135deg, #faf5ff, #f3e8ff)", icon: "🔍", route: "/farmer/buyers" },
            ].map((s, i) => (
              <div key={i} className="stat-card-premium"
                onClick={() => router.push(s.route)} style={{ cursor: "pointer" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, background: s.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, margin: "0 auto 8px",
                }}>{s.icon}</div>
                <div style={{
                  fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, color: s.color, lineHeight: 1,
                }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ cursor: "pointer", textAlign: "center", padding: "16px 12px" }}
          onClick={() => router.push("/farmer/lots")}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #fef3c7, #fde68a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, margin: "0 auto 8px",
          }}>📦</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t("my_produce")}</span>
        </div>
        <div className="card" style={{ cursor: "pointer", textAlign: "center", padding: "16px 12px" }}
          onClick={() => router.push("/farmer/profile")}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, margin: "0 auto 8px",
          }}>⚙️</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t("help")}</span>
        </div>
      </div>

      {/* Data Disclaimer */}
      <p className="data-source" style={{ textAlign: "center", marginTop: 8 }}>
        {prices?.source === "synthetic_demo" ? t("synthetic_label") : t("real_label")}
      </p>

      {/* Bottom Nav */}
      <BottomNav
        active="/farmer"
        items={[
          { icon: "🏠", label: t("home"), href: "/farmer" },
          { icon: "📊", label: t("markets"), href: "/farmer/prices" },
          { icon: "💰", label: t("sell_my_produce"), href: "/farmer/sell" },
          { icon: "📋", label: t("orders"), href: "/farmer/orders" },
          { icon: "👤", label: t("more"), href: "/farmer/profile" },
        ]}
      />
    </div>
  );
}
