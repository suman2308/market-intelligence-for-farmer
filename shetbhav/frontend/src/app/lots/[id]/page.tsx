"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Shared lot detail page — reachable by any logged-in role (buyer browsing
 * lots, farmer/FPO reviewing their own, or anyone landing here from a
 * notification link). Shows the posting farmer/FPO's identity with a link
 * to their counterparty profile.
 */

type Lot = {
  id: number; farmer_id: number; farmer_user_id?: number; farmer_username?: string;
  farmer_name?: string; fpo_id?: number; fpo_user_id?: number; fpo_name?: string; crop_id: number;
  crop_name?: string; quantity_kg: number; price_per_q?: number; quality_grade: string;
  address?: string; harvest_date?: string; storage_available: boolean; urgency: string;
  status: string; offers_close_at?: string; created_at: string;
};

export default function LotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Lot>(`/lots/${id}`)
      .then(r => setLot(r.data))
      .catch(() => setError("Lot not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const posterLabel = lot?.fpo_name || lot?.farmer_name || "Unknown";
  const posterUserId = lot?.fpo_id ? lot?.fpo_user_id : lot?.farmer_user_id;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Lot Details</h1>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, margin: 0 }}>📦</p>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0 0" }}>{error}</p>
        </div>
      ) : lot && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{lot.crop_name || "Crop"}</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>Lot #{lot.id}</p>
              </div>
              <span className={`badge badge-${lot.status === "active" ? "active" : "pending"}`}>{lot.status}</span>
            </div>

            {lot.price_per_q && (
              <p style={{ fontSize: 28, fontWeight: 800, color: "var(--green-700)", margin: "0 0 12px" }}>
                ₹{lot.price_per_q.toLocaleString("en-IN")}<span style={{ fontSize: 14, fontWeight: 500 }}>/q</span>
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Quantity", `${lot.quantity_kg.toLocaleString("en-IN")} kg`],
                ["Grade", lot.quality_grade],
                ["Urgency", lot.urgency],
                ["Storage available", lot.storage_available ? "Yes" : "No"],
                ["Address", lot.address || "—"],
                ["Harvest date", lot.harvest_date ? new Date(lot.harvest_date).toLocaleDateString("en-IN") : "—"],
                ["Offers close", lot.offers_close_at ? new Date(lot.offers_close_at).toLocaleString("en-IN") : "—"],
                ["Posted", new Date(lot.created_at).toLocaleDateString("en-IN")],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="heading-sm" style={{ marginBottom: 8 }}>Posted by</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 700, margin: 0 }}>{posterLabel}</p>
                {lot.farmer_username && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>@{lot.farmer_username}</p>
                )}
              </div>
              {posterUserId && (
                <button className="btn-secondary btn-sm"
                  onClick={() => router.push(`/profile/${posterUserId}`)}>
                  View Profile
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
