"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import FarmerHeader from "@/components/FarmerHeader";

export default function FarmerLots() {
  const router = useRouter();
  const { t } = useI18n();
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/lots").then(r => { setLots(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <FarmerHeader />
      <div className="farmer-page farmer-shell">
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("my_produce")}</h1>
      </div>

      <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => router.push("/farmer/sell")}>
        ➕ {t("create_lot")}
      </button>

      {loading ? (
        <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12 }} />)}</div>
      ) : lots.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, margin: 0 }}>📦</p>
          <p style={{ fontSize: 16, color: "#6b7280", margin: "12px 0 0 0" }}>No lots yet. Create your first lot!</p>
        </div>
      ) : (
        lots.map(lot => (
          <div key={lot.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {lot.crop_name || "Crop"} - {lot.quantity_kg}kg
                </p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0 0" }}>
                  Grade {lot.quality_grade} · {lot.urgency}
                </p>
                {lot.address && <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0 0" }}>{lot.address}</p>}
              </div>
              <span className={`badge ${lot.status === "active" ? "badge-active" : "badge-completed"}`}>
                {lot.status}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {lot.status === "active" && (
                <button className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: 14 }}
                  onClick={() => router.push("/farmer/sell")}>
                  💰 Find Buyers
                </button>
              )}
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  );
}
