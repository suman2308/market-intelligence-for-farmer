"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Counterparty profile view — reached from a lot/demand detail page or a
 * notification, so a farmer/buyer/FPO can see who they're actually dealing
 * with: name, role, business info, contact. Never shows email/credentials.
 */

type Profile = {
  id: number; username: string; full_name: string; role: string; phone?: string;
  business_name?: string; business_type?: string; trust_score?: number;
  verification_status?: string; completed_transactions?: number;
  fpo_name?: string; member_count?: number; district?: string; address?: string;
};

const ROLE_LABEL: Record<string, string> = {
  farmer: "🌾 Farmer", buyer: "🏭 Buyer", fpo: "🤝 FPO", admin: "⚙️ Admin",
};

export default function CounterpartyProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Profile>(`/users/${userId}/profile`)
      .then(r => setProfile(r.data))
      .catch(() => setError("Profile not found."))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Profile</h1>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 32, margin: 0 }}>👤</p>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0 0" }}>{error}</p>
        </div>
      ) : profile && (
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--green-100), var(--green-200))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "var(--green-800)",
            margin: "0 auto 12px",
          }}>
            {(profile.fpo_name || profile.business_name || profile.full_name).charAt(0)}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {profile.fpo_name || profile.business_name || profile.full_name}
          </h2>
          <p style={{ fontSize: 13, color: "var(--stone-400)", margin: "4px 0 0" }}>
            @{profile.username} · {ROLE_LABEL[profile.role] || profile.role}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-secondary)" }}>Contact</span>
              <span style={{ fontWeight: 600 }}>{profile.phone || "Not provided"}</span>
            </div>
            {profile.district && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>District</span>
                <span style={{ fontWeight: 600 }}>{profile.district}</span>
              </div>
            )}
            {profile.address && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>Address</span>
                <span style={{ fontWeight: 600 }}>{profile.address}</span>
              </div>
            )}
            {profile.business_type && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>Business type</span>
                <span style={{ fontWeight: 600 }}>{profile.business_type}</span>
              </div>
            )}
            {profile.trust_score !== undefined && profile.trust_score !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>Trust score</span>
                <span style={{ fontWeight: 600 }}>{profile.trust_score.toFixed(0)}/100</span>
              </div>
            )}
            {profile.completed_transactions !== undefined && profile.completed_transactions !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>Completed deals</span>
                <span style={{ fontWeight: 600 }}>{profile.completed_transactions}</span>
              </div>
            )}
            {profile.member_count !== undefined && profile.member_count !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-secondary)" }}>Members</span>
                <span style={{ fontWeight: 600 }}>{profile.member_count}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
