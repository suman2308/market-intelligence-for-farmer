"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function EarningsPage() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser().finally(() => {
      Promise.all([
        api.get("/orders").catch(() => ({ data: [] })),
      ]).then(([o]) => {
        setOrders(o.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  if (!user) return null;

  const paidOrders = orders.filter(o => ["paid", "completed"].includes(o.status));
  const pendingOrders = orders.filter(o => !["paid", "completed", "cancelled"].includes(o.status));
  const totalEarnings = paidOrders.reduce((sum: number, o: any) => sum + (o.total_value || 0), 0);
  const totalPending = pendingOrders.reduce((sum: number, o: any) => sum + (o.total_value || 0), 0);
  const avgPrice = paidOrders.length > 0
    ? paidOrders.reduce((sum: number, o: any) => sum + (o.price_per_q || 0), 0) / paidOrders.length
    : 0;

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="heading-md" style={{ margin: 0 }}>{t("my_earnings")}</h1>
      </div>

      {/* Total Earnings Hero */}
      <Card style={{
        textAlign: "center", marginBottom: 16, padding: 28,
        background: "linear-gradient(135deg, #166534, #16a34a)", color: "white",
      }}>
        <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>Total Received</p>
        <p style={{ fontSize: 36, fontWeight: 800, margin: "8px 0" }}>
          ₹{totalEarnings.toLocaleString("en-IN")}
        </p>
        <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
          {paidOrders.length} paid transaction{paidOrders.length !== 1 ? "s" : ""}
        </p>
      </Card>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card style={{ textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--warning)" }}>
            ₹{totalPending > 0 ? totalPending.toLocaleString("en-IN") : "0"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Pending</div>
        </Card>
        <Card style={{ textAlign: "center", padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)" }}>
            ₹{avgPrice > 0 ? avgPrice.toLocaleString("en-IN") : "---"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Avg ₹/quintal</div>
        </Card>
      </div>

      {/* Transaction History */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Transaction History</h2>
      {loading ? (
        <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />)}</div>
      ) : orders.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 28, margin: 0 }}>💰</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 0 0" }}>No transactions yet. Sell your produce to start earning!</p>
          <Button style={{ marginTop: 12 }} onClick={() => router.push("/farmer/lots")}>
            {t("create_lot") || "Create a Lot"}
          </Button>
        </Card>
      ) : (
        orders.map((o: any) => (
          <Card key={o.id} style={{
            marginBottom: 8, padding: 14, borderLeft: `3px solid ${
              ["paid", "completed"].includes(o.status) ? "var(--success)" :
              o.status === "cancelled" ? "var(--danger)" : "var(--warning)"
            }`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Order #{o.id}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                  {o.quantity_kg}kg · ₹{o.price_per_q?.toLocaleString("en-IN")}/q
                </p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                  {new Date(o.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontWeight: 700,
                  color: ["paid", "completed"].includes(o.status) ? "var(--success)" :
                         o.status === "cancelled" ? "var(--danger)" : "var(--warning)",
                  fontSize: 16,
                }}>
                  {["paid", "completed"].includes(o.status) ? "+" : ""}₹{o.total_value?.toLocaleString("en-IN")}
                </span>
                <p style={{
                  fontSize: 11, margin: "2px 0 0 0",
                  color: ["paid", "completed"].includes(o.status) ? "var(--success)" :
                         o.status === "cancelled" ? "var(--danger)" : "var(--text-secondary)",
                  fontWeight: 500,
                }}>
                  {o.status === "paid" || o.status === "completed" ? "✅ Received" :
                   o.status === "cancelled" ? "❌ Cancelled" :
                   o.status === "accepted" ? "⏳ Accepted" :
                   `⏳ ${o.status.replace(/_/g, " ")}`}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}

      {/* Source disclaimer */}
      <p className="data-source" style={{ textAlign: "center", marginTop: 16 }}>
        Payment tracking is simulated for demo. Not a real financial transaction.
      </p>
    </div>
      <FarmerBottomNav />
    </div>
  );
}
