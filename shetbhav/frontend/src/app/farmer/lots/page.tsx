"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { cropEmoji } from "@/lib/cropEmoji";
import { totalAmount, formatINR } from "@/lib/money";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

const ACTIVE_STATUSES = ["active", "matched", "offered"];

const ORDER_STATUS_COLOR: Record<string, string> = {
  accepted: "var(--info)", payment_pending: "var(--warning)",
  paid: "var(--success)", completed: "var(--success)",
  cancelled: "var(--text-secondary)", disputed: "var(--danger)",
};

export default function FarmerLots() {
  return (
    <Suspense fallback={null}>
      <FarmerLotsContent />
    </Suspense>
  );
}

function FarmerLotsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [lots, setLots] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingLotId, setEditingLotId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ quantity_kg: 0, price_per_q: 0, quality_grade: "unrated", urgency: "flexible" });
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [deletingLotId, setDeletingLotId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    crop_id: 0, quantity_kg: 500, price_per_q: 2000,
    quality_grade: "unrated", urgency: "flexible", storage_available: false,
    available_for_fpo: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = () => {
    setLoadError(false);
    Promise.all([
      api.get("/lots"),
      api.get("/orders"),
      api.get("/crops"),
    ]).then(([l, o, c]) => {
      setLots(l.data);
      setOrders(o.data);
      setCrops(c.data || []);
      setForm(f => (f.crop_id ? f : { ...f, crop_id: c.data?.[0]?.id || 0 }));
      setLoading(false);
    }).catch(() => { setLoadError(true); setLoading(false); });
  };

  useEffect(load, []);

  // Arriving from the Smart Sell recommendation with a crop/quantity/grade
  // already chosen there — prefill and open the create form immediately.
  useEffect(() => {
    const cropId = searchParams.get("crop_id");
    if (!cropId) return;
    setForm(f => ({
      ...f,
      crop_id: Number(cropId) || f.crop_id,
      quantity_kg: Number(searchParams.get("quantity_kg")) || f.quantity_kg,
      quality_grade: searchParams.get("quality_grade") || f.quality_grade,
      urgency: searchParams.get("urgency") || f.urgency,
      storage_available: searchParams.get("storage_available") === "true",
    }));
    setShowCreate(true);
  }, [searchParams]);

  const startEdit = (lot: any) => {
    setEditError("");
    setEditingLotId(lot.id);
    setEditForm({
      quantity_kg: lot.quantity_kg, price_per_q: lot.price_per_q || 0,
      quality_grade: lot.quality_grade || "unrated", urgency: lot.urgency || "flexible",
    });
  };

  const saveEdit = async (lotId: number) => {
    setSavingEditId(lotId);
    setEditError("");
    try {
      const { data } = await api.put(`/lots/${lotId}`, editForm);
      setLots(prev => prev.map(l => l.id === lotId ? data : l));
      setEditingLotId(null);
    } catch (e: any) {
      setEditError(e.response?.data?.detail || "Couldn't save changes. Please try again.");
    } finally {
      setSavingEditId(null);
    }
  };

  const deleteLot = async (lotId: number) => {
    setDeletingLotId(lotId);
    setDeleteError("");
    try {
      await api.delete(`/lots/${lotId}`);
      setLots(prev => prev.filter(l => l.id !== lotId));
    } catch (e: any) {
      setDeleteError(e.response?.data?.detail || "Couldn't withdraw this lot. Please try again.");
    } finally {
      setDeletingLotId(null);
    }
  };

  const createLot = async () => {
    if (!form.crop_id || !form.quantity_kg || !form.price_per_q) {
      setCreateError("Please fill in crop, quantity and price.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await api.post("/lots", form);
      setShowCreate(false);
      setForm(f => ({ ...f, quantity_kg: 500, price_per_q: 2000 }));
      load();
    } catch (e: any) {
      setCreateError(e.response?.data?.detail || "Couldn't create this lot. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const activeLots = lots.filter(l => ACTIVE_STATUSES.includes(l.status));
  const inFpoProcessLots = lots.filter(l => l.status === "pending_fpo" || l.status === "fpo_aggregated");
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
        <h1 className="heading-md" style={{ margin: 0 }}>{t("my_lots") || "My Lots"}</h1>
      </div>

      {/* ── Create Lot ── */}
      <button className="btn-primary" style={{ width: "100%", marginBottom: showCreate ? 12 : 16 }}
        onClick={() => setShowCreate(s => !s)}>
        {showCreate ? "✕ Cancel" : `➕ ${t("create_lot") || "Create a Lot"}`}
      </button>

      {showCreate && (
        <div className="card section-gap">
          {createError && (
            <p style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 10px" }}>⚠️ {createError}</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Crop</label>
              <select className="select" value={form.crop_id} onChange={e => setForm({ ...form, crop_id: Number(e.target.value) })} style={{ width: "100%" }}>
                {crops.map((c: any) => <option key={c.id} value={c.id}>{cropEmoji(c.name)} {c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quantity (kg)</label>
                <input className="input" type="number" value={form.quantity_kg}
                  onChange={e => setForm({ ...form, quantity_kg: Number(e.target.value) })} min={1} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Price (₹/quintal)</label>
                <input className="input" type="number" value={form.price_per_q}
                  onChange={e => setForm({ ...form, price_per_q: Number(e.target.value) })} min={1} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quality Grade</label>
                <select className="select" value={form.quality_grade} onChange={e => setForm({ ...form, quality_grade: e.target.value })} style={{ width: "100%" }}>
                  <option value="unrated">Unrated</option>
                  <option value="A">Grade A — Premium</option>
                  <option value="B">Grade B — Standard</option>
                  <option value="C">Grade C — Below Standard</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Urgency</label>
                <select className="select" value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })} style={{ width: "100%" }}>
                  <option value="urgent">Urgent (sell within hours)</option>
                  <option value="soon">Soon (within a day)</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.storage_available}
                onChange={e => setForm({ ...form, storage_available: e.target.checked })} />
              I have storage available for this produce
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.available_for_fpo}
                onChange={e => setForm({ ...form, available_for_fpo: e.target.checked })} />
              Make this lot available for FPO aggregation
            </label>
            <button className="btn-primary" disabled={creating} onClick={createLot}>
              {creating ? "Listing…" : "List this produce"}
            </button>
          </div>
        </div>
      )}

      <button className="btn-secondary" style={{ width: "100%", marginBottom: 16 }}
        onClick={() => router.push("/farmer/offers")}>
        📨 Offers on my lots
      </button>

      {/* ── Active Lots ── */}
      <p className="heading-sm" style={{ marginBottom: 8 }}>Active Lots</p>
      {loading ? (
        <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
      ) : loadError ? (
        <div className="card section-gap" style={{ borderColor: "var(--danger)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 13, margin: 0, color: "var(--danger)" }}>⚠️ Couldn't load your lots.</p>
          <button className="btn-sm" onClick={load} style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Retry
          </button>
        </div>
      ) : activeLots.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, marginBottom: 16 }}>
          <p style={{ fontSize: 28, margin: 0 }}>📦</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "10px 0 0 0" }}>No active lots. Create one above to reach buyers.</p>
        </div>
      ) : (
        activeLots.map(lot => (
          <div key={lot.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
              onClick={() => router.push(`/lots/${lot.id}`)}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {cropEmoji(lot.crop_name)} {lot.crop_name || "Crop"} - {lot.quantity_kg}kg
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                  Grade {lot.quality_grade} · {lot.urgency}
                  {lot.price_per_q ? ` · ₹${lot.price_per_q.toLocaleString("en-IN")}/q` : ""}
                </p>
                {lot.price_per_q && (
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "2px 0 0 0" }}>
                    Total: {formatINR(totalAmount(lot.price_per_q, lot.quantity_kg))}
                  </p>
                )}
                {lot.address && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>{lot.address}</p>}
              </div>
              <span className={`badge ${lot.status === "active" ? "badge-active" : "badge-completed"}`}>
                {lot.status}
              </span>
            </div>
            {editingLotId === lot.id ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--stone-100, #f5f5f4)" }}>
                {editError && <p style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 8px" }}>⚠️ {editError}</p>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quantity (kg)</label>
                    <input className="input" type="number" value={editForm.quantity_kg}
                      onChange={e => setEditForm({ ...editForm, quantity_kg: Number(e.target.value) })} min={1} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Price (₹/quintal)</label>
                    <input className="input" type="number" value={editForm.price_per_q}
                      onChange={e => setEditForm({ ...editForm, price_per_q: Number(e.target.value) })} min={1} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Quality Grade</label>
                    <select className="select" value={editForm.quality_grade} onChange={e => setEditForm({ ...editForm, quality_grade: e.target.value })} style={{ width: "100%" }}>
                      <option value="unrated">Unrated</option>
                      <option value="A">Grade A — Premium</option>
                      <option value="B">Grade B — Standard</option>
                      <option value="C">Grade C — Below Standard</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Urgency</label>
                    <select className="select" value={editForm.urgency} onChange={e => setEditForm({ ...editForm, urgency: e.target.value })} style={{ width: "100%" }}>
                      <option value="urgent">Urgent</option>
                      <option value="soon">Soon</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: 13 }}
                    disabled={savingEditId === lot.id} onClick={() => saveEdit(lot.id)}>
                    {savingEditId === lot.id ? "Saving…" : "Save Changes"}
                  </button>
                  <button style={{
                    flex: 1, padding: "8px", fontSize: 13, borderRadius: 8,
                    border: "1px solid var(--stone-200)", background: "white", cursor: "pointer",
                  }} onClick={() => setEditingLotId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {lot.status === "active" && (
                  <>
                    <button className="btn-secondary" style={{ flex: 1, padding: "10px", fontSize: 14 }}
                      onClick={() => startEdit(lot)}>
                      ✏️ Edit
                    </button>
                    <button style={{
                      flex: 1, padding: "10px", fontSize: 14, borderRadius: 8,
                      border: "1px solid var(--stone-200)", background: "white", cursor: "pointer", color: "var(--danger)",
                    }} disabled={deletingLotId === lot.id} onClick={() => deleteLot(lot.id)}>
                      {deletingLotId === lot.id ? "…" : "🗑️ Delete"}
                    </button>
                  </>
                )}
              </div>
            )}
            {deleteError && editingLotId !== lot.id && (
              <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>⚠️ {deleteError}</p>
            )}
          </div>
        ))
      )}

      {/* ── In FPO Process ── */}
      {inFpoProcessLots.length > 0 && (
        <>
          <p className="heading-sm" style={{ margin: "20px 0 8px" }}>In FPO Storage</p>
          {inFpoProcessLots.map(lot => (
            <div key={lot.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                    {cropEmoji(lot.crop_name)} {lot.crop_name} · {lot.quantity_kg}kg
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                    {lot.status === "pending_fpo" ? "Awaiting your confirmation" : "Aggregated with your FPO"}
                  </p>
                </div>
                <span className="badge badge-amber">{lot.status === "pending_fpo" ? "Pending" : "In FPO storage"}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Order History ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 8px" }}>
        <p className="heading-sm" style={{ margin: 0 }}>Order History</p>
        <button onClick={() => router.push("/farmer/orders")}
          style={{ background: "none", border: "none", color: "var(--green-600)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          View all →
        </button>
      </div>
      {!loading && !loadError && recentOrders.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", margin: "8px 0" }}>No orders yet</p>
      ) : (
        recentOrders.map((order: any) => (
          <div key={order.id} className="card" style={{ marginBottom: 8, padding: "12px 14px", cursor: "pointer" }}
            onClick={() => router.push(`/farmer/orders/${order.id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Order #{order.id} · {order.quantity_kg}kg</p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>₹{order.price_per_q}/q</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>₹{order.total_value?.toLocaleString("en-IN")}</p>
                <span className="badge" style={{
                  fontSize: 10,
                  background: `color-mix(in srgb, ${ORDER_STATUS_COLOR[order.status] || "var(--warning)"} 15%, white)`,
                  color: ORDER_STATUS_COLOR[order.status] || "var(--warning)",
                }}>
                  {order.status}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
      </div>
      <FarmerBottomNav />
    </div>
  );
}
