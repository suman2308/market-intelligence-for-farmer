"use client";

/**
 * ShetBhav Design System — Shared Components
 * Centralized, consistent UI elements for all pages.
 */

import React from "react";

// ── Page Layout ──────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, onBack, actions }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      {onBack && (
        <button onClick={onBack} aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 8, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="heading-md" style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────
export function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }} role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < current ? "var(--color-primary)" : "var(--color-border)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────
export function StatCard({ value, label, color, icon }: {
  value: string | number;
  label: string;
  color?: string;
  icon?: string;
}) {
  return (
    <div className="card stat-card">
      {icon && <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>}
      <div className="stat-value" style={{ color: color || "var(--color-text)", fontSize: "clamp(20px, 5vw, 28px)" }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ── Price Display ────────────────────────────────────────────────────
export function PriceDisplay({ price, unit, label, trend, trendPct }: {
  price: number | string;
  unit?: string;
  label?: string;
  trend?: "up" | "down" | "stable";
  trendPct?: number;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      {label && <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>{label}</p>}
      <div className="price-big" style={{ margin: "4px 0" }}>
        ₹{typeof price === "number" ? price.toLocaleString("en-IN") : price}
        {unit && <span className="price-unit"> {unit}</span>}
      </div>
      {trend && trendPct !== undefined && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
          <span style={{ color: trend === "up" ? "var(--color-success)" : trend === "down" ? "var(--color-danger)" : "var(--color-text-secondary)", fontSize: 14, fontWeight: 600 }}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {Math.abs(trendPct)}%
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {trend === "up" ? "rising" : trend === "down" ? "falling" : "stable"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Source Label ──────────────────────────────────────────────────────
export function SourceLabel({ source, updated }: { source: string; updated?: string }) {
  const isSynthetic = source.includes("synthetic") || source.includes("demo") || source.includes("Demo");
  return (
    <div className="data-source" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {isSynthetic ? "🧪" : "🏛️"} {source}
      </span>
      {updated && <span>· {updated}</span>}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
      <h3 className="heading-sm" style={{ margin: 0 }}>{title}</h3>
      {description && <p className="text-sm" style={{ color: "var(--color-text-secondary)", margin: "8px 0 0 0" }}>{description}</p>}
      {action && (
        <button className="btn-primary" style={{ marginTop: 16, maxWidth: 280, margin: "16px auto 0" }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Status Timeline ──────────────────────────────────────────────────
export function StatusTimeline({ steps }: { steps: { label: string; status: "done" | "current" | "pending" }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "8px 0" }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              background: step.status === "done" ? "var(--color-success)" : step.status === "current" ? "var(--color-primary)" : "var(--color-border)",
              color: step.status === "pending" ? "var(--color-text-secondary)" : "white",
              border: step.status === "current" ? "3px solid var(--color-primary-light)" : "none",
            }}>
              {step.status === "done" ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 2, height: 28, background: step.status === "done" ? "var(--color-success)" : "var(--color-border)" }} />
            )}
          </div>
          <div style={{ paddingBottom: 12, flex: 1 }}>
            <p style={{
              fontSize: 14, fontWeight: step.status === "current" ? 600 : 400, margin: 0,
              color: step.status === "pending" ? "var(--color-text-secondary)" : "var(--color-text)",
            }}>
              {step.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Toast Notification ───────────────────────────────────────────────
let toastTimeout: NodeJS.Timeout;
export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  const existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const colors: Record<string, string> = {
    success: "var(--color-success)",
    error: "var(--color-danger)",
    info: "var(--color-info)",
  };
  const icons: Record<string, string> = { success: "✓", error: "✕", info: "ℹ" };

  const el = document.createElement("div");
  el.className = "toast-notification";
  el.setAttribute("role", "alert");
  el.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: var(--color-text); color: white;
    padding: 12px 20px; border-radius: 12px; font-size: 14px;
    z-index: 200; display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    animation: slideUp 0.3s ease;
    max-width: calc(100vw - 32px); text-align: center;
  `;
  el.innerHTML = `<span style="color: ${colors[type]}; font-weight: 700;">${icons[type]}</span> ${message}`;
  document.body.appendChild(el);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.remove(), 3000);
}

// ── Info Card ────────────────────────────────────────────────────────
export function InfoCard({ icon, title, children, color }: {
  icon: string; title: string; children: React.ReactNode; color?: string;
}) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color || "var(--color-info)"}`, padding: 16 }}>
      <h3 className="heading-sm" style={{ color: color || "var(--color-info)", margin: "0 0 8px 0" }}>{icon} {title}</h3>
      {children}
    </div>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────
export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const cls = score >= 80 ? "score-high" : score >= 60 ? "score-medium" : "score-low";
  return (
    <span className={`score-badge ${cls}`}>
      {score}{label ? ` ${label}` : "/100"}
    </span>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────
export function Skeleton({ height = 100, count = 1 }: { height?: number; count?: number }) {
  return (
    <div className="flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 12 }} />
      ))}
    </div>
  );
}

// ── Action Card ──────────────────────────────────────────────────────
export function ActionCard({ icon, title, subtitle, onClick, variant = "default" }: {
  icon: string; title: string; subtitle?: string; onClick: () => void; variant?: "default" | "featured";
}) {
  if (variant === "featured") {
    return (
      <div className="featured-card" onClick={onClick} role="button" tabIndex={0}
        onKeyDown={e => e.key === "Enter" && onClick()}
        style={{ cursor: "pointer" }}>
        <span style={{ fontSize: 40 }}>{icon}</span>
        <span className="heading-sm" style={{ color: "white", textAlign: "center" }}>{title}</span>
        {subtitle && <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}>{subtitle}</span>}
      </div>
    );
  }
  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 10px", gap: 6, minHeight: 80, justifyContent: "center" }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span className="text-sm" style={{ fontWeight: 600, textAlign: "center" }}>{title}</span>
      {subtitle && <span className="text-xs" style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{subtitle}</span>}
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────────────────
export function BottomNav({ items, active }: {
  items: { icon: string; label: string; href: string; badge?: number }[];
  active: string;
}) {
  return (
    <nav className="bottom-nav hide-desktop" aria-label="Main navigation">
      {items.map(item => (
        <a key={item.href} href={item.href} className={`nav-item ${item.href === active ? "active" : ""}`}
          aria-current={item.href === active ? "page" : undefined}>
          <span style={{ fontSize: 20, position: "relative" }}>
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -8,
                background: "var(--color-danger)", color: "white",
                fontSize: 10, fontWeight: 700, width: 16, height: 16,
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{item.badge > 9 ? "9+" : item.badge}</span>
            )}
          </span>
          <span style={{ fontSize: 10 }}>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

// ── Crop Icon ────────────────────────────────────────────────────────
export function CropIcon({ crop, size = 20 }: { crop: string; size?: number }) {
  const icons: Record<string, string> = { tomato: "🍅", onion: "🧅", soybean: "🫘" };
  return <span style={{ fontSize: size }}>{icons[crop.toLowerCase()] || "🌾"}</span>;
}
