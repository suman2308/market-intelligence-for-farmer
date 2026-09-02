"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { EmptyState, BottomNav, Skeleton } from "@/components/ui";

/**
 * Order status to human-readable mapping
 */
const STATUS_MAP: Record<string, { label: string; icon: string; color: string }> = {
  created: { label: "Order created", icon: "📝", color: "var(--color-text-secondary)" },
  matched: { label: "Matched with buyer", icon: "🤝", color: "var(--color-info)" },
  offer_received: { label: "Offer received", icon: "📨", color: "var(--color-accent)" },
  negotiating: { label: "Negotiating", icon: "💬", color: "var(--color-accent)" },
  accepted: { label: "Offer accepted", icon: "✅", color: "var(--color-success)" },
  pickup_scheduled: { label: "Pickup scheduled", icon: "🚚", color: "var(--color-info)" },
  in_transit: { label: "In transit", icon: "🚛", color: "var(--color-info)" },
  delivered: { label: "Delivered", icon: "📦", color: "var(--color-success)" },
  quality_confirmed: { label: "Quality confirmed", icon: "✓", color: "var(--color-success)" },
  payment_pending: { label: "Payment pending", icon: "⏳", color: "var(--color-accent)" },
  paid: { label: "Paid", icon: "💰", color: "var(--color-success)" },
  completed: { label: "Completed", icon: "✅", color: "var(--color-success)" },
  disputed: { label: "Disputed", icon: "⚠️", color: "var(--color-danger)" },
  cancelled: { label: "Cancelled", icon: "✕", color: "var(--color-text-secondary)" },
};

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { label: status?.replace(/_/g, " "), icon: "●", color: "var(--color-text-secondary)" };
}

/**
 * Timeline for an order
 */
function OrderTimeline({ status }: { status: string }) {
  const allSteps = [
    "accepted", "pickup_scheduled", "in_transit", "delivered", "quality_confirmed", "paid",
  ];
  const currentIdx = allSteps.indexOf(status);

  // For completed/paid orders, show all steps done
  const isComplete = ["completed", "paid"].includes(status);
  const isCancelled = status === "cancelled";

  if (isCancelled || status === "disputed") {
    return (
      <div style={{ padding: "12px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{getStatusInfo(status).icon}</span>
        <span className="text-sm" style={{ color: getStatusInfo(status).color, fontWeight: 600 }}>
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
                background: isDone ? "var(--color-success)" : isCurrent ? "var(--color-primary)" : "var(--color-border)",
                color: !isDone && !isCurrent ? "var(--color-text-secondary)" : "white",
                border: isCurrent ? "2px solid var(--color-primary-light)" : "none",
              }}>
                {isDone ? "✓" : ""}
              </div>
              {i < allSteps.length - 1 && (
                <div style={{ width: 2, height: 20, background: isDone ? "var(--color-success)" : "var(--color-border)" }} />
              )}
            </div>
            <span style={{
              fontSize: 12, paddingBottom: 4,
              color: isDone ? "var(--color-text)" : "var(--color-text-secondary)",
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
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  useEffect(() => { loadUser().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (user) api.get("/orders").then(r => setOrders(r.data)).catch(() => {});
  }, [user]);

  if (!user) return null;

  const activeOrders = orders.filter(o => !["completed", "cancelled", "paid"].includes(o.status));
  const completedOrders = orders.filter(o => ["completed", "cancelled", "paid"].includes(o.status));
  const displayOrders = activeTab === "active" ? activeOrders : completedOrders;

  return (
    <>
      <div className="page-header">
        <h1 className="heading-md">{t("my_orders")}</h1>
      </div>

      {/* Tabs */}
      <div className="scroll-x section-gap">
        <button className={`toggle-btn ${activeTab === "active" ? "selected" : ""}`}
          onClick={() => setActiveTab("active")} style={{ flex: "none" }}>
          {t("active_lots")} ({activeOrders.length})
        </button>
        <button className={`toggle-btn ${activeTab === "completed" ? "selected" : ""}`}
          onClick={() => setActiveTab("completed")} style={{ flex: "none" }}>
          {t("orders_history")} ({completedOrders.length})
        </button>
      </div>

      {loading ? (
        <Skeleton height={100} count={3} />
      ) : displayOrders.length === 0 ? (
        <EmptyState
          icon="📋"
          title={activeTab === "active" ? "No active orders" : "No completed orders yet"}
          description={activeTab === "active"
            ? "When you accept an offer, your orders will appear here."
            : "Completed orders will show up here after delivery and payment."
          }
          action={activeTab === "active" ? { label: t("sell_my_produce"), onClick: () => router.push("/farmer/sell") } : undefined}
        />
      ) : (
        <div className="flex-col gap-3">
          {displayOrders.map(order => {
            const info = getStatusInfo(order.status);
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="card" style={{ cursor: "pointer" }}
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{info.icon}</span>
                      <span className="text-sm" style={{ fontWeight: 600 }}>Order #{order.id}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
                      {order.quantity_kg}kg · ₹{order.price_per_q?.toLocaleString("en-IN")}/q
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="badge" style={{
                      background: `${info.color}15`, color: info.color, marginBottom: 4, display: "inline-block",
                    }}>
                      {info.label}
                    </span>
                    <p className="price-big" style={{ fontSize: 18, margin: "4px 0 0 0" }}>
                      ₹{order.total_value?.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Expanded Timeline */}
                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                    <OrderTimeline status={order.status} />
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)", marginTop: 8, textAlign: "right" }}>
                      Created: {new Date(order.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BottomNav
        active="/farmer/orders"
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
