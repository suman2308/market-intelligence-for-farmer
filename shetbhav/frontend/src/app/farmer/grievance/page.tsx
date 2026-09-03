"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { BottomNav } from "@/components/ui";

const CATEGORIES = [
  { value: "wrong_quantity", label: "Wrong Quantity Delivered", icon: "⚖️" },
  { value: "quality_disagreement", label: "Quality Disagreement", icon: "🔍" },
  { value: "payment_delayed", label: "Payment Not Received", icon: "💰" },
  { value: "transport_issue", label: "Transport Problem", icon: "🚚" },
  { value: "buyer_issue", label: "Buyer Issue", icon: "🏭" },
  { value: "seller_issue", label: "Seller Issue", icon: "🌾" },
  { value: "other", label: "Other Issue", icon: "📝" },
];

export default function GrievancePage() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [grievances, setGrievances] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser(); }, []);
  useEffect(() => {
    if (user) {
      Promise.all([
        api.get("/orders").catch(() => ({ data: [] })),
        api.get("/grievances").catch(() => ({ data: [] })),
      ]).then(([o, g]) => {
        setOrders(o.data);
        setGrievances(g.data);
        setLoading(false);
      });
    }
  }, [user]);

  if (!user) return null;

  const submit = async () => {
    if (!category || description.length < 10) return;
    setSubmitting(true);
    try {
      await api.post("/grievances", {
        order_id: orderId || null,
        category,
        description,
      });
      setSuccess(true);
      const { data } = await api.get("/grievances");
      setGrievances(data);
      setCategory("");
      setDescription("");
      setOrderId("");
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = { open: "var(--color-accent)", under_review: "var(--color-info)", resolved: "var(--color-success)", rejected: "var(--color-danger)" };
    return map[status] || "var(--color-text-secondary)";
  };

  return (
    <>
      <div className="page-header">
        <button onClick={() => router.push("/farmer")}
          aria-label="Back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 8, minWidth: 44, minHeight: 44 }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="heading-md" style={{ margin: 0 }}>Help & Grievance</h1>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
            Report an issue or get help
          </p>
        </div>
      </div>

      {success && (
        <div className="card" style={{ marginBottom: 16, background: "var(--color-success-bg)", borderLeft: "4px solid var(--color-success)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-success)", margin: 0 }}>
            ✅ Grievance submitted successfully! Our team will review it.
          </p>
        </div>
      )}

      {/* New Grievance Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>📝 Report an Issue</h3>

        {/* Order Selection */}
        <div style={{ marginBottom: 12 }}>
          <label className="text-xs" style={{ color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
            Related Order (optional)
          </label>
          <select className="select" value={orderId} onChange={e => setOrderId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">No specific order</option>
            {orders.map((o: any) => (
              <option key={o.id} value={o.id}>Order #{o.id} — {o.quantity_kg}kg</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 12 }}>
          <label className="text-xs" style={{ color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
            Issue Type *
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.value}
                onClick={() => setCategory(cat.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                  borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", minHeight: 44,
                  border: category === cat.value ? "2px solid var(--color-primary)" : "1.5px solid var(--color-border)",
                  background: category === cat.value ? "var(--color-primary-light)" : "var(--color-card)",
                  color: category === cat.value ? "var(--color-primary)" : "var(--color-text)",
                  textAlign: "left",
                }}>
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <label className="text-xs" style={{ color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
            Description * (minimum 10 characters)
          </label>
          <textarea
            className="input"
            rows={4}
            placeholder="Describe what happened in detail..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ resize: "vertical", minHeight: 100 }}
          />
          <p className="text-xs" style={{ color: description.length >= 10 ? "var(--color-success)" : "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
            {description.length}/10 min
          </p>
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={submit}
          disabled={!category || description.length < 10 || submitting}
        >
          {submitting ? "Submitting..." : "Submit Grievance"}
        </button>
      </div>

      {/* Previous Grievances */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>📋 My Grievances ({grievances.length})</h3>
        {grievances.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: 16 }}>
            No grievances filed yet. 🎉
          </p>
        ) : grievances.map((g: any) => (
          <div key={g.id} style={{ padding: "12px 0", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                  {CATEGORIES.find(c => c.value === g.category)?.icon} {CATEGORIES.find(c => c.value === g.category)?.label || g.category}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                  {g.description?.substring(0, 100)}{g.description?.length > 100 ? "..." : ""}
                </p>
                {g.admin_response && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "var(--color-info-bg, #eff6ff)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 4px 0", color: "var(--color-info)" }}>Admin Response:</p>
                    <p style={{ fontSize: 12, margin: 0 }}>{g.admin_response}</p>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge" style={{ background: `${statusColor(g.status)}15`, color: statusColor(g.status), padding: "4px 10px", borderRadius: 12, fontSize: 11 }}>
                  {g.status?.replace(/_/g, " ")}
                </span>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary, #9ca3af)", margin: "4px 0 0 0" }}>
                  {new Date(g.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav
        active="/farmer/profile"
        items={[
          { icon: "🏠", label: t("home"), href: "/farmer" },
          { icon: "📊", label: t("markets"), href: "/farmer/prices" },
          { icon: "💰", label: t("sell_my_produce"), href: "/farmer/sell" },
          { icon: "📋", label: t("orders"), href: "/farmer/orders" },
          { icon: "👤", label: t("more"), href: "/farmer/profile" },
        ]}
      />
    </>
  );
}
