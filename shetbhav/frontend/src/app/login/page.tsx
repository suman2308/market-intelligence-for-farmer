"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(username, password);
      router.push("/farmer");
    } catch { setError(t("error_generic")); }
    finally { setLoading(false); }
  };

  const demoLogin = async (user: string) => {
    setLoading(true);
    try {
      await login(user, "demo123");
      const role = user === "admin" ? "admin"
        : user === "nashik_fpo" ? "fpo"
        : ["abc_foods","fresh_harvest","nashik_exports","metro_fresh","kolhapur_coop"].includes(user) ? "buyer"
        : "farmer";
      router.push(role === "buyer" ? "/buyer" : role === "admin" ? "/admin" : role === "fpo" ? "/fpo" : "/farmer");
    } catch { setError("Demo login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-hero">
      {/* Left panel — hero branding (desktop only) */}
      <div className="login-left">
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 64, marginBottom: 16, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}>🌾</div>
          <h1 style={{
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            margin: "0 0 16px 0",
            letterSpacing: "-0.5px",
          }}>
            {t("app_name")}
          </h1>
          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.6,
            margin: "0 0 40px 0",
          }}>
            {t("tagline")}
          </p>

          {/* Feature highlights */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: "🧠", text: "AI-powered Smart Sell recommendations" },
              { icon: "📊", text: "Real-time market prices & forecasts" },
              { icon: "🤝", text: "Direct buyer-seller connection" },
              { icon: "📱", text: "Works in Hindi & Marathi" },
            ].map((f, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "rgba(255,255,255,0.85)",
                fontSize: 15,
              }}>
                <span style={{
                  fontSize: 20,
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="login-right">
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Mobile-only branding */}
          <div style={{ textAlign: "center", marginBottom: 32 }} className="hide-desktop">
            <div style={{ fontSize: 48, marginBottom: 8 }}>🌾</div>
            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#166534",
              margin: 0,
            }}>{t("app_name")}</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>{t("tagline")}</p>
          </div>

          {/* Desktop form title */}
          <div style={{ marginBottom: 28 }} className="hide-mobile">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px 0" }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              Sign in to access your dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>
                Username
              </label>
              <input className="input" placeholder="Enter your username" value={username}
                onChange={e => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" }}>
                Password
              </label>
              <input className="input" type="password" placeholder="Enter your password" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>

            {error && (
              <div style={{
                background: "linear-gradient(135deg, #fef2f2, #fde8e8)",
                padding: "12px 14px",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid rgba(239, 68, 68, 0.15)",
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <p style={{ color: "#dc2626", fontSize: 13, margin: 0, fontWeight: 500 }}>{error}</p>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}
              style={{ marginTop: 4, fontSize: 15, fontWeight: 700, letterSpacing: "0.3px" }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                  Signing in...
                </span>
              ) : t("sign_in")}
            </button>
          </form>

          {/* Divider */}
          <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)" }}></div>
            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, whiteSpace: "nowrap" }}>Quick Demo</span>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)" }}></div>
          </div>

          {/* Demo Accounts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { user: "ramesh", icon: "👨‍🌾", label: "Farmer", sub: "Ramesh Patil", color: "#166534" },
              { user: "abc_foods", icon: "🏭", label: "Buyer", sub: "ABC Foods", color: "#1e40af" },
              { user: "admin", icon: "⚙️", label: "Admin", sub: "Platform", color: "#6b21a8" },
              { user: "nashik_fpo", icon: "🌾", label: "FPO", sub: "Nashik FPO", color: "#92400e" },
            ].map((d) => (
              <button key={d.user} onClick={() => demoLogin(d.user)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "14px 8px",
                  borderRadius: 14,
                  border: "1.5px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minHeight: 80,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = d.color;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${d.color}15`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}>
                <span style={{ fontSize: 24 }}>{d.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.label}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{d.sub}</span>
              </button>
            ))}
          </div>

          {/* Register Link */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <a href="/register" style={{
              color: "#166534",
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 600,
            }}>
              Don&apos;t have an account? <span style={{ textDecoration: "underline" }}>Create Account</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
