import { useEffect, useMemo, useRef, useState } from 'react';
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

function createOfficialIcon(title: string): L.DivIcon {
  return L.divIcon({
    className: 'official-marker-icon',
    html: `<div style="position:relative;width:12px;height:12px">
      <svg width="12" height="12" viewBox="0 0 12 12" style="display:block;overflow:visible">
        <polygon points="6,0 12,6 6,12 0,6" fill="#f97316" stroke="white" stroke-width="1.5"/>
      </svg>
      <span style="position:absolute;top:14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:var(--text-xs);font-weight:700;color:#f97316;font-family:system-ui,sans-serif;letter-spacing:0.02em;text-shadow:0 1px 0 white,0 -1px 0 white,1px 0 0 white,-1px 0 0 white,0 0 5px rgba(255,255,255,0.9)">${title}</span>
    </div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

const spectatorIcon = L.divIcon({
  className: '',
  html: `<div style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.4))">
    <svg width="26" height="18" viewBox="0 0 26 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="8" height="8" rx="2" fill="#a855f7" stroke="white" stroke-width="1.3"/>
      <rect x="17" y="1" width="8" height="8" rx="2" fill="#a855f7" stroke="white" stroke-width="1.3"/>
      <rect x="8.6" y="3" width="8.8" height="4.5" fill="#a855f7"/>
      <line x1="9" y1="3" x2="17" y2="3" stroke="white" stroke-width="1.3"/>
      <line x1="9" y1="7.5" x2="17" y2="7.5" stroke="white" stroke-width="1.3"/>
      <circle cx="5" cy="13.5" r="4" fill="#a855f7" stroke="white" stroke-width="1.5"/>
      <circle cx="21" cy="13.5" r="4" fill="#a855f7" stroke="white" stroke-width="1.5"/>
      <circle cx="3.8" cy="12.3" r="1.4" fill="white" opacity="0.3"/>
      <circle cx="19.8" cy="12.3" r="1.4" fill="white" opacity="0.3"/>
    </svg>
  </div>`,
  iconSize: [26, 18],
  iconAnchor: [13, 18],
  popupAnchor: [0, -20],
});

/**
 * Letter marker icon.
 * - greyed: excluded from plan → slate colour
 * - clockTime: shown below the circle when spot is included and start time is set
 */
function createLetterIcon(letter: string, glowing = false, greyed = false, clockTime?: string): L.DivIcon {
  const size = glowing ? 28 : 20;
  const half = size / 2;
  const lineHeight = size - 4;
  const bg = greyed ? '#94a3b8' : '#a855f7';
  const shadow = glowing
    ? '0 0 0 5px rgba(168,85,247,0.4),0 0 18px 6px rgba(168,85,247,0.55)'
    : '0 1px 4px rgba(0,0,0,0.4)';
  const fontSize = glowing ? 'var(--text-sm)' : 'var(--text-xs)';
  const timeLabel = clockTime
    ? `<span style="position:absolute;top:${size + 3}px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;color:#ea580c;font-family:system-ui,sans-serif;text-shadow:0 1px 0 white,0 -1px 0 white,1px 0 0 white,-1px 0 0 white">${clockTime}</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;overflow:visible"><div style="width:${size}px;height:${size}px;background:${bg};border:2px solid #fff;border-radius:50%;box-shadow:${shadow};color:white;font-size:${fontSize};font-weight:700;font-family:system-ui,sans-serif;text-align:center;line-height:${lineHeight}px">${letter}</div>${timeLabel}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -(half + 2)],
  });
}

const ZOOM_THRESHOLD = 14;

