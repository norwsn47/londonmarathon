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

function createLetterIcon(letter: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;background:#a855f7;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);color:white;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;text-align:center;line-height:16px">${letter}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

function createLetterIconGlowing(letter: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:#a855f7;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 5px rgba(168,85,247,0.4),0 0 18px 6px rgba(168,85,247,0.55);color:white;font-size:12px;font-weight:700;font-family:system-ui,sans-serif;text-align:center;line-height:24px">${letter}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function fullPopup(spot: SpotPrediction, unit: 'km' | 'mi'): string {
  const distLabel = unit === 'mi'
    ? `Mile ${spot.distanceMile}`
    : `${spot.distanceKm} km`;
  const timeHtml = spot.clockTime
    ? `<div style="font-size:15px;font-weight:bold;color:#ea580c;margin:4px 0">🕐 ${spot.clockTime}</div>`
    : '';
  const stationsHtml = spot.nearestStations
    .map(s => `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 5px;margin:2px 2px 0 0;font-size:10px;color:#334155">${s}</span>`)
    .join('');
  return `<div style="font-family:system-ui,sans-serif;min-width:200px;max-width:240px;color:#0f172a">
    <div style="font-size:13px;font-weight:700;margin-bottom:2px">${spot.name}</div>
    <div style="font-size:10px;color:#64748b;margin-bottom:4px">${distLabel}</div>
    ${timeHtml}
    <div style="font-size:11px;color:#334155;margin-bottom:6px">${spot.description}</div>
    <div style="font-size:10px;color:#ea580c;font-weight:600;margin-bottom:2px">Nearest stations</div>
    <div style="margin-bottom:6px">${stationsHtml}</div>
    <div style="font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:4px">${spot.crowdNotes}</div>
  </div>`;
}

const ZOOM_THRESHOLD = 14;

interface Props {
  gpxPoints: GpxPoint[];
  markers: CourseMarker[];
  positionKm?: number | null;
  spectatorPredictions?: SpotPrediction[];
  displayUnit?: 'km' | 'mi';
}

export default function CourseMap({ gpxPoints, markers, positionKm, spectatorPredictions = [], displayUnit = 'km' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<Map<string, L.Marker>>(new Map());
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);
  const spectatorLayersRef = useRef<Map<string, L.Marker>>(new Map());

  const [zoom, setZoom] = useState(13);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);

  // Spots sorted by course distance — defines numbering 1–N
  const sortedSpots = [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [51.5, -0.08],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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

  // Swap icons: zoomed-out → lettered (glow on hover); zoomed-in → binoculars
  useEffect(() => {
    const sorted = [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm);
    if (zoom < ZOOM_THRESHOLD) {
      sorted.forEach((spot, i) => {
        const layer = spectatorLayersRef.current.get(spot.id);
        if (!layer) return;
        const letter = String.fromCharCode(65 + i);
        layer.setIcon(hoveredSpotId === spot.id ? createLetterIconGlowing(letter) : createLetterIcon(letter));
      });
    } else {
      for (const [, layer] of spectatorLayersRef.current) {
        layer.closePopup();
        layer.setIcon(spectatorIcon);
      }
    }
  }, [zoom, spectatorPredictions, hoveredSpotId]);

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

    // Letter assigned by course-distance order (A = earliest)
    const letterMap = new Map(
      [...spectatorPredictions]
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map((spot, i) => [spot.id, String.fromCharCode(65 + i)])
    );

    for (const spot of spectatorPredictions) {
      const letter = letterMap.get(spot.id) ?? '';
      const existing = spectatorLayersRef.current.get(spot.id);

      if (existing) {
        existing.setPopupContent(fullPopup(spot, displayUnit));
        existing.setTooltipContent(`${letter} · ${spot.name} · ${displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`}`);
      } else {
        const distLabel = displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`;
        const layer = L.marker([spot.lat, spot.lng], { icon: spectatorIcon })
          .bindPopup(fullPopup(spot, displayUnit), { maxWidth: 260 })
          .bindTooltip(`${letter} · ${spot.name} · ${distLabel}`, { permanent: true, direction: 'right', className: 'spectator-label', offset: [8, 0] })
          .addTo(map);
        spectatorLayersRef.current.set(spot.id, layer);
      }
    }
  }, [spectatorPredictions, displayUnit]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div ref={containerRef} style={{ height: '100%' }} />

      {/* Zoomed-out: numbered key panel along the left edge */}
      {zoom < ZOOM_THRESHOLD && sortedSpots.length > 0 && (
        <div style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 900,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {sortedSpots.map((spot, i) => (
            <div
              key={spot.id}
              onMouseEnter={() => setHoveredSpotId(spot.id)}
              onMouseLeave={() => setHoveredSpotId(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                background: hoveredSpotId === spot.id ? 'rgba(245,240,255,0.97)' : 'rgba(255,255,255,0.93)',
                border: hoveredSpotId === spot.id ? '1px solid #a855f7' : '1px solid #e2e8f0',
                borderRadius: 7,
                padding: '5px 10px 5px 6px',
                boxShadow: hoveredSpotId === spot.id ? '0 2px 8px rgba(168,85,247,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
                maxWidth: 250,
                pointerEvents: 'auto',
                cursor: 'default',
                transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
              }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                {/* Letter badge */}
                <span style={{
                  width: 19, height: 19, borderRadius: '50%',
                  background: '#a855f7', color: 'white',
                  fontSize: 11, fontWeight: 700,
                  fontFamily: 'system-ui,sans-serif',
                  textAlign: 'center', lineHeight: '19px',
                  flexShrink: 0,
                }}>{String.fromCharCode(65 + i)}</span>
                {/* Name */}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {spot.name}
                </span>
                {/* Distance marker */}
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                  {displayUnit === 'mi' ? `Mi ${spot.distanceMile}` : `${spot.distanceKm} km`}
                </span>
                {/* Predicted time */}
                {spot.clockTime && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c', flexShrink: 0 }}>{spot.clockTime}</span>
                )}
              </div>
              {/* Description */}
              {spot.description && (
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.35, whiteSpace: 'normal', paddingLeft: 26 }}>
                  {spot.description.length > 80 ? spot.description.slice(0, 77) + '…' : spot.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zoomed-in: small legend pill */}
      {zoom >= ZOOM_THRESHOLD && (
        <div style={{ position: 'absolute', bottom: 28, left: 8, zIndex: 900, pointerEvents: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.92)', border: '1px solid #e2e8f0',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 10, fontWeight: 600, color: '#7c3aed',
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
