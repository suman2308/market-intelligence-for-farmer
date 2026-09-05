"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Shared demand detail page — reachable by any logged-in role (farmer/FPO
 * reviewing a buyer's demand, or the buyer checking their own). Shows the
 * posting buyer's identity with a link to their counterparty profile.
 */

type Demand = {
  id: number; buyer_id: number; buyer_user_id?: number; buyer_username?: string;
  buyer_name?: string; crop_id: number; crop_name?: string; quantity_kg: number;
  quality_grade?: string; required_by_date?: string; district?: string;
  offered_price_per_q: number; status: string; created_at: string;
};

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Demand>(`/demand/${id}`)
      .then(r => setDemand(r.data))
      .catch(() => setError("Demand not found."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Demand Details</h1>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, margin: 0 }}>📋</p>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0 0" }}>{error}</p>
        </div>
      ) : demand && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{demand.crop_name || "Crop"}</h2>
                <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "2px 0 0" }}>Demand #{demand.id}</p>
              </div>
              <span className={`badge badge-${demand.status === "open" ? "active" : "pending"}`}>{demand.status}</span>
            </div>

            <p style={{ fontSize: 28, fontWeight: 800, color: "var(--green-700)", margin: "0 0 12px" }}>
              ₹{demand.offered_price_per_q.toLocaleString("en-IN")}<span style={{ fontSize: 14, fontWeight: 500 }}>/q</span>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Quantity", `${demand.quantity_kg.toLocaleString("en-IN")} kg`],
                ["Grade", demand.quality_grade || "Any"],
                ["District", demand.district || "—"],
                ["Required by", demand.required_by_date ? new Date(demand.required_by_date).toLocaleDateString("en-IN") : "—"],
                ["Posted", new Date(demand.created_at).toLocaleDateString("en-IN")],
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
                <p style={{ fontWeight: 700, margin: 0 }}>{demand.buyer_name || "Buyer"}</p>
                {demand.buyer_username && (
                  <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "2px 0 0" }}>@{demand.buyer_username}</p>
                )}
              </div>
              {demand.buyer_user_id && (
                <button className="btn-secondary btn-sm"
                  onClick={() => router.push(`/profile/${demand.buyer_user_id}`)}>
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
