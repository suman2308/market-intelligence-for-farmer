"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";

export default function BuyerDashboard() {
  const router = useRouter();
  const { user, loadUser, logout } = useAuth();
  const { t } = useI18n();
  const [demand, setDemand] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [showCreateDemand, setShowCreateDemand] = useState(false);
  const [offerModal, setOfferModal] = useState<any>(null); // lot to offer on
  const [offerForm, setOfferForm] = useState({ price_per_q: 2500, quantity_kg: 1000, delivery_date: "" });
  const [demandForm, setDemandForm] = useState({
    crop_id: 1, quantity_kg: 5000, quality_grade: "A",
    required_by_date: "", district: "Pune", offered_price_per_q: 2500,
  });
  const [activeTab, setActiveTab] = useState<"demands" | "lots" | "offers">("lots");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user) {
      Promise.all([
        api.get("/demand").catch(() => ({ data: [] })),
        api.get("/crops").catch(() => ({ data: [] })),
        api.get("/lots?status=active").catch(() => ({ data: [] })),
        api.get("/offers").catch(() => ({ data: [] })),
      ]).then(([d, c, l, o]) => {
        setDemand(d.data); setCrops(c.data); setLots(l.data); setOffers(o.data);
      }).catch(() => {});
    }
  }, [user]);

  if (loading) return (
    <div style={{ padding: 16 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />)}
    </div>
  );

  if (!user) return null;

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
        to_user_id: 1, // will be resolved server-side from lot
        price_per_q: offerForm.price_per_q,
        quantity_kg: offerForm.quantity_kg,
        delivery_date: offerForm.delivery_date || null,
      });
      setOfferModal(null);
      setOfferForm({ price_per_q: 2500, quantity_kg: 1000, delivery_date: "" });
      const { data } = await api.get("/offers");
      setOffers(data);
    } catch {}
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🏭 {user.full_name}</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>Buyer Dashboard</p>
        </div>
        <button onClick={() => { logout(); router.push("/login"); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 13, cursor: "pointer" }}>
          {t("logout")}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: "center", padding: "14px 8px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#3b82f6" }}>{demand.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Active Demands</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "14px 8px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{lots.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Available Lots</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "14px 8px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#8b5cf6" }}>{offers.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>My Offers</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {(["lots", "demands", "offers"] as const).map(tab => (
          <button key={tab} className={`toggle-btn ${activeTab === tab ? "selected" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ whiteSpace: "nowrap", textTransform: "capitalize", flex: "none" }}>
            {tab} {tab === "lots" ? `(${lots.length})` : tab === "demands" ? `(${demand.length})` : `(${offers.length})`}
          </button>
        ))}
      </div>

      {/* Lots Tab — Browse farmer lots and make offers */}
      {activeTab === "lots" && (
        <>
          <button className="btn-primary" style={{ marginBottom: 16 }}
            onClick={() => setShowCreateDemand(!showCreateDemand)}>
            ➕ {t("create_demand")}
          </button>

          {showCreateDemand && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("create_demand")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <select className="select" value={demandForm.crop_id}
                  onChange={e => setDemandForm({ ...demandForm, crop_id: Number(e.target.value) })}>
                  {crops.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input className="input" type="number" placeholder="Quantity (kg)" value={demandForm.quantity_kg}
                  onChange={e => setDemandForm({ ...demandForm, quantity_kg: Number(e.target.value) })} />
                <input className="input" type="number" placeholder="Price per quintal (₹)" value={demandForm.offered_price_per_q}
                  onChange={e => setDemandForm({ ...demandForm, offered_price_per_q: Number(e.target.value) })} />
                <input className="input" type="text" placeholder="District" value={demandForm.district}
                  onChange={e => setDemandForm({ ...demandForm, district: e.target.value })} />
                <input className="input" type="date" placeholder="Required by"
                  onChange={e => setDemandForm({ ...demandForm, required_by_date: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={createDemand}>{t("submit")}</button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateDemand(false)}>{t("cancel")}</button>
                </div>
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Available Lots</h2>
          {lots.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <p style={{ fontSize: 28, margin: 0 }}>📦</p>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0 0" }}>No lots available right now. Post a demand instead.</p>
            </div>
          ) : lots.map((lot: any) => (
            <div key={lot.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {lot.crop_name || "Crop"} — {lot.quantity_kg}kg
                  </p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                    Grade {lot.quality_grade || "Any"} · {lot.address || lot.urgency}
                  </p>
                </div>
                <span className={`badge ${lot.status === "active" ? "badge-active" : ""}`}>{lot.status}</span>
              </div>
              <button className="btn-primary" style={{ marginTop: 12, padding: "10px 16px", fontSize: 14, width: "100%" }}
                onClick={() => {
                  setOfferForm({ price_per_q: 2500, quantity_kg: Math.min(lot.quantity_kg, 5000), delivery_date: "" });
                  setOfferModal(lot);
                }}>
                📩 Make Offer
              </button>
            </div>
          ))}
        </>
      )}

      {/* Demands Tab */}
      {activeTab === "demands" && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>My Demands</h2>
          {demand.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <p style={{ fontSize: 28, margin: 0 }}>📋</p>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0 0" }}>No demands yet. Create one to find farmers.</p>
            </div>
          ) : demand.map((d: any) => (
            <div key={d.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {crops.find((c: any) => c.id === d.crop_id)?.name || "Crop"} — {d.quantity_kg}kg
                  </p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                    Grade {d.quality_grade || "Any"} · {d.district || "Any district"}
                  </p>
                </div>
                <span className={`badge ${d.status === "open" ? "badge-active" : "badge-pending"}`}>{d.status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>₹{d.offered_price_per_q?.toLocaleString("en-IN")}/q</span>
                {d.required_by_date && (
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    By: {new Date(d.required_by_date).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Offers Tab */}
      {activeTab === "offers" && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>My Offers</h2>
          {offers.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <p style={{ fontSize: 28, margin: 0 }}>📩</p>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0 0" }}>No offers yet. Browse lots to make one.</p>
            </div>
          ) : offers.map((o: any) => (
            <div key={o.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Offer #{o.id}</p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                    {o.quantity_kg}kg @ ₹{o.price_per_q?.toLocaleString("en-IN")}/q
                  </p>
                  {o.delivery_date && (
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0 0" }}>
                      Delivery: {new Date(o.delivery_date).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
                <span className={`badge ${
                  o.status === "accepted" ? "badge-completed" :
                  o.status === "pending" ? "badge-pending" :
                  o.status === "countered" ? "badge-active" :
                  o.status === "rejected" ? "badge-cancelled" : ""
                }`} style={o.status === "countered" ? { background: "#fef3c7", color: "#92400e" } : o.status === "rejected" ? { background: "#fee2e2", color: "#991b1b" } : {}}>
                  {o.status}
                </span>
              </div>
              {o.status === "countered" && (
                <p style={{ fontSize: 13, color: "#92400e", marginTop: 8, padding: "6px 10px", background: "#fef3c7", borderRadius: 8 }}>
                  💬 The farmer countered at ₹{o.price_per_q?.toLocaleString("en-IN")}/q. Review and respond.
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {/* Offer Modal */}
      {offerModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end",
          justifyContent: "center", zIndex: 1000, padding: "0 0 20px 0",
        }} onClick={() => setOfferModal(null)}>
          <div style={{
            background: "white", borderRadius: "16px 16px 0 0", padding: 24,
            width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Make Offer</h3>
              <button onClick={() => setOfferModal(null)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>✕</button>
            </div>

            <div className="card" style={{ marginBottom: 16, background: "#f0fdf4" }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {offerModal.crop_name} — {offerModal.quantity_kg}kg
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                Grade {offerModal.quality_grade} · {offerModal.address}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                  Price per Quintal (₹)
                </label>
                <input className="input" type="number" value={offerForm.price_per_q}
                  onChange={e => setOfferForm({ ...offerForm, price_per_q: Number(e.target.value) })}
                  min={1000} step={50} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                  Quantity (kg, max {offerModal.quantity_kg})
                </label>
                <input className="input" type="number" value={offerForm.quantity_kg}
                  onChange={e => setOfferForm({ ...offerForm, quantity_kg: Math.min(Number(e.target.value), offerModal.quantity_kg) })}
                  min={100} step={100} max={offerModal.quantity_kg} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                  Delivery Date
                </label>
                <input className="input" type="date" value={offerForm.delivery_date}
                  onChange={e => setOfferForm({ ...offerForm, delivery_date: e.target.value })} />
              </div>

              <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>Total Value</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>
                    ₹{((offerForm.price_per_q * offerForm.quantity_kg) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <button className="btn-primary" onClick={() => createOffer(offerModal)}
                style={{ width: "100%", padding: "14px" }}>
                📩 Send Offer
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav hide-desktop">
        <a href="/farmer" className="nav-item"><span style={{ fontSize: 20 }}>🏠</span><span>Home</span></a>
        <a href="/farmer/prices" className="nav-item"><span style={{ fontSize: 20 }}>📊</span><span>Prices</span></a>
        <a href="/farmer/sell" className="nav-item"><span style={{ fontSize: 20 }}>💰</span><span>Sell</span></a>
        <a href="/farmer/orders" className="nav-item"><span style={{ fontSize: 20 }}>📋</span><span>Orders</span></a>
        <a href="/farmer/profile" className="nav-item"><span style={{ fontSize: 20 }}>👤</span><span>Profile</span></a>
      </nav>
    </div>
  );
}
