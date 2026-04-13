import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GpxPoint } from '../lib/gpxParser';
import type { CourseMarker } from '../lib/types';
import type { SpotPrediction } from '../lib/spectatorSpots';

// Fix Leaflet's default icon path issue with Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const officialDot = L.divIcon({
  className: '',
  html: '<div style="width:10px;height:10px;background:#f97316;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -8],
});

// Binoculars icon for spectator viewing spots
const spectatorIcon = L.divIcon({
  className: '',
  html: `<div style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.4))">
    <svg width="26" height="18" viewBox="0 0 26 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Left barrel -->
      <rect x="1" y="1" width="8" height="8" rx="2" fill="#a855f7" stroke="white" stroke-width="1.3"/>
      <!-- Right barrel -->
      <rect x="17" y="1" width="8" height="8" rx="2" fill="#a855f7" stroke="white" stroke-width="1.3"/>
      <!-- Bridge fills gap -->
      <rect x="8.6" y="3" width="8.8" height="4.5" fill="#a855f7"/>
      <!-- Bridge top/bottom lines -->
      <line x1="9" y1="3" x2="17" y2="3" stroke="white" stroke-width="1.3"/>
      <line x1="9" y1="7.5" x2="17" y2="7.5" stroke="white" stroke-width="1.3"/>
      <!-- Left objective lens -->
      <circle cx="5" cy="13.5" r="4" fill="#a855f7" stroke="white" stroke-width="1.5"/>
      <!-- Right objective lens -->
      <circle cx="21" cy="13.5" r="4" fill="#a855f7" stroke="white" stroke-width="1.5"/>
      <!-- Lens glare left -->
      <circle cx="3.8" cy="12.3" r="1.4" fill="white" opacity="0.3"/>
      <!-- Lens glare right -->
      <circle cx="19.8" cy="12.3" r="1.4" fill="white" opacity="0.3"/>
    </svg>
  </div>`,
  iconSize: [26, 18],
  iconAnchor: [13, 18],
  popupAnchor: [0, -20],
});

// Below this zoom level, switch to side-panel label mode
const ZOOM_THRESHOLD = 14;
const LABEL_H = 22;
const LABEL_GAP = 5;
const PANEL_RIGHT = 10;
const PANEL_W = 168;
const MAP_H = 420;

interface Props {
  gpxPoints: GpxPoint[];
  markers: CourseMarker[];
  positionKm?: number | null;
  spectatorPredictions?: SpotPrediction[];
}

