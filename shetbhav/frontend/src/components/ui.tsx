"use client";

import React from "react";

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
            i < current ? "completed" : i === current ? "active" : ""
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

export function VoiceButton({ text, label }: { text: string; label?: string }) {
  const speak = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };
  return (
    <button className="voice-btn" onClick={speak} aria-label="Listen to text">
      🔊 {label || "Listen"}
    </button>
  );
}

// VoicePlayButton alias
export function VoicePlayButton({ text, label }: { text: string; label?: string }) {
  return <VoiceButton text={text} label={label} />;
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
