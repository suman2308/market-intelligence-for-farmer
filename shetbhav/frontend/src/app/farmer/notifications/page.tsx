"use client";
import { useRouter } from "next/navigation";
import { NotificationsPanel } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function FarmerNotifications() {
  const router = useRouter();

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} aria-label="Go back"
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
          <h1 className="heading-md" style={{ margin: 0 }}>Notifications</h1>
        </div>

        <div className="card">
          <NotificationsPanel />
        </div>
      </div>
      <FarmerBottomNav />
    </div>
  );
}
