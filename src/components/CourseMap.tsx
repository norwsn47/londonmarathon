import { useEffect, useRef } from 'react';
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

const officialIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'marker-official',
});

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'marker-user',
});

// Purple circle icon for spectator viewing spots
const spectatorIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#a855f7;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -10],
});

interface Props {
  gpxPoints: GpxPoint[];
  markers: CourseMarker[];
  positionKm?: number | null; // current runner position on course
  onMapClick?: (lat: number, lng: number) => void;
  canAddMarkers: boolean;
  spectatorPredictions?: SpotPrediction[];
}

export default function CourseMap({ gpxPoints, markers, positionKm, onMapClick, canAddMarkers, spectatorPredictions = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markerLayersRef = useRef<Map<string, L.Marker>>(new Map());
  const positionMarkerRef = useRef<L.CircleMarker | null>(null);
  const spectatorLayersRef = useRef<Map<string, L.Marker>>(new Map());

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Click handler for adding markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick || !canAddMarkers) return;

    function handleClick(e: L.LeafletMouseEvent) {
      onMapClick!(e.latlng.lat, e.latlng.lng);
    }
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [onMapClick, canAddMarkers]);

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

    // Remove old markers no longer in list
    for (const [id, layer] of markerLayersRef.current) {
      if (!markers.find(m => m.id === id)) {
        layer.remove();
        markerLayersRef.current.delete(id);
      }
    }

    // Add new markers
    for (const marker of markers) {
      if (markerLayersRef.current.has(marker.id)) continue;
      const icon = marker.type === 'official' ? officialIcon : userIcon;
      const layer = L.marker([marker.lat, marker.lng], { icon })
        .bindPopup(`<b>${marker.title}</b>${marker.description ? `<br/><span style="font-size:12px;color:#94a3b8">${marker.description}</span>` : ''}`)
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

    // Find closest point
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

    // Remove spots no longer in the list
    for (const [id, layer] of spectatorLayersRef.current) {
      if (!spectatorPredictions.find(s => s.id === id)) {
        layer.remove();
        spectatorLayersRef.current.delete(id);
      }
    }

    for (const spot of spectatorPredictions) {
      const existing = spectatorLayersRef.current.get(spot.id);

      // Build popup HTML
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
        // Update popup content in place (e.g. when clock time changes)
        existing.setPopupContent(popupHtml);
      } else {
        const layer = L.marker([spot.lat, spot.lng], { icon: spectatorIcon })
          .bindPopup(popupHtml, { maxWidth: 260 })
          .addTo(map);
        spectatorLayersRef.current.set(spot.id, layer);
      }
    }
  }, [spectatorPredictions]);

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
        {canAddMarkers && (
          <p className="text-[11px] text-orange-600 font-semibold">Click map to add marker</p>
        )}
      </div>
      <div ref={containerRef} style={{ height: 420 }} />
    </div>
  );
}
