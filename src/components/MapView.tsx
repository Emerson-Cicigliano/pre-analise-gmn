"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  color: string;
  title: string;
  target?: boolean;
};

export default function MapView({ center, markers, height = 380 }: { center: LatLng; markers: MapMarker[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView([center.latitude, center.longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const mk of markers) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="mk${mk.target ? " mk-target" : ""}" style="background:${mk.color}">${mk.label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([mk.lat, mk.lng], { icon, zIndexOffset: mk.target ? 1000 : 0 })
        .bindTooltip(mk.title)
        .addTo(group);
      bounds.push([mk.lat, mk.lng]);
    }
    if (bounds.length > 1) m.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  }, [markers]);

  return <div ref={el} className="map" style={{ height }} />;
}
