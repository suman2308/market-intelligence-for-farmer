"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, roleHomePath } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import type { Lang } from "@/lib/i18n";
import { PasswordInput } from "@/components/ui";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type DetailField = "full_name" | "username" | "email" | "phone" | "password";

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DetailField, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<DetailField, boolean>>>({});
  const [toast, setToast] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const validateField = useCallback((field: DetailField, value: string): string => {
    switch (field) {
      case "full_name":
        return value.trim() ? "" : t("full_name_required");
      case "username":
        if (!value) return t("username_required");
        if (value.length < 3) return t("username_min_length");
        return "";
      case "email":
        if (!value) return t("email_required");
        if (!EMAIL_RE.test(value)) return t("email_invalid");
        return "";
      case "phone":
        if (!value) return "";
        return /^\d{10}$/.test(value) ? "" : t("phone_invalid");
      case "password":
        if (!value) return t("password_required");
        if (value.length < 6) return t("password_min_length");
        return "";
      default:
        return "";
    }
  }, [t]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => { return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current as ReturnType<typeof setTimeout>); }; }, []);

  const handleFieldChange = (field: DetailField, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleFieldBlur = (field: DetailField) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, form[field]) }));
  };

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
    const fields: DetailField[] = ["full_name", "username", "email", "phone", "password"];
    const errors: Partial<Record<DetailField, string>> = {};
    fields.forEach(f => {
      const msg = validateField(f, form[f]);
      if (msg) errors[f] = msg;
    });
    if (!errors.username && availability.username === false) errors.username = t("username_taken");
    if (!errors.email && availability.email === false) errors.email = t("email_taken");

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ full_name: true, username: true, email: true, phone: true, password: true });
      showToast(t("fix_highlighted_fields"));
      return;
    }
    setFieldErrors({});
    setStep("role");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      router.push(roleHomePath(form.role));
    } catch {
      setError(t("registration_failed"));
      showToast(t("registration_failed"));
      setStep("details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" key={lang}>
      {toast && (
        <div className="toast-popup" role="alert">
          <span className="toast-popup-icon">⚠️</span>
          <span>{toast}</span>
        </div>
      )}
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

              <form onSubmit={handleDetails} className="auth-form" noValidate>
                <div className="auth-field">
                  <label className="auth-label">{t("full_name")}</label>
                  <input className={`input ${touched.full_name && fieldErrors.full_name ? "input-error" : ""}`}
                    placeholder={t("full_name")} value={form.full_name}
                    onChange={e => handleFieldChange("full_name", e.target.value)}
                    onBlur={() => handleFieldBlur("full_name")}
                    maxLength={200} />
                  {touched.full_name && fieldErrors.full_name && (
                    <div className="field-popup">{fieldErrors.full_name}</div>
                  )}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("username")}</label>
                  <input className={`input ${touched.username && (fieldErrors.username || availability.username === false) ? "input-error" : availability.username === true ? "input-success" : ""}`}
                    placeholder={t("username")} value={form.username}
                    onChange={e => { handleFieldChange("username", e.target.value); debouncedCheck("username", e.target.value); }}
                    onBlur={() => handleFieldBlur("username")}
                    maxLength={100} />
                  {touched.username && (fieldErrors.username || availability.username === false) && (
                    <div className="field-popup">{fieldErrors.username || t("username_taken")}</div>
                  )}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("email")}</label>
                  <input className={`input ${touched.email && (fieldErrors.email || availability.email === false) ? "input-error" : availability.email === true ? "input-success" : ""}`}
                    type="email" placeholder={t("email")} value={form.email}
                    onChange={e => { handleFieldChange("email", e.target.value); debouncedCheck("email", e.target.value); }}
                    onBlur={() => handleFieldBlur("email")} />
                  {touched.email && (fieldErrors.email || availability.email === false) && (
                    <div className="field-popup">{fieldErrors.email || t("email_taken")}</div>
                  )}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("phone")}</label>
                  <input className={`input ${touched.phone && fieldErrors.phone ? "input-error" : ""}`}
                    type="tel" placeholder="9876543210" value={form.phone}
                    onChange={e => handleFieldChange("phone", e.target.value)}
                    onBlur={() => handleFieldBlur("phone")} />
                  {touched.phone && fieldErrors.phone && (
                    <div className="field-popup">{fieldErrors.phone}</div>
                  )}
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t("password")}</label>
                  <PasswordInput className={`input ${touched.password && fieldErrors.password ? "input-error" : ""}`}
                    placeholder={t("password")} value={form.password}
                    onChange={e => handleFieldChange("password", e.target.value)}
                    onBlur={() => handleFieldBlur("password")} />
                  {touched.password && fieldErrors.password && (
                    <div className="field-popup">{fieldErrors.password}</div>
                  )}
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