function buildMarkerPopupHtml(
  marker: CourseMarker,
  pred?: { elapsed: string; clock: string },
): string {
  const predHtml = pred
    ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0">
        <div style="font-size:var(--text-xs);color:#64748b;letter-spacing:0.04em;text-transform:uppercase;font-weight:600;margin-bottom:3px">Predicted arrival</div>
        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:var(--text-md);font-weight:700;color:#ea580c">${pred.clock}</span>
          <span style="font-size:var(--text-xs);color:#94a3b8;font-family:monospace">${pred.elapsed}</span>
        </div>
      </div>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;min-width:160px;color:#0f172a">
    <div style="font-size:var(--text-sm);font-weight:700">${marker.title}</div>
    ${marker.description ? `<div style="font-size:var(--text-xs);color:#64748b;margin-top:2px;letter-spacing:0.02em">${marker.description}</div>` : ''}
    ${predHtml}
  </div>`;
}

interface Props {
  gpxPoints: GpxPoint[];
  markers: CourseMarker[];
  spectatorPredictions?: SpotPrediction[];
  displayUnit?: 'km' | 'mi';
  markerPredictions?: Record<string, { elapsed: string; clock: string }>;
  /** Tile-interaction state — owned by App, passed down for icon effects */
  selectedSpotId: string | null;
  hoveredSpotId: string | null;
  includedSpotIds: Set<string>;
  onSpotSelect: (id: string | null) => void;
}

export default function CourseMap({
  gpxPoints,
  markers,
  spectatorPredictions = [],
  displayUnit = 'km',
  markerPredictions = {},
  selectedSpotId,
  hoveredSpotId,
  includedSpotIds,
  onSpotSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<Map<string, L.Marker>>(new Map());
  const spectatorLayersRef = useRef<Map<string, L.Marker>>(new Map());

  const [zoom, setZoom] = useState(13);

  // Refs to avoid stale closures in Leaflet event handlers
  const selectedSpotIdRef = useRef<string | null>(selectedSpotId);
  const onSpotSelectRef = useRef(onSpotSelect);
  useEffect(() => { selectedSpotIdRef.current = selectedSpotId; }, [selectedSpotId]);
  useEffect(() => { onSpotSelectRef.current = onSpotSelect; }, [onSpotSelect]);

  // Spots sorted by course distance — defines lettering A, B, C…
  const sortedSpots = useMemo(
    () => [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm),
    [spectatorPredictions],
  );

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [51.5, -0.08],
      zoom: 13,
      zoomControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topleft' }).addTo(map);

    mapRef.current = map;

    const onViewChange = () => setZoom(map.getZoom());
    map.on('zoomend', onViewChange);
    map.on('moveend', onViewChange);

    return () => {
      map.off('zoomend', onViewChange);
      map.off('moveend', onViewChange);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Toggle CSS class to hide permanent tooltips when zoomed out
  useEffect(() => {
    containerRef.current?.classList.toggle('zoomed-out', zoom < ZOOM_THRESHOLD);
  }, [zoom]);

  // Swap icons: zoomed-out → lettered (glow on hover/select, grey when excluded,
  // clock time shown on map when included); zoomed-in → binoculars
  useEffect(() => {
    if (zoom < ZOOM_THRESHOLD) {
      sortedSpots.forEach((spot, i) => {
        const layer = spectatorLayersRef.current.get(spot.id);
        if (!layer) return;
        const letter = String.fromCharCode(65 + i);
        const active = hoveredSpotId === spot.id || selectedSpotId === spot.id;
        const included = includedSpotIds.has(spot.id);
        const clockTime = included ? (spot.clockTime ?? undefined) : undefined;
        layer.setIcon(createLetterIcon(letter, active, !included, clockTime));
      });
    } else {
      for (const [, layer] of spectatorLayersRef.current) {
        layer.setIcon(spectatorIcon);
      }
    }
  }, [zoom, sortedSpots, hoveredSpotId, selectedSpotId, includedSpotIds]);

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

  // Draw course markers (re-runs when predictions change to update popup content)
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
      const pred = markerPredictions[marker.id];
      const popupHtml = buildMarkerPopupHtml(marker, pred);
      const existing = markerLayersRef.current.get(marker.id);
      if (existing) {
        existing.setPopupContent(popupHtml);
      } else {
        const layer = L.marker([marker.lat, marker.lng], { icon: createOfficialIcon(marker.title) })
          .bindPopup(popupHtml, { maxWidth: 280 })
          .addTo(map);
        markerLayersRef.current.set(marker.id, layer);
      }
    }
  }, [markers, markerPredictions]);

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

    const letterMap = new Map(
      [...spectatorPredictions]
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map((spot, i) => [spot.id, String.fromCharCode(65 + i)])
    );

    for (const spot of spectatorPredictions) {
      const letter = letterMap.get(spot.id) ?? '';
      const existing = spectatorLayersRef.current.get(spot.id);

      if (existing) {
        existing.setTooltipContent(`${letter} · ${spot.name} · ${displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`}`);
      } else {
        const distLabel = displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`;
        const layer = L.marker([spot.lat, spot.lng], { icon: spectatorIcon })
          .bindTooltip(`${letter} · ${spot.name} · ${distLabel}`, {
            permanent: true, direction: 'right', className: 'spectator-label', offset: [8, 0],
          })
          .addTo(map);
        layer.on('click', () => {
          const curr = selectedSpotIdRef.current;
          onSpotSelectRef.current(curr === spot.id ? null : spot.id);
        });
        spectatorLayersRef.current.set(spot.id, layer);
      }
    }
  }, [spectatorPredictions, displayUnit]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div ref={containerRef} style={{ height: '100%' }} />

      {/* Zoomed-in: small legend pill */}
      {zoom >= ZOOM_THRESHOLD && (
        <div style={{ position: 'absolute', bottom: 28, left: 8, zIndex: 900, pointerEvents: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 'var(--text-xs)', fontWeight: 600, color: '#7c3aed', letterSpacing: '0.02em',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7', flexShrink: 0 }} />
            Viewing spots
          </span>
        </div>
      )}
    </div>
  );
}
