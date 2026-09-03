"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { Sidebar, BottomNav, EmptyState, Skeleton, VerificationBadge, TrustScore } from "@/components/ui";

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
    crop_id: 1, quantity_kg: 5000, quality_grade: "A",
    required_by_date: "", district: "Pune", offered_price_per_q: 2500,
  });
  const [activeTab, setActiveTab] = useState<"lots" | "demands" | "offers" | "orders">("lots");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user) {
      Promise.all([
        api.get("/demand").catch(() => ({ data: [] })),
        api.get("/crops").catch(() => ({ data: [] })),
        api.get("/lots?status=active").catch(() => ({ data: [] })),
        api.get("/offers").catch(() => ({ data: [] })),
        api.get("/orders").catch(() => ({ data: [] })),
      ]).then(([d, c, l, o, or]) => {
        setDemand(d.data); setCrops(c.data); setLots(l.data);
        setOffers(o.data); setOrders(or.data);
      }).catch(() => {});
    }
  }, [user]);

  if (loading) return <div style={{ padding: 16 }}><Skeleton height={80} count={4} /></div>;
  if (!user) return null;

  const sidebarItems = [
    { icon: "🏠", label: "Dashboard", href: "/buyer#dashboard" },
    { icon: "📋", label: "My Demands", href: "/buyer#demands" },
    { icon: "📦", label: "Browse Lots", href: "/buyer#lots" },
    { icon: "📨", label: "Offers", href: "/buyer#offers" },
    { icon: "🚚", label: "Orders", href: "/buyer#orders" },
    { icon: "👤", label: "Profile", href: "/buyer#profile" },
  ];

  const createDemand = async () => {
    try {
      await api.post("/demand", demandForm);
      setShowCreateDemand(false);
      const { data } = await api.get("/demand");
      setDemand(data);
    } catch {}
  };

  const createOffer = async (lot: any) => {
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
    } catch {}
  };

  return (
    <div className={typeof window !== "undefined" && window.innerWidth >= 768 ? "has-sidebar" : ""}>
      <Sidebar active="/buyer" items={sidebarItems} title="ShetBhav Buyer" subtitle="Marketplace" />

      <div style={{ padding: "0 0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 12px" }}>
          <div>
            <h1 className="heading-lg" style={{ margin: 0 }}>🏭 {user.full_name}</h1>
            <p className="text-xs" style={{ margin: "2px 0 0" }}>Buyer Dashboard</p>
          </div>
          <button onClick={() => { logout(); router.push("/login"); }} className="btn-secondary btn-sm">Logout</button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { value: demand.length, label: "Demands", color: "var(--sky-500)" },
            { value: lots.length, label: "Lots", color: "var(--green-600)" },
            { value: offers.length, label: "Offers", color: "var(--saffron-500)" },
            { value: orders.length, label: "Orders", color: "var(--stone-600)" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: "white", borderRadius: 12, border: "1px solid var(--stone-200)" }}>
              <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="scroll-x section-gap">
          {(["lots", "demands", "offers", "orders"] as const).map(tab => (
            <button key={tab} className={`toggle-btn ${activeTab === tab ? "selected" : ""}`}
              onClick={() => setActiveTab(tab)}
              style={{ whiteSpace: "nowrap", textTransform: "capitalize", flex: "none" }}>
              {tab} ({tab === "lots" ? lots.length : tab === "demands" ? demand.length : tab === "offers" ? offers.length : orders.length})
            </button>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{lot.crop_name} — {lot.quantity_kg}kg</p>
                    <p className="text-xs" style={{ margin: "2px 0 0" }}>Grade {lot.quality_grade || "Any"} · {lot.address}</p>
                  </div>
                  <span className={`badge badge-${lot.status === "active" ? "active" : "pending"}`}>{lot.status}</span>
                </div>
                <button className="btn-primary btn-sm" style={{ marginTop: 10 }}
                  onClick={() => { setOfferForm({ price_per_q: 2500, quantity_kg: Math.min(lot.quantity_kg, 5000), delivery_date: "" }); setOfferModal(lot); }}>
                  📩 Make Offer
                </button>
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
            ) : offers.map((o: any) => (
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
              </div>
            ))}
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
              </div>
            ))}
          </>
        )}
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

      <BottomNav active="/buyer" items={[
        { icon: "🏠", label: "Home", href: "/buyer" },
        { icon: "📋", label: "Demand", href: "/buyer" },
        { icon: "📦", label: "Lots", href: "/buyer" },
        { icon: "🚚", label: "Orders", href: "/buyer" },
        { icon: "👤", label: "Profile", href: "/buyer" },
      ]} />
    </div>
  );
}
