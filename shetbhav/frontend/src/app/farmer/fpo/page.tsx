"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { cropEmoji } from "@/lib/cropEmoji";
import { totalAmount, formatINR } from "@/lib/money";
import { EmptyState, Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Farmer <-> FPO — join an FPO (self-service, FPO manager approves), and
 * respond to aggregation requests the FPO has sent on your own lots.
 * Entirely additive: a farmer who never visits this page keeps selling
 * directly to buyers exactly as before.
 */

export default function FarmerFpoPage() {
  const router = useRouter();
  const [fpos, setFpos] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoadError(false);
    Promise.all([
      api.get("/fpo/browse"),
      api.get("/farmer/fpo-status"),
      api.get("/farmer/fpo-requests"),
    ]).then(([f, m, r]) => {
      setFpos(f.data);
      setMemberships(m.data);
      setRequests(r.data);
      setLoading(false);
    }).catch(() => { setLoadError(true); setLoading(false); });
  };

  useEffect(load, []);

  const membershipFor = (fpoId: number) => memberships.find(m => m.fpo_id === fpoId);
  const activeMembership = memberships.find(m => m.status === "active");

  const joinFpo = async (fpoId: number) => {
    setJoiningId(fpoId);
    setError("");
    try {
      await api.post("/fpo/join-request", null, { params: { fpo_id: fpoId } });
      load();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Couldn't send the request. Please try again.");
    } finally {
      setJoiningId(null);
    }
  };

  const respond = async (contributionId: number, action: "confirm" | "decline") => {
    setRespondingId(contributionId);
    setError("");
    try {
      await api.post(`/fpo/aggregation/${contributionId}/${action}`);
      load();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Couldn't record your response. Please try again.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} aria-label="Go back"
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
          <h1 className="heading-md" style={{ margin: 0 }}>FPO Membership</h1>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 12 }}>
            <span>⚠️</span><p>{error}</p>
          </div>
        )}

        {loading ? (
          <div>{[1, 2].map(i => <Skeleton key={i} height={100} />)}</div>
        ) : loadError ? (
          <EmptyState icon="⚠️" title="Couldn't load FPO info" description="Check your connection and try again."
            action={{ label: "Retry", onClick: load }} />
        ) : (
          <>
            {/* ── Pending Aggregation Requests ── */}
            {requests.length > 0 && (
              <>
                <p className="heading-sm" style={{ marginBottom: 8 }}>Aggregation Requests</p>
                {requests.map(r => (
                  <div key={r.contribution_id} className="card" style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {cropEmoji(r.crop_name)} {r.fpo_name} wants your {r.quantity_kg?.toLocaleString("en-IN")}kg of {r.crop_name || "produce"}
                    </p>
                    {r.expected_price_per_q && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        Expected price: ₹{r.expected_price_per_q.toLocaleString("en-IN")}/q
                        {" · "}Total: {formatINR(totalAmount(r.expected_price_per_q, r.quantity_kg))}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: "10px", fontSize: 13 }}
                        disabled={respondingId === r.contribution_id}
                        onClick={() => respond(r.contribution_id, "confirm")}>
                        {respondingId === r.contribution_id ? "…" : "✅ Confirm"}
                      </button>
                      <button style={{
                        flex: 1, padding: "10px", fontSize: 13, borderRadius: 8,
                        border: "1px solid var(--stone-200)", background: "white", cursor: "pointer", color: "var(--danger)",
                      }} disabled={respondingId === r.contribution_id}
                        onClick={() => respond(r.contribution_id, "decline")}>
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── Membership ── */}
            <p className="heading-sm" style={{ marginBottom: 8 }}>
              {activeMembership ? "Your FPO" : "Browse FPOs"}
            </p>
            {activeMembership ? (
              <div className="card">
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{activeMembership.fpo_name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                  Member since {activeMembership.joined_at ? new Date(activeMembership.joined_at).toLocaleDateString("en-IN") : "—"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                  Mark a lot "available for FPO aggregation" when you create it to let this FPO pick it up.
                </p>
              </div>
            ) : fpos.length === 0 ? (
              <EmptyState icon="🏢" title="No FPOs registered yet" description="Check back later." />
            ) : (
              fpos.map(fpo => {
                const m = membershipFor(fpo.id);
                return (
                  <div key={fpo.id} className="card" style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{fpo.name}</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                          {fpo.district || "—"} · {fpo.member_count} member{fpo.member_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {m?.status === "pending" ? (
                        <span className="badge badge-amber">Requested</span>
                      ) : m?.status === "rejected" ? (
                        <span className="badge badge-gray">Declined</span>
                      ) : (
                        <button className="btn-primary btn-sm" disabled={joiningId === fpo.id}
                          onClick={() => joinFpo(fpo.id)}>
                          {joiningId === fpo.id ? "…" : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
      <FarmerBottomNav />
    </div>
  );
}
