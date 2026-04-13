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

function createLetterIcon(letter: string, glowing = false): L.DivIcon {
  const size = glowing ? 28 : 20;
  const half = size / 2;
  const lineHeight = size - 4;
  const shadow = glowing
    ? '0 0 0 5px rgba(168,85,247,0.4),0 0 18px 6px rgba(168,85,247,0.55)'
    : '0 1px 4px rgba(0,0,0,0.4)';
  const fontSize = glowing ? 'var(--text-sm)' : 'var(--text-xs)';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:#a855f7;border:2px solid #fff;border-radius:50%;box-shadow:${shadow};color:white;font-size:${fontSize};font-weight:700;font-family:system-ui,sans-serif;text-align:center;line-height:${lineHeight}px">${letter}</div>`,
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
  positionKm?: number | null;
  spectatorPredictions?: SpotPrediction[];
  displayUnit?: 'km' | 'mi';
  markerPredictions?: Record<string, { elapsed: string; clock: string }>;
}

export default function CourseMap({ gpxPoints, markers, positionKm, spectatorPredictions = [], displayUnit = 'km', markerPredictions = {} }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<Map<string, L.Marker>>(new Map());
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);
  const spectatorLayersRef = useRef<Map<string, L.Marker>>(new Map());

  const cardRowRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(13);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  // Spots sorted by course distance — defines numbering 1–N
  const sortedSpots = [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm);

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

  // Swap icons: zoomed-out → lettered (glow on hover/select); zoomed-in → binoculars
  useEffect(() => {
    const sorted = [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm);
    if (zoom < ZOOM_THRESHOLD) {
      sorted.forEach((spot, i) => {
        const layer = spectatorLayersRef.current.get(spot.id);
        if (!layer) return;
        const letter = String.fromCharCode(65 + i);
        const active = hoveredSpotId === spot.id || selectedSpotId === spot.id;
        layer.setIcon(active ? createLetterIcon(letter, true) : createLetterIcon(letter));
      });
    } else {
      for (const [, layer] of spectatorLayersRef.current) {
        layer.setIcon(spectatorIcon);
      }
    }
  }, [zoom, spectatorPredictions, hoveredSpotId, selectedSpotId]);

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

  // Scroll selected tile into view when selected via map click
  useEffect(() => {
    if (!selectedSpotId) return;
    const el = document.querySelector(`[data-spot-id="${selectedSpotId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedSpotId]);

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
        existing.setTooltipContent(`${letter} · ${spot.name} · ${displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`}`);
      } else {
        const distLabel = displayUnit === 'mi' ? `Mile ${spot.distanceMile}` : `${spot.distanceKm} km`;
        const layer = L.marker([spot.lat, spot.lng], { icon: spectatorIcon })
          .bindTooltip(`${letter} · ${spot.name} · ${distLabel}`, { permanent: true, direction: 'right', className: 'spectator-label', offset: [8, 0] })
          .addTo(map);
        layer.on('click', () => setSelectedSpotId(prev => prev === spot.id ? null : spot.id));
        spectatorLayersRef.current.set(spot.id, layer);
      }
    }
  }, [spectatorPredictions, displayUnit]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div ref={containerRef} style={{ height: '100%' }} />

      {/* Zoomed-out: card row pinned to bottom, cards expand upward on hover/click */}
      {zoom < ZOOM_THRESHOLD && sortedSpots.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 900 }}>
          <div style={{ position: 'relative', padding: '0 8px 8px 8px' }}>

            {/* Right-fade gradient + scroll arrow — anchored to bottom */}
            {sortedSpots.length > 4 && (
              <>
                <div style={{
                  position: 'absolute', right: 8, bottom: 8, width: 72, height: 60,
                  background: 'linear-gradient(to right, transparent, rgba(241,245,249,0.95))',
                  pointerEvents: 'none', zIndex: 2,
                }} />
                <button
                  onClick={() => cardRowRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
                  style={{
                    position: 'absolute', right: 14, bottom: 16,
                    zIndex: 3, width: 32, height: 32, borderRadius: '50%',
                    background: 'white', border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#7c3aed',
                  }}
                  title="Scroll right"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </>
            )}

            {/* Scrollable cards — align-items: flex-end makes cards grow upward */}
            <div
              ref={cardRowRef}
              className="spectator-key-panel"
              style={{
                display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 6,
                overflowX: 'auto', scrollbarWidth: 'none',
                paddingRight: sortedSpots.length > 4 ? 52 : 0,
              }}
            >
              {sortedSpots.map((spot, i) => {
                const isActive = hoveredSpotId === spot.id || selectedSpotId === spot.id;
                const isSelected = selectedSpotId === spot.id;
                const letter = String.fromCharCode(65 + i);
                const distLabel = displayUnit === 'mi' ? `Mi ${spot.distanceMile}` : `${spot.distanceKm} km`;
                return (
                  <div
                    key={spot.id}
                    data-spot-id={spot.id}
                    onMouseEnter={() => setHoveredSpotId(spot.id)}
                    onMouseLeave={() => setHoveredSpotId(null)}
                    onClick={() => setSelectedSpotId(prev => prev === spot.id ? null : spot.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 5,
                      background: isSelected ? 'rgba(245,240,255,0.98)' : isActive ? 'rgba(250,247,255,0.97)' : 'rgba(255,255,255,0.93)',
                      border: isSelected ? '1.5px solid #a855f7' : isActive ? '1px solid #c084fc' : '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: isActive ? '8px 10px 8px 8px' : '6px 10px 6px 7px',
                      boxShadow: isSelected ? '0 4px 16px rgba(168,85,247,0.28)' : isActive ? '0 2px 10px rgba(168,85,247,0.18)' : '0 1px 3px rgba(0,0,0,0.08)',
                      width: 176, flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s, padding 0.18s',
                    }}
                  >
                    {/* Compact row — always visible */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: isActive ? '#9333ea' : '#a855f7',
                        color: 'white', fontSize: 'var(--text-xs)', fontWeight: 700,
                        fontFamily: 'system-ui,sans-serif',
                        textAlign: 'center', lineHeight: '20px', flexShrink: 0,
                      }}>{letter}</span>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {spot.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', letterSpacing: '0.02em' }}>{distLabel}</span>
                          {spot.clockTime && (
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#ea580c' }}>{spot.clockTime}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content — grows upward via align-items: flex-end on parent */}
                    {isActive && (
                      <>
                        {spot.description && (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#64748b', lineHeight: 1.45, letterSpacing: '0.02em', paddingLeft: 27 }}>
                            {spot.description}
                          </div>
                        )}
                        {spot.nearestStations.length > 0 && (
                          <div style={{ paddingLeft: 27 }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: '#ea580c', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
                              Nearest stations
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {spot.nearestStations.map(s => (
                                <span key={s} style={{
                                  background: '#f1f5f9', border: '1px solid #e2e8f0',
                                  borderRadius: 5, padding: '1px 6px',
                                  fontSize: 'var(--text-xs)', color: '#334155', letterSpacing: '0.02em',
                                }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {spot.crowdNotes && (
                          <div style={{
                            paddingLeft: 27, borderTop: '1px solid #e2e8f0', paddingTop: 5,
                            fontSize: 'var(--text-xs)', color: '#64748b', lineHeight: 1.45, letterSpacing: '0.02em',
                          }}>
                            {spot.crowdNotes}
                          </div>
                        )}
                        <div style={{ paddingLeft: 27, fontSize: 'var(--text-xs)', color: '#c4b5fd' }}>
                          {isSelected ? 'Click to close' : 'Click to pin open'}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
