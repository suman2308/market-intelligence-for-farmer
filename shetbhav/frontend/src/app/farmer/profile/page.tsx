"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function FarmerProfile() {
  const { user, logout, loadUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ farm_address: "", farm_location_lat: 0, farm_location_lng: 0, phone: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser().then(() => {
      api.get("/farmers/profile").then(r => {
        setProfile(r.data);
        setEditForm({
          farm_address: r.data.farm_address || "",
          farm_location_lat: r.data.farm_location_lat || 19.9975,
          farm_location_lng: r.data.farm_location_lng || 73.7898,
          phone: r.data.phone || "",
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  if (loading) return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
        <div style={{ padding: "16px 0" }}>
          <Skeleton height={26} />
        </div>
        <div className="skeleton" style={{ height: 190, borderRadius: 14, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 150, borderRadius: 14 }} />
      </div>
      <FarmerBottomNav />
    </div>
  );

  if (!user) return null;

  const saveProfile = async () => {
    try {
      await api.put("/farmers/profile", editForm);
      const { data } = await api.get("/farmers/profile");
      setProfile(data);
      setEditing(false);
    } catch {}
  };

  return (
    <div className="farmer-shell">
      <FarmerHeader />
    <div className="farmer-page">
      <div style={{ padding: "16px 0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("profile")}</h1>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ textAlign: "center", marginBottom: 16, padding: 24 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--green-100), var(--green-200))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 800, color: "var(--green-800)",
          margin: "0 auto 12px",
        }}>
          {user.full_name.charAt(0)}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{user.full_name}</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0 0" }}>@{user.username} · Farmer</p>
        <p style={{ fontSize: 13, color: "#6b7280" }}>{user.email}</p>
      </div>

      {/* Farm Details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Farm Details</h3>
          <button onClick={() => setEditing(!editing)}
            style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", margin: "-8px -10px", minHeight: 36, minWidth: 44 }}>
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                Farm Address
              </label>
              <input className="input" value={editForm.farm_address}
                onChange={e => setEditForm({ ...editForm, farm_address: e.target.value })}
                placeholder="Village, Taluka, District" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                  Latitude
                </label>
                <input className="input" type="number" step="0.0001" value={editForm.farm_location_lat}
                  onChange={e => setEditForm({ ...editForm, farm_location_lat: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                  Longitude
                </label>
                <input className="input" type="number" step="0.0001" value={editForm.farm_location_lng}
                  onChange={e => setEditForm({ ...editForm, farm_location_lng: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" }}>
                Phone
              </label>
              <input className="input" type="tel" value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX" />
            </div>
            <button className="btn-primary" onClick={saveProfile}>Save Changes</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontSize: 14 }}>Address</span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{profile?.farm_address || "Not set"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontSize: 14 }}>Phone</span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{profile?.phone || "Not set"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontSize: 14 }}>Coordinates</span>
              <span style={{ fontWeight: 500, fontSize: 14, color: "#9ca3af" }}>
                {profile?.farm_location_lat?.toFixed(4)}, {profile?.farm_location_lng?.toFixed(4)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Language */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("language")}</h3>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="lang-toggle" role="group" aria-label="Language">
            {[{ v: "en", l: "EN" }, { v: "hi", l: "हिं" }, { v: "mr", l: "मरा" }].map(({ v, l }) => (
              <button key={v} className={`lang-btn ${lang === v ? "active" : ""}`}
                aria-pressed={lang === v}
                onClick={() => setLang(v as any)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quick Links</h3>
        {[
          { label: "📊 Market Prices", path: "/farmer/prices" },
          { label: "📦 My Lots", path: "/farmer/lots" },
          { label: "🔍 Find Buyers", path: "/farmer/buyers" },
          { label: "📋 My Orders", path: "/farmer/orders" },
          { label: "💰 My Earnings", path: "/farmer/earnings" },
          { label: "🚨 Help & Grievance", path: "/farmer/grievance" },
        ].map(link => (
          <Link key={link.path} href={link.path}
            style={{
              display: "block", width: "100%", padding: "10px 0", background: "none",
              border: "none", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
              fontSize: 14, fontWeight: 500, textAlign: "left", textDecoration: "none",
              color: "inherit",
            }}>
            {link.label}
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button className="btn-primary" onClick={() => { logout(); router.push("/login"); }}
        style={{ background: "#ef4444", width: "100%" }}>
        {t("logout")}
      </button>

    </div>
      <FarmerBottomNav />
    </div>
  );
}
