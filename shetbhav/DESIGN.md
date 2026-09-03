# ShetBhav Design System — शेतभाव

**Know the market. Choose better. Earn more.**

This document is the single source of truth for ShetBhav's visual design, layout, and interaction patterns. It exists so every page looks like it belongs to the same product — warm, trustworthy, and simple enough for a farmer who has never used a smartphone app.

---

## Design Principles

Derived from research into farmer-facing and low-literacy interfaces (Lollypop's FarmRise, Gapsy's agriculture app guide, WCAG 2.2 target-size guidance):

1. **Design for the field, not the demo.** Screens are read at arm's length in direct sunlight. High contrast, large text, large touch targets.
2. **One question per screen.** Never show a farmer a wall of fields. Break long forms into steps with visible progress.
3. **Turn data into decisions.** Show the recommendation first ("Sell to ABC Foods, earn ₹91,500"), put the raw numbers behind expandable sections.
4. **Minimize typing.** Use visual selectors, quick-choice chips, and smart defaults. Every input is a potential dropout.
5. **Build trust through transparency.** Every price shows its source, observed date, retrieved time, and freshness. Never let synthetic data look live.
6. **48px minimum touch targets.** Farmers wear gloves, have rough hands, and tap quickly. WCAG 2.5.8 minimum is 24px — we go to 48px (and often 56px for primary actions).
7. **Multilingual by default.** English, Hindi, and Marathi must render without overflow and switch instantly.

---

## Color Palette

### Primary — warm agricultural identity

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-cream` | `#FCFAF5` | Page background (warm cream) |
| `--green-600` / `--color-primary` | `#1F6B45` | Primary buttons, links, active states (trust, crops) |
| `--green-900` | `#123B2A` | Headers, sidebar, strong headings |
| `--saffron-500` / `--color-accent` | `#D97706` | Opportunity highlights, "best option" badges |
| `--green-50` | `#E8F5EC` | Success backgrounds, selected states |

### Neutral

| Token | Hex | Usage |
|-------|-----|-------|
| `--navy` / `--text-primary` | `#172033` | Body text, headings |
| `--text-secondary` | `#667085` | Secondary text, captions |
| `--border` | `#E2E8F0` | Card borders, dividers |
| `--bg-card` | `#FFFFFF` | Card backgrounds |

### Status — use semantically, never decoratively

| Token | Hex | Meaning |
|-------|-----|---------|
| `--success` | `#16A34A` | Green only for positive states |
| `--warning` | `#F59E0B` | Amber for pending / medium confidence |
| `--danger` | `#DC2626` | Red only for warnings, errors, rejections |
| `--info` | `#2563EB` | Blue for informational states |
| `--gray` | `#98A2B3` | Gray for unavailable data |

### Rules
- Green = positive only. Amber = pending/medium. Red = warning only. Gray = unavailable.
- Never rely on color alone — always pair with an icon or label (colorblind-safe).
- Minimum contrast ratio 4.5:1 for text (verified for `#172033` on `#FCFAF5` and white on `#1F6B45`).

---

## Typography

**Font families:**
- Latin: `Noto Sans`
- Devanagari (Hindi, Marathi): `Noto Sans Devanagari`
- Fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

Declared in `globals.css` as `--font-sans` and `--font-display`.

### Size scale

| Level | Desktop | Mobile | Weight | Line height | Used for |
|-------|---------|--------|--------|-------------|----------|
| Brand (ShetBhav) | 32–48px | 28px | 800 | 1.1 | Login/register header, desktop hero |
| H1 | 32px | 28px | 800 | 1.2 | Farmer name, page titles |
| H2 | 24px | 22px | 700 | 1.25 | Section headings |
| H3 | 20px | 18px | 600 | 1.35 | Card titles |
| Body | 16px | 16px | 400 | 1.5 | Default text |
| Small | 14px | 14px | 400 | 1.4 | Labels, secondary text |
| Caption | 12px | 12px | 400 | 1.4 | Source badges, timestamps |
| Price (hero) | 48px | 32px | 800 | 1.0 | ₹ price displays |

### Rules
- The **ShetBhav brand name is always the biggest text** on every screen.
- Page titles are smaller than the brand, larger than card titles.
- Never use font sizes smaller than 11px (`--text-xs` floor).
- Hindi/Marathi text must not overflow — always test with long words like "सलाहकार".

---

## Spacing (8px grid)

Scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

| Context | Value |
|---------|-------|
| Page side padding (mobile) | 16px |
| Page side padding (desktop) | 32–40px |
| Card padding | 16–20px |
| Card gap in lists | 12px |
| Section gap | 24–32px |
| Between form fields | 12–16px |
| Touch target minimum | 48×48px |

---

## Components

All shared components live in `src/components/ui.tsx` and `src/components/FarmerHeader.tsx`.

