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
    setLoading(true); setError("");
    try {
      await login(user, "demo123");
      const role = user === "admin" ? "admin"
        : user === "nashik_fpo" ? "fpo"
        : ["abc_foods", "fresh_harvest", "nashik_exports", "metro_fresh", "kolhapur_coop"].includes(user) ? "buyer"
        : "farmer";
      router.push(role === "buyer" ? "/buyer" : role === "admin" ? "/admin" : role === "fpo" ? "/fpo" : "/farmer");
    } catch { setError("Demo login failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-hero">
      {/* Left panel — hero branding (desktop) */}
      <div className="login-left">
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🌾</div>
          <h1 style={{ fontSize: "clamp(36px, 4vw, 48px)", fontWeight: 800, color: "white", lineHeight: 1.1, margin: "0 0 12px" }}>
            शेतभाव
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", margin: "0 0 32px", lineHeight: 1.5 }}>
            बाज़ार जानो। बेहतर चुनो। ज़्यादा कमाओ।
          </p>
          {[
            { icon: "🧠", text: "AI-powered Smart Sell recommendations" },
            { icon: "📊", text: "Real-time mandi prices & forecasts" },
            { icon: "🤝", text: "Direct verified buyer-seller connection" },
            { icon: "📱", text: "Works in Hindi, Marathi & English" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>{f.icon}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-right">
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile logo */}
          <div style={{ textAlign: "center", marginBottom: 24 }} className="hide-desktop">
            <div style={{ fontSize: 48, marginBottom: 4 }}>🌾</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--green-700)", margin: 0 }}>शेतभाव</h1>
            <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "4px 0 0" }}>Know the market. Choose better.</p>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--stone-900)" }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: "var(--stone-400)", margin: "0 0 24px" }}>Sign in to access your dashboard</p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--stone-700)", marginBottom: 6, display: "block" }}>Username</label>
              <input className="input" placeholder="Enter your username" value={username}
                onChange={e => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--stone-700)", marginBottom: 6, display: "block" }}>Password</label>
              <input className="input" type="password" placeholder="Enter your password" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && (
              <div style={{ background: "var(--danger-light)", padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span>
                <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>
              </div>
            )}
            <button className="btn-primary" type="submit" disabled={loading}
              style={{ marginTop: 4, fontSize: 15, fontWeight: 700 }}>
              {loading ? <><span className="spinner" /> Signing in...</> : "Sign In"}
            </button>
          </form>

          {/* Demo divider */}
          <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--stone-200)" }} />
            <span style={{ fontSize: 12, color: "var(--stone-400)", fontWeight: 500 }}>Quick Demo</span>
            <div style={{ flex: 1, height: 1, background: "var(--stone-200)" }} />
          </div>

          {/* Demo accounts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { user: "ramesh", icon: "👨‍🌾", label: "Farmer", sub: "Ramesh Patil", color: "var(--green-600)" },
              { user: "abc_foods", icon: "🏭", label: "Buyer", sub: "ABC Foods", color: "var(--sky-600)" },
              { user: "admin", icon: "⚙️", label: "Admin", sub: "Platform", color: "var(--stone-600)" },
              { user: "nashik_fpo", icon: "🌾", label: "FPO", sub: "Nashik FPO", color: "var(--saffron-600)" },
            ].map((d) => (
              <button key={d.user} onClick={() => demoLogin(d.user)} disabled={loading}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "12px 8px", borderRadius: 12, border: "1.5px solid var(--stone-200)",
                  background: "white", cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.15s", fontFamily: "inherit", minHeight: 72,
                  opacity: loading ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 22 }}>{d.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>{d.label}</span>
                <span style={{ fontSize: 11, color: "var(--stone-400)" }}>{d.sub}</span>
              </button>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--stone-400)" }}>
            {t("no_account")}{" "}
            <a href="/register" style={{ color: "var(--green-600)", fontWeight: 600, textDecoration: "none" }}>
              {t("create_account")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
