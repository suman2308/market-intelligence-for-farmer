"use client";

import React from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

/* ══════════════════════════════════════════════════════════════════════
   SHETBHAV UI COMPONENT LIBRARY
   Reusable components for the agricultural market intelligence platform.
   ══════════════════════════════════════════════════════════════════════ */

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

