"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import { ProgressBar } from "@/components/ui";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

/**
 * Smart Sell Wizard — Redesigned
 * Each step asks ONE meaningful question.
 * Progressive disclosure. Simple on the surface.
 */

const STEPS = [
  { key: "crop", icon: "🌾" },
  { key: "quantity", icon: "⚖️" },
  { key: "quality", icon: "⭐" },
  { key: "urgency", icon: "⏰" },
  { key: "storage", icon: "📦" },
  { key: "location", icon: "📍" },
  { key: "result", icon: "🎯" },
];

export default function SmartSellPage() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [crops, setCrops] = useState<any[]>([]);
  const [form, setForm] = useState({
    crop_id: 0, crop_name: "", quantity_kg: 2000, quality_grade: "A",
    location_lat: 20.0057, location_lng: 73.7229,
    harvest_date: "", storage_available: true, urgency: "soon",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => { loadUser(); }, []);
  useEffect(() => {
    api.get("/crops").then(r => {
      setCrops(r.data);
      if (r.data.length > 0) setForm(f => ({ ...f, crop_id: r.data[0].id, crop_name: r.data[0].name }));
    }).catch(() => {});
  }, []);

  const analyzeOptions = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const { data } = await api.post("/smart-sell", {
        crop_id: form.crop_id, quantity_kg: form.quantity_kg,
        quality_grade: form.quality_grade, location_lat: form.location_lat,
        location_lng: form.location_lng, harvest_date: form.harvest_date || null,
        storage_available: form.storage_available, urgency: form.urgency,
      });
      setResult(data);
      setStep(6);
    } catch (e: any) {
      setError(e.response?.data?.detail || t("error_generic"));
    } finally {
      setAnalyzing(false);
    }
  };

  const createLotAndGoHome = async () => {
    try {
      await api.post("/lots", {
        crop_id: form.crop_id, quantity_kg: form.quantity_kg,
        quality_grade: form.quality_grade, location_lat: form.location_lat,
        location_lng: form.location_lng, storage_available: form.storage_available,
        urgency: form.urgency,
      });
      router.push("/farmer");
    } catch {}
  };

  const cropEmoji = (name: string) => {
    const n = name.toLowerCase();
    return n === "tomato" ? "🍅" : n === "onion" ? "🧅" : n === "soybean" ? "🫘" : "🌾";
  };

  if (!user) return null;

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      {/* Header */}
      <div className="page-header">
        <button onClick={() => step > 0 ? setStep(step - 1) : router.back()}
          aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 8, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="heading-md" style={{ margin: 0 }}>{t("sell_my_produce")}</h1>
          <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
            {step < 6 ? `Step ${step + 1} of 6` : "Your recommendation"}
          </p>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar current={step + 1} total={7} />

      <div className="page-body">
      {/* ═══ STEP 1: What do you want to sell? ═══ */}
      {step === 0 && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>{t("crop")}</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
            What crop do you want to sell?
          </p>
          <div className="flex-col gap-3">
            {crops.map(crop => (
              <button key={crop.id}
                className={`toggle-btn ${form.crop_id === crop.id ? "selected" : ""}`}
                onClick={() => { setForm({ ...form, crop_id: crop.id, crop_name: crop.name }); setStep(1); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                  textAlign: "left", borderRadius: 14, fontSize: 16, minHeight: 60,
                  border: form.crop_id === crop.id ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                }}>
                <span style={{ fontSize: 32 }}>{cropEmoji(crop.name)}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{crop.name}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{crop.name_hi}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 2: How much do you have? ═══ */}
      {step === 1 && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>How much do you have?</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>
            Enter the quantity in kilograms
          </p>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <input
              className="input"
              type="number"
              value={form.quantity_kg}
              onChange={e => setForm({ ...form, quantity_kg: Number(e.target.value) })}
              min={10} step={100}
              style={{
                textAlign: "center", fontSize: 32, fontWeight: 800,
                padding: "16px", maxWidth: 280, margin: "0 auto",
                color: "var(--color-primary)",
              }}
              aria-label="Quantity in kilograms"
            />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
              {form.quantity_kg} kg = <strong>{(form.quantity_kg / 100).toFixed(1)} quintals</strong>
            </p>
          </div>
          {/* Quick quantity chips */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[500, 1000, 2000, 5000, 10000].map(qty => (
              <button key={qty} onClick={() => setForm({ ...form, quantity_kg: qty })}
                style={{
                  padding: "8px 16px", borderRadius: 20, border: "1px solid var(--color-border)",
                  background: form.quantity_kg === qty ? "var(--color-primary-light)" : "white",
                  color: form.quantity_kg === qty ? "var(--color-primary)" : "var(--color-text)",
                  fontWeight: form.quantity_kg === qty ? 600 : 400, cursor: "pointer", fontSize: 13,
                  minHeight: 36,
                }}>
                {qty >= 1000 ? `${qty / 1000}T` : `${qty}kg`}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button className="btn-primary" style={{ maxWidth: 300, margin: "0 auto" }}
              onClick={() => setStep(2)} disabled={form.quantity_kg <= 0}>
              {t("next")} →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: What quality? ═══ */}
      {step === 2 && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>What quality is your crop?</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
            Select the grade that best matches
          </p>
          <div className="flex-col gap-3">
            {[
              { v: "A", label: "Grade A", sublabel: "Premium quality", emoji: "⭐", color: "var(--color-success)" },
              { v: "B", label: "Grade B", sublabel: "Good quality", emoji: "👍", color: "var(--color-accent)" },
              { v: "C", label: "Grade C", sublabel: "Standard quality", emoji: "📦", color: "var(--color-text-secondary)" },
            ].map(g => (
              <button key={g.v}
                className={`toggle-btn ${form.quality_grade === g.v ? "selected" : ""}`}
                onClick={() => { setForm({ ...form, quality_grade: g.v }); setStep(3); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                  textAlign: "left", borderRadius: 14, minHeight: 64,
                  border: form.quality_grade === g.v ? `2px solid ${g.color}` : "2px solid var(--color-border)",
                }}>
                <span style={{ fontSize: 28 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{g.label}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{g.sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 4: When do you need to sell? ═══ */}
      {step === 3 && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>When do you need to sell?</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
            This helps us find the best timing
          </p>
          <div className="flex-col gap-3">
            {[
              { v: "urgent", label: t("urgent"), sublabel: "As soon as possible", emoji: "⚡" },
              { v: "soon", label: t("soon"), sublabel: "Within a few days", emoji: "📅" },
              { v: "flexible", label: t("flexible"), sublabel: "No rush, waiting for the best price", emoji: "🕐" },
            ].map(u => (
              <button key={u.v}
                className={`toggle-btn ${form.urgency === u.v ? "selected" : ""}`}
                onClick={() => { setForm({ ...form, urgency: u.v }); setStep(4); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                  textAlign: "left", borderRadius: 14, minHeight: 64,
                  border: form.urgency === u.v ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                }}>
                <span style={{ fontSize: 28 }}>{u.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{u.label}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{u.sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 5: Can you store? ═══ */}
      {step === 4 && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>Can you store your produce?</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
            Storage can help you wait for better prices
          </p>
          <div className="flex-col gap-3">
            {[
              { v: true, label: "Yes, I have storage", emoji: "✅" },
              { v: false, label: "No, I need to sell quickly", emoji: "❌" },
            ].map(s => (
              <button key={String(s.v)}
                className={`toggle-btn ${form.storage_available === s.v ? "selected" : ""}`}
                onClick={() => { setForm({ ...form, storage_available: s.v }); setStep(5); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                  textAlign: "left", borderRadius: 14, minHeight: 64,
                  border: form.storage_available === s.v ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                }}>
                <span style={{ fontSize: 28 }}>{s.emoji}</span>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 6: Confirm & Analyze ═══ */}
      {step === 5 && !analyzing && (
        <div>
          <h2 className="heading-lg" style={{ marginBottom: 4 }}>Ready to find your best option</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)", marginBottom: 20 }}>
            We'll analyze market prices, buyer demand, transport costs, and forecast trends
          </p>

          {/* Summary Card */}
          <div className="card" style={{ marginBottom: 20, padding: 20 }}>
            <h3 className="heading-sm" style={{ margin: "0 0 12px 0" }}>Your details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Crop", `${cropEmoji(form.crop_name)} ${form.crop_name}`],
                ["Quantity", `${form.quantity_kg.toLocaleString("en-IN")} kg (${(form.quantity_kg / 100).toFixed(1)} q)`],
                ["Quality", `Grade ${form.quality_grade}`],
                ["Urgency", form.urgency === "urgent" ? "Within 2 days" : form.urgency === "soon" ? "Within 3-5 days" : "Flexible timing"],
                ["Storage", form.storage_available ? "Available" : "Not available"],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{String(label)}</span>
                  <span className="text-sm" style={{ fontWeight: 600 }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={analyzeOptions}
            style={{ fontSize: 18, padding: "16px 24px", minHeight: 56 }}>
            🔍 {t("find_best_options")}
          </button>
        </div>
      )}

      {/* ═══ Analyzing Animation ═══ */}
      {analyzing && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 className="heading-lg" style={{ marginBottom: 8 }}>Analyzing your options...</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 300, margin: "20px auto 0" }}>
            {[
              { label: "Checking market prices", done: true },
              { label: "Finding buyer demand", done: true },
              { label: "Calculating transport costs", done: false },
              { label: "Comparing expected earnings", done: false },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                <span style={{ color: item.done ? "var(--color-success)" : "var(--color-border)", fontSize: 16, width: 20, textAlign: "center" }}>
                  {item.done ? "✓" : <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                </span>
                <span className="text-sm" style={{ color: item.done ? "var(--color-text)" : "var(--color-text-secondary)" }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 7: Result ═══ */}
      {step === 6 && result && !analyzing && (
        <div>
          {/* Lot Summary */}
          <div style={{ background: "var(--color-success-light)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p className="text-sm" style={{ fontWeight: 600, margin: 0 }}>
              {cropEmoji(form.crop_name)} {form.crop_name} — {form.quantity_kg.toLocaleString("en-IN")}kg — Grade {form.quality_grade}
            </p>
          </div>

          {/* Best Option — Primary Recommendation */}
          {result.best_option && (
            <div style={{
              border: "2px solid var(--color-success)", borderRadius: 20, padding: 20, marginBottom: 16,
              background: "linear-gradient(180deg, var(--color-success-light), white)",
            }}>
              <p className="text-xs" style={{ color: "var(--color-success)", fontWeight: 700, margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>
                Your Best Option
              </p>
              <h2 className="heading-lg" style={{ margin: "8px 0 0 0" }}>{result.best_option.target_name}</h2>

              {/* Net Price — Hero */}
              <div style={{ textAlign: "center", margin: "16px 0" }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: "var(--color-primary)", lineHeight: 1 }}>
                  ₹{result.best_option.net_realization_per_q?.toLocaleString("en-IN")}
                  <span style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-secondary)" }}> /q</span>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                  Expected net earning per quintal
                </p>
              </div>

              {/* Score */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--color-success)", color: "white",
                  padding: "6px 16px", borderRadius: 20, fontSize: 14, fontWeight: 700,
                }}>
                  {result.best_option.score}/100 · Best match
                </span>
              </div>

              {/* Reasons — simple checklist */}
              <div style={{ marginBottom: 12 }}>
                {result.best_option.reasons?.slice(0, 4).map((r: string, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "var(--color-success)", fontSize: 14 }}>✓</span>
                    <span className="text-sm">{r}</span>
                  </div>
                ))}
              </div>

              {/* Risks */}
              {result.best_option.risks?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {result.best_option.risks.map((r: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ color: "var(--color-accent)", fontSize: 14 }}>⚠</span>
                      <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confidence */}
              <div className="text-xs" style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>
                Confidence: {((result.best_option.confidence || 0) * 100).toFixed(0)}%
              </div>

              {/* Explanation Toggle */}
              <button onClick={() => setShowExplanation(!showExplanation)}
                style={{
                  display: "block", width: "100%", marginTop: 12, padding: "10px",
                  background: "transparent", border: "1px dashed var(--color-border)",
                  borderRadius: 10, cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)",
                  textAlign: "center",
                }}>
                {showExplanation ? "Hide" : "Show"} calculation details
              </button>

              {/* Collapsible Explanation */}
              {showExplanation && (
                <div style={{ marginTop: 12, padding: 14, background: "var(--color-card-alt)", borderRadius: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["Gross price", `₹${result.best_option.gross_price_per_q}/q`],
                      ["Transport cost", `-₹${result.best_option.transport_cost_per_q}/q`],
                      ["Storage cost", `-₹${result.best_option.storage_cost_per_q}/q`],
                      ["Expected loss", `-₹${result.best_option.expected_loss_per_q}/q`],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{String(label)}</span>
                        <span className="text-sm" style={{ fontWeight: 600, color: String(value).includes("-") ? "var(--color-danger)" : "var(--color-text)" }}>{String(value)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                      <span className="text-sm" style={{ fontWeight: 700 }}>Net per quintal</span>
                      <span className="text-sm" style={{ fontWeight: 700, color: "var(--color-primary)" }}>₹{result.best_option.net_realization_per_q}/q</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--color-primary)", borderRadius: 10, textAlign: "center" }}>
                    <p className="text-xs" style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>Total expected earnings</p>
                    <p style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 0 0", color: "white" }}>
                      ₹{((result.best_option.net_realization_per_q || 0) * (form.quantity_kg / 100)).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alternatives — Cards */}
          {result.alternatives?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 className="heading-sm" style={{ marginBottom: 10 }}>Other options</h3>
              {result.alternatives.map((alt: any, i: number) => (
                <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p className="text-sm" style={{ fontWeight: 600, margin: 0 }}>{alt.target_name}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                        Net: ₹{alt.net_realization_per_q?.toLocaleString("en-IN")}/q
                      </p>
                    </div>
                    <span className={`score-badge ${alt.score >= 80 ? "score-high" : alt.score >= 60 ? "score-medium" : "score-low"}`}>
                      {alt.score}/100
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* What-If */}
          {result.what_if_scenarios?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 className="heading-sm" style={{ marginBottom: 10 }}>What if you wait?</h3>
              {result.what_if_scenarios.map((s: any, i: number) => (
                <div key={i} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <p className="text-sm" style={{ fontWeight: 600, margin: 0 }}>{s.scenario}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span className="text-sm">Net: <strong>₹{s.net?.toLocaleString("en-IN")}</strong></span>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: s.risk === "Low" ? "var(--color-success)" : s.risk === "Medium" ? "var(--color-accent)" : "var(--color-danger)",
                    }}>
                      Risk: {s.risk}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data Source */}
          <div style={{ padding: 12, background: "var(--color-card-alt)", borderRadius: 8, marginBottom: 16 }}>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
              Price: {result.best_option?.data_labels?.gross_price || "Market estimate"} ·
              Transport: {result.best_option?.data_labels?.transport || "Estimated"}
            </p>
          </div>

          {/* Actions */}
          <button className="btn-primary" onClick={createLotAndGoHome}
            style={{ fontSize: 16, marginBottom: 12 }}>
            📦 {t("create_lot")} & {t("find_buyers")}
          </button>
          <button className="btn-secondary" onClick={() => router.push("/farmer")}>
            {t("home")}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card" style={{ borderLeft: "3px solid var(--color-danger)", marginTop: 12 }}>
          <p style={{ color: "var(--color-danger)", fontSize: 14, fontWeight: 500, margin: 0 }}>
            ⚠️ {error}
          </p>
        </div>
      )}
      </div>

      <FarmerBottomNav />
    </div>
  );
}
