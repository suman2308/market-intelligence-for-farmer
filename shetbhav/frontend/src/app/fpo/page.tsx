"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth, roleHomePath } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { NotificationBell, EmptyState } from "@/components/ui";
import { cropEmoji } from "@/lib/cropEmoji";
import { totalAmount, formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FpoTab = "overview" | "members" | "lots" | "demands" | "available-lots" | "payments";

export default function FPODashboard() {
  const router = useRouter();
  const { user, loadUser, logout } = useAuth();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [demands, setDemands] = useState<any[]>([]);
  const [availableLots, setAvailableLots] = useState<any[]>([]);
  const [fpoOrders, setFpoOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<FpoTab>("overview");
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfilledIds, setFulfilledIds] = useState<Set<number>>(new Set());
  const [demandError, setDemandError] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const [selectedAvailableLots, setSelectedAvailableLots] = useState<Set<number>>(new Set());
  const [aggregatePrice, setAggregatePrice] = useState("");
  const [aggregating, setAggregating] = useState(false);
  const [aggregateError, setAggregateError] = useState("");
  const [distributingOrderId, setDistributingOrderId] = useState<number | null>(null);
  const [distributionResult, setDistributionResult] = useState<any>(null);
  const [distributeError, setDistributeError] = useState("");
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadUser().finally(() => setAuthChecked(true));
  }, []);

  const load = () => {
    Promise.all([
      api.get("/fpo/dashboard"),
      api.get("/fpo/members"),
      api.get("/fpo/lots"),
      api.get("/demand", { params: { status: "open" } }),
      api.get("/fpo/members/pending").catch(() => ({ data: [] })),
      api.get("/fpo/available-lots").catch(() => ({ data: [] })),
      api.get("/fpo/orders").catch(() => ({ data: [] })),
    ]).then(([d, m, l, dem, pm, al, fo]) => {
      setDashboard(d.data);
      setMembers(m.data);
      setLots(l.data);
      setDemands(dem.data);
      setPendingMembers(pm.data);
      setAvailableLots(al.data);
      setFpoOrders(fo.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "fpo") {
      router.push(roleHomePath(user.role));
      return;
    }
    load();
  }, [user, authChecked]);

  if (!authChecked || !user || user.role !== "fpo") return null;

  const sidebarItems = [
    { icon: "🌾", label: "Overview", tab: "overview" as const },
    { icon: "👥", label: "Members", tab: "members" as const },
    { icon: "📦", label: "Lots", tab: "lots" as const },
    { icon: "🔍", label: "Available Lots", tab: "available-lots" as const },
    { icon: "📋", label: "Demands", tab: "demands" as const },
    { icon: "💰", label: "Payments", tab: "payments" as const },
  ];

  const goLogout = () => { logout(); router.push("/login"); };

  const openTab = (t: FpoTab) => {
    setTab(t);
    contentRef.current?.scrollTo({ top: 0 });
  };

  const approveMember = async (membershipId: number) => {
    setMemberActionError("");
    try {
      await api.put(`/fpo/members/${membershipId}/approve`);
      load();
    } catch (e: any) {
      setMemberActionError(e.response?.data?.detail || "Couldn't approve this request.");
    }
  };

  const rejectMember = async (membershipId: number) => {
    setMemberActionError("");
    try {
      await api.put(`/fpo/members/${membershipId}/reject`);
      load();
    } catch (e: any) {
      setMemberActionError(e.response?.data?.detail || "Couldn't decline this request.");
    }
  };

  const toggleAvailableLot = (lotId: number) => {
    setSelectedAvailableLots(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId); else next.add(lotId);
      return next;
    });
  };

  const requestAggregation = async () => {
    if (selectedAvailableLots.size === 0) return;
    setAggregating(true);
    setAggregateError("");
    try {
      await api.post("/fpo/aggregate-request", {
        lot_ids: Array.from(selectedAvailableLots),
        expected_price_per_q: aggregatePrice ? Number(aggregatePrice) : null,
      });
      setSelectedAvailableLots(new Set());
      setAggregatePrice("");
      load();
    } catch (e: any) {
      setAggregateError(e.response?.data?.detail || "Couldn't send the aggregation request.");
    } finally {
      setAggregating(false);
    }
  };

  const distributePayment = async (orderId: number) => {
    setDistributingOrderId(orderId);
    setDistributeError("");
    setDistributionResult(null);
    try {
      const { data } = await api.post(`/fpo/orders/${orderId}/distribute-payment`);
      setDistributionResult(data);
      load();
    } catch (e: any) {
      setDistributeError(e.response?.data?.detail || "Couldn't distribute payment.");
    } finally {
      setDistributingOrderId(null);
    }
  };

  const activeLots = lots.filter((l: any) => l.status === "active");
  const lotsForDemand = (demand: any) =>
    activeLots.filter((l: any) => l.crop_id === demand.crop_id && l.quantity_kg >= demand.quantity_kg);

  const openRespond = (demand: any) => {
    setDemandError("");
    setRespondingTo(demand.id);
    const matchingLot = lotsForDemand(demand)[0];
    setSelectedLotId(matchingLot ? String(matchingLot.id) : "");
  };

  const fulfil = async (demand: any) => {
    if (!selectedLotId) return;
    setFulfilling(true);
    setDemandError("");
    try {
      await api.post(`/demand/${demand.id}/fulfil`, { lot_id: Number(selectedLotId) });
      setFulfilledIds(prev => new Set(prev).add(demand.id));
      setRespondingTo(null);
    } catch (e: any) {
      setDemandError(e.response?.data?.detail || "Could not fulfil this demand. Please try again.");
    } finally {
      setFulfilling(false);
    }
  };

  return (
    <div className="role-app">
      {/* Left panel — brand, role, navigation (desktop) */}
      <aside className="role-side hide-mobile" aria-label="FPO navigation">
        <div className="role-side-brand">
          <div className="role-brand-name"><span className="role-brand-logo">🌾</span>ShetBhav</div>
          <div className="role-side-role">FPO</div>
        </div>
        <nav className="role-side-nav">
          {sidebarItems.map(item => (
            <button key={item.tab}
              className={`role-nav-item ${tab === item.tab ? "active" : ""}`}
              onClick={() => openTab(item.tab)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right column — white top bar + scrollable content */}
      <div className="role-main">
        <header className="role-topbar">
          <div style={{ minWidth: 0 }}>
            <h1 className="role-topbar-name">🌾 {dashboard?.fpo_name || "FPO Dashboard"}</h1>
            <p className="role-topbar-sub">
              {dashboard?.district || "Maharashtra"} · {dashboard?.member_count || 0} members
            </p>
          </div>
          <div className="role-topbar-actions">
            <NotificationBell />
            <button className="logout-btn" onClick={goLogout}>⏻ {t("logout") || "Log out"}</button>
          </div>
        </header>

        <main className="role-content" ref={contentRef}>
          <div className="role-inner">

      {/* Stats */}
      {dashboard && (
        <div className="grid-2 section-gap">
          {[
            { label: "Members", value: dashboard.member_count, icon: "👥", color: "#15803d", tint: "rgba(21, 128, 61, 0.12)" },
            { label: "Active Lots", value: dashboard.active_lots, icon: "📦", color: "#d97706", tint: "rgba(217, 119, 6, 0.12)" },
            { label: "Total Volume", value: `${(dashboard.total_volume_kg / 1000).toFixed(1)}t`, icon: "⚖️", color: "#0ea5e9", tint: "rgba(14, 165, 233, 0.12)" },
            { label: "Completed", value: dashboard.completed_orders, icon: "✅", color: "#16a34a", tint: "rgba(34, 197, 94, 0.14)" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card" style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span className="stat-value" style={{ color: stat.color, fontSize: "clamp(22px, 5vw, 28px)", lineHeight: 1 }}>
                  {stat.value}
                </span>
                <span className="role-stat-ico" style={{ background: stat.tint }}>{stat.icon}</span>
              </div>
              <div className="stat-label" style={{ marginTop: 10, textAlign: "left", fontSize: 12, fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === "overview" && (
            <div className="flex-col gap-3">
              <Card>
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
              </Card>

              <Card style={{ padding: 16, background: "#f0fdf4", borderLeft: "3px solid var(--color-success)" }}>
                <h3 className="heading-sm" style={{ color: "var(--color-success)" }}>💡 FPO Aggregation</h3>
                <p className="text-sm" style={{ margin: "8px 0 0 0", color: "var(--color-text-secondary)" }}>
                  Combine individual farmer lots into bulk orders for better prices. Select member lots and aggregate them for buyer demand matching.
                </p>
              </Card>
            </div>
          )}

          {/* Members Tab */}
          {tab === "members" && (
            <div className="flex-col gap-3">
              {memberActionError && (
                <div className="auth-error"><span>⚠️</span><p>{memberActionError}</p></div>
              )}
              {pendingMembers.length > 0 && (
                <Card style={{ borderLeft: "3px solid var(--color-accent, #d97706)" }}>
                  <h3 className="heading-sm" style={{ marginBottom: 8 }}>Pending Join Requests</h3>
                  {pendingMembers.map((p: any) => (
                    <div key={p.membership_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--color-border)" }}>
                      <div>
                        <p className="text-sm" style={{ fontWeight: 600, margin: 0 }}>{p.farmer_name}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0" }}>{p.district || "—"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button size="sm" onClick={() => approveMember(p.membership_id)}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => rejectMember(p.membership_id)}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              {members.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 32 }}>👥</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No members yet</p>
                </Card>
              ) : (
                members.map((m) => (
                  <Card key={m.id}>
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
                          {cropEmoji(crop)} {crop}
                        </span>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Lots Tab */}
          {tab === "lots" && (
            <div className="flex-col gap-3">
              {lots.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 32 }}>📦</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No aggregated lots yet</p>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                    Contact admin to aggregate member lots
                  </p>
                </Card>
              ) : (
                lots.map((lot) => (
                  <Card key={lot.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                      onClick={() => router.push(`/lots/${lot.id}`)}>
                      <div>
                        <h3 className="heading-sm" style={{ margin: 0 }}>
                          {cropEmoji(lot.crop_name)} {lot.crop_name}
                        </h3>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                          Grade {lot.quality_grade} · {lot.quantity_kg?.toLocaleString("en-IN")} kg
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {lot.price_per_q && (
                          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>₹{lot.price_per_q.toLocaleString("en-IN")}/q</p>
                        )}
                        <span className={`badge ${lot.status === "active" ? "badge-verified" : ""}`}>
                          {lot.status}
                        </span>
                      </div>
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
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Demands Tab */}
          {tab === "demands" && (
            <div className="flex-col gap-3">
              {demandError && (
                <div className="auth-error"><span>⚠️</span><p>{demandError}</p></div>
              )}
              {demands.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ fontSize: 32 }}>📋</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No open demands right now</p>
                </Card>
              ) : (
                demands.map((demand: any) => {
                  const cropLots = lotsForDemand(demand);
                  const fulfilled = fulfilledIds.has(demand.id);
                  return (
                    <Card key={demand.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                        onClick={() => router.push(`/demands/${demand.id}`)}>
                        <div>
                          <h3 className="heading-sm" style={{ margin: 0 }}>
                            {demand.crop_name || "Crop"} · {demand.quantity_kg}kg
                          </h3>
                          <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
                            {demand.buyer_name || "Buyer"} · {demand.district || "—"}
                            {demand.quality_grade ? ` · Grade ${demand.quality_grade}` : ""}
                          </p>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                          ₹{demand.offered_price_per_q?.toLocaleString("en-IN")}/q
                        </p>
                      </div>

                      {fulfilled ? (
                        <p style={{ fontSize: 13, color: "var(--color-success)", fontWeight: 600, marginTop: 10 }}>
                          ✓ Locked — buyer notified to pay
                        </p>
                      ) : respondingTo === demand.id ? (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
                          {cropLots.length === 0 ? (
                            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                              No aggregated lot has enough quantity for this demand.
                            </p>
                          ) : (
                            <>
                              <label className="text-xs" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
                                Fulfil with which lot?
                              </label>
                              <select className="select" value={selectedLotId}
                                onChange={e => setSelectedLotId(e.target.value)}
                                style={{ width: "100%", marginBottom: 8 }}>
                                {cropLots.map((l: any) => (
                                  <option key={l.id} value={l.id}>Lot #{l.id} · {l.quantity_kg}kg</option>
                                ))}
                              </select>
                              <div style={{ display: "flex", gap: 8 }}>
                                <Button className="flex-1"
                                  disabled={fulfilling} onClick={() => fulfil(demand)}>
                                  {fulfilling ? "Locking…" : "Lock & Fulfil"}
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => setRespondingTo(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button className="w-full" style={{ marginTop: 10 }}
                          onClick={() => openRespond(demand)}>
                          Lock & Fulfil
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* Available Lots Tab — Section 4.1: browse member lots opted into FPO aggregation */}
          {tab === "available-lots" && (
            <div className="flex-col gap-3">
              {aggregateError && (
                <div className="auth-error"><span>⚠️</span><p>{aggregateError}</p></div>
              )}
              {availableLots.length === 0 ? (
                <EmptyState icon="🔍" title="No lots available right now"
                  description="Lots your members mark 'available for FPO aggregation' will show up here." />
              ) : (
                <>
                  {availableLots.map((l: any) => (
                    <label key={l.lot_id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input type="checkbox" checked={selectedAvailableLots.has(l.lot_id)}
                          onChange={() => toggleAvailableLot(l.lot_id)} />
                        <div>
                          <p className="text-sm" style={{ fontWeight: 600, margin: 0 }}>
                            {cropEmoji(l.crop_name)} {l.farmer_name} — {l.crop_name} · {l.quantity_kg?.toLocaleString("en-IN")}kg
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                            Grade {l.quality_grade} · {l.district || "—"}
                            {l.price_per_q ? ` · ₹${l.price_per_q.toLocaleString("en-IN")}/q asking` : ""}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                  {selectedAvailableLots.size > 0 && (
                    <Card style={{ background: "#f0fdf4", borderLeft: "3px solid var(--color-success)" }}>
                      <p className="text-sm" style={{ fontWeight: 600, margin: "0 0 8px" }}>
                        {selectedAvailableLots.size} lot{selectedAvailableLots.size !== 1 ? "s" : ""} selected ·{" "}
                        {availableLots.filter((l: any) => selectedAvailableLots.has(l.lot_id))
                          .reduce((sum: number, l: any) => sum + l.quantity_kg, 0).toLocaleString("en-IN")}kg total
                      </p>
                      <label className="text-xs" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
                        Expected price for the aggregated lot (₹/quintal, optional)
                      </label>
                      <Input type="number" value={aggregatePrice}
                        onChange={e => setAggregatePrice(e.target.value)}
                        placeholder="Falls back to a weighted average of the selected lots"
                        style={{ marginBottom: 10 }} />
                      <Button className="w-full"
                        disabled={aggregating} onClick={requestAggregation}>
                        {aggregating ? "Sending…" : "Request Aggregation"}
                      </Button>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Payments Tab — Section 6.2: distribute a paid order's proceeds to contributing farmers */}
          {tab === "payments" && (
            <div className="flex-col gap-3">
              {distributeError && (
                <div className="auth-error"><span>⚠️</span><p>{distributeError}</p></div>
              )}
              {distributionResult && (
                <Card style={{ background: "#f0fdf4", borderLeft: "3px solid var(--color-success)" }}>
                  <h3 className="heading-sm" style={{ marginBottom: 8 }}>Payment Distributed</h3>
                  <div className="flex-col gap-2" style={{ marginBottom: 12 }}>
                    {[
                      ["Total received", formatINR(distributionResult.total_received)],
                      ["Commission + platform fee", formatINR(distributionResult.total_commission + distributionResult.total_platform_fee)],
                      ["Net distributed", formatINR(distributionResult.net_distributed)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                        <span className="text-sm" style={{ fontWeight: 700 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  {distributionResult.breakdown.map((b: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
                      <span className="text-sm">{b.farmer_name} · {b.quantity_kg.toLocaleString("en-IN")}kg</span>
                      <span className="text-sm" style={{ fontWeight: 600 }}>{formatINR(b.net_payable)}</span>
                    </div>
                  ))}
                  <Button variant="secondary" className="w-full" style={{ marginTop: 12 }}
                    onClick={() => setDistributionResult(null)}>Close</Button>
                </Card>
              )}
              {fpoOrders.length === 0 ? (
                <EmptyState icon="💰" title="No FPO orders yet"
                  description="Orders buyers place against your aggregated lots will show up here." />
              ) : (
                fpoOrders.map((o: any) => (
                  <Card key={o.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p className="text-sm" style={{ fontWeight: 700, margin: 0 }}>
                          {o.crop_name || `Order #${o.id}`} · {o.quantity_kg}kg
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
                          {formatINR(o.total_value)} · Total: {formatINR(totalAmount(o.price_per_q, o.quantity_kg))}
                        </p>
                      </div>
                      <span className={`badge ${o.status === "paid" || o.status === "completed" ? "badge-verified" : ""}`}>{o.status}</span>
                    </div>
                    {o.status === "paid" && !o.payment_distributed && (
                      <Button className="w-full" style={{ marginTop: 10 }}
                        disabled={distributingOrderId === o.id} onClick={() => distributePayment(o.id)}>
                        {distributingOrderId === o.id ? "Distributing…" : "Distribute Payment"}
                      </Button>
                    )}
                    {o.payment_distributed && (
                      <p className="text-xs" style={{ color: "var(--color-success)", fontWeight: 600, marginTop: 8 }}>
                        ✓ Payment distributed to farmers
                      </p>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav hide-desktop" aria-label="FPO navigation">
        {sidebarItems.map(item => (
          <button key={item.tab}
            className={`nav-item ${tab === item.tab ? "active" : ""}`}
            onClick={() => openTab(item.tab)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
