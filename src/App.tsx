import { useState, useMemo, useEffect, useRef } from 'react';
import type { Segment, CourseMarker } from './lib/types';
import { generateSegments, MARATHON_KM, KM_PER_MILE } from './lib/paceUtils';
import { parseGpx, type GpxPoint } from './lib/gpxParser';
import { predictSpotTimes, type SpotPrediction, type SpectatorSpot, SPECTATOR_SPOTS } from './lib/spectatorSpots';
import CourseMap from './components/CourseMap';

const OFFICIAL_MARKERS: CourseMarker[] = [
  { id: 'start',        lat: 51.4730,  lng:  0.0034,  title: 'Start Line',     description: 'Blackheath — Championship & Mass start', type: 'official', distanceKm: 0          },
  { id: 'km10',         lat: 51.4830,  lng: -0.0028,  title: '10 km',          description: 'Deptford / New Cross area',               type: 'official', distanceKm: 10         },
  { id: 'tower-bridge', lat: 51.5056,  lng: -0.0754,  title: 'Tower Bridge',   description: '~20 km — iconic crossing',                type: 'official', distanceKm: 20         },
  { id: 'half',         lat: 51.5094,  lng: -0.0610,  title: 'Half Marathon',  description: '21.1 km',                                 type: 'official', distanceKm: MARATHON_KM / 2 },
  { id: 'km30',         lat: 51.5050,  lng: -0.0224,  title: '30 km',          description: 'Isle of Dogs / Docklands',                type: 'official', distanceKm: 30         },
  { id: 'km40',         lat: 51.5057,  lng: -0.1228,  title: '40 km',          description: 'Embankment — nearly there!',              type: 'official', distanceKm: 40         },
  { id: 'finish',       lat: 51.5032,  lng: -0.1374,  title: 'Finish Line',    description: 'The Mall',                               type: 'official', distanceKm: MARATHON_KM },
];

const SPLIT_MARKS = [
  { label: '5 km',    dist: 5              },
  { label: '10 km',   dist: 10             },
  { label: '15 km',   dist: 15             },
  { label: '20 km',   dist: 20             },
  { label: 'HM',      dist: MARATHON_KM / 2 },
  { label: '25 km',   dist: 25             },
  { label: '30 km',   dist: 30             },
  { label: '35 km',   dist: 35             },
  { label: '40 km',   dist: 40             },
  { label: '42.2 km', dist: MARATHON_KM    },
];

const DEFAULT_TARGET = 4 * 3600;
const UNIT = 'km' as const;

// Tile dimension constants
const TILE_COLLAPSED_W = 160;
const TILE_EXPANDED_W  = 480; // desktop expanded width (3× collapsed width of 160)
const TILE_COLLAPSED_H = 80;
// Desktop expanded tiles: fixed narrow width so text wraps rather than sprawling
// horizontally; height increased to 40vh to accommodate wrapped content.
const DESKTOP_EXPANDED_H_CSS = '40vh';
// Mobile carousel snap: peek amount on each side so adjacent tiles are visible.
// Tile width = viewport width − 2×MOBILE_SNAP_PEEK; gap between tiles = MOBILE_SNAP_GAP.
const MOBILE_SNAP_PEEK = 44;
const MOBILE_SNAP_GAP  = 10;

function secToHMM(sec: number): string {
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
}