export default function CourseMap({ gpxPoints, markers, positionKm, spectatorPredictions = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<Map<string, L.Marker>>(new Map());
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);
  const spectatorLayersRef = useRef<Map<string, L.Marker>>(new Map());

  const [zoom, setZoom] = useState(13);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [51.5, -0.08], // London
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Track zoom/move so overlay recalculates
    const onViewChange = () => setZoom(map.getZoom());
    map.on('zoomend moveend', onViewChange);

    return () => {
      map.off('zoomend moveend', onViewChange);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Toggle CSS class to hide permanent tooltips in zoomed-out panel mode
  useEffect(() => {
    containerRef.current?.classList.toggle('zoomed-out', zoom < ZOOM_THRESHOLD);
  }, [zoom]);

  // Draw GPX route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (!gpxPoints.length) return;

    const latlngs = gpxPoints.map(p => [p.lat, p.lng] as [number, number]);
    const polyline = L.polyline(latlngs, {
      color: '#f97316',
      weight: 3,
      opacity: 0.85,
    }).addTo(map);

    routeLayerRef.current = polyline;
    map.fitBounds(polyline.getBounds(), { padding: [32, 32] });
  }, [gpxPoints]);

  // Draw course markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [id, layer] of markerLayersRef.current) {
      if (!markers.find(m => m.id === id)) {
        layer.remove();
        markerLayersRef.current.delete(id);
      }
    }

    for (const marker of markers) {
      if (markerLayersRef.current.has(marker.id)) continue;
      const popupHtml = `<div style="font-family:system-ui,sans-serif;min-width:140px;color:#0f172a">
        <div style="font-size:13px;font-weight:700">${marker.title}</div>
        ${marker.description ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${marker.description}</div>` : ''}
      </div>`;
      const layer = L.marker([marker.lat, marker.lng], { icon: officialDot })
        .bindPopup(popupHtml, { maxWidth: 260 })
        .bindTooltip(marker.title, { permanent: true, direction: 'right', className: 'spectator-label', offset: [8, 0] })
        .addTo(map);
      markerLayersRef.current.set(marker.id, layer);
    }
  }, [markers]);

  // Draw runner position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (positionMarkerRef.current) {
      positionMarkerRef.current.remove();
      positionMarkerRef.current = null;
    }

    if (positionKm == null || !gpxPoints.length) return;

    let closest = gpxPoints[0];
    let minDiff = Math.abs(gpxPoints[0].distKm - positionKm);
    for (const pt of gpxPoints) {
      const diff = Math.abs(pt.distKm - positionKm);
      if (diff < minDiff) { minDiff = diff; closest = pt; }
    }

    positionMarkerRef.current = L.circleMarker([closest.lat, closest.lng], {
      radius: 8,
      color: '#4ade80',
      fillColor: '#4ade80',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(`📍 ${positionKm.toFixed(1)} km`)
      .addTo(map);
  }, [positionKm, gpxPoints]);

  // Draw spectator viewing spots
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const [id, layer] of spectatorLayersRef.current) {
      if (!spectatorPredictions.find(s => s.id === id)) {
        layer.remove();
        spectatorLayersRef.current.delete(id);
      }
    }

    for (const spot of spectatorPredictions) {
      const existing = spectatorLayersRef.current.get(spot.id);

      const timeHtml = spot.clockTime
        ? `<div style="font-size:15px;font-weight:bold;color:#ea580c;margin:4px 0">🕐 ${spot.clockTime}</div>`
        : '';
      const stationsHtml = spot.nearestStations
        .map(s => `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 5px;margin:2px 2px 0 0;font-size:10px;color:#334155">${s}</span>`)
        .join('');
      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:200px;max-width:240px;color:#0f172a">
          <div style="font-size:13px;font-weight:700;margin-bottom:2px">${spot.name}</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:4px">
            Mile ${spot.distanceMile} · ${spot.distanceKm} km
          </div>
          ${timeHtml}
          <div style="font-size:11px;color:#334155;margin-bottom:6px">${spot.description}</div>
          <div style="font-size:10px;color:#ea580c;font-weight:600;margin-bottom:2px">Nearest stations</div>
          <div style="margin-bottom:6px">${stationsHtml}</div>
          <div style="font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:4px">${spot.crowdNotes}</div>
        </div>`;

      if (existing) {
        existing.setPopupContent(popupHtml);
      } else {
        const layer = L.marker([spot.lat, spot.lng], { icon: spectatorIcon })
          .bindPopup(popupHtml, { maxWidth: 260 })
          .bindTooltip(`${spot.name} · Mile ${spot.distanceMile}`, { permanent: true, direction: 'right', className: 'spectator-label', offset: [8, 0] })
          .addTo(map);
        spectatorLayersRef.current.set(spot.id, layer);
      }
    }
  }, [spectatorPredictions]);

  // --- Compute side-panel overlay items when zoomed out ---
  const isZoomedOut = zoom < ZOOM_THRESHOLD;

  type OverlayItem = { spot: SpotPrediction; px: number; py: number; labelY: number };
  let overlayItems: OverlayItem[] = [];
  let panelLeft = 0;

  if (isZoomedOut && mapRef.current && spectatorPredictions.length > 0) {
    const map = mapRef.current;
    const containerW = wrapperRef.current?.offsetWidth ?? 600;
    panelLeft = containerW - PANEL_W - PANEL_RIGHT;

    const withPixels = spectatorPredictions
      .map(spot => {
        const pt = map.latLngToContainerPoint([spot.lat, spot.lng]);
        return { spot, px: Math.round(pt.x), py: Math.round(pt.y) };
      })
      .sort((a, b) => a.py - b.py); // top-to-bottom on map → no label crossing

    const totalH = withPixels.length * LABEL_H + (withPixels.length - 1) * LABEL_GAP;
    const panelTop = Math.max(8, (MAP_H - totalH) / 2);

    overlayItems = withPixels.map((item, i) => ({
      ...item,
      labelY: panelTop + i * (LABEL_H + LABEL_GAP),
    }));
  }

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Course Map</p>
          <span className="flex items-center gap-1 text-[10px] text-purple-400 font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 border border-white/30" />
            Viewing spots
          </span>
        </div>
      </div>

      <div ref={wrapperRef} className="relative" style={{ height: MAP_H }}>
        <div ref={containerRef} style={{ height: '100%' }} />

        {/* Zoomed-out: side panel with leader lines */}
        {isZoomedOut && overlayItems.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 900, overflow: 'hidden' }}>
            {/* SVG leader lines */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {overlayItems.map(item => {
                const labelMidY = item.labelY + LABEL_H / 2;
                return (
                  <g key={item.spot.id}>
                    <circle cx={item.px} cy={item.py} r="3.5" fill="#a855f7" opacity="0.85" />
                    <line
                      x1={item.px} y1={item.py}
                      x2={panelLeft} y2={labelMidY}
                      stroke="#a855f7" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Stacked label panel */}
            <div style={{
              position: 'absolute',
              right: PANEL_RIGHT,
              top: overlayItems[0].labelY,
              display: 'flex',
              flexDirection: 'column',
              gap: LABEL_GAP,
            }}>
              {overlayItems.map(item => (
                <div key={item.spot.id} style={{
                  height: LABEL_H,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(255,255,255,0.93)',
                  border: '1px solid #e2e8f0',
                  borderRadius: 5,
                  padding: '0 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#334155',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  width: PANEL_W - 2,
                }}>
                  <span style={{ color: '#9333ea', fontWeight: 700, flexShrink: 0 }}>M{item.spot.distanceMile}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{item.spot.name}</span>
                  {item.spot.clockTime && (
                    <span style={{ color: '#ea580c', flexShrink: 0 }}>{item.spot.clockTime}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
