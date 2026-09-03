"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "mr", label: "मरा" },
];

export default function FarmerHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <div className="farmer-header">
        <div className="farmer-header-left" onClick={() => router.push("/farmer")} style={{ cursor: "pointer" }}>
          <span className="farmer-header-logo">🌾</span>
          <div>
            <div className="farmer-header-title">{t("app_name")}</div>
          </div>
        </div>
        <div className="farmer-header-right">
          <div className="farmer-lang-toggle">
            {LANGS.map(l => (
              <button key={l.code}
                onClick={() => setLang(l.code)}
                className={`farmer-lang-btn ${lang === l.code ? "active" : ""}`}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="farmer-profile-btn" ref={menuRef} onClick={() => setMenuOpen(!menuOpen)}>
            <div className="farmer-avatar">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            {menuOpen && (
              <div className="farmer-profile-menu">
                <div className="farmer-profile-info">
                  <div className="farmer-profile-name">{user?.full_name}</div>
                  <div className="farmer-profile-role">{user?.role}</div>
                  {user?.email && <div className="farmer-profile-email">{user.email}</div>}
                </div>
                <div className="farmer-profile-divider" />
                <button onClick={() => { router.push("/farmer/profile"); setMenuOpen(false); }}>
                  {t("profile")}
                </button>
                <button onClick={() => { logout(); router.push("/login"); setMenuOpen(false); }} className="farmer-profile-logout">
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Spacer to account for fixed header */}
      <div style={{ height: 56 }} />
    </>
  );
}
