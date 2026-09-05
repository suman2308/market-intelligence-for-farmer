"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleHomePath } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { EmptyState, Skeleton, NotificationBell, NotificationsPanel } from "@/components/ui";

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
  const [demandForm, setDemandForm] = useState({
    crop_id: 0, quantity_kg: 5000, quality_grade: "A",
    required_by_date: "", district: "Pune", offered_price_per_q: 2500,
  });
  const [activeTab, setActiveTab] = useState<"lots" | "demands" | "offers" | "orders" | "notifications">("lots");
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [counterOfferId, setCounterOfferId] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [actionError, setActionError] = useState("");
  const [bookingLotId, setBookingLotId] = useState<number | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  const refreshOffersAndOrders = () => {
    Promise.all([api.get("/offers"), api.get("/orders")])
      .then(([o, or]) => { setOffers(o.data); setOrders(or.data); })
      .catch(() => {});
  };

  const actOnOffer = async (offerId: number, action: "accept" | "reject" | "counter", price?: string) => {
    setBusyOfferId(offerId);
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
    } catch {
      // Errors surface via the offer's status staying unchanged; nothing further needed here.
    } finally {
      setBusyOfferId(null);
    }
  };

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user && user.role === "buyer") {
      Promise.all([
        api.get("/demand").catch(() => ({ data: [] })),
        api.get("/crops").catch(() => ({ data: [] })),
        api.get("/lots?status=active").catch(() => ({ data: [] })),
        api.get("/offers").catch(() => ({ data: [] })),
        api.get("/orders").catch(() => ({ data: [] })),
      ]).then(([d, c, l, o, or]) => {
        setDemand(d.data);
        // Crop ids differ per database — default the demand form to the first real crop
        if (c.data?.length) {
          setCrops(c.data);
          setDemandForm(f => (f.crop_id ? f : { ...f, crop_id: c.data[0].id }));
        } else {
          setCrops([]);
        }
        setLots(l.data); setOffers(o.data); setOrders(or.data);
      }).catch(() => {});
    }
  }, [user]);

  if (loading) return <div style={{ padding: 16 }}><Skeleton height={80} count={4} /></div>;
  if (!user) { router.push("/login"); return null; }
  if (user.role !== "buyer") { router.push(roleHomePath(user.role)); return null; }

  const sidebarItems = [
    { icon: "📦", label: "Browse Lots", tab: "lots" as const },
    { icon: "📋", label: "My Demands", tab: "demands" as const },
    { icon: "📨", label: "My Offers", tab: "offers" as const },
    { icon: "🚚", label: "My Orders", tab: "orders" as const },
    { icon: "🔔", label: "Notifications", tab: "notifications" as const },
  ];

  const goLogout = () => { logout(); router.push("/login"); };

  const openTab = (tab: "lots" | "demands" | "offers" | "orders" | "notifications") => {
    setActiveTab(tab);
    contentRef.current?.scrollTo({ top: 0 });
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
            { value: demand.length, label: "Demands", icon: "📋", color: "#0ea5e9", tint: "rgba(14, 165, 233, 0.12)" },
            { value: lots.length, label: "Lots", icon: "📦", color: "#15803d", tint: "rgba(21, 128, 61, 0.12)" },
            { value: offers.length, label: "Offers", icon: "📨", color: "#d97706", tint: "rgba(217, 119, 6, 0.12)" },
            { value: orders.length, label: "Orders", icon: "🚚", color: "#64748b", tint: "rgba(100, 116, 139, 0.12)" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ textAlign: "left" }}>
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
            <button className="btn-accent section-gap" onClick={() => setShowCreateDemand(!showCreateDemand)}>
              ➕ {t("create_demand")}
            </button>
            {showCreateDemand && (
              <div className="card section-gap">
                <h3 className="heading-sm" style={{ marginBottom: 12 }}>Post Demand</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <select className="select" value={demandForm.crop_id}
                    onChange={e => setDemandForm({ ...demandForm, crop_id: Number(e.target.value) })}>
                    {crops.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input className="input" type="number" placeholder="Qty (kg)" value={demandForm.quantity_kg}
                      onChange={e => setDemandForm({ ...demandForm, quantity_kg: Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="Price/quintal (₹)" value={demandForm.offered_price_per_q}
                      onChange={e => setDemandForm({ ...demandForm, offered_price_per_q: Number(e.target.value) })} />
                  </div>
                  <input className="input" type="text" placeholder="District" value={demandForm.district}
                    onChange={e => setDemandForm({ ...demandForm, district: e.target.value })} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={createDemand}>Post Demand</button>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateDemand(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>Available Lots</h3>
            {lots.length === 0 ? (
              <EmptyState icon="📦" title="No lots available" description="Post a demand to find farmers" />
            ) : lots.map((lot: any) => (
              <div key={lot.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                  onClick={() => router.push(`/lots/${lot.id}`)}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{lot.crop_name} — {lot.quantity_kg}kg</p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>Grade {lot.quality_grade || "Any"} · {lot.address}</p>
                    {lot.farmer_name && (
                      <p className="text-xs" style={{ margin: "2px 0 0", color: "var(--stone-400)" }}>by {lot.farmer_name}</p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {lot.price_per_q && (
                      <p className="price-highlight" style={{ margin: 0 }}>₹{lot.price_per_q.toLocaleString("en-IN")}/q</p>
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
                    onClick={() => { setOfferForm({ price_per_q: lot.price_per_q || 2500, quantity_kg: Math.min(lot.quantity_kg, 5000), delivery_date: "" }); setOfferModal(lot); }}>
                    {lot.price_per_q ? "Propose a different price" : "Propose a price"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Demands Tab */}
        {activeTab === "demands" && (
          <>
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>My Demands</h3>
            {demand.length === 0 ? (
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
                    <span className="price-highlight">₹{d.offered_price_per_q?.toLocaleString("en-IN")}/q</span>
                    <span className={`badge badge-${d.status === "open" ? "active" : "pending"}`} style={{ marginLeft: 6 }}>{d.status}</span>
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
            {offers.length === 0 ? (
              <EmptyState icon="📩" title="No offers yet" description="Browse lots to make one" />
            ) : offers.map((o: any) => {
              // Only offers currently addressed to this buyer (a farmer's
              // fresh offer against a demand, or a farmer's counter on an
              // offer this buyer sent) can be acted on here.
              const awaitingMe = o.to_user_id === user.id && (o.status === "pending" || o.status === "countered");
              return (
                <div key={o.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Offer #{o.id}</p>
                      <p className="text-sm" style={{ margin: "2px 0 0" }}>{o.quantity_kg}kg @ ₹{o.price_per_q?.toLocaleString("en-IN")}/q</p>
                    </div>
                    <span className={`badge badge-${o.status === "accepted" ? "completed" : o.status === "pending" ? "active" : o.status === "countered" ? "pending" : "cancelled"}`}>
                      {o.status}
                    </span>
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
            {orders.length === 0 ? (
              <EmptyState icon="🚚" title="No orders yet" description="Accepted offers will appear here" />
            ) : orders.map((o: any) => (
              <div key={o.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Order #{o.id}</p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>{o.quantity_kg}kg @ ₹{o.price_per_q}/q</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="price-highlight" style={{ margin: 0 }}>₹{o.total_value?.toLocaleString("en-IN")}</p>
                    <span className={`badge badge-${o.status === "paid" || o.status === "completed" ? "completed" : "active"}`}>{o.status}</span>
                  </div>
                </div>
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
          </div>
        </main>
      </div>

      {/* Offer Modal */}
      {offerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setOfferModal(null)}>
          <div className="card" style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", padding: 20, maxHeight: "80vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div className="grabber" />
            <h3 className="heading-md" style={{ margin: "8px 0 12px" }}>Make Offer</h3>
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
                  onChange={e => setOfferForm({ ...offerForm, quantity_kg: Math.min(Number(e.target.value), offerModal.quantity_kg) })} min={100} />
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
