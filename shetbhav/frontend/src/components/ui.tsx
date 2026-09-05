"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import api from "@/lib/api";

/* ══════════════════════════════════════════════════════════════════════
   SHETBHAV UI COMPONENT LIBRARY
   Reusable components for the agricultural market intelligence platform.
   ══════════════════════════════════════════════════════════════════════ */

// ── Page Layout ──────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      {back && (
        <button
          onClick={back}
          aria-label="Go back"
          style={{
            background: "none",
            border: "none",
            fontSize: 22,
            cursor: "pointer",
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ←
        </button>
      )}
      <div style={{ flex: 1 }}>
        <h1 className="heading-md" style={{ margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-xs"
            style={{ color: "var(--text-secondary)", margin: "2px 0 0 0" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────

export function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="progress-bar">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`progress-dot ${
            i < current - 1 ? "completed" : i === current - 1 ? "active" : ""
          }`}
        />
      ))}
    </div>
  );
}

// ── Bottom Navigation ────────────────────────────────────────────────

export function BottomNav({
  items,
  active,
}: {
  items: { href: string; icon: string; label: string }[];
  active: string;
}) {
  return (
    <nav className="bottom-nav hide-desktop" role="navigation">
      {items.map((item, idx) => (
        <a
          key={`${item.href}-${idx}`}
          href={item.href}
          className={`nav-item ${active === item.href ? "active" : ""}`}
          aria-current={active === item.href ? "page" : undefined}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

// ── Sidebar (Desktop) ────────────────────────────────────────────────

export function Sidebar({
  items,
  active,
  brand,
  title,
  subtitle,
}: {
  items: { href: string; icon: string; label: string }[];
  active: string;
  brand?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <nav className="sidebar hide-mobile" aria-label="Main navigation">
      <div style={{ marginBottom: 24, paddingLeft: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "white" }}>
          🌾 {title || brand || "ShetBhav"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            marginTop: 4,
          }}
        >
          {subtitle || "Market Intelligence"}
        </div>
      </div>
      {items.map((item, idx) => (
        <a
          key={`${item.href}-${idx}`}
          href={item.href}
          className={`sidebar-item ${active === item.href ? "active" : ""}`}
          aria-current={active === item.href ? "page" : undefined}
        >
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

// ── Source Badge ─────────────────────────────────────────────────────

export function DataSourceBadge({
  source,
  date,
}: {
  source: string;
  date?: string;
}) {
  const s = source.toLowerCase();
  let cls = "source-synthetic";
  let label = "Demo data";
  let icon = "🧪";

  if (s.includes("live") || s.includes("official")) {
    cls = "source-live";
    label = "Official daily data";
    icon = "✓";
  } else if (s.includes("cached")) {
    cls = "source-cached";
    label = "Cached data";
    icon = "📦";
  } else if (s.includes("model") || s.includes("forecast")) {
    cls = "source-model";
    label = "Model estimate";
    icon = "🤖";
  } else if (s.includes("synthetic") || s.includes("demo")) {
    cls = "source-synthetic";
    label = "Demo data";
    icon = "🧪";
  } else if (s.includes("historical")) {
    cls = "source-cached";
    label = "Imported data";
    icon = "📊";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span className={`source-badge ${cls}`}>
        {icon} {label}
      </span>
      {date && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {date}
        </span>
      )}
    </div>
  );
}

// ── Confidence Badge ─────────────────────────────────────────────────

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  let cls = "confidence-low";
  let label = "Low";
  if (confidence >= 75) {
    cls = "confidence-high";
    label = "High";
  } else if (confidence >= 50) {
    cls = "confidence-medium";
    label = "Medium";
  }
  return (
    <span className={`confidence-badge ${cls}`}>
      {label} ({confidence.toFixed(0)}%)
    </span>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────

export function ScoreBadge({ score }: { score: number }) {
  let cls = "score-low";
  if (score >= 80) cls = "score-high";
  else if (score >= 60) cls = "score-medium";
  return <span className={`score-badge ${cls}`}>{score}/100</span>;
}

// ── Verification Badge ───────────────────────────────────────────────

export function VerificationBadge({
  status,
}: {
  status: string;
}) {
  const s = status.toLowerCase();
  if (s === "verified") return <span className="badge badge-green">✓ Verified</span>;
  if (s === "pending") return <span className="badge badge-amber">⏳ Pending</span>;
  if (s === "rejected") return <span className="badge badge-red">✗ Rejected</span>;
  return <span className="badge badge-gray">{status}</span>;
}

// ── Stat Card ────────────────────────────────────────────────────────

export function StatCard({
  icon,
  value,
  label,
  color,
  onClick,
}: {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div
        className="stat-value"
        style={{
          color: color || "var(--navy)",
          fontSize: "clamp(20px, 5vw, 26px)",
        }}
      >
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ── Crop Card ────────────────────────────────────────────────────────

export function CropCard({
  name,
  nameHi,
  emoji,
  selected,
  onClick,
}: {
  name: string;
  nameHi?: string;
  emoji: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`toggle-btn ${selected ? "selected" : ""}`}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 18px",
        textAlign: "left",
        borderRadius: 14,
        fontSize: 16,
        minHeight: 60,
        width: "100%",
        border: selected
          ? "2px solid var(--green-600)"
          : "2px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 32 }}>{emoji}</span>
      <div>
        <div style={{ fontWeight: 600 }}>{name}</div>
        {nameHi && (
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {nameHi}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Recommendation Card ──────────────────────────────────────────────

export function RecommendationCard({
  title,
  price,
  unit,
  score,
  reasons,
  risks,
  confidence,
  onAction,
  actionLabel,
  dataLabel,
}: {
  title: string;
  price: number;
  unit?: string;
  score: number;
  reasons: string[];
  risks?: string[];
  confidence: number;
  onAction?: () => void;
  actionLabel?: string;
  dataLabel?: string;
}) {
  return (
    <div className="card-green" style={{ padding: 20, borderRadius: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" as const }}>
            {title}
          </p>
          <div className="price-hero" style={{ color: "white", marginTop: 8 }}>
            ₹{price.toLocaleString("en-IN")}
            <span className="price-unit" style={{ color: "rgba(255,255,255,0.7)" }}>{unit || "/q"}</span>
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>

      <div style={{ marginTop: 12 }}>
        {reasons.slice(0, 3).map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>✓</span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{r}</span>
          </div>
        ))}
      </div>

      {risks && risks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {risks.slice(0, 2).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "var(--saffron-300)", fontSize: 14 }}>⚠</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ConfidenceBadge confidence={confidence} />
        {dataLabel && (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{dataLabel}</span>
        )}
      </div>

      {onAction && (
        <button
          className="btn-secondary"
          onClick={onAction}
          style={{ marginTop: 12, background: "white", borderColor: "white", color: "var(--green-700)" }}
        >
          {actionLabel || "View Details →"}
        </button>
      )}
    </div>
  );
}

// ── Lot Card ─────────────────────────────────────────────────────────

export function LotCard({
  cropName,
  emoji,
  quantityKg,
  grade,
  status,
  address,
  onClick,
}: {
  cropName: string;
  emoji: string;
  quantityKg: number;
  grade: string;
  status: string;
  address?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div>
          <p className="text-md" style={{ fontWeight: 600, margin: 0 }}>
            {cropName} · {quantityKg.toLocaleString("en-IN")} kg
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
            Grade {grade} · {address || "Maharashtra"}
          </p>
        </div>
      </div>
      <span className={`badge ${status === "active" ? "badge-green" : "badge-gray"}`}>
        {status}
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: string | { label: string; onClick: () => void };
  onAction?: () => void;
}) {
  const actionLabel = typeof action === "object" ? action?.label : action;
  const actionClick = typeof action === "object" ? action?.onClick : onAction;
  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p className="heading-sm" style={{ margin: "0 0 8px 0" }}>{title}</p>
      {description && (
        <p className="text-sm" style={{ color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          {description}
        </p>
      )}
      {actionLabel && actionClick && (
        <button className="btn-primary" onClick={actionClick} style={{ maxWidth: 240, margin: "0 auto" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Voice Button ─────────────────────────────────────────────────────

const VOICE_LANGS: { code: Lang; bcp47: string; label: string }[] = [
  { code: "en", bcp47: "en-IN", label: "English" },
  { code: "hi", bcp47: "hi-IN", label: "हिंदी" },
  { code: "mr", bcp47: "mr-IN", label: "मराठी" },
];

function SpeakerIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <line x1="23" y1="9" x2="17" y2="15" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      )}
      {!muted && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
      {muted && <line x1="17" y1="9" x2="23" y2="15" />}
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

/** Text-to-speech button with play/pause and a language picker.
 * Defaults the reading language to the app's current UI language, but the
 * listener can switch it independently (e.g. read an English page aloud in
 * Marathi) since speechSynthesis voice availability varies by device. */
export function VoiceButton({ text, label }: { text: string; label?: string }) {
  const { lang: uiLang } = useI18n();
  const [voiceLang, setVoiceLang] = React.useState<Lang>(uiLang);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  React.useEffect(() => {
    // Stop speaking if the component unmounts mid-utterance.
    return () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); };
  }, []);

  const reset = () => { setIsSpeaking(false); setIsPaused(false); };

  const speak = (lang: Lang) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel(); // stop any other utterance already playing
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = VOICE_LANGS.find(l => l.code === lang)?.bcp47 || "en-IN";
    utterance.rate = 0.9;
    utterance.onend = reset;
    utterance.onerror = reset;
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  };

  const togglePlayPause = () => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking) {
      speechSynthesis.pause();
      setIsSpeaking(false);
      setIsPaused(true);
    } else if (isPaused) {
      speechSynthesis.resume();
      setIsSpeaking(true);
      setIsPaused(false);
    } else {
      speak(voiceLang);
    }
  };

  const chooseLang = (lang: Lang) => {
    setVoiceLang(lang);
    setMenuOpen(false);
    if (isSpeaking || isPaused) speak(lang);
  };

  return (
    <div className="voice-btn-group" ref={wrapRef}>
      <button type="button" className="voice-btn" onClick={togglePlayPause}
        aria-label={isSpeaking ? "Pause reading" : "Read aloud"}>
        {isSpeaking ? <PauseIcon /> : <SpeakerIcon />}
        {label || "Listen"}
      </button>
      <button type="button" className="voice-lang-btn" onClick={() => setMenuOpen(o => !o)}
        aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Choose reading language">
        {voiceLang.toUpperCase()}
      </button>
      {menuOpen && (
        <div className="voice-lang-menu" role="menu">
          {VOICE_LANGS.map(l => (
            <button key={l.code} type="button" role="menuitemradio" aria-checked={voiceLang === l.code}
              className={`voice-lang-option ${voiceLang === l.code ? "active" : ""}`}
              onClick={() => chooseLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// VoicePlayButton alias
export function VoicePlayButton({ text, label }: { text: string; label?: string }) {
  return <VoiceButton text={text} label={label} />;
}

// ── Password Input ───────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a17.9 17.9 0 0 1-3.15 4.19M6.5 6.5C3.9 8.13 2 11 2 12s4 8 11 8a9.3 9.3 0 0 0 4.16-.94M9.5 9.5a3 3 0 0 0 4.24 4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Password input with a show/hide toggle (defaults masked). Accepts any
 * standard <input> prop — swap in wherever a plain password input is used. */
export function PasswordInput({
  className, ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="password-input-wrap">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className || ""} password-input`.trim()}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

// ── Notification Bell ────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  link?: string | null;
  counterparty_user_id?: number | null;
  created_at: string;
};

/** Bell + unread-count dropdown, backed by GET /notifications and
 * POST /notifications/{id}/read. Drop into any dashboard header. */
export function NotificationBell() {
  const router = useRouter();
  const [notifs, setNotifs] = React.useState<NotificationItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(() => {
    api.get<NotificationItem[]>("/notifications").then(r => setNotifs(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Poll for new notifications so the badge/list update live without a
  // manual page refresh.
  React.useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) load(); // refresh on open so it's never stale
  };

  const markRead = (n: NotificationItem) => {
    if (!n.is_read) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  const handleSelect = (n: NotificationItem) => {
    markRead(n);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleViewProfile = (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(n);
    setOpen(false);
    if (n.counterparty_user_id) router.push(`/profile/${n.counterparty_user_id}`);
  };

  const handleDelete = (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifs(prev => prev.filter(x => x.id !== n.id));
    api.delete(`/notifications/${n.id}`).catch(() => {});
  };

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button type="button" className="notif-bell-btn" onClick={handleOpen}
        aria-label="Notifications" aria-haspopup="menu" aria-expanded={open}>
        <BellIcon />
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-bell-menu" role="menu">
          <div className="notif-bell-header">Notifications</div>
          {notifs.length === 0 ? (
            <div className="notif-bell-empty">No notifications yet</div>
          ) : (
            notifs.slice(0, 10).map(n => (
              <div key={n.id} role="menuitem"
                className={`notif-bell-item ${n.is_read ? "" : "unread"}`}
                onClick={() => handleSelect(n)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="notif-bell-item-title">{n.title}</span>
                    <span className="notif-bell-item-msg">{n.message}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {n.counterparty_user_id && (
                      <button type="button" className="notif-bell-profile-btn"
                        onClick={(e) => handleViewProfile(n, e)} aria-label="View counterparty profile">
                        👤
                      </button>
                    )}
                    <button type="button" className="notif-bell-profile-btn"
                      onClick={(e) => handleDelete(n, e)} aria-label="Delete notification">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Full inline notification list (not a dropdown) — for embedding in a
 * Profile page's own "Notifications" section, alongside the header bell. */
export function NotificationsPanel() {
  const router = useRouter();
  const [notifs, setNotifs] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    api.get<NotificationItem[]>("/notifications")
      .then(r => setNotifs(r.data))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Poll so this list updates live without a manual page refresh.
  React.useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = (n: NotificationItem) => {
    if (!n.is_read) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  const handleClick = (n: NotificationItem) => {
    markRead(n);
    if (n.link) router.push(n.link);
  };

  const handleViewProfile = (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(n);
    if (n.counterparty_user_id) router.push(`/profile/${n.counterparty_user_id}`);
  };

  const handleDelete = (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifs(prev => prev.filter(x => x.id !== n.id));
    api.delete(`/notifications/${n.id}`).catch(() => {});
  };

  if (loading) return <Skeleton height={56} count={2} />;
  if (notifs.length === 0) {
    return <p className="text-sm" style={{ color: "var(--text-muted)", margin: 0 }}>No notifications yet</p>;
  }

  return (
    <div className="flex-col gap-2">
      {notifs.map(n => (
        <div key={n.id} onClick={() => handleClick(n)}
          className={`notif-panel-item ${n.is_read ? "" : "unread"}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, width: "100%" }}>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="notif-panel-item-title">{n.title}</span>
              <span className="notif-panel-item-msg">{n.message}</span>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {n.counterparty_user_id && (
                <button type="button" className="notif-bell-profile-btn"
                  onClick={(e) => handleViewProfile(n, e)} aria-label="View counterparty profile">
                  👤
                </button>
              )}
              <button type="button" className="notif-bell-profile-btn"
                onClick={(e) => handleDelete(n, e)} aria-label="Delete notification">
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────

export function Skeleton({ height = 60, count = 1 }: { height?: number; count?: number }) {
  return (
    <div className="flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 12 }} />
      ))}
    </div>
  );
}

// ── Trust Score ─────────────────────────────────────────────────────

export function TrustScore({ score }: { score: number }) {
  let color = "var(--danger)";
  let label = "Low";
  if (score >= 85) { color = "var(--success)"; label = "High"; }
  else if (score >= 70) { color = "var(--warning)"; label = "Medium"; }
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{score}</div>
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label} trust</div>
    </div>
  );
}

// ── Why Explainer ────────────────────────────────────────────────────

export function WhyExplainer({
  reasons,
  risks,
  assumptions,
}: {
  reasons: string[];
  risks?: string[];
  assumptions?: string[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="card" style={{ padding: 14 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--green-600)",
        }}
      >
        <span>💡 Why is this recommended?</span>
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "0.2s" }}>▼</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "var(--success)", marginTop: 2 }}>✓</span>
              <span className="text-sm">{r}</span>
            </div>
          ))}
          {risks && risks.length > 0 && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--warning-bg)", borderRadius: 8 }}>
              <p className="text-xs" style={{ fontWeight: 600, color: "var(--warning)", margin: "0 0 4px 0" }}>Risks</p>
              {risks.map((r, i) => (
                <p key={i} className="text-xs" style={{ margin: "2px 0", color: "var(--text-secondary)" }}>⚠ {r}</p>
              ))}
            </div>
          )}
          {assumptions && assumptions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p className="text-xs" style={{ fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 4px 0" }}>Assumptions</p>
              {assumptions.map((a, i) => (
                <p key={i} className="text-xs" style={{ margin: "2px 0", color: "var(--text-muted)" }}>• {a}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mobile Sticky Action ─────────────────────────────────────────────

export function MobileStickyAction({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="hide-desktop"
      style={{
        position: "fixed",
        bottom: 64,
        left: 0,
        right: 0,
        padding: "12px var(--page-padding)",
        background: "linear-gradient(transparent, var(--bg-cream) 20%)",
        zIndex: 90,
      }}
    >
      {children}
    </div>
  );
}
