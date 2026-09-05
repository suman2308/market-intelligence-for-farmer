"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleHomePath } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { EmptyState, Skeleton, NotificationBell, NotificationsPanel } from "@/components/ui";
import { totalAmount, formatINR } from "@/lib/money";

export default function BuyerDashboard() {
  const router = useRouter();
  const { user, loadUser, logout } = useAuth();
  const { t } = useI18n();
  const [demand, setDemand] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [showCreateDemand, setShowCreateDemand] = useState(false);
  const [offerModal, setOfferModal] = useState<any>(null);
  const [offerForm, setOfferForm] = useState({ price_per_q: 2500, quantity_kg: 1000, delivery_date: "" });
  const [quantityCapped, setQuantityCapped] = useState(false);
  const [demandForm, setDemandForm] = useState({
    crop_id: 0, quantity_kg: 5000, quality_grade: "A",
    required_by_date: "", district: "Pune", offered_price_per_q: 2500,
  });
  const [activeTab, setActiveTab] = useState<"lots" | "demands" | "offers" | "orders" | "notifications" | "profile">("lots");
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [counterOfferId, setCounterOfferId] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [actionError, setActionError] = useState("");
  const [bookingLotId, setBookingLotId] = useState<number | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [lotsError, setLotsError] = useState(false);
  const [sellerTypeFilter, setSellerTypeFilter] = useState<"all" | "farmer" | "fpo">("all");
  const [demandsError, setDemandsError] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ business_name: "", business_type: "", district: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const contentRef = useRef<HTMLElement | null>(null);

  const refreshOffersAndOrders = () => {
    Promise.all([api.get("/offers"), api.get("/orders")])
      .then(([o, or]) => { setOffers(o.data); setOrders(or.data); })
      .catch(() => {});
  };

  const actOnOffer = async (offerId: number, action: "accept" | "reject" | "counter", price?: string) => {
    setBusyOfferId(offerId);
    setActionError("");
    try {
      if (action === "counter") {
        await api.post(`/offers/${offerId}/counter`, { price_per_q: Number(price) });
        setCounterOfferId(null);
        setCounterPrice("");
      } else {
        await api.post(`/offers/${offerId}/${action}`);
        if (action === "accept") setActiveTab("orders");
      }
      refreshOffersAndOrders();
    } catch (e: any) {
      setActionError(e.response?.data?.detail || `Couldn't ${action} this offer. Please try again.`);
    } finally {
      setBusyOfferId(null);
    }
  };

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);

  const loadDashboard = () => {
    if (!user || user.role !== "buyer") return;
    setLotsError(false); setDemandsError(false); setOffersError(false); setOrdersError(false);
    Promise.all([
      api.get("/demand").catch(() => { setDemandsError(true); return { data: [] }; }),
      api.get("/crops").catch(() => ({ data: [] })),
      api.get("/lots?status=active").catch(() => { setLotsError(true); return { data: [] }; }),
      api.get("/offers").catch(() => { setOffersError(true); return { data: [] }; }),
      api.get("/orders").catch(() => { setOrdersError(true); return { data: [] }; }),
      api.get("/buyers/profile").catch(() => null),
    ]).then(([d, c, l, o, or, bp]) => {
      setDemand(d.data);
      // Crop ids differ per database — default the demand form to the first real crop
      if (c.data?.length) {
        setCrops(c.data);
        setDemandForm(f => (f.crop_id ? f : { ...f, crop_id: c.data[0].id }));
      } else {
        setCrops([]);
      }
      setLots(l.data); setOffers(o.data); setOrders(or.data);
      if (bp) {
        setBuyerProfile(bp.data);
        setProfileForm({
          business_name: bp.data.business_name || "",
          business_type: bp.data.business_type || "",
          district: bp.data.district || "",
        });
      }
    });
  };

  useEffect(loadDashboard, [user]);

  useEffect(() => {
    if (!offerModal) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOfferModal(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [offerModal]);

  if (loading) return <div style={{ padding: 16 }}><Skeleton height={80} count={4} /></div>;
  if (!user) { router.push("/login"); return null; }
  if (user.role !== "buyer") { router.push(roleHomePath(user.role)); return null; }

  const sidebarItems = [
    { icon: "📦", label: "Browse Lots", tab: "lots" as const },
    { icon: "📋", label: "My Demands", tab: "demands" as const },
    { icon: "📨", label: "My Offers", tab: "offers" as const },
    { icon: "🚚", label: "My Orders", tab: "orders" as const },
    { icon: "🔔", label: "Notifications", tab: "notifications" as const },
    { icon: "👤", label: "Profile", tab: "profile" as const },
  ];

  const goLogout = () => { logout(); router.push("/login"); };

  const openTab = (tab: "lots" | "demands" | "offers" | "orders" | "notifications" | "profile") => {
    setActiveTab(tab);
    contentRef.current?.scrollTo({ top: 0 });
  };

  const saveBuyerProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      const { data } = await api.put("/buyers/profile", profileForm);
      setBuyerProfile(data);
      setEditingProfile(false);
    } catch (e: any) {
      setProfileError(e.response?.data?.detail || "Couldn't save your changes. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const createDemand = async () => {
    setActionError("");
    try {
      await api.post("/demand", {
        ...demandForm,
        // Backend expects null (not "") for optional dates
        required_by_date: demandForm.required_by_date || null,
      });
      setShowCreateDemand(false);
      const { data } = await api.get("/demand");
      setDemand(data);
    } catch (e: any) {
      setActionError(e.response?.data?.detail || "Could not post the demand. Please try again.");
    }
  };

  const bookLot = async (lot: any) => {
    setActionError("");
    setBookingLotId(lot.id);
    try {
      await api.post(`/lots/${lot.id}/book`);
      const [lotsResp, ordersResp] = await Promise.all([api.get("/lots?status=active"), api.get("/orders")]);
      setLots(lotsResp.data);
      setOrders(ordersResp.data);
      setActiveTab("orders");
    } catch (e: any) {
      setActionError(e.response?.data?.detail || "Could not book this lot. Please try again.");
    } finally {
      setBookingLotId(null);
    }
  };

  const payOrder = async (orderId: number) => {
    setActionError("");
    setPayingOrderId(orderId);
    try {
      await api.post(`/payments/${orderId}/simulate`);
      const { data } = await api.get("/orders");
      setOrders(data);
    } catch (e: any) {
      setActionError(e.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPayingOrderId(null);
    }
  };

  const createOffer = async (lot: any) => {
    setActionError("");
    try {
      await api.post("/offers", {
        lot_id: lot.id,
        price_per_q: offerForm.price_per_q,
        quantity_kg: offerForm.quantity_kg,
        delivery_date: offerForm.delivery_date || null,
      });
      setOfferModal(null);
      const { data } = await api.get("/offers");
      setOffers(data);
    } catch (e: any) {
      setActionError(e.response?.data?.detail || "Could not send the offer. Please try again.");
    }
  };

  return (
    <div className="role-app">
      {/* Left panel — brand, role, navigation, logout (desktop) */}
      <aside className="role-side hide-mobile" aria-label="Buyer navigation">
        <div className="role-side-brand">
          <div className="role-brand-name"><span className="role-brand-logo">🌾</span>ShetBhav</div>
          <div className="role-side-role">Buyer</div>
        </div>
        <nav className="role-side-nav">
          {sidebarItems.map(item => (
            <button key={item.tab}
              className={`role-nav-item ${activeTab === item.tab ? "active" : ""}`}
              onClick={() => openTab(item.tab)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right column — fixed top bar + scrollable content */}
      <div className="role-main">
        <header className="role-topbar">
          <div style={{ minWidth: 0 }}>
            <h1 className="role-topbar-name">{user.full_name}</h1>
            <p className="role-topbar-sub">Buyer Dashboard</p>
          </div>
          <div className="role-topbar-actions">
            <span className="badge badge-green hide-mobile">✓ Verified Buyer</span>
            <NotificationBell />
            <button className="logout-btn" onClick={goLogout}>⏻ {t("logout") || "Log out"}</button>
          </div>
        </header>

        <main className="role-content" ref={contentRef}>
          <div className="role-inner">

        {actionError && (
          <div className="auth-error" style={{ marginBottom: 16 }}>
            <span>⚠️</span><p>{actionError}</p>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
          {[
            { value: demand.length, label: "Demands", icon: "📋", color: "#0ea5e9", tint: "rgba(14, 165, 233, 0.12)", tab: "demands" as const },
            { value: lots.length, label: "Lots", icon: "📦", color: "#15803d", tint: "rgba(21, 128, 61, 0.12)", tab: "lots" as const },
            { value: offers.length, label: "Offers", icon: "📨", color: "#d97706", tint: "rgba(217, 119, 6, 0.12)", tab: "offers" as const },
            { value: orders.length, label: "Orders", icon: "🚚", color: "#64748b", tint: "rgba(100, 116, 139, 0.12)", tab: "orders" as const },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => openTab(s.tab)}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span className="stat-value" style={{ color: s.color, fontSize: 30, lineHeight: 1 }}>{s.value}</span>
                <span className="role-stat-ico" style={{ background: s.tint }}>{s.icon}</span>
              </div>
              <div className="stat-label" style={{ marginTop: 10, textAlign: "left", fontSize: 12, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Lots Tab */}
        {activeTab === "lots" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <h3 className="heading-sm" style={{ margin: 0 }}>Available Lots</h3>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { v: "all" as const, label: "All" },
                  { v: "farmer" as const, label: "Farmers" },
                  { v: "fpo" as const, label: "FPOs" },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setSellerTypeFilter(opt.v)}
                    style={{
                      padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: sellerTypeFilter === opt.v ? "1.5px solid var(--green-600)" : "1px solid var(--stone-200)",
                      background: sellerTypeFilter === opt.v ? "var(--green-50, #f0fdf4)" : "white",
                      color: sellerTypeFilter === opt.v ? "var(--green-700)" : "var(--text-secondary)",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const visibleLots = lots.filter((lot: any) =>
                !!lot.price_per_q && (
                  sellerTypeFilter === "all" ? true :
                  sellerTypeFilter === "fpo" ? !!lot.fpo_id : !lot.fpo_id
                )
              );
              return lotsError ? (
              <EmptyState icon="⚠️" title="Couldn't load lots" description="Check your connection and try again." action={{ label: "Retry", onClick: loadDashboard }} />
            ) : visibleLots.length === 0 ? (
              <EmptyState icon="📦" title="No lots available"
                description={sellerTypeFilter === "all" ? "Post a demand to find farmers" : `No ${sellerTypeFilter === "fpo" ? "FPO" : "individual farmer"} lots right now`} />
            ) : visibleLots.map((lot: any) => (
              <div key={lot.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                  onClick={() => router.push(`/lots/${lot.id}`)}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{lot.crop_name} — {lot.quantity_kg}kg</p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>Grade {lot.quality_grade || "Any"} · {lot.address}</p>
                    {lot.fpo_id ? (
                      <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--info)" }}>🏢 {lot.fpo_name || "FPO"}</p>
                    ) : lot.farmer_name && (
                      <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>by {lot.farmer_name}</p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {lot.price_per_q && (
                      <>
                        <p className="price-highlight" style={{ margin: 0 }}>₹{lot.price_per_q.toLocaleString("en-IN")}/q</p>
                        <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                          Total: {formatINR(totalAmount(lot.price_per_q, lot.quantity_kg))}
                        </p>
                      </>
                    )}
                    <span className={`badge badge-${lot.status === "active" ? "active" : "pending"}`}>{lot.status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {lot.price_per_q ? (
                    <button className="btn-primary btn-sm" style={{ width: "100%" }}
                      disabled={bookingLotId === lot.id}
                      onClick={() => bookLot(lot)}>
                      {bookingLotId === lot.id ? "Booking…" : `📦 Book at ₹${lot.price_per_q.toLocaleString("en-IN")}/q`}
                    </button>
                  ) : null}
                  <button className="btn-secondary btn-sm" style={{ width: "100%" }}
                    onClick={() => { setOfferForm({ price_per_q: lot.price_per_q || 2500, quantity_kg: Math.min(lot.quantity_kg, 5000), delivery_date: "" }); setQuantityCapped(false); setOfferModal(lot); }}>
                    {lot.price_per_q ? "Propose a different price" : "Propose a price"}
                  </button>
                </div>
              </div>
            ));
            })()}
          </>
        )}

        {/* Demands Tab */}
        {activeTab === "demands" && (
          <>
            <button className="btn-accent section-gap" onClick={() => setShowCreateDemand(!showCreateDemand)}>
              {showCreateDemand ? "✕ Cancel" : `➕ ${t("create_demand")}`}
            </button>
            {showCreateDemand && (
              <div className="card section-gap">
                <h3 className="heading-sm" style={{ marginBottom: 12 }}>Post a Demand</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Crop</label>
                    <select className="select" value={demandForm.crop_id}
                      onChange={e => setDemandForm({ ...demandForm, crop_id: Number(e.target.value) })} style={{ width: "100%" }}>
                      {crops.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quantity (kg)</label>
                      <input className="input" type="number" value={demandForm.quantity_kg}
                        onChange={e => setDemandForm({ ...demandForm, quantity_kg: Number(e.target.value) })} min={1} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Price (₹/quintal)</label>
                      <input className="input" type="number" value={demandForm.offered_price_per_q}
                        onChange={e => setDemandForm({ ...demandForm, offered_price_per_q: Number(e.target.value) })} min={1} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quality Grade</label>
                      <select className="select" value={demandForm.quality_grade}
                        onChange={e => setDemandForm({ ...demandForm, quality_grade: e.target.value })} style={{ width: "100%" }}>
                        <option value="A">Grade A — Premium</option>
                        <option value="B">Grade B — Standard</option>
                        <option value="C">Grade C — Below Standard</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Required By</label>
                      <input className="input" type="date" value={demandForm.required_by_date}
                        onChange={e => setDemandForm({ ...demandForm, required_by_date: e.target.value })} style={{ width: "100%" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>District</label>
                    <input className="input" type="text" value={demandForm.district}
                      onChange={e => setDemandForm({ ...demandForm, district: e.target.value })} style={{ width: "100%" }} />
                  </div>
                  <button className="btn-primary" onClick={createDemand}>Post Demand</button>
                </div>
              </div>
            )}
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>My Demands</h3>
            {demandsError ? (
              <EmptyState icon="⚠️" title="Couldn't load demands" description="Check your connection and try again." action={{ label: "Retry", onClick: loadDashboard }} />
            ) : demand.length === 0 ? (
              <EmptyState icon="📋" title="No demands yet" description="Create one to find farmers" />
            ) : demand.map((d: any) => (
              <div key={d.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {crops.find((c: any) => c.id === d.crop_id)?.name || "Crop"} — {d.quantity_kg}kg
                    </p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>Grade {d.quality_grade || "Any"} · {d.district}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>
                      <span className="price-highlight">₹{d.offered_price_per_q?.toLocaleString("en-IN")}/q</span>
                      <span className={`badge badge-${d.status === "open" ? "active" : "pending"}`} style={{ marginLeft: 6 }}>{d.status}</span>
                    </div>
                    <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                      Total: {formatINR(totalAmount(d.offered_price_per_q, d.quantity_kg))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Offers Tab */}
        {activeTab === "offers" && (
          <>
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>My Offers</h3>
            {offersError ? (
              <EmptyState icon="⚠️" title="Couldn't load offers" description="Check your connection and try again." action={{ label: "Retry", onClick: loadDashboard }} />
            ) : offers.length === 0 ? (
              <EmptyState icon="📩" title="No offers yet" description="Browse lots to make one" />
            ) : offers.map((o: any) => {
              // Only offers currently addressed to this buyer (a farmer's
              // fresh offer against a demand, or a farmer's counter on an
              // offer this buyer sent) can be acted on here.
              const awaitingMe = o.to_user_id === user.id && (o.status === "pending" || o.status === "countered");
              return (
                <div key={o.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                        {o.crop_name || `Offer #${o.id}`}{o.quality_grade ? ` · Grade ${o.quality_grade}` : ""}
                      </p>
                      <p className="text-sm" style={{ margin: "2px 0 0" }}>{o.quantity_kg}kg @ ₹{o.price_per_q?.toLocaleString("en-IN")}/q</p>
                      {(o.farmer_name || o.lot_address) && (
                        <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                          {o.farmer_name ? `by ${o.farmer_name}` : ""}{o.farmer_name && o.lot_address ? " · " : ""}{o.lot_address || ""}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span className={`badge ${o.status === "accepted" ? "badge-green" : o.status === "pending" ? "badge-amber" : o.status === "countered" ? "badge-blue" : "badge-gray"}`}>
                        {o.status}
                      </span>
                      <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                        Total: {formatINR(totalAmount(o.price_per_q, o.quantity_kg))}
                      </p>
                    </div>
                  </div>
                  {o.status === "countered" && (
                    <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "var(--saffron-50)" }}>
                      <p className="text-xs" style={{ color: "var(--saffron-700)", margin: 0 }}>
                        💬 Counter offer at ₹{o.price_per_q?.toLocaleString("en-IN")}/q
                      </p>
                    </div>
                  )}

                  {awaitingMe && counterOfferId !== o.id && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                        disabled={busyOfferId === o.id}
                        onClick={() => actOnOffer(o.id, "accept")}>
                        {busyOfferId === o.id ? "…" : "Accept"}
                      </button>
                      <button className="btn-secondary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                        disabled={busyOfferId === o.id}
                        onClick={() => setCounterOfferId(o.id)}>
                        Counter
                      </button>
                      <button style={{
                        flex: 1, padding: "8px", fontSize: 13, borderRadius: 8,
                        border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                      }} disabled={busyOfferId === o.id}
                        onClick={() => actOnOffer(o.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  )}

                  {counterOfferId === o.id && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input className="input" type="number" placeholder="Your price ₹/q"
                        value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
                        style={{ flex: 1, padding: "8px 10px", fontSize: 13 }} />
                      <button className="btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}
                        disabled={!counterPrice || busyOfferId === o.id}
                        onClick={() => actOnOffer(o.id, "counter", counterPrice)}>
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
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <>
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>Orders</h3>
            {ordersError ? (
              <EmptyState icon="⚠️" title="Couldn't load orders" description="Check your connection and try again." action={{ label: "Retry", onClick: loadDashboard }} />
            ) : orders.length === 0 ? (
              <EmptyState icon="🚚" title="No orders yet" description="Accepted offers will appear here" />
            ) : orders.map((o: any) => (
              <div key={o.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                      {o.crop_name || `Order #${o.id}`}{o.quality_grade ? ` · Grade ${o.quality_grade}` : ""}
                    </p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>{o.quantity_kg}kg @ ₹{o.price_per_q}/q</p>
                    {(o.farmer_name || o.address) && (
                      <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--text-secondary)" }}>
                        {o.farmer_name ? `by ${o.farmer_name}` : ""}{o.farmer_name && o.address ? " · " : ""}{o.address || ""}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <p className="price-highlight" style={{ margin: 0 }}>₹{o.total_value?.toLocaleString("en-IN")}</p>
                    <span className={`badge ${
                      o.status === "paid" || o.status === "completed" ? "badge-green" :
                      o.status === "payment_pending" ? "badge-amber" :
                      o.status === "accepted" ? "badge-blue" :
                      o.status === "cancelled" || o.status === "disputed" ? "badge-gray" : "badge-amber"
                    }`}>{o.status}</span>
                  </div>
                </div>
                {(o.status === "payment_pending" || o.status === "accepted") && o.payment_deadline && (
                  <p className="text-xs" style={{ margin: "8px 0 0", color: "var(--warning, #d97706)" }}>
                    ⏰ Pay before {new Date(o.payment_deadline).toLocaleString("en-IN")} — after that the lot is released to other buyers.
                  </p>
                )}
                {(o.status === "payment_pending" || o.status === "accepted") && (
                  <button className="btn-primary btn-sm" style={{ marginTop: 10, width: "100%" }}
                    disabled={payingOrderId === o.id}
                    onClick={() => payOrder(o.id)}>
                    {payingOrderId === o.id ? "Processing…" : `💳 Pay ₹${o.total_value?.toLocaleString("en-IN")}`}
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <>
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>Notifications</h3>
            <NotificationsPanel />
          </>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (() => {
          const paidOrders = orders.filter((o: any) => o.status === "paid" || o.status === "completed");
          const totalSpent = paidOrders.reduce((sum: number, o: any) => sum + (o.total_value || 0), 0);
          const byCrop: Record<string, { quantity_kg: number; total_value: number; count: number }> = {};
          paidOrders.forEach((o: any) => {
            const key = o.crop_name || "Other";
            if (!byCrop[key]) byCrop[key] = { quantity_kg: 0, total_value: 0, count: 0 };
            byCrop[key].quantity_kg += o.quantity_kg || 0;
            byCrop[key].total_value += o.total_value || 0;
            byCrop[key].count += 1;
          });
          const recentOrders = [...orders]
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

          return (
            <>
              {/* Profile Card */}
              <div className="card section-gap" style={{ textAlign: "center", padding: 24 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--green-100), var(--green-200))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32, fontWeight: 800, color: "var(--green-800)",
                  margin: "0 auto 12px",
                }}>
                  {user.full_name.charAt(0)}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{user.full_name}</h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>@{user.username} · Buyer</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user.email}</p>
                {buyerProfile && (
                  <span className="badge badge-green" style={{ marginTop: 8, display: "inline-block" }}>
                    Trust score: {buyerProfile.trust_score?.toFixed(0) ?? 0}
                  </span>
                )}
              </div>

              {/* Business Details */}
              <div className="card section-gap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Business Details</h3>
                  <button onClick={() => setEditingProfile(!editingProfile)}
                    style={{ fontSize: 13, color: "var(--green-600)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", margin: "-8px -10px", minHeight: 36, minWidth: 44 }}>
                    {editingProfile ? "Cancel" : "Edit"}
                  </button>
                </div>

                {editingProfile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Business Name</label>
                      <input className="input" value={profileForm.business_name}
                        onChange={e => setProfileForm({ ...profileForm, business_name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Business Type</label>
                      <input className="input" value={profileForm.business_type}
                        onChange={e => setProfileForm({ ...profileForm, business_type: e.target.value })}
                        placeholder="e.g. Wholesaler, Retailer, Processor" />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>District</label>
                      <input className="input" value={profileForm.district}
                        onChange={e => setProfileForm({ ...profileForm, district: e.target.value })} />
                    </div>
                    {profileError && (
                      <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>⚠️ {profileError}</p>
                    )}
                    <button className="btn-primary" onClick={saveBuyerProfile} disabled={savingProfile}>
                      {savingProfile ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Business Name</span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{buyerProfile?.business_name || "Not set"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Business Type</span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{buyerProfile?.business_type || "Not set"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>District</span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{buyerProfile?.district || "Not set"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction History */}
              <div className="card section-gap">
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>📋 Transaction History</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Orders", value: orders.length },
                    { label: "Completed", value: paidOrders.length },
                    { label: "Spent", value: formatINR(totalSpent) },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign: "center", padding: "10px 4px", background: "var(--stone-50, #f9fafb)", borderRadius: 10 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{stat.value}</p>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {Object.keys(byCrop).length > 0 && (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>By Crop</p>
                    {Object.entries(byCrop).map(([crop, stats]) => (
                      <div key={crop} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--stone-100, #f3f4f6)" }}>
                        <span style={{ fontSize: 13 }}>{crop} · {stats.count} order{stats.count !== 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{stats.quantity_kg.toLocaleString("en-IN")}kg · {formatINR(stats.total_value)}</span>
                      </div>
                    ))}
                  </>
                )}

                {recentOrders.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", margin: "12px 0 0" }}>No transactions yet</p>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>Recent Orders</p>
                    {recentOrders.map((order: any) => (
                      <div key={order.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--stone-100, #f3f4f6)" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{order.crop_name || `Order #${order.id}`} · {order.quantity_kg}kg</p>
                          <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>₹{order.price_per_q}/q</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{formatINR(order.total_value || 0)}</p>
                          <span className={`badge ${order.status === "paid" || order.status === "completed" ? "badge-completed" : "badge-active"}`} style={{ fontSize: 10 }}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button className="btn-primary" onClick={goLogout} style={{ background: "var(--danger, #ef4444)", width: "100%" }}>
                {t("logout") || "Log out"}
              </button>
            </>
          );
        })()}
          </div>
        </main>
      </div>

      {/* Offer Modal */}
      {offerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setOfferModal(null)}>
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="offer-modal-title"
            style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "80vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div className="grabber" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 12px" }}>
              <h3 id="offer-modal-title" className="heading-md" style={{ margin: 0 }}>Make Offer</h3>
              <button onClick={() => setOfferModal(null)} aria-label="Close" autoFocus
                style={{ background: "var(--stone-100, #f3f4f6)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>
                ✕
              </button>
            </div>
            <div className="card" style={{ marginBottom: 12, background: "var(--green-50)" }}>
              <p style={{ fontWeight: 600, margin: 0 }}>{offerModal.crop_name} — {offerModal.quantity_kg}kg</p>
              <p className="text-xs" style={{ margin: "2px 0 0" }}>Grade {offerModal.quality_grade} · {offerModal.address}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="text-xs" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Price per Quintal (₹)</label>
                <input className="input" type="number" value={offerForm.price_per_q}
                  onChange={e => setOfferForm({ ...offerForm, price_per_q: Number(e.target.value) })} min={1000} step={50} />
              </div>
              <div>
                <label className="text-xs" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Quantity (max {offerModal.quantity_kg}kg)</label>
                <input className="input" type="number" value={offerForm.quantity_kg}
                  onChange={e => {
                    const raw = Number(e.target.value);
                    const capped = raw > offerModal.quantity_kg;
                    setQuantityCapped(capped);
                    setOfferForm({ ...offerForm, quantity_kg: Math.min(raw, offerModal.quantity_kg) });
                  }} min={100} />
                {quantityCapped && (
                  <p className="text-xs" style={{ color: "var(--warning, #d97706)", margin: "4px 0 0" }}>
                    Capped at {offerModal.quantity_kg}kg — that's all this lot has available.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Delivery Date</label>
                <input className="input" type="date" value={offerForm.delivery_date}
                  onChange={e => setOfferForm({ ...offerForm, delivery_date: e.target.value })} />
              </div>
              <div style={{ background: "var(--stone-50)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-sm">Total Value</span>
                  <span className="price-highlight">₹{((offerForm.price_per_q * offerForm.quantity_kg) / 100).toLocaleString("en-IN")}</span>
                </div>
              </div>
              <button className="btn-primary" onClick={() => createOffer(offerModal)}>📩 Send Offer</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav hide-desktop" aria-label="Buyer navigation">
        {[
          { icon: "📦", label: "Lots", tab: "lots" as const },
          { icon: "📋", label: "Demands", tab: "demands" as const },
          { icon: "📨", label: "Offers", tab: "offers" as const },
          { icon: "🚚", label: "Orders", tab: "orders" as const },
          { icon: "👤", label: "Profile", tab: "profile" as const },
        ].map(item => (
          <button key={item.tab}
            className={`nav-item ${activeTab === item.tab ? "active" : ""}`}
            onClick={() => openTab(item.tab)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
