"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import type { Lang } from "@/lib/i18n";

const ROLES = [
  { value: "farmer", icon: "👨‍🌾", labelKey: "i_am_farmer", descKey: "role_farmer_desc" },
  { value: "buyer", icon: "🏭", labelKey: "i_am_buyer", descKey: "role_buyer_desc" },
  { value: "fpo", icon: "🤝", labelKey: "i_am_fpo", descKey: "role_fpo_desc" },
];

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "mr", label: "मरा" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [step, setStep] = useState<"details" | "role">("details");
  const [form, setForm] = useState({
    username: "", email: "", password: "", full_name: "", phone: "", role: "farmer"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<{ username?: boolean; email?: boolean }>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const checkAvailability = useCallback(async (field: "username" | "email", value: string) => {
    if (!value || value.length < 3) { setAvailability(prev => ({ ...prev, [field]: undefined })); return; }
    try {
      const { data } = await api.get(`/auth/check?${field}=${encodeURIComponent(value)}`);
      setAvailability(prev => ({ ...prev, [field]: field === "username" ? data.username_available : data.email_available }));
    } catch { setAvailability(prev => ({ ...prev, [field]: undefined })); }
  }, []);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current as ReturnType<typeof setTimeout>); }; }, []);

  const debouncedCheck = (field: "username" | "email", value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current as ReturnType<typeof setTimeout>);
    setAvailability(prev => ({ ...prev, [field]: undefined }));
    timerRef.current = setTimeout(() => checkAvailability(field, value), 500);
  };

  const handleDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password || !form.full_name) return;
    setStep("role");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      router.push(form.role === "buyer" ? "/buyer" : form.role === "fpo" ? "/fpo" : "/farmer");
    } catch {
      setError(t("registration_failed"));
      setStep("details");
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

      {/* Left panel */}
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
            { icon: "📊", key: "todays_prices" },
            { icon: "🧠", key: "smart_sell" },
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

      {/* Right panel */}
      <main className="auth-right">
        <div className="auth-form-wrap">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <div style={{ fontSize: 52, marginBottom: 4 }}>🌾</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--green-700)", margin: 0, letterSpacing: '-0.01em' }}>{t("app_name")}</h1>
            <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "4px 0 0" }}>{t("tagline")}</p>
          </div>

          {step === "details" ? (
            <>
              <h2 className="auth-title">{t("create_account_title")}</h2>
              <p className="auth-subtitle">{t("create_account_subtitle")}</p>

              <form onSubmit={handleDetails} className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">{t("full_name")}</label>
                  <input className="input" placeholder={t("full_name")} value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("username")}</label>
                  <input className="input" style={availability.username === false ? { borderColor: '#dc2626' } : availability.username === true ? { borderColor: '#16a34a' } : {}}
                    placeholder={t("username")} value={form.username}
                    onChange={e => { setForm({ ...form, username: e.target.value }); debouncedCheck("username", e.target.value); }} required />
                  {availability.username === false && <span style={{ fontSize: 12, color: '#dc2626' }}>{t("username_taken")}</span>}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("email")}</label>
                  <input className="input" type="email" style={availability.email === false ? { borderColor: '#dc2626' } : availability.email === true ? { borderColor: '#16a34a' } : {}}
                    placeholder={t("email")} value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); debouncedCheck("email", e.target.value); }} required />
                  {availability.email === false && <span style={{ fontSize: 12, color: '#dc2626' }}>{t("email_taken")}</span>}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("phone")}</label>
                  <input className="input" type="tel" placeholder="9876543210" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("password")}</label>
                  <input className="input" type="password" placeholder={t("password")} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <button className="btn-primary auth-submit" type="submit" disabled={availability.username === false || availability.email === false}>
                  {t("continue")}
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => setStep("details")} className="auth-back">
                {t("back_to_login")}
              </button>
              <h2 className="auth-title">{t("select_role")}</h2>
              <p className="auth-subtitle">{t("select_role_subtitle")}</p>

              <form onSubmit={handleRegister} className="auth-form">
                {ROLES.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`auth-role-btn ${form.role === r.value ? "selected" : ""}`}>
                    <span className="auth-role-icon">{r.icon}</span>
                    <div className="auth-role-text">
                      <div className="auth-role-label">{t(r.labelKey)}</div>
                      <div className="auth-role-desc">{t(r.descKey)}</div>
                    </div>
                    {form.role === r.value && <span className="auth-role-check">✓</span>}
                  </button>
                ))}

                {error && (
                  <div className="auth-error">
                    <p>{error}</p>
                  </div>
                )}

                <button className="btn-primary auth-submit" type="submit" disabled={loading}>
                  {loading ? <><span className="spinner" /> {t("creating_account")}</> : t("create_account")}
                </button>
              </form>
            </>
          )}

          <p className="auth-footer-link">
            {t("already_have_account")}{" "}
            <a href="/login">{t("sign_in")}</a>
          </p>
        </div>
      </main>
    </div>
  );
}
