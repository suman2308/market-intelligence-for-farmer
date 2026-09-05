"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import api from "@/lib/api";
import MapView, { MapPoint } from "@/components/MapView";
import FarmerHeader from "@/components/FarmerHeader";
import FarmerBottomNav from "@/components/FarmerBottomNav";
import { cropEmoji } from "@/lib/cropEmoji";

export default function PricesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [selectedCrop, setSelectedCrop] = useState(0);
  const [crops, setCrops] = useState<any[]>([]);
  const [prices, setPrices] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [selectedMarket, setSelectedMarket] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // Crop ids differ per database — default to the first real crop from /crops
    Promise.all([api.get("/crops"), api.get("/markets")]).then(([c, m]) => {
      const cropList = c.data || [];
      const marketList = m.data || [];
      setCrops(cropList);
      setMarkets(marketList);
      if (cropList.length) setSelectedCrop(prev => prev || cropList[0].id);
      else { setError(true); setLoading(false); }
      if (marketList.length) setSelectedMarket(marketList[0].id);
    }).catch(() => { setError(true); setLoading(false); });
  }, [retry]);

  useEffect(() => {
    if (!selectedCrop) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      api.get(`/markets/prices?crop_id=${selectedCrop}${selectedMarket ? `&market_id=${selectedMarket}` : ""}`),
      api.get(`/markets/overview?crop_id=${selectedCrop}`),
    ]).then(([p, o]) => {
      if (cancelled) return;
      setPrices(p.data);
      setForecast(o.data?.forecast);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedCrop, selectedMarket, retry]);

  // Build map points from markets
  const mapPoints: MapPoint[] = markets
    .filter((m: any) => m.location_lat && m.location_lng)
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      lat: m.location_lat,
      lng: m.location_lng,
      type: "market" as const,
      detail: `${m.district}, ${m.state}`,
      badge: m.id === selectedMarket ? "Selected" : undefined,
    }));

  return (
    <div className="farmer-shell">
      <FarmerHeader />
      <div className="page-header">
        <button onClick={() => router.back()} aria-label="Go back"
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 12, margin: -4, minWidth: 44, minHeight: 44 }}>←</button>
        <h1 className="heading-md">{t("todays_prices")}</h1>
      </div>

      <div className="page-body">
      {/* Crop Tabs */}
      <div className="scroll-x section-gap">
        {crops.map(crop => (
          <button key={crop.id}
            className={`toggle-btn ${selectedCrop === crop.id ? "selected" : ""}`}
            onClick={() => setSelectedCrop(crop.id)}
            style={{ whiteSpace: "nowrap", flex: "none" }}>
            {cropEmoji(crop.name)} {crop.name}
          </button>
        ))}
      </div>

      {/* Market Selector */}
      {markets.length > 0 && (
        <select className="select section-gap" value={selectedMarket}
          onChange={e => setSelectedMarket(Number(e.target.value))}>
          {markets.map(m => <option key={m.id} value={m.id}>{m.name} ({m.district})</option>)}
        </select>
      )}

      {/* Map Toggle */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowMap(!showMap)}
          className="toggle-btn"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10, fontSize: 13,
          }}
        >
          🗺️ {showMap ? "Hide Map" : "Show Markets on Map"}
        </button>
      </div>

      {/* Map View */}
      {showMap && mapPoints.length > 0 && (
        <div className="section-gap">
          <MapView
            points={mapPoints}
            center={[19.75, 75.71]}
            zoom={7}
            height="280px"
            onPointClick={(p) => setSelectedMarket(p.id)}
          />
          <p className="text-xs" style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
            Tap a marker to select that market
          </p>
        </div>
      )}

      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 100 }} />
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <p style={{ fontSize: 30, margin: "0 0 6px 0" }}>⚠️</p>
          <p className="text-body" style={{ color: "var(--color-text-secondary)", margin: "0 0 14px 0" }}>
            Couldn't load market prices. Check your connection and try again.
          </p>
          <button className="btn-primary" onClick={() => setRetry(r => r + 1)}>
            ↻ Retry
          </button>
        </div>
      ) : prices ? (
        <>
          {/* Current Price Card */}
          <div className="card section-gap" style={{ textAlign: "center", padding: "20px 16px" }}>
            <p style={{ margin: 0, color: "var(--saffron-600)", fontSize: 12, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" }}>TODAY</p>
            <div className="price-big" style={{ margin: "6px 0 2px" }}>
              ₹{prices.prices?.modal_price?.toLocaleString("en-IN") || "---"}
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)" }}>
                {t("per_quintal")}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
              Range: ₹{prices.prices?.min_price?.toLocaleString("en-IN")} — ₹{prices.prices?.max_price?.toLocaleString("en-IN")}
            </p>
            <div className="data-source" style={{ marginTop: 8 }}>{prices.data_source_label}</div>
          </div>

          {/* Forecast */}
          {forecast && (
            <div className="card section-gap">
              <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "0 0 4px 0" }}>{t("forecast")} (7 days)</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span className="heading-lg" style={{ color: "#3b82f6" }}>
                  ₹{forecast.expected_low?.toLocaleString("en-IN") ?? "—"} — ₹{forecast.expected_high?.toLocaleString("en-IN") ?? "—"}
                </span>
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)", margin: "8px 0 0 0" }}>
                {t("confidence")}: {(forecast.confidence * 100).toFixed(0)}%
              </p>
              <p className="data-source">{forecast.explanation || forecast.source_label || ""}</p>
              <div style={{
                marginTop: 12, padding: 12, background: "#eff6ff", borderRadius: 10,
                borderLeft: "3px solid #3b82f6",
              }}>
                <p className="text-sm" style={{ fontWeight: 600, margin: 0, color: "#1e40af" }}>
                  📈 {(forecast.predicted_price || 0) > (prices.prices?.modal_price || 0)
                    ? "Price expected to rise"
                    : (forecast.predicted_price || 0) < (prices.prices?.modal_price || 0)
                      ? "Price expected to fall"
                      : "Price expected to stay stable"
                  }
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                  {(forecast.predicted_price || 0) > (prices.prices?.modal_price || 0)
                    ? t("store_and_sell")
                    : (forecast.predicted_price || 0) < (prices.prices?.modal_price || 0)
                      ? t("sell_now")
                      : t("sell_now")
                  }
                </p>
              </div>
            </div>
          )}

          {/* Price Details */}
          <div className="card section-gap">
            <h3 className="heading-sm mb-2">Details</h3>
            <div className="flex-col gap-2">
              {[
                ["Modal Price", `₹${prices.prices?.modal_price?.toLocaleString("en-IN")}`],
                ["Minimum", `₹${prices.prices?.min_price?.toLocaleString("en-IN")}`],
                ["Maximum", `₹${prices.prices?.max_price?.toLocaleString("en-IN")}`],
                ["Arrivals", `${prices.prices?.arrivals_qty?.toFixed(0) || "---"} q`],
                ["Market", prices.market],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                  <span className="text-sm" style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={() => router.push("/farmer/sell")}>
            🧠 Smart Sell Recommendation
          </button>
          <p className="text-xs" style={{ textAlign: "center", color: "var(--text-secondary)", margin: "8px 0 0" }}>
            Answer a few quick questions and get a personalised recommendation on where and how to sell.
          </p>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 30, margin: "0 0 6px 0" }}>📭</p>
          <p className="text-body" style={{ color: "var(--color-text-secondary)", margin: 0 }}>
            No market price data available for this crop yet.
          </p>
        </div>
      )}

      </div>

      <FarmerBottomNav />
    </div>
  );
}
