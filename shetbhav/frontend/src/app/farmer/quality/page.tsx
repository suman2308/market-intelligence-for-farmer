"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";

export default function QualityPage() {
  const router = useRouter();
  const { user, loadUser } = useAuth();
  const { t } = useI18n();
  const [lots, setLots] = useState<any[]>([]);
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [grade, setGrade] = useState("A");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingLots, setFetchingLots] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadUser().finally(() => {
      api.get("/lots").then(r => {
        setLots(r.data);
        setFetchingLots(false);
      }).catch(() => setFetchingLots(false));
    });
  }, []);

  if (!user) return null;

  const handleFileUpload = async (file: File) => {
    if (!selectedLot) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setResult({ error: "Only JPEG, PNG, or WebP images are accepted." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResult({ error: "File too large. Maximum size is 10MB." });
      return;
    }

    // Create local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/quality/upload/${selectedLot.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedImage(data.url);
      setUploadedFilePath(data.filepath);
    } catch (e: any) {
      setResult({ error: e.response?.data?.detail || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const assessAI = async () => {
    if (!selectedLot) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (uploadedFilePath) {
        params.append("filepath", uploadedFilePath);
      } else {
        params.append("image_url", "demo://sample.jpg");
      }
      const { data } = await api.post(`/quality/assess/${selectedLot.id}?${params.toString()}`);
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.detail || "Analysis failed." });
    } finally {
      setAnalyzing(false);
    }
  };

  const assessManual = async () => {
    if (!selectedLot || !grade) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post(`/quality/assess/${selectedLot.id}?override_grade=${grade}`);
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.detail || "Assessment failed." });
    } finally {
      setLoading(false);
    }
  };

  const gradeColor = (g: string) => g === "A" ? "#16a34a" : g === "B" ? "#d97706" : "#dc2626";
  const gradeBg = (g: string) => g === "A" ? "#f0fdf4" : g === "B" ? "#fffbeb" : "#fef2f2";

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="farmer-page">
      {/* Header */}
      <div style={{ padding: "16px 0 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 10, margin: -6, minWidth: 44, minHeight: 44 }}>←</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("quality") || "Quality Grading"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>AI-powered crop quality analysis</p>
        </div>
      </div>

      {/* Step 1: Select Lot */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8, background: "#166534", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
          }}>1</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Select your produce lot</span>
        </div>

        {fetchingLots ? (
          <div>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
        ) : lots.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <p style={{ fontSize: 28, margin: 0 }}>📦</p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 0 0" }}>No lots to grade. Create a lot first.</p>
            <button className="btn-primary" style={{ marginTop: 12, fontSize: 14 }}
              onClick={() => router.push("/farmer/sell")}>{t("create_lot") || "Create Lot"}</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lots.map((lot: any) => (
              <div key={lot.id} className="card" style={{
                cursor: "pointer",
                border: selectedLot?.id === lot.id ? "2px solid #166534" : "1.5px solid #e5e7eb",
                padding: "12px 14px",
                background: selectedLot?.id === lot.id ? "#f0fdf4" : "white",
                transition: "all 0.2s",
              }} onClick={() => { setSelectedLot(lot); setResult(null); setUploadedImage(null); setPreviewUrl(null); setUploadedFilePath(null); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                      Lot #{lot.id} — {lot.crop_name}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                      {lot.quantity_kg}kg · Grade {lot.quality_grade} · {lot.address || "Nashik"}
                    </p>
                  </div>
                  {["tomato", "onion", "soybean"].includes(lot.crop_name?.toLowerCase()) && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#1e40af",
                    }}>🤖 AI</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Upload Photo */}
      {selectedLot && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 8, background: "#166534", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
            }}>2</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Take or upload a photo</span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#166534" : "#d1d5db"}`,
              borderRadius: 16, padding: 24, textAlign: "center", cursor: "pointer",
              background: dragOver ? "#f0fdf4" : (previewUrl || uploadedImage) ? "#fafafa" : "#f9fafb",
              transition: "all 0.2s",
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              capture="environment" onChange={handleFileSelect} style={{ display: "none" }} />

            {uploading ? (
              <div>
                <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Uploading...</p>
              </div>
            ) : (previewUrl || uploadedImage) ? (
              <div>
                <img src={previewUrl || uploadedImage || ""} alt="Uploaded produce"
                  style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 12, marginBottom: 8, objectFit: "cover" }} />
                <p style={{ fontSize: 12, color: "#16a34a", margin: 0, fontWeight: 500 }}>
                  ✅ Photo ready for analysis
                </p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Tap to change photo</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 36, margin: 0 }}>📸</p>
                <p style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px 0", color: "#374151" }}>
                  Take a clear photo of your {selectedLot.crop_name}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  Tap to use camera or select from gallery · JPEG, PNG, WebP
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Analyze */}
      {selectedLot && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 8, background: "#166534", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
            }}>3</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Get your quality grade</span>
          </div>

          {!["tomato", "onion", "soybean"].includes(selectedLot.crop_name?.toLowerCase()) && (
            <p style={{ fontSize: 12, color: "var(--warning, #d97706)", margin: "0 0 10px 0" }}>
              ⚠️ AI grading isn't tuned for {selectedLot.crop_name} yet — use Manual Grade instead for a reliable result.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="btn-primary" onClick={assessAI} disabled={analyzing || loading}
              style={{
                background: "linear-gradient(135deg, #1e40af, #2563eb)",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                fontSize: 14, fontWeight: 700,
              }}>
              {analyzing ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "white" }}></span>
                  Analyzing...
                </span>
              ) : "🤖 AI Grade"}
            </button>
            <div>
              <select className="select" value={grade} onChange={e => setGrade(e.target.value)}
                style={{ marginBottom: 8, fontSize: 13, borderRadius: 10, minHeight: 40 }}>
                <option value="A">Grade A — Premium</option>
                <option value="B">Grade B — Standard</option>
                <option value="C">Grade C — Below Standard</option>
              </select>
              <button className="btn-primary" onClick={assessManual} disabled={loading || !grade}
                style={{ fontSize: 14, fontWeight: 700, minHeight: 42 }}>
                {loading ? "Saving..." : "✋ Manual Grade"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Analysis Result ── */}
      {result && !result.error && (
        <div style={{ marginBottom: 20 }}>
          {/* Grade Hero Card */}
          <div style={{
            background: `linear-gradient(135deg, ${gradeBg(result.grade)}, white)`,
            border: `2px solid ${gradeColor(result.grade)}30`,
            borderRadius: 20, padding: "24px 20px", marginBottom: 12,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gradeColor(result.grade) }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  AI Analysis Result
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  <span style={{
                    fontSize: 48, fontWeight: 800, color: gradeColor(result.grade), lineHeight: 1,
                  }}>{result.grade}</span>
                  <div>
                    <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>
                      {result.score ? `${result.score}/100` : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 28, fontWeight: 800, color: gradeColor(result.grade), lineHeight: 1,
                }}>{result.confidence}%</div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Confidence</p>
              </div>
            </div>

            {/* Confidence bar */}
            <div style={{ marginTop: 16, background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{
                width: `${result.confidence}%`, height: "100%", borderRadius: 4,
                background: `linear-gradient(90deg, ${gradeColor(result.grade)}80, ${gradeColor(result.grade)})`,
                transition: "width 0.5s ease",
              }} />
            </div>

            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 12, lineHeight: 1.5, fontStyle: "italic" }}>
              {result.notes}
            </p>
            <p style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 8 }}>{result.source_label}</p>
          </div>

          {/* Factor Breakdown */}
          {result.factors && Object.keys(result.factors).length > 0 && (
            <div className="card" style={{ marginBottom: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Analysis Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(result.factors).map(([key, factor]: [string, any]) => (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                        {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: factor.score >= 80 ? "#16a34a" : factor.score >= 60 ? "#d97706" : "#dc2626",
                      }}>{factor.score}/100</span>
                    </div>
                    <div style={{ background: "#f3f4f6", borderRadius: 4, height: 5, overflow: "hidden" }}>
                      <div style={{
                        width: `${factor.score}%`, height: "100%", borderRadius: 4,
                        background: factor.score >= 80 ? "#16a34a" : factor.score >= 60 ? "#d97706" : "#dc2626",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0 0" }}>{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color & Defect Analysis */}
          {(result.color_analysis || result.defect_analysis) && (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Detailed Analysis</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {result.color_analysis && (
                  <div style={{ padding: 10, borderRadius: 12, background: "#fafafa" }}>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Color</p>
                    <p style={{ fontSize: 13, color: "#374151", margin: "4px 0 0 0", fontWeight: 500 }}>
                      Hue: {result.color_analysis.dominant_hue}°
                    </p>
                    <p style={{ fontSize: 13, color: "#374151", margin: "2px 0 0 0" }}>
                      Sat: {result.color_analysis.saturation_avg}
                    </p>
                  </div>
                )}
                {result.defect_analysis && (
                  <div style={{ padding: 10, borderRadius: 12, background: "#fafafa" }}>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Defects</p>
                    <p style={{ fontSize: 13, color: result.defect_analysis.has_visible_defects ? "#dc2626" : "#16a34a", margin: "4px 0 0 0", fontWeight: 500 }}>
                      {result.defect_analysis.has_visible_defects ? "⚠️ Spots detected" : "✅ Clean surface"}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                      Dark area: {(result.defect_analysis.dark_spot_ratio * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="card" style={{ borderLeft: "3px solid #dc2626", marginBottom: 16 }}>
          <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 500 }}>⚠️ {result.error}</p>
        </div>
      )}

      {/* Info */}
      <div className="card" style={{ marginBottom: 20, padding: 14 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          🤖 AI grading analyzes color vibrancy, surface uniformity, freshness, and blemish detection.
          Supported: Tomato, Onion, Soybean. Upload a clear, well-lit photo for best results.
          Final grade is subject to buyer verification.
        </p>
      </div>
      </div>
      <FarmerBottomNav />
    </div>
  );
}
