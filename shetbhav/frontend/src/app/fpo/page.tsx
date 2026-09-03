"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Sidebar } from "@/components/ui";

export default function FPODashboard() {
  const router = useRouter();
  const { user, token, loadUser } = useAuth();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "members" | "lots">("overview");

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "fpo") {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get("/fpo/dashboard"),
      api.get("/fpo/members"),
      api.get("/fpo/lots"),
    ]).then(([d, m, l]) => {
      setDashboard(d.data);
      setMembers(m.data);
      setLots(l.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (!user || user.role !== "fpo") return null;

  const sidebarItems = [
    { icon: "🌾", label: "Overview", href: "/fpo#overview" },
    { icon: "👥", label: "Members", href: "/fpo#members" },
    { icon: "📦", label: "Lots", href: "/fpo#lots" },
  ];

  return (
    <div className="has-sidebar">
      <Sidebar active="/fpo" items={sidebarItems} title="ShetBhav FPO" subtitle="Collective Selling" />

      <div className="page-body">
        <div className="page-header" style={{ padding: "16px 0 12px" }}>
          <div>
            <h1 className="heading-md" style={{ margin: 0 }}>🌾 {dashboard?.fpo_name || "FPO Dashboard"}</h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
              {dashboard?.district || "Maharashtra"} · {dashboard?.member_count || 0} members
            </p>
          </div>
        </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid-2 section-gap">
          {[
            { label: "Members", value: dashboard.member_count, icon: "👥", color: "var(--color-primary)" },
            { label: "Active Lots", value: dashboard.active_lots, icon: "📦", color: "var(--color-accent)" },
            { label: "Total Volume", value: `${(dashboard.total_volume_kg / 1000).toFixed(1)}t`, icon: "⚖️", color: "var(--color-info)" },
            { label: "Completed", value: dashboard.completed_orders, icon: "✅", color: "var(--color-success)" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div className="stat-value" style={{ color: stat.color, fontSize: "clamp(20px, 5vw, 26px)" }}>
                {stat.value}
              </div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="scroll-x section-gap">
        {(["overview", "members", "lots"] as const).map((t) => (
          <button key={t} className={`toggle-btn ${tab === t ? "selected" : ""}`}
            onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>
            {t === "overview" ? "📊 Overview" : t === "members" ? "👥 Members" : "📦 Lots"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === "overview" && (
            <div className="flex-col gap-3">
              <div className="card">
                <h3 className="heading-sm">📋 FPO Summary</h3>
                <div className="flex-col gap-2" style={{ marginTop: 8 }}>
                  {[
                    ["Organization", dashboard?.fpo_name],
                    ["District", dashboard?.district],
                    ["Total Members", dashboard?.member_count],
                    ["Active Lots", dashboard?.active_lots],
                    ["Total Volume", `${dashboard?.total_volume_kg?.toLocaleString("en-IN")} kg`],
                    ["Total Orders", dashboard?.total_orders],
                    ["Completed Orders", dashboard?.completed_orders],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{String(label)}</span>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{String(value || "---")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 16, background: "#f0fdf4", borderLeft: "3px solid var(--color-success)" }}>
                <h3 className="heading-sm" style={{ color: "var(--color-success)" }}>💡 FPO Aggregation</h3>
                <p className="text-sm" style={{ margin: "8px 0 0 0", color: "var(--color-text-secondary)" }}>
                  Combine individual farmer lots into bulk orders for better prices. Select member lots and aggregate them for buyer demand matching.
                </p>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {tab === "members" && (
            <div className="flex-col gap-3">
              {members.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 32 }}>👥</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No members yet</p>
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 className="heading-sm" style={{ margin: 0 }}>{m.name}</h3>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                          {m.district} · {m.farm_size_acres || "---"} acres
                        </p>
                      </div>
                      <span className="badge">{m.active_lots} active lots</span>
                    </div>
                    <div className="grid-3" style={{ marginTop: 12 }}>
                      <div className="stat-card" style={{ padding: 0 }}>
                        <div className="stat-value" style={{ fontSize: 16 }}>{m.total_lots}</div>
                        <div className="stat-label">Lots</div>
                      </div>
                      <div className="stat-card" style={{ padding: 0 }}>
                        <div className="stat-value" style={{ fontSize: 16 }}>{m.total_quantity_kg?.toLocaleString("en-IN")}</div>
                        <div className="stat-label">kg Total</div>
                      </div>
                      <div className="stat-card" style={{ padding: 0 }}>
                        <div className="stat-value" style={{ fontSize: 16 }}>
                          {m.primary_crops?.length || 0}
                        </div>
                        <div className="stat-label">Crops</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      {m.primary_crops?.map((crop: string) => (
                        <span key={crop} style={{
                          padding: "2px 8px", borderRadius: 8, fontSize: 11,
                          background: "var(--color-success-light)", color: "var(--color-success)",
                        }}>
                          {crop === "tomato" ? "🍅" : crop === "onion" ? "🧅" : "🫘"} {crop}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Lots Tab */}
          {tab === "lots" && (
            <div className="flex-col gap-3">
              {lots.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 32 }}>📦</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No aggregated lots yet</p>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                    Contact admin to aggregate member lots
                  </p>
                </div>
              ) : (
                lots.map((lot) => (
                  <div key={lot.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 className="heading-sm" style={{ margin: 0 }}>
                          {lot.crop_name === "tomato" ? "🍅" : lot.crop_name === "onion" ? "🧅" : "🫘"} {lot.crop_name}
                        </h3>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                          Grade {lot.quality_grade} · {lot.quantity_kg?.toLocaleString("en-IN")} kg
                        </p>
                      </div>
                      <span className={`badge ${lot.status === "active" ? "badge-verified" : ""}`}>
                        {lot.status}
                      </span>
                    </div>
                    {lot.is_aggregated && (
                      <div style={{
                        marginTop: 8, padding: "4px 10px", borderRadius: 8,
                        background: "var(--color-info-light)", color: "var(--color-info)",
                        display: "inline-block", fontSize: 12, fontWeight: 500,
                      }}>
                        🔗 Aggregated · {lot.contributor_count} contributors
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <nav className="bottom-nav hide-desktop">
        <a href="/fpo" className="nav-item active"><span style={{ fontSize: 20 }}>🌾</span><span>FPO</span></a>
        <a href="/buyer" className="nav-item"><span style={{ fontSize: 20 }}>🏭</span><span>Buyers</span></a>
        <a href="/farmer/prices" className="nav-item"><span style={{ fontSize: 20 }}>📊</span><span>Prices</span></a>
        <a href="/farmer/orders" className="nav-item"><span style={{ fontSize: 20 }}>📋</span><span>Orders</span></a>
        <a href="/login" className="nav-item"><span style={{ fontSize: 20 }}>👤</span><span>Profile</span></a>
      </nav>
      </div>
    </div>
  );
}
