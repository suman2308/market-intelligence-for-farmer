"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

const EVENT_ICONS: Record<string, string> = {
  offer_accepted: "✅",
  order_created: "📝",
  status_update: "🔄",
  pickup_completed: "📦",
  buyer_received: "🏭",
  payment_initiated: "⏳",
  payment_completed: "💰",
  grievance_opened: "⚠️",
  grievance_resolved: "✔️",
  transport_assigned: "🚚",
};

const STATUS_LABELS: Record<string, string> = {
  created: "Order Created",
  accepted: "Offer Accepted",
  pickup_scheduled: "Pickup Scheduled",
  in_transit: "In Transit",
  delivered: "Delivered",
  quality_confirmed: "Quality Confirmed",
  payment_pending: "Payment Pending",
  paid: "Paid",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadUser(); }, []);
  useEffect(() => {
    if (user && id) {
      api.get(`/orders/${id}`)
        .then(r => { setOrderData(r.data); setLoading(false); })
        .catch(e => { setError("Order not found"); setLoading(false); });
    }
  }, [user, id]);

  if (!user) return null;
  if (loading) return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="page-body">
        <div style={{ padding: "10px 0 14px" }}>
          <Skeleton height={26} />
        </div>
        <Skeleton height={140} />
        <div style={{ height: 12 }} />
        <Skeleton height={100} />
        <div style={{ height: 12 }} />
        <Skeleton height={200} />
      </div>
      <FarmerBottomNav />
    </div>
  );
  if (error) return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontSize: 28 }}>❌</p>
        <p style={{ color: "var(--color-text-secondary)" }}>{error}</p>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/farmer/orders")}>← Back to Orders</button>
      </div>
      <FarmerBottomNav />
    </div>
  );

  const { order, crop_name, timeline, payment, logistics } = orderData;

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      {/* Header */}
      <div className="page-header">
        <button onClick={() => router.push("/farmer/orders")}
          aria-label="Back to orders"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 8, minWidth: 44, minHeight: 44 }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="heading-md" style={{ margin: 0 }}>Order #{order.id}</h1>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
            {crop_name} · {order.quantity_kg}kg
          </p>
        </div>
      </div>

      <div className="page-body">
      {/* Order Summary Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className="badge" style={{ background: order.status === "paid" || order.status === "completed" ? "var(--color-success-bg)" : "var(--color-accent-bg)", color: order.status === "paid" || order.status === "completed" ? "var(--color-success)" : "var(--color-accent)", padding: "6px 12px", borderRadius: 20, fontWeight: 600, fontSize: 13 }}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary)" }}>
            ₹{order.total_value?.toLocaleString("en-IN")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Price per quintal</p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 0 0" }}>₹{order.price_per_q?.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Quantity</p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 0 0" }}>{order.quantity_kg}kg ({(order.quantity_kg / 100).toFixed(1)}q)</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Delivery date</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "4px 0 0 0" }}>
              {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("en-IN") : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Created</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "4px 0 0 0" }}>
              {new Date(order.created_at).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {payment && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 8 }}>
            💰 Payment Details
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Amount</p>
              <p style={{ fontSize: 16, fontWeight: 700, margin: "2px 0 0 0", color: "var(--color-success)" }}>₹{payment.amount?.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Status</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0 0" }}>
                {payment.status === "completed" ? "✅ Completed" : `⏳ ${payment.status}`}
              </p>
            </div>
            {payment.transaction_ref && (
              <div style={{ gridColumn: "1 / -1" }}>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Transaction Ref (Simulated)</p>
                <p style={{ fontSize: 13, fontWeight: 600, margin: "2px 0 0 0", fontFamily: "monospace" }}>{payment.transaction_ref}</p>
              </div>
            )}
          </div>
          <p className="text-xs" style={{ color: "var(--color-accent)", marginTop: 8, fontStyle: "italic" }}>
            ⚠️ This is a demo simulation. No real money movement has occurred.
          </p>
        </div>
      )}

      {/* Logistics */}
      {logistics && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 8 }}>
            🚚 Transport
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Distance</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0 0" }}>{logistics.distance_km ? `${logistics.distance_km.toFixed(1)} km` : "—"}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>Cost</p>
              <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0 0" }}>{logistics.cost ? `₹${logistics.cost}` : "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 8 }}>
          📋 Order Timeline
        </h3>
        {timeline && timeline.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {timeline.map((event: any, i: number) => (
              <div key={event.id} style={{ display: "flex", gap: 12, position: "relative" }}>
                {/* Vertical line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: i === timeline.length - 1 ? "var(--color-primary)" : "var(--color-success)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: "white", fontWeight: 700, position: "relative", zIndex: 1,
                  }}>
                    {EVENT_ICONS[event.event_type] || "●"}
                  </div>
                  {i < timeline.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: "var(--color-success)", minHeight: 20 }} />
                  )}
                </div>
                {/* Event content */}
                <div style={{ paddingBottom: 16, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-text)" }}>{event.title}</p>
                  {event.description && (
                    <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>{event.description}</p>
                  )}
                  <p style={{ fontSize: 11, color: "var(--color-text-tertiary, #9ca3af)", margin: "4px 0 0 0" }}>
                    {event.created_at ? new Date(event.created_at).toLocaleString("en-IN") : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center", padding: 16 }}>
            No timeline events yet. Events will appear as the order progresses.
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {order.status !== "paid" && order.status !== "completed" && order.status !== "cancelled" && (
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => router.push("/farmer/orders")}>
            ← Back to Orders
          </button>
        )}
      </div>
      </div>
      <FarmerBottomNav />
    </div>
  );
}
