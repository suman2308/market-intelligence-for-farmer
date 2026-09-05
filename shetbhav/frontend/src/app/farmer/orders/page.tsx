"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Order status to human-readable mapping
 */
const STATUS_MAP: Record<string, { label: string; icon: string; color: string }> = {
  created: { label: "Order created", icon: "📝", color: "#667085" },
  matched: { label: "Matched with buyer", icon: "🤝", color: "#2563eb" },
  offer_received: { label: "Offer received", icon: "📨", color: "#D97706" },
  negotiating: { label: "Negotiating", icon: "💬", color: "#D97706" },
  accepted: { label: "Offer accepted", icon: "✅", color: "#16a34a" },
  pickup_scheduled: { label: "Pickup scheduled", icon: "🚚", color: "#2563eb" },
  in_transit: { label: "In transit", icon: "🚛", color: "#2563eb" },
  delivered: { label: "Delivered", icon: "📦", color: "#16a34a" },
  quality_confirmed: { label: "Quality confirmed", icon: "✓", color: "#16a34a" },
  payment_pending: { label: "Payment pending", icon: "⏳", color: "#D97706" },
  paid: { label: "Paid", icon: "💰", color: "#16a34a" },
  completed: { label: "Completed", icon: "✅", color: "#16a34a" },
  disputed: { label: "Disputed", icon: "⚠️", color: "#C2413B" },
  cancelled: { label: "Cancelled", icon: "✕", color: "#667085" },
};

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { label: status?.replace(/_/g, " "), icon: "●", color: "#667085" };
}

/**
 * Timeline for an order
 */
function OrderTimeline({ status }: { status: string }) {
  const allSteps = [
    "accepted", "pickup_scheduled", "in_transit", "delivered", "quality_confirmed", "paid",
  ];
  const currentIdx = allSteps.indexOf(status);
  const isComplete = ["completed", "paid"].includes(status);
  const isCancelled = status === "cancelled";

  if (isCancelled || status === "disputed") {
    return (
      <div style={{ padding: "12px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{getStatusInfo(status).icon}</span>
        <span style={{ color: getStatusInfo(status).color, fontWeight: 600, fontSize: 14 }}>
          {getStatusInfo(status).label}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 0 }}>
      {allSteps.map((step, i) => {
        const isDone = isComplete || (currentIdx >= 0 && i <= currentIdx);
        const isCurrent = !isComplete && i === currentIdx;
        const stepInfo = getStatusInfo(step);
        return (
          <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                background: isDone ? "#16a34a" : isCurrent ? "#1F6B45" : "#e5e7eb",
                color: !isDone && !isCurrent ? "#667085" : "white",
                border: isCurrent ? "2px solid #bbf7d0" : "none",
              }}>
                {isDone ? "✓" : ""}
              </div>
              {i < allSteps.length - 1 && (
                <div style={{ width: 2, height: 20, background: isDone ? "#16a34a" : "#e5e7eb" }} />
              )}
            </div>
            <span style={{
              fontSize: 12, paddingBottom: 4,
              color: isDone ? "#172033" : "#667085",
              fontWeight: isCurrent ? 600 : 400,
            }}>
              {stepInfo.icon} {stepInfo.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);

  const loadOrders = () => {
    if (!user) return;
    setOrdersError(false);
    api.get("/orders").then(r => setOrders(r.data)).catch(() => setOrdersError(true));
  };
  useEffect(loadOrders, [user]);

  if (!user) return null;

  const activeOrders = orders.filter(o => !["completed", "cancelled", "paid"].includes(o.status));
  const completedOrders = orders.filter(o => ["completed", "cancelled", "paid"].includes(o.status));
  const displayOrders = activeTab === "active" ? activeOrders : completedOrders;

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("my_orders")}</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          <button
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
              background: activeTab === "active" ? "#1F6B45" : "#f3f4f6",
              color: activeTab === "active" ? "white" : "#667085",
              fontWeight: 600, fontSize: 14,
            }}
            onClick={() => setActiveTab("active")}>
            {t("active_orders")} ({activeOrders.length})
          </button>
          <button
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
              background: activeTab === "completed" ? "#1F6B45" : "#f3f4f6",
              color: activeTab === "completed" ? "white" : "#667085",
              fontWeight: 600, fontSize: 14,
            }}
            onClick={() => setActiveTab("completed")}>
            {t("orders_history")} ({completedOrders.length})
          </button>
        </div>

        {loading ? (
          <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
        ) : ordersError ? (
          <div className="card" style={{ textAlign: "center", padding: 32, borderColor: "var(--danger)" }}>
            <p style={{ fontSize: 28, margin: 0 }}>⚠️</p>
            <p style={{ fontSize: 14, color: "var(--danger)", margin: "8px 0 12px 0" }}>
              Couldn't load your orders. Check your connection and try again.
            </p>
            <button className="btn-primary" onClick={loadOrders}>Retry</button>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32, margin: 0 }}>📋</p>
            <p style={{ fontSize: 14, color: "#667085", margin: "8px 0 0 0" }}>
              {activeTab === "active"
                ? "No active orders. When you accept an offer, your orders will appear here."
                : "Completed orders will show up here after delivery and payment."
              }
            </p>
            {activeTab === "active" && (
              <button className="btn-primary" style={{ marginTop: 12 }}
                onClick={() => router.push("/farmer/sell")}>
                {t("sell_my_produce")}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayOrders.map(order => {
              const info = getStatusInfo(order.status);
              return (
                <div key={order.id} className="card" style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/farmer/orders/${order.id}`)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{info.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Order #{order.id}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#667085", margin: 0 }}>
                        {order.quantity_kg}kg · ₹{order.price_per_q?.toLocaleString("en-IN")}/q
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 8,
                        background: `${info.color}15`, color: info.color, display: "inline-block",
                      }}>
                        {info.label}
                      </span>
                      <p style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0 0", color: "#172033" }}>
                        ₹{order.total_value?.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
        <FarmerBottomNav />
    </div>
  );
}
