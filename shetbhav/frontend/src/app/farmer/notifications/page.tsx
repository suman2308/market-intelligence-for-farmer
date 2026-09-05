"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NotificationsPanel } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function FarmerNotifications() {
  const router = useRouter();

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="heading-md" style={{ margin: 0 }}>Notifications</h1>
        </div>

        <Card>
          <CardContent>
            <NotificationsPanel />
          </CardContent>
        </Card>
      </div>
      <FarmerBottomNav />
    </div>
  );
}
