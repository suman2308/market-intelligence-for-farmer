"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);

export interface MapPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: "market" | "buyer" | "farmer" | "storage" | "lot";
  detail?: string;
  badge?: string;
  color?: string;
}

interface MapViewProps {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
  onPointClick?: (point: MapPoint) => void;
}

function getMarkerIcon(type: string, color?: string) {
  if (typeof window === "undefined") return undefined;
  const L = require("leaflet");

  const colors: Record<string, string> = {
    market: "#2d6a4f",
    buyer: "#b07d3b",
    farmer: "#4a7c59",
    storage: "#6c757d",
    lot: "#c95d3e",
  };

  const icons: Record<string, string> = {
    market: "🏪",
    buyer: "🏭",
    farmer: "👨‍🌾",
    storage: "📦",
    lot: "🌾",
  };

  const c = color || colors[type] || "#2d6a4f";
  const emoji = icons[type] || "📍";

  return L.divIcon({
    html: `<div style="
      background:${c};
      width:32px; height:32px;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:16px;
      border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export default function MapView({
  points,
  center,
  zoom = 10,
  height = "300px",
  className = "",
  onPointClick,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fix Leaflet default icon paths
    if (typeof window !== "undefined") {
      const L = require("leaflet");
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
    }
  }, []);

  if (!mounted) {
    return (
      <div
        className={className}
        style={{
          height,
          background: "var(--color-card)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border)",
        }}
      >
        Loading map...
      </div>
    );
  }

  // Calculate center from points if not provided
  const mapCenter: [number, number] =
    center ||
    (points.length > 0
      ? [
          points.reduce((s, p) => s + p.lat, 0) / points.length,
          points.reduce((s, p) => s + p.lng, 0) / points.length,
        ]
      : [19.75, 75.71]); // Maharashtra center

  return (
    <div className={className} style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={getMarkerIcon(point.type, point.color)}
            eventHandlers={{
              click: () => onPointClick?.(point),
            }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <strong style={{ fontSize: 14 }}>{point.name}</strong>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {point.type.charAt(0).toUpperCase() + point.type.slice(1)}
                </div>
                {point.detail && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>{point.detail}</div>
                )}
                {point.badge && (
                  <div
                    style={{
                      display: "inline-block",
                      background: "var(--color-primary, #2d6a4f)",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {point.badge}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
