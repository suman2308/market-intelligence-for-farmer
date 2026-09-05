"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleHomePath } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { DataSourceBadge, Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";
import { cropEmoji } from "@/lib/cropEmoji";

/**
 * Farmer Dashboard — शेतभाव
 * Mobile-first. One main action per screen.
 * Shows: greeting → today's prices (all crops) → stats → my produce.
 */
export default function FarmerHome() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t, lang } = useI18n();
  const [dashboard, setDashboard] = useState<any>(null);
  const [crops, setCrops] = useState<any[]>([]);
  const [cropPrices, setCropPrices] = useState<Record<number, any>>({});
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [lotsError, setLotsError] = useState(false);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [priceIndex, setPriceIndex] = useState(0);

  useEffect(() => { loadUser().then(() => setLoading(false)); }, []);

  // Auto-rotate the price carousel one full card at a time, looping back
  // to the first crop after the last — a smooth CSS transform transition,
  // not a scroll-snap drag, so exactly one card is ever fully in view.
  useEffect(() => {
    if (!sectionsLoaded || crops.length <= 1) return;
    const timer = setInterval(() => {
      setPriceIndex(i => (i + 1) % crops.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [sectionsLoaded, crops.length]);

  const loadDashboardAndLots = () => {
    if (!user) return;
    setDashboardError(false);
    setLotsError(false);
    Promise.all([
      api.get("/farmers/dashboard").catch(() => { setDashboardError(true); return { data: null }; }),
      api.get("/crops").catch(() => ({ data: [] })),
      api.get("/lots").catch(() => { setLotsError(true); return { data: [] }; }),
    ]).then(async ([d, c, l]) => {
      setDashboard(d.data);
      setLots(l.data);
      const cropList: any[] = c.data || [];
      setCrops(cropList);
      const priceResults = await Promise.all(
        cropList.map((crop: any) =>
          api.get(`/markets/prices?crop_id=${crop.id}`).then(r => r.data).catch(() => null)
        )
      );
      const priceMap: Record<number, any> = {};
      cropList.forEach((crop: any, i: number) => { priceMap[crop.id] = priceResults[i]; });
      setCropPrices(priceMap);
      setSectionsLoaded(true);
    });
  };

  useEffect(loadDashboardAndLots, [user]);

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
  if (user.role !== "farmer") { router.push(roleHomePath(user.role)); return null; }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return lang === "hi" ? "सुप्रभात" : lang === "mr" ? "सुप्रभात" : "Good Morning";
    if (h < 17) return lang === "hi" ? "नमस्कार" : lang === "mr" ? "नमस्कार" : "Good Afternoon";
    return lang === "hi" ? "शुभ संध्या" : lang === "mr" ? "शुभ संध्या" : "Good Evening";
  };

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
        <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>📍 Nashik, Maharashtra</p>
      </div>

      {/* ── Today's Prices — sliding carousel across every crop ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p className="heading-sm" style={{ margin: 0 }}>📊 {t("todays_prices") || "Today's Prices"}</p>
      </div>
      {!sectionsLoaded ? (
        <div className="section-gap" style={{ display: "flex", gap: 10, overflow: "hidden" }}>
          <Skeleton height={140} />
        </div>
      ) : (
        <div className="section-gap">
        <div style={{ overflow: "hidden", borderRadius: 14 }}>
          <div style={{
            display: "flex",
            width: `${crops.length * 100}%`,
            transform: `translateX(-${priceIndex * (100 / crops.length)}%)`,
            transition: "transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)",
          }}>
          {crops.map((crop: any) => {
            const p = cropPrices[crop.id];
            return (
              <div key={crop.id} className="card" style={{ flex: `0 0 ${100 / crops.length}%`, cursor: "pointer", margin: 0, borderRadius: 0 }}
                onClick={() => router.push("/farmer/prices")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{cropEmoji(crop.name)} {crop.name}</p>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>→</span>
                </div>
                {p ? (
                  <>
                    <div className="price-big" style={{ fontSize: "clamp(24px, 5.5vw, 30px)" }}>
                      ₹{p.prices?.modal_price?.toLocaleString("en-IN") || "---"}
                    </div>
                    <p className="text-xs" style={{ margin: "4px 0 8px" }}>
                      Range ₹{p.prices?.min_price?.toLocaleString("en-IN")} – ₹{p.prices?.max_price?.toLocaleString("en-IN")}
                    </p>
                    <DataSourceBadge source={p.data_source_label || "Synthetic demo data"} />
                  </>
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Price unavailable</p>
                )}
              </div>
            );
          })}
          </div>
        </div>
        {crops.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
            {crops.map((crop: any, i: number) => (
              <span key={crop.id} style={{
                width: i === priceIndex ? 16 : 6, height: 6, borderRadius: 3,
                background: i === priceIndex ? "var(--green-600)" : "var(--stone-200)",
                transition: "all 0.3s ease",
              }} />
            ))}
          </div>
        )}
        </div>
      )}

      {/* ── Dashboard Stats ── */}
      {!sectionsLoaded ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} />
        </div>
      ) : dashboardError ? (
        <div className="card section-gap" style={{ borderColor: "var(--danger)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, margin: 0, color: "var(--danger)" }}>⚠️ Couldn't load your dashboard stats.</p>
          <button className="btn-sm" onClick={loadDashboardAndLots} style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Retry
          </button>
        </div>
      ) : dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { value: dashboard.active_lots, label: t("active_lots") || "Active Lots", icon: "📦", color: "var(--green-600)", route: "/farmer/lots" },
            { value: dashboard.pending_orders, label: t("pending_orders") || "Pending Orders", icon: "🚚", color: "var(--saffron-500)", route: "/farmer/orders" },
            { value: dashboard.total_earnings > 0 ? `₹${(dashboard.total_earnings / 1000).toFixed(1)}K` : "₹0", label: t("my_earnings") || "Earnings", icon: "💰", color: "var(--sky-500)", route: "/farmer/earnings" },
            { value: "→", label: "Buyers & FPOs", icon: "🏢", color: "var(--stone-500)", route: "/farmer/buyers" },
          ].map((s, i) => (
            <div key={i} className="stat-card-premium" onClick={() => router.push(s.route)}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── My Lots ── */}
      {!sectionsLoaded ? (
        <div className="section-gap"><Skeleton height={70} count={2} /></div>
      ) : lotsError ? (
        <div className="card section-gap" style={{ borderColor: "var(--danger)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, margin: 0, color: "var(--danger)" }}>⚠️ Couldn't load your produce lots.</p>
          <button className="btn-sm" onClick={loadDashboardAndLots} style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Retry
          </button>
        </div>
      ) : lots.length === 0 ? (
        <div className="card section-gap" style={{ textAlign: "center", padding: "20px 16px" }}>
          <p style={{ fontSize: 24, margin: "0 0 4px" }}>🌾</p>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>No produce listed yet</p>
          <p className="text-xs" style={{ margin: "0 0 12px" }}>List your first lot to start reaching buyers.</p>
          <button className="btn-sm" onClick={() => router.push("/farmer/lots")} style={{ background: "var(--green-600)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            + List Produce
          </button>
        </div>
      ) : (
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
                    {cropEmoji(lot.crop_name)}
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
      </div>

      <FarmerBottomNav />
    </div>
  );
}
