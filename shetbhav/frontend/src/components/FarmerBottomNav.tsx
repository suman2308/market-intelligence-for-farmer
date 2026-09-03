"use client";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/**
 * Shared bottom navigation for every farmer page.
 * Five fixed tabs: Home · Prices · Sell · Orders · Profile.
 * Highlights the matching tab from the current path automatically.
 */
const TABS = [
  { href: "/farmer", icon: "🏠", labelKey: "home" },
  { href: "/farmer/prices", icon: "📊", labelKey: "markets" },
  { href: "/farmer/sell", icon: "💰", labelKey: "sell_my_produce" },
  { href: "/farmer/orders", icon: "📋", labelKey: "orders" },
  { href: "/farmer/profile", icon: "👤", labelKey: "profile" },
] as const;

// Detail pages that belong under each tab
const CHILDREN: Record<string, string[]> = {
  "/farmer": ["/farmer/lots"],
  "/farmer/prices": ["/farmer/buyers"],
  "/farmer/sell": ["/farmer/quality"],
  "/farmer/orders": [],
  "/farmer/profile": ["/farmer/earnings", "/farmer/grievance"],
};

export default function FarmerBottomNav({ active }: { active?: string } = {}) {
  const pathname = usePathname() || "";
  const { t } = useI18n();

  const isActive = (href: string) => {
    if (active) return active === href;
    if (href === "/farmer" || CHILDREN[href]?.length) {
      return pathname === href || (CHILDREN[href] || []).some((p) => pathname.startsWith(p));
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="bottom-nav hide-desktop" role="navigation" aria-label="Farmer navigation">
      {TABS.map((tab) => {
        const tabActive = isActive(tab.href);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`nav-item ${tabActive ? "active" : ""}`}
            aria-current={tabActive ? "page" : undefined}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ fontWeight: tabActive ? 700 : 500 }}>{t(tab.labelKey as any) || tab.href.split("/").pop()}</span>
          </a>
        );
      })}
    </nav>
  );
}
