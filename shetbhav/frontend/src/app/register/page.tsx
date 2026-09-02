"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    username: "", email: "", password: "", full_name: "", phone: "", role: "farmer"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      router.push(form.role === "buyer" ? "/buyer" : "/farmer");
    } catch {
      setError(t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: "farmer", label: t("i_am_farmer"), icon: "👨‍🌾" },
    { value: "buyer", label: t("i_am_buyer"), icon: "🏭" },
    { value: "fpo", label: t("i_am_fpo"), icon: "🤝" },
  ];

  return (
    <div style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>{t("create_account")}</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Role Selection */}
        <div style={{ display: "flex", gap: 8 }}>
          {roles.map(r => (
            <button key={r.value} type="button"
              className={`toggle-btn ${form.role === r.value ? "selected" : ""}`}
              onClick={() => setForm({ ...form, role: r.value })}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px" }}>
              <span style={{ fontSize: 24 }}>{r.icon}</span>
              <span style={{ fontSize: 12, marginTop: 4 }}>{r.label}</span>
            </button>
          ))}
        </div>

        <input className="input" placeholder={t("full_name")} value={form.full_name}
          onChange={e => setForm({ ...form, full_name: e.target.value })} required />
        <input className="input" placeholder={t("username")} value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })} required />
        <input className="input" type="email" placeholder={t("email")} value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="tel" placeholder={t("phone")} value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className="input" type="password" placeholder={t("password")} value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />

        {error && <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? t("loading") : t("create_account")}
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <a href="/login" style={{ color: "#16a34a", fontSize: 14 }}>{t("has_account")} {t("sign_in")}</a>
      </div>
    </div>
  );
}
