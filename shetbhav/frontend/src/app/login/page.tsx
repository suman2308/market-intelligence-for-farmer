"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const ROLES = [
  { value: "farmer", icon: "👨‍🌾", labelKey: "i_am_farmer", descKey: "role_farmer_desc" },
  { value: "buyer", icon: "🏭", labelKey: "i_am_buyer", descKey: "role_buyer_desc" },
  { value: "fpo", icon: "🤝", labelKey: "i_am_fpo", descKey: "role_fpo_desc" },
  { value: "admin", icon: "⚙️", labelKey: "role_admin_desc", descKey: "role_admin_desc" },
];

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "hi", label: "हिं", flag: "🇮🇳" },
  { code: "mr", label: "मरा", flag: "🇮🇳" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("farmer");
  const [step, setStep] = useState<"credentials" | "role">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "credentials") {
      if (!username || !password) return;
      setStep("role");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      router.push(
        selectedRole === "buyer" ? "/buyer" :
        selectedRole === "admin" ? "/admin" :
        selectedRole === "fpo" ? "/fpo" : "/farmer"
      );
    } catch {
      setError(t("invalid_credentials"));
      setStep("credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" key={lang}>
      {/* Mobile green header */}
      <header className="auth-mobile-header">
        <div className="auth-mobile-header-left">
          <span className="auth-mobile-header-logo">🌾</span>
          <div>
            <div className="auth-mobile-header-title">{t("app_name")}</div>
            <div className="auth-mobile-header-tagline">{t("tagline")}</div>
          </div>
        </div>
        <div className="lang-toggle">
          {LANGS.map(l => (
            <button key={l.code}
              onClick={() => setLang(l.code)}
              className={`lang-btn ${lang === l.code ? "active" : ""}`}>
              {l.label}
            </button>
          ))}
        </div>
      </header>
      {/* Desktop language toggle */}
      <div className="lang-toggle lang-toggle--fixed hide-mobile">
        {LANGS.map(l => (
          <button key={l.code}
            onClick={() => setLang(l.code)}
            className={`lang-btn ${lang === l.code ? "active" : ""}`}>
            {l.label}
          </button>
        ))}
      </div>

      {/* Left panel — hero (desktop only) */}
      <div className="auth-left">
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🌾</div>
          <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, color: "white", lineHeight: 1.1, margin: "0 0 12px" }}>
            {t("app_name")}
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", margin: "0 0 32px", lineHeight: 1.5 }}>
            {t("tagline")}
          </p>
          {[
            { icon: "🧠", key: "smart_sell" },
            { icon: "📊", key: "todays_prices" },
            { icon: "🤝", key: "find_buyers" },
            { icon: "📱", key: "language" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>{f.icon}</span>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{t(f.key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <main className="auth-right">
        <div className="auth-form-wrap">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <div style={{ fontSize: 52, marginBottom: 4 }}>🌾</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--green-700)", margin: 0, letterSpacing: '-0.01em' }}>{t("app_name")}</h1>
            <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "4px 0 0" }}>{t("tagline")}</p>
          </div>

          {step === "credentials" ? (
            <>
              <h2 className="auth-title">{t("welcome_back")}</h2>
              <p className="auth-subtitle">{t("sign_in_subtitle")}</p>

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">{t("username")}</label>
                  <input className="input" placeholder={t("username")} value={username}
                    onChange={e => setUsername(e.target.value)} required autoComplete="username" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("password")}</label>
                  <input className="input" type="password" placeholder={t("password")} value={password}
                    onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                {error && (
                  <div className="auth-error">
                    <span>⚠️</span>
                    <p>{error}</p>
                  </div>
                )}
                <button className="btn-primary auth-submit" type="submit" disabled={loading}>
                  {loading ? <><span className="spinner" /> {t("signing_in")}</> : t("continue")}
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => { setStep("credentials"); setError(""); }} className="auth-back">
                {t("back_to_login")}
              </button>
              <h2 className="auth-title">{t("select_role")}</h2>
              <p className="auth-subtitle">{t("select_role_subtitle")}</p>

              <form onSubmit={handleSubmit} className="auth-form">
                {ROLES.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`auth-role-btn ${selectedRole === r.value ? "selected" : ""}`}>
                    <span className="auth-role-icon">{r.icon}</span>
                    <div className="auth-role-text">
                      <div className="auth-role-label">{t(r.labelKey)}</div>
                      <div className="auth-role-desc">{t(r.descKey)}</div>
                    </div>
                    {selectedRole === r.value && <span className="auth-role-check">✓</span>}
                  </button>
                ))}

                {error && (
                  <div className="auth-error">
                    <p>{error}</p>
                  </div>
                )}

                <button className="btn-primary auth-submit" type="submit" disabled={loading}>
                  {loading ? <><span className="spinner" /> {t("signing_in")}</> : t("sign_in")}
                </button>
              </form>
            </>
          )}

          <p className="auth-footer-link">
            {t("dont_have_account")}{" "}
            <a href="/register">{t("create_account")}</a>
          </p>
        </div>
      </main>
    </div>
  );
}
