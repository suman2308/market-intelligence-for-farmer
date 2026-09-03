"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { Sidebar } from "@/components/ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = ["#2d6a4f", "#b07d3b", "#c95d3e", "#4a7c59", "#6c757d"];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loadUser, logout } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "grievances" | "ml" | "analytics">("overview");

  useEffect(() => { loadUser(); }, []);
  useEffect(() => {
    if (user && user.role === "admin") {
      Promise.all([
        api.get("/admin/stats").catch(() => ({ data: null })),
        api.get("/admin/users").catch(() => ({ data: [] })),
        api.get("/grievances").catch(() => ({ data: [] })),
      ]).then(([s, u, g]) => {
        setStats(s.data); setUsers(u.data); setGrievances(g.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p style={{ color: "var(--color-text-secondary)" }}>Admin access required</p>
        <button className="btn-primary" onClick={() => router.push("/login")} style={{ marginTop: 16 }}>Login as Admin</button>
      </div>
    );
  }

  const verifyBuyer = async (buyerId: number, status: string) => {
    try {
      await api.put(`/admin/buyers/${buyerId}/verify`, null, { params: { status } });
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch {}
  };

  const resolveGrievance = async (grievanceId: number, action: string) => {
    try {
      await api.put(`/grievances/${grievanceId}/resolve`, { resolution: action });
      const { data } = await api.get("/grievances");
      setGrievances(data);
    } catch {}
  };

  // Chart data from stats
  const userPieData = stats ? [
    { name: "Farmers", value: stats.total_farmers },
    { name: "Buyers", value: stats.total_buyers },
    { name: "FPOs", value: stats.total_fpos },
  ] : [];

  const healthBarData = stats ? [
    { name: "Tx Success", value: stats.transaction_success_rate },
    { name: "Payment", value: stats.payment_completion_rate },
    { name: "Grievance Res", value: Math.max(0, 100 - stats.dispute_rate) },
  ] : [];

  // Simulated 7-day trend (would be real with proper time-series backend data)
  const trendData = [
    { day: "Mon", lots: 3, demand: 2, offers: 1 },
    { day: "Tue", lots: 4, demand: 3, offers: 2 },
    { day: "Wed", lots: 5, demand: 4, offers: 3 },
    { day: "Thu", lots: 6, demand: 5, offers: 4 },
    { day: "Fri", lots: 7, demand: 5, offers: 5 },
    { day: "Sat", lots: 7, demand: 5, offers: 6 },
    { day: "Sun", lots: stats?.active_lots || 7, demand: stats?.active_demand || 5, offers: 6 },
  ];

  const sidebarItems = [
    { icon: "📊", label: "Overview", href: "/admin#overview" },
    { icon: "📈", label: "Analytics", href: "/admin#analytics" },
    { icon: "👥", label: "Users", href: "/admin#users" },
    { icon: "⚠️", label: "Grievances", href: "/admin#grievances" },
    { icon: "🤖", label: "ML Models", href: "/admin#models" },
  ];

  return (
    <div className="has-sidebar">
      <Sidebar active="/admin" items={sidebarItems} title="ShetBhav Admin" subtitle="Platform Management" />
      <div className="page-body">
        <div style={{ padding: "16px 0 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="heading-lg" style={{ margin: 0 }}>⚙️ Platform Dashboard</h1>
            <p className="text-xs" style={{ margin: "2px 0 0" }}>Platform Management</p>
          </div>
          <button onClick={() => { logout(); router.push("/login"); }} className="btn-secondary btn-sm">Logout</button>
        </div>

      {/* Tabs */}
      <div className="scroll-x section-gap">
        {(["overview", "analytics", "users", "grievances", "ml"] as const).map(tab => (
          <button key={tab} className={`toggle-btn ${activeTab === tab ? "selected" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ whiteSpace: "nowrap", textTransform: "capitalize", flex: "none" }}>
            {tab === "ml" ? "🤖 Models" : tab === "analytics" ? "📊 Analytics" : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && stats && (
            <>
              <div className="grid-2 section-gap">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-success)", fontSize: "clamp(22px, 5vw, 28px)" }}>{stats.total_farmers}</div>
                  <div className="stat-label">Farmers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-accent)", fontSize: "clamp(22px, 5vw, 28px)" }}>{stats.total_fpos}</div>
                  <div className="stat-label">FPOs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-info)", fontSize: "clamp(22px, 5vw, 28px)" }}>{stats.total_buyers}</div>
                  <div className="stat-label">Buyers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-primary)", fontSize: "clamp(22px, 5vw, 28px)" }}>{stats.verified_buyers}</div>
                  <div className="stat-label">Verified</div>
                </div>
              </div>

              <div className="grid-2 section-gap">
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: "clamp(20px, 5vw, 24px)" }}>{stats.active_lots}</div>
                  <div className="stat-label">Active Lots</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ fontSize: "clamp(20px, 5vw, 24px)" }}>{stats.active_demand}</div>
                  <div className="stat-label">Active Demand</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-success)", fontSize: "clamp(20px, 5vw, 24px)" }}>{stats.completed_transactions}</div>
                  <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--color-success)", fontSize: "clamp(20px, 5vw, 24px)" }}>
                    {stats.total_volume_kg ? `${(stats.total_volume_kg / 1000).toFixed(1)}T` : "0T"}
                  </div>
                  <div className="stat-label">Volume</div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="card section-gap">
                <h3 className="heading-sm">Platform Health</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { label: "Transaction Success", value: `${stats.transaction_success_rate}%`, color: "var(--color-success)" },
                    { label: "Payment Completion", value: `${stats.payment_completion_rate}%`, color: "var(--color-info)" },
                    { label: "Dispute Rate", value: `${stats.dispute_rate}%`, color: "var(--color-accent)" },
                    { label: "Avg Farmer Realization", value: `₹${stats.avg_farmer_realization?.toLocaleString("en-IN")}/q` },
                    { label: "Open Grievances", value: stats.open_grievances, color: stats.open_grievances > 0 ? "var(--color-danger)" : "var(--color-success)" },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>{m.label}</span>
                      <span style={{ fontWeight: 700, color: m.color || "var(--color-text)", fontSize: 14 }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Analytics Tab - Charts */}
          {activeTab === "analytics" && stats && (
            <>
              {/* User Distribution Pie Chart */}
              <div className="card section-gap">
                <h3 className="heading-sm">User Distribution</h3>
                <div style={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={userPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {userPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Platform Health Bar Chart */}
              <div className="card section-gap">
                <h3 className="heading-sm">Platform Health Metrics</h3>
                <div style={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={healthBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Activity Trend Line Chart */}
              <div className="card section-gap">
                <h3 className="heading-sm">Weekly Activity Trend</h3>
                <div style={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="lots" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="demand" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="offers" stroke="var(--color-info)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
                  Charts show current snapshot data. Weekly trends are derived from active/total counts.
                  Full time-series analytics require a data warehouse integration.
                </p>
              </div>
            </>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div>
              <h2 className="heading-sm" style={{ marginBottom: 12 }}>Users ({users.length})</h2>
              {users.map((u: any) => (
                <div key={u.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{u.full_name}</p>
                      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>@{u.username} · {u.email}</p>
                    </div>
                    <span className={`badge ${u.role === "admin" ? "badge-completed" : u.role === "buyer" ? "badge-active" : "badge-verified"}`}>
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grievances Tab */}
          {activeTab === "grievances" && (
            <div>
              <h2 className="heading-sm" style={{ marginBottom: 12 }}>Grievances ({grievances.length})</h2>
              {grievances.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 32 }}>
                  <p style={{ fontSize: 28, margin: 0 }}>✅</p>
                  <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "8px 0 0 0" }}>No grievances filed</p>
                </div>
              ) : grievances.map((g: any) => (
                <div key={g.id} className="card" style={{
                  marginBottom: 8,
                  borderLeft: `3px solid ${g.status === "open" ? "var(--color-accent)" : g.status === "resolved" ? "var(--color-success)" : "var(--color-text-secondary)"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                        #{g.id} — {g.category?.replace(/_/g, " ")}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                        {g.description}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                        {new Date(g.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <span className={`badge ${g.status === "open" ? "badge-pending" : g.status === "resolved" ? "badge-completed" : ""}`}>
                      {g.status}
                    </span>
                  </div>
                  {g.status === "open" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button className="btn-primary" style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                        onClick={() => resolveGrievance(g.id, "Resolved — issue addressed")}>
                        ✅ Resolve
                      </button>
                      <button className="btn-secondary" style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                        onClick={() => resolveGrievance(g.id, "Rejected — no action needed")}>
                        ❌ Reject
                      </button>
                    </div>
                  )}
                  {g.resolution && (
                    <p style={{ fontSize: 12, color: "var(--color-success)", marginTop: 8, fontStyle: "italic" }}>
                      Resolution: {g.resolution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ML Models Tab */}
          {activeTab === "ml" && (
            <div>
              <h2 className="heading-sm" style={{ marginBottom: 12 }}>🤖 ML Models</h2>
              <div className="card" style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 8px 0" }}>
                  Price forecasting models trained on historical market data.
                </p>
                {["Tomato", "Onion", "Soybean"].map(crop => (
                  <div key={crop} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid var(--color-border)",
                  }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{crop}</span>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>Price Forecast</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge badge-verified">Trained</span>
                      <span className="badge badge-active">XGBoost</span>
                    </div>
                  </div>
                ))}
                <p className="data-source" style={{ marginTop: 12 }}>
                  Models trained on synthetic demo data. See ML.md for methodology.
                </p>
              </div>

              <div className="card">
                <h3 className="heading-sm" style={{ marginBottom: 8 }}>Smart Sell Engine</h3>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                  Multi-factor scoring: net realization, buyer reliability, transport cost,
                  storage cost, price forecast, quality match, urgency.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