| Component | File | Notes |
|-----------|------|-------|
| `PageHeader` | ui.tsx | Title + optional back button + actions |
| `ProgressBar` | ui.tsx | Wizard step indicator (dots) |
| `BottomNav` | ui.tsx | Mobile bottom navigation (farmer) |
| `Sidebar` | ui.tsx | Desktop left nav (buyer, FPO, admin) |
| `DataSourceBadge` | ui.tsx | Source label: live / cached / model / synthetic / imported |
| `ConfidenceBadge` | ui.tsx | High / Medium / Low with % |
| `ScoreBadge` | ui.tsx | `82/100` style |
| `VerificationBadge` | ui.tsx | Verified / Pending / Rejected |
| `StatCard` | ui.tsx | Icon + value + label metric card |
| `CropCard` | ui.tsx | Large visual crop selector |
| `RecommendationCard` | ui.tsx | Green hero card: price, score, reasons, risks |
| `LotCard` | ui.tsx | Crop lot summary |
| `EmptyState` | ui.tsx | Icon + title + description + optional action |
| `VoiceButton` / `VoicePlayButton` | ui.tsx | SpeechSynthesis playback (hi-IN) |
| `Skeleton` | ui.tsx | Loading placeholder |
| `TrustScore` | ui.tsx | Buyer trust score display |
| `WhyExplainer` | ui.tsx | Collapsible "why recommended" section |
| `MobileStickyAction` | ui.tsx | Sticky bottom CTA (mobile) |
| `FarmerHeader` | FarmerHeader.tsx | Green sticky header: logo, language toggle, profile menu |
| `MapView` | MapView.tsx | Leaflet/OSM map |

### Source badges (critical for trust)
| Source | Badge label | Class | Icon |
|--------|-------------|-------|------|
| data.gov.in / AGMARKNET | "Official daily data" | `source-live` | ✓ |
| Cached official data | "Cached data" | `source-cached` | 📦 |
| Imported dataset | "Imported data" | `source-cached` | 📊 |
| Model forecast | "Model estimate" | `source-model` | 🤖 |
| Synthetic / demo | "Demo data" | `source-synthetic` | 🧪 |

---

## Layouts

### Farmer (mobile-first, always)
- All farmer pages are wrapped in `.farmer-shell` (max-width 420px, centered on desktop).
- On a desktop browser the farmer experience still looks like a phone — centered column with green header and bottom nav.
- Bottom navigation: Home, Prices, Sell, Orders, Profile.
- Sticky green `FarmerHeader` with brand, language toggle, profile menu.

### Buyer / FPO / Admin (desktop-first)
- `.has-sidebar` layout: fixed 240px dark-green sidebar + fluid content.
- Metric cards row, tabbed sections, tables for business workflows.
- On mobile the sidebar collapses and content becomes single-column.

### Auth (login / register)
- Mobile: green sticky header (brand + language toggle) + centered form below.
- Desktop: split screen — dark-green hero panel left, form right.
- Two-step flow: credentials → role selection (never show both at once).

---

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Small mobile | < 640px | Single column, cards instead of tables, bottom nav |
| Tablet | 640–1023px | Two-column grids, wider padding |
| Desktop | 1024–1439px | Sidebar layout, tables, map/list split |
| Large desktop | 1440px+ | Same as desktop with wider max content width |

### Farmer shell on desktop
```css
@media (min-width: 768px) {
  .farmer-shell { max-width: 420px; border-left/right: 1px solid var(--border); }
}
```
The farmer gets the same mobile experience centered on any screen.

---

## Accessibility

- **Touch targets:** all interactive controls ≥ 48px (buttons, nav items, inputs).
- **Focus:** `:focus-visible` outline 2px `--green-600` with 2px offset (declared in globals.css).
- **ARIA:** nav landmarks, `aria-current="page"` on active nav items, `aria-label` on icon-only buttons (back, voice).
- **Contrast:** navy `#172033` on cream `#FCFAF5` (13:1), white on `#1F6B45` (6.4:1) — both pass WCAG AA.
- **Colorblind:** status always includes icon + label, never color alone.
- **Voice:** `VoicePlayButton` reads recommendation, prices, order status in hi-IN.
- **Reduced motion:** `prefers-reduced-motion` disables animations.
- **Language:** instant EN/HI/MR switch via `useI18n`, persisted in localStorage.

---

## Design Inspiration & Research Notes

Research sources reviewed:
- **Lollypop FarmRise** — award-winning Indian agri app: light, icon-driven, decision-first UI.
- **Gapsy agriculture app guide** — prioritize efficiency over cognitive load, environmental visual language, progressive disclosure.
- **WCAG 2.5.8 Target Size (Minimum)** — 24px floor; platform guidance 48×48dp for touch.
- **Smashing Magazine touch targets** — 44×44px minimum for icons, larger for primary actions.

Adopted:
- Large emoji-based crop icons (farmers recognize tomatoes/onions instantly).
- Green = crop/trust, saffron = opportunity/attention.
- Recommendation cards show the decision, not the algorithm.
- Source badges on every price card (trust through transparency).

Avoided:
- Generic corporate dashboards with dense tables on mobile.
- Blue/gray "SaaS" color schemes that feel foreign to agriculture.
- Relying on charts as the primary interface.
- Jargon like "net realization," "feature importance," "confidence interval" in farmer-facing copy.

---

## Performance

- CSS custom properties keep the theme in one place (`globals.css` `:root`).
- Shared components avoid repeated markup.
- Skeleton loaders replace spinners to reduce layout shift.
- Map (`MapView`) is secondary, loaded only on pages that need it.
- Fonts: Noto Sans / Noto Sans Devanagari via font-family stack (webfonts optional).

---

## How to Use This System

1. **Never inline colors** — use `var(--green-600)`, `var(--text-secondary)`, etc.
2. **Never invent new type sizes** — use the heading/text classes (`heading-xl` → `text-xs`).
3. **Use shared components** from `ui.tsx` instead of rebuilding cards.
4. **Wrap farmer pages** in `farmer-shell`, business pages in `has-sidebar`.
5. **Every price must carry a source badge** — always.
6. **Test every page at 360px, 390px, 768px, 1024px, 1280px, 1440px** before considering it done.

---

## Status

This design system is implemented and applied across all pages (login, register, farmer ×10, buyer, FPO, admin). Remaining polish is tracked in `PROJECT_STATUS.md`.