"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { NotificationBell } from "@/components/ui";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "mr", label: "मरा" },
];

/**
 * Farmer app bar — brand on the left, language toggle on the right.
 * Profile lives in the bottom navigation (footer), so no avatar here.
 */
export default function FarmerHeader() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();

  return (
    <div className="farmer-header">
      <div className="farmer-header-left" onClick={() => router.push("/farmer")} style={{ cursor: "pointer" }}>
        <span className="farmer-header-logo">🌾</span>
        <span className="farmer-header-title">{t("app_name")}</span>
      </div>
      <div className="farmer-header-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="lang-toggle" role="group" aria-label="Language">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={`lang-btn ${lang === l.code ? "active" : ""}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <NotificationBell />
      </div>
    </div>
  );
}