function formatPace(targetSec: number, unit: 'km' | 'mi'): string {
  const paceSecPerKm = targetSec / MARATHON_KM;
  const paceSec = unit === 'mi' ? paceSecPerKm * KM_PER_MILE : paceSecPerKm;
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function secToHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function secToMS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [targetSec, setTargetSec] = useState(DEFAULT_TARGET);
  const [segments, setSegments] = useState<Segment[]>(() =>
    generateSegments(DEFAULT_TARGET, 'even', UNIT),
  );
  const [gpxPoints, setGpxPoints] = useState<GpxPoint[]>([]);
  const [officialMarkers, setOfficialMarkers] = useState<CourseMarker[]>(OFFICIAL_MARKERS);
  const [spectatorSpots, setSpectatorSpots] = useState<SpectatorSpot[]>(SPECTATOR_SPOTS);
  const [displayUnit, setDisplayUnit] = useState<'km' | 'mi'>('km');
  const [startTimeStr, setStartTimeStr] = useState('10:00');

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputVal, setTargetInputVal] = useState(secToHMM(DEFAULT_TARGET));
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [showSplits, setShowSplits] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // ── Spectator tile interaction state (lifted out of CourseMap) ────────────
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [includedSpotIds, setIncludedSpotIds] = useState<Set<string>>(new Set());
  // Mobile carousel: which tile is currently centred in the scroll container.
  // Drives the purple glow on the tile AND the matching map icon highlight.
  const [mobileCenteredSpotId, setMobileCenteredSpotId] = useState<string | null>(null);
  const includedInitRef = useRef(false);
  const cardRowRef = useRef<HTMLDivElement>(null);

  // ── Mobile detection, tile panel height, and carousel tile width ─────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  // Lazy-initialise so the map container already has the correct height on first
  // render — prevents fitBounds firing against a full-screen height on mobile.
  const [mobilePanelH, setMobilePanelH] = useState(() =>
    window.innerWidth < 768 ? Math.floor((window.innerHeight - 56) / 2) : 0,
  );
  // Width of each carousel tile: viewport minus peek on both sides.
  // Initialised eagerly so the first render is already correct.
  const [mobileTileW, setMobileTileW] = useState(() =>
    window.innerWidth < 768 ? window.innerWidth - 2 * MOBILE_SNAP_PEEK : TILE_EXPANDED_W,
  );

  useEffect(() => {
    const HEADER_H = 56;
    function update() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setMobilePanelH(Math.floor((window.innerHeight - HEADER_H) / 2));
        setMobileTileW(window.innerWidth - 2 * MOBILE_SNAP_PEEK);
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const runnerStartTime = useMemo(() => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, [startTimeStr]);

  const spectatorPredictions = useMemo<SpotPrediction[]>(
    () => predictSpotTimes(runnerStartTime, segments, spectatorSpots),
    [runnerStartTime, segments, spectatorSpots],
  );

  const sortedSpots = useMemo(
    () => [...spectatorPredictions].sort((a, b) => a.distanceKm - b.distanceKm),
    [spectatorPredictions],
  );

  const markerPredictions = useMemo(() => {
    const result: Record<string, { elapsed: string; clock: string }> = {};
    for (const m of officialMarkers) {
      if (m.distanceKm == null) continue;
      const elapsedSec = targetSec * (m.distanceKm / MARATHON_KM);
      const clock = new Date(runnerStartTime.getTime() + elapsedSec * 1000)
        .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      result[m.id] = { elapsed: secToHMS(elapsedSec), clock };
    }
    return result;
  }, [targetSec, runnerStartTime, officialMarkers]);

  const splits = useMemo(() => {
    let prevSec = 0;
    return SPLIT_MARKS.map(({ label, dist }) => {
      const accSec = targetSec * (dist / MARATHON_KM);
      const splitSec = accSec - prevSec;
      prevSec = accSec;
      return { label, split: secToMS(splitSec), total: secToHMS(accSec) };
    });
  }, [targetSec]);

  const predictedFinishTime = useMemo(() => {
    const finish = new Date(runnerStartTime.getTime() + targetSec * 1000);
    return finish.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, [runnerStartTime, targetSec]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/london-marathon.gpx')
      .then(r => r.text())
      .then(text => { const pts = parseGpx(text); if (pts.length) setGpxPoints(pts); })
      .catch(() => {});
    fetch('/api/official-markers')
      .then(r => r.json())
      .then((data: CourseMarker[]) => { if (Array.isArray(data) && data.length) setOfficialMarkers(data); })
      .catch(() => {});
    fetch('/api/spectator-spots')
      .then(r => r.json())
      .then((data: SpectatorSpot[]) => { if (Array.isArray(data) && data.length) setSpectatorSpots(data); })
      .catch(() => {});
  }, []);

  // Init: mark every spot as included on first load
  useEffect(() => {
    if (!includedInitRef.current && sortedSpots.length > 0) {
      includedInitRef.current = true;
      setIncludedSpotIds(new Set(sortedSpots.map(s => s.id)));
    }
  }, [sortedSpots]);

  // Scroll the selected tile into view
  useEffect(() => {
    if (!selectedSpotId || !cardRowRef.current) return;
    const el = cardRowRef.current.querySelector<HTMLElement>(`[data-spot-id="${selectedSpotId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedSpotId]);

  // Update scroll arrow enabled state after spots load/change
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = cardRowRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    });
  }, [sortedSpots]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function applyTargetChange(newSec: number) {
    setTargetSec(newSec);
    setSegments(generateSegments(newSec, 'even', UNIT));
    setTargetInputVal(secToHMM(newSec));
  }

  function commitTargetInput() {
    setEditingTarget(false);
    const parts = targetInputVal.split(':').map(s => parseInt(s.trim(), 10));
    if (parts.length === 2 && !parts.some(isNaN) && parts[1] >= 0 && parts[1] < 60 && parts[0] >= 0) {
      applyTargetChange(parts[0] * 3600 + parts[1] * 60);
    } else {
      setTargetInputVal(secToHMM(targetSec));
    }
  }

  function toggleIncluded(spotId: string) {
    setIncludedSpotIds(prev => {
      const next = new Set(prev);
      next.has(spotId) ? next.delete(spotId) : next.add(spotId);
      return next;
    });
  }

  function updateScrollArrows() {
    const el = cardRowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    // Track the centred carousel tile (mobile only)
    if (isMobile && sortedSpots.length > 0) {
      const tileStep = mobileTileW + MOBILE_SNAP_GAP;
      const index = Math.min(
        sortedSpots.length - 1,
        Math.max(0, Math.round(el.scrollLeft / tileStep)),
      );
      setMobileCenteredSpotId(sortedSpots[index].id);
    }
  }

  // ── Tile row rendering (shared between mobile panel and desktop overlay) ──
  function renderTileRow(mobile: boolean) {
    // Mobile expanded tiles fill the panel height (minus padding).
    // Desktop expanded tiles use 30vh height and fit-content width — see tileStyle below.
    const expandedH = mobilePanelH - 16;
    // Include toggle is thumb-sized on mobile
    const toggleSize   = mobile ? 28 : 18;
    const toggleIcon   = mobile ? 13 : 9;

    return sortedSpots.map((spot, i) => {
      const isActive   = hoveredSpotId === spot.id || selectedSpotId === spot.id;
      // On mobile the centred carousel tile gets the same strong purple as a selected tile
      const isSelected = selectedSpotId === spot.id || (mobile && mobileCenteredSpotId === spot.id);
      // Mobile tiles are always in the expanded state — no collapse interaction
      const isExpanded = mobile || isActive;
      const isIncluded = includedSpotIds.has(spot.id);
      const letter     = String.fromCharCode(65 + i);
      const distLabel  = displayUnit === 'mi' ? `Mi ${spot.distanceMile}` : `${spot.distanceKm} km`;

      const tileStyle: React.CSSProperties = {
        position: 'relative',
        pointerEvents: 'auto',
        // Desktop expanded: fixed narrow width so text wraps into taller tile.
        // Mobile expanded: carousel tile width (viewport − 2×peek) for snap-to-centre.
        // Collapsed (desktop only): fixed collapsed dimensions.
        width:          isExpanded ? (mobile ? mobileTileW : TILE_EXPANDED_W) : TILE_COLLAPSED_W,
        height:         isExpanded ? (mobile ? expandedH : DESKTOP_EXPANDED_H_CSS) : TILE_COLLAPSED_H,
        scrollSnapAlign: mobile ? 'center' : undefined,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        // On mobile the tile is overflow:hidden; inner body scrolls.
        // On desktop the tile itself scrolls (overflow-y:auto when expanded).
        overflowY: (isExpanded && !mobile) ? 'auto' : 'hidden',
        background: isSelected ? 'rgba(245,240,255,0.98)' : isActive ? 'rgba(250,247,255,0.97)' : 'rgba(255,255,255,0.93)',
        border: isSelected ? '1.5px solid #a855f7' : isActive ? '1px solid #c084fc' : '1px solid #e2e8f0',
        borderRadius: 10,
        padding: isExpanded ? '8px' : '6px 7px',
        boxShadow: isSelected
          ? '0 4px 16px rgba(168,85,247,0.28)'
          : isActive ? '0 2px 10px rgba(168,85,247,0.18)'
          : '0 1px 3px rgba(0,0,0,0.08)',
        cursor: mobile ? 'default' : 'pointer',
        transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
      };

      // Links element — on mobile pinned as tile footer, on desktop inside scroll body
      const linksEl = (spot.url || spot.mapsUrl) ? (
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 5, flexShrink: 0 }}>
          {spot.url && (
            <a href={spot.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} title="View source"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: '#a855f7', textDecoration: 'none' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <ellipse cx="6" cy="6" rx="2.2" ry="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="4.5" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="7.5" x2="11" y2="7.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Source
            </a>
          )}
          {spot.mapsUrl && (
            <a href={spot.mapsUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} title="Open in Google Maps"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: '#1a73e8', textDecoration: 'none' }}>
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" fill="#EA4335"/>
                <circle cx="5" cy="5" r="2" fill="white"/>
              </svg>
              Maps
            </a>
          )}
        </div>
      ) : null;

      return (
        <div
          key={spot.id}
          data-spot-id={spot.id}
          onMouseEnter={() => !mobile && setHoveredSpotId(spot.id)}
          onMouseLeave={() => !mobile && setHoveredSpotId(null)}
          onClick={() => !mobile && setSelectedSpotId(prev => prev === spot.id ? null : spot.id)}
          style={tileStyle}
        >
          {/* Top-right controls — include toggle always shown when expanded */}
          {isExpanded && (
            <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, zIndex: 1 }}>
              <button
                onClick={e => { e.stopPropagation(); toggleIncluded(spot.id); }}
                title={isIncluded ? 'Remove from plan' : 'Add to plan'}
                style={{
                  width: toggleSize, height: toggleSize, borderRadius: '50%',
                  background: isIncluded ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.12)',
                  border: `1px solid ${isIncluded ? 'rgba(22,163,74,0.45)' : 'rgba(148,163,184,0.45)'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isIncluded ? '#16a34a' : '#94a3b8', padding: 0,
                }}
              >
                {isIncluded ? (
                  <svg width={toggleIcon} height={toggleIcon} viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width={toggleIcon} height={toggleIcon} viewBox="0 0 9 9" fill="none">
                    <path d="M4.5 1.5v6M1.5 4.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
              {/* Close button — desktop only; mobile tiles have no collapse */}
              {!mobile && (
                <button
                  onClick={e => { e.stopPropagation(); setSelectedSpotId(null); setHoveredSpotId(null); }}
                  title="Close"
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(168,85,247,0.12)', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#a855f7', padding: 0,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {isExpanded ? (
            // ── Expanded ─────────────────────────────────────────────────────
            <>
              {/* Fixed header: letter + name + dist/time always visible */}
              <div style={{ flexShrink: 0 }}>
                <span style={{
                  display: 'inline-block',
                  width: 24, height: 24, borderRadius: '50%',
                  background: isIncluded ? '#9333ea' : '#94a3b8',
                  color: 'white', fontSize: 'var(--text-sm)', fontWeight: 700,
                  fontFamily: 'system-ui,sans-serif',
                  textAlign: 'center', lineHeight: '24px',
                }}>{letter}</span>
                <div style={{ marginTop: 5 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#1e293b', paddingRight: mobile ? toggleSize + 10 : 46 }}>
                    {spot.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', letterSpacing: '0.02em' }}>{distLabel}</span>
                    {spot.clockTime && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: isIncluded ? '#ea580c' : '#94a3b8' }}>
                        {spot.clockTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable body — description, stations, crowd notes */}
              <div
                className="tile-scroll-area"
                style={{
                  flex: 1, minHeight: 0,
                  overflowY: mobile ? 'auto' : 'visible',
                  marginTop: 5,
                  display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                {spot.description && (
                  <div style={{ fontSize: 'var(--text-xs)', color: '#64748b', lineHeight: 1.45, letterSpacing: '0.02em' }}>
                    {spot.description}
                  </div>
                )}
                {spot.nearestStations.length > 0 && (
                  <div>
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
                    borderTop: '1px solid #e2e8f0', paddingTop: 5,
                    fontSize: 'var(--text-xs)', color: '#64748b', lineHeight: 1.45, letterSpacing: '0.02em',
                  }}>
                    {spot.crowdNotes}
                  </div>
                )}
                {/* On desktop the links sit inside the scroll body */}
                {!mobile && linksEl}
              </div>

              {/* On mobile the links are pinned to the bottom of the tile */}
              {mobile && linksEl && (
                <div style={{ flexShrink: 0, marginTop: 4 }}>
                  {linksEl}
                </div>
              )}
            </>
          ) : (
            // ── Collapsed (desktop only) ──────────────────────────────────
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: isIncluded ? '#a855f7' : '#94a3b8',
                color: 'white', fontSize: 'var(--text-xs)', fontWeight: 700,
                fontFamily: 'system-ui,sans-serif',
                textAlign: 'center', lineHeight: '20px', flexShrink: 0,
              }}>{letter}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: isIncluded ? '#1e293b' : '#94a3b8',
                  lineHeight: 1.3,
                }}>
                  {spot.name}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: isIncluded ? '#94a3b8' : '#cbd5e1', letterSpacing: '0.02em' }}>{distLabel}</span>
                  {spot.clockTime && (
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: isIncluded ? '#ea580c' : '#cbd5e1' }}>
                      {spot.clockTime}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  // ── Right panel ───────────────────────────────────────────────────────────
  const rightPanel = (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-border shadow-xl flex flex-row">
      {showSplits && (
        <div className="p-4 border-r border-border w-44 flex flex-col gap-0.5">
          <div className="flex t-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="w-12">Mark</span>
            <span className="flex-1 text-right">Split</span>
            <span className="w-14 text-right">Total</span>
          </div>
          {splits.map((row, i) => (
            <div key={row.label} className={`flex items-center py-0.5 px-0.5 rounded ${i === 4 ? 'bg-orange-500/5' : ''}`}>
              <span className={`w-12 t-xs font-semibold ${i === 4 ? 'text-orange-600' : 'text-slate-500'}`}>{row.label}</span>
              <span className="flex-1 text-right t-xs font-mono text-slate-400">{row.split}</span>
              <span className={`w-14 text-right t-xs font-mono font-semibold ${i === splits.length - 1 ? 'text-orange-600' : 'text-slate-700'}`}>{row.total}</span>
            </div>
          ))}
        </div>
      )}
      <div className="p-4 flex flex-col gap-4 w-56">
        <div>
          <p className="t-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Target</p>
          <div className="flex items-baseline gap-2">
            {editingTarget ? (
              <input
                ref={targetInputRef}
                type="text"
                value={targetInputVal}
                onChange={e => setTargetInputVal(e.target.value)}
                onBlur={commitTargetInput}
                onKeyDown={e => {
                  if (e.key === 'Enter') targetInputRef.current?.blur();
                  if (e.key === 'Escape') { setTargetInputVal(secToHMM(targetSec)); setEditingTarget(false); }
                }}
                className="w-20 text-center t-xl font-bold font-mono text-orange-600 bg-orange-500/5 border border-orange-500/50 rounded-xl px-2 py-0.5 outline-none"
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setTargetInputVal(secToHMM(targetSec)); setEditingTarget(true); }}
                title="Click to edit target time"
                className="t-xl font-bold font-mono text-orange-600 bg-orange-500/5 border border-orange-500/20 rounded-xl px-3 py-0.5 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all"
              >
                {secToHMM(targetSec)}
              </button>
            )}
            <span className="t-xs text-slate-400 font-mono whitespace-nowrap">
              {formatPace(targetSec, displayUnit)}<span className="text-slate-300">/{displayUnit}</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowSplits(v => !v)}
          className="flex items-center justify-between w-full t-xs font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
        >
          <span>Splits</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showSplits ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
            <path d="M8 2l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="border-t border-border" />
        <div>
          <label className="t-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">Start time</label>
          <input
            type="time"
            value={startTimeStr}
            onChange={e => setStartTimeStr(e.target.value)}
            className="t-md font-semibold font-mono text-slate-900 bg-surface-2 border border-border rounded-lg px-2 py-1 outline-none focus:border-orange-500/60 transition-colors w-full"
          />
        </div>
        <div>
          <p className="t-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Finish time</p>
          <p className="t-lg font-bold text-slate-900">{predictedFinishTime}</p>
        </div>
        <div className="flex gap-2">
          {(['km', 'mi'] as const).map(u => (
            <button
              key={u}
              onClick={() => setDisplayUnit(u)}
              className={`t-sm font-semibold px-3 py-1 rounded-lg border transition-all flex-1 ${
                displayUnit === u
                  ? 'bg-orange-500/10 border-orange-500/50 text-orange-600'
                  : 'border-border text-slate-500 hover:text-slate-900'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // On mobile the centred carousel tile drives map icon highlight instead of hover
  const mapHoveredSpotId = isMobile ? mobileCenteredSpotId : hoveredSpotId;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="font-sans"
      style={{ height: 'var(--app-height)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header — normal flow, fixed height */}
      <div
        className="flex-shrink-0 z-[1000] flex items-center justify-between px-4 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm"
        style={{ height: 56 }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="14" cy="16" r="10" stroke="#f97316" strokeWidth="2"/>
            <rect x="11.5" y="5" width="5" height="2.5" rx="1.25" fill="#f97316"/>
            <rect x="13.25" y="4" width="1.5" height="2" rx="0.75" fill="#f97316"/>
            <path d="M16 10.5L10.5 17H14.5L12 22.5L19 15.5H15L16 10.5Z" fill="#f97316"/>
          </svg>
          <div>
            <h1 className="t-md font-bold text-slate-900 tracking-tight leading-tight">London Marathon Pacer</h1>
            <p className="t-xs text-slate-400">Plan your perfect race</p>
          </div>
        </div>
        {/* Mobile: target time pill + expand toggle */}
        {isMobile && (
          <button
            onClick={() => setShowMobilePanel(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 10,
              background: showMobilePanel ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)',
              border: `1px solid ${showMobilePanel ? 'rgba(249,115,22,0.4)' : 'rgba(249,115,22,0.2)'}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'monospace', color: '#ea580c', letterSpacing: '-0.02em' }}>
              {secToHMM(targetSec)}
            </span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ color: '#ea580c', transform: showMobilePanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {isMobile ? (
        // ── Mobile: map (top 50%) + tile panel (bottom 50%) ─────────────────
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Slide-down settings panel — appears below header, above map */}
          {showMobilePanel && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2000,
              background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderBottom: '1px solid #e2e8f0', padding: '12px 16px 16px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Target + pace */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Target</div>
                    {editingTarget ? (
                      <input
                        ref={targetInputRef}
                        type="text"
                        value={targetInputVal}
                        onChange={e => setTargetInputVal(e.target.value)}
                        onBlur={commitTargetInput}
                        onKeyDown={e => {
                          if (e.key === 'Enter') targetInputRef.current?.blur();
                          if (e.key === 'Escape') { setTargetInputVal(secToHMM(targetSec)); setEditingTarget(false); }
                        }}
                        style={{ width: 80, textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'monospace', color: '#ea580c', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.5)', borderRadius: 10, padding: '2px 8px', outline: 'none' }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => { setTargetInputVal(secToHMM(targetSec)); setEditingTarget(true); }}
                        style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'monospace', color: '#ea580c', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: '2px 12px', cursor: 'pointer' }}
                      >
                        {secToHMM(targetSec)}
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {formatPace(targetSec, displayUnit)}<span style={{ color: '#cbd5e1' }}>/{displayUnit}</span>
                  </span>
                </div>

                {/* Start + Finish */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Start</label>
                    <input
                      type="time"
                      value={startTimeStr}
                      onChange={e => setStartTimeStr(e.target.value)}
                      style={{ fontSize: 'var(--text-md)', fontWeight: 600, fontFamily: 'monospace', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', outline: 'none', width: '100%' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Finish</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#0f172a' }}>{predictedFinishTime}</div>
                  </div>
                </div>

                {/* km/mi toggle + splits toggle */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['km', 'mi'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setDisplayUnit(u)}
                        style={{
                          fontSize: 'var(--text-sm)', fontWeight: 600, padding: '5px 14px', borderRadius: 8,
                          border: displayUnit === u ? '1px solid rgba(249,115,22,0.5)' : '1px solid #e2e8f0',
                          background: displayUnit === u ? 'rgba(249,115,22,0.1)' : 'transparent',
                          color: displayUnit === u ? '#ea580c' : '#64748b', cursor: 'pointer',
                        }}
                      >{u}</button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowSplits(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 4px', marginLeft: 'auto' }}
                  >
                    Splits
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showSplits ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
                      <path d="M8 2l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Splits table */}
                {showSplits && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      <span style={{ width: 52 }}>Mark</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>Split</span>
                      <span style={{ width: 64, textAlign: 'right' }}>Total</span>
                    </div>
                    {splits.map((row, i) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: 4, background: i === 4 ? 'rgba(249,115,22,0.05)' : 'transparent' }}>
                        <span style={{ width: 52, fontSize: 'var(--text-xs)', fontWeight: 600, color: i === 4 ? '#ea580c' : '#64748b' }}>{row.label}</span>
                        <span style={{ flex: 1, textAlign: 'right', fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: '#94a3b8' }}>{row.split}</span>
                        <span style={{ width: 64, textAlign: 'right', fontSize: 'var(--text-xs)', fontFamily: 'monospace', fontWeight: 600, color: i === splits.length - 1 ? '#ea580c' : '#334155' }}>{row.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map section */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
            <CourseMap
              gpxPoints={gpxPoints}
              markers={officialMarkers}
              spectatorPredictions={spectatorPredictions}
              displayUnit={displayUnit}
              markerPredictions={markerPredictions}
              selectedSpotId={selectedSpotId}
              hoveredSpotId={mapHoveredSpotId}
              includedSpotIds={includedSpotIds}
              onSpotSelect={setSelectedSpotId}
              panToOnSelect
            />
          </div>

          {/* Tile panel — fixed height, horizontal scroll only */}
          <div style={{
            flexShrink: 0,
            height: mobilePanelH,
            overflow: 'hidden',
            background: 'white',
            borderTop: '1px solid #e2e8f0',
            position: 'relative',
          }}>
            {/* Left arrow — sits in the left peek zone */}
            {sortedSpots.length > 1 && (
              <button
                onClick={() => cardRowRef.current?.scrollBy({ left: -(mobileTileW + MOBILE_SNAP_GAP), behavior: 'smooth' })}
                style={{
                  position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 3, width: 36, height: 36, borderRadius: '50%',
                  background: 'white', border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  cursor: canScrollLeft ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: canScrollLeft ? '#7c3aed' : '#cbd5e1',
                  opacity: canScrollLeft ? 1 : 0.35,
                  pointerEvents: canScrollLeft ? 'auto' : 'none',
                }}
                title="Previous"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Right arrow — sits in the right peek zone */}
            {sortedSpots.length > 1 && (
              <button
                onClick={() => cardRowRef.current?.scrollBy({ left: mobileTileW + MOBILE_SNAP_GAP, behavior: 'smooth' })}
                style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 3, width: 36, height: 36, borderRadius: '50%',
                  background: 'white', border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  cursor: canScrollRight ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: canScrollRight ? '#7c3aed' : '#cbd5e1',
                  opacity: canScrollRight ? 1 : 0.35,
                  pointerEvents: canScrollRight ? 'auto' : 'none',
                }}
                title="Next"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Scrollable tile row — snap-to-centre carousel */}
            <div
              ref={cardRowRef}
              className="spectator-key-panel"
              onScroll={updateScrollArrows}
              style={{
                height: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: MOBILE_SNAP_GAP,
                // Equal padding = peek amount: first & last tiles snap-centre correctly
                paddingLeft: MOBILE_SNAP_PEEK,
                paddingRight: MOBILE_SNAP_PEEK,
                paddingTop: 8,
                paddingBottom: 8,
                boxSizing: 'border-box',
                scrollSnapType: 'x mandatory',
                // Prevent snap-scroll from propagating to the page
                overscrollBehaviorX: 'contain',
              }}
            >
              {renderTileRow(true)}
            </div>
          </div>

        </div>
      ) : (
        // ── Desktop: full-screen map with floating overlays ──────────────────
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>

          {/* Full-screen map */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <CourseMap
              gpxPoints={gpxPoints}
              markers={officialMarkers}
              spectatorPredictions={spectatorPredictions}
              displayUnit={displayUnit}
              markerPredictions={markerPredictions}
              selectedSpotId={selectedSpotId}
              hoveredSpotId={mapHoveredSpotId}
              includedSpotIds={includedSpotIds}
              onSpotSelect={setSelectedSpotId}
            />
          </div>

          {/* Right panel */}
          <div style={{ position: 'absolute', right: 16, top: 8, zIndex: 1000 }}>
            {rightPanel}
          </div>

          {/* Desktop tile overlay — pinned to bottom of map */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 900, pointerEvents: 'none' }}>
            <div style={{ position: 'relative', padding: '0 8px 8px 8px' }}>
              {sortedSpots.length > 4 && (
                <>
                  {/* Left arrow */}
                  {canScrollLeft && (
                    <div style={{
                      position: 'absolute', left: 8, bottom: 8, width: 56, height: TILE_COLLAPSED_H,
                      background: 'linear-gradient(to left, transparent, rgba(241,245,249,0.95))',
                      pointerEvents: 'none', zIndex: 2,
                    }} />
                  )}
                  <button
                    onClick={() => cardRowRef.current?.scrollBy({ left: -(TILE_EXPANDED_W + 6), behavior: 'smooth' })}
                    style={{
                      position: 'absolute', left: 14, bottom: 16,
                      zIndex: 3, width: 32, height: 32, borderRadius: '50%',
                      background: 'white', border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      cursor: canScrollLeft ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: canScrollLeft ? '#7c3aed' : '#cbd5e1',
                      opacity: canScrollLeft ? 1 : 0.35,
                      pointerEvents: 'auto',
                    }}
                    title="Scroll left"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M9 2l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {/* Right arrow */}
                  {canScrollRight && (
                    <div style={{
                      position: 'absolute', right: 8, bottom: 8, width: 72, height: TILE_COLLAPSED_H,
                      background: 'linear-gradient(to right, transparent, rgba(241,245,249,0.95))',
                      pointerEvents: 'none', zIndex: 2,
                    }} />
                  )}
                  <button
                    onClick={() => cardRowRef.current?.scrollBy({ left: TILE_EXPANDED_W + 6, behavior: 'smooth' })}
                    style={{
                      position: 'absolute', right: 14, bottom: 16,
                      zIndex: 3, width: 32, height: 32, borderRadius: '50%',
                      background: 'white', border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      cursor: canScrollRight ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: canScrollRight ? '#7c3aed' : '#cbd5e1',
                      opacity: canScrollRight ? 1 : 0.35,
                      pointerEvents: 'auto',
                    }}
                    title="Scroll right"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
              <div
                ref={cardRowRef}
                className="spectator-key-panel"
                onScroll={updateScrollArrows}
                style={{
                  display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 6,
                  overflowX: 'auto', scrollbarWidth: 'none',
                  paddingLeft: sortedSpots.length > 4 ? 52 : 0,
                  paddingRight: sortedSpots.length > 4 ? 52 : 0,
                  pointerEvents: 'none',
                }}
              >
                {renderTileRow(false)}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
