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
const TILE_COLLAPSED_W = 130;
const TILE_EXPANDED_W  = 260; // exactly 2× collapsed
const TILE_COLLAPSED_H = 68;
const DESKTOP_EXPANDED_H = 240;

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

  // ── Spectator tile interaction state (lifted out of CourseMap) ────────────
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [includedSpotIds, setIncludedSpotIds] = useState<Set<string>>(new Set());
  const includedInitRef = useRef(false);
  const cardRowRef = useRef<HTMLDivElement>(null);

  // ── Mobile detection & tile panel height ──────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  // Height in px of the bottom tile panel (half the space below the header)
  const [mobilePanelH, setMobilePanelH] = useState(0);

  useEffect(() => {
    const HEADER_H = 56;
    function update() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMobilePanelH(Math.floor((window.innerHeight - HEADER_H) / 2));
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

  // ── Tile row rendering (shared between mobile panel and desktop overlay) ──
  function renderTileRow(mobile: boolean) {
    // On mobile, expanded tiles fill the panel height (minus padding).
    // On desktop, expanded tiles use a fixed height.
    const expandedH = mobile ? mobilePanelH - 16 : DESKTOP_EXPANDED_H;

    return sortedSpots.map((spot, i) => {
      const isActive   = hoveredSpotId === spot.id || selectedSpotId === spot.id;
      const isSelected = selectedSpotId === spot.id;
      const isIncluded = includedSpotIds.has(spot.id);
      const letter     = String.fromCharCode(65 + i);
      const distLabel  = displayUnit === 'mi' ? `Mi ${spot.distanceMile}` : `${spot.distanceKm} km`;

      const tileStyle: React.CSSProperties = {
        position: 'relative',
        pointerEvents: 'auto',
        width: isActive ? TILE_EXPANDED_W : TILE_COLLAPSED_W,
        height: isActive ? expandedH : TILE_COLLAPSED_H,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        // On mobile the tile is overflow:hidden; inner body scrolls.
        // On desktop the tile itself scrolls (overflow-y:auto when expanded).
        overflowY: (isActive && !mobile) ? 'auto' : 'hidden',
        background: isSelected ? 'rgba(245,240,255,0.98)' : isActive ? 'rgba(250,247,255,0.97)' : 'rgba(255,255,255,0.93)',
        border: isSelected ? '1.5px solid #a855f7' : isActive ? '1px solid #c084fc' : '1px solid #e2e8f0',
        borderRadius: 10,
        padding: isActive ? '8px' : '6px 7px',
        boxShadow: isSelected
          ? '0 4px 16px rgba(168,85,247,0.28)'
          : isActive ? '0 2px 10px rgba(168,85,247,0.18)'
          : '0 1px 3px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
      };

      return (
        <div
          key={spot.id}
          data-spot-id={spot.id}
          onMouseEnter={() => setHoveredSpotId(spot.id)}
          onMouseLeave={() => setHoveredSpotId(null)}
          onClick={() => setSelectedSpotId(prev => prev === spot.id ? null : spot.id)}
          style={tileStyle}
        >
          {/* Top-right controls — visible when expanded */}
          {isActive && (
            <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, zIndex: 1 }}>
              <button
                onClick={e => { e.stopPropagation(); toggleIncluded(spot.id); }}
                title={isIncluded ? 'Remove from plan' : 'Add to plan'}
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: isIncluded ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.12)',
                  border: `1px solid ${isIncluded ? 'rgba(22,163,74,0.45)' : 'rgba(148,163,184,0.45)'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isIncluded ? '#16a34a' : '#94a3b8', padding: 0,
                }}
              >
                {isIncluded ? (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M4.5 1.5v6M1.5 4.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
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
            </div>
          )}

          {isActive ? (
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
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#1e293b', paddingRight: 46 }}>
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

              {/* Scrollable body — on mobile this area scrolls; on desktop the tile itself scrolls */}
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
                {(spot.url || spot.mapsUrl) && (
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 5 }}>
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
                )}
              </div>
            </>
          ) : (
            // ── Collapsed ────────────────────────────────────────────────────
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: isIncluded ? '#a855f7' : '#94a3b8',
                color: 'white', fontSize: 'var(--text-xs)', fontWeight: 700,
                fontFamily: 'system-ui,sans-serif',
                textAlign: 'center', lineHeight: '20px', flexShrink: 0,
              }}>{letter}</span>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: isIncluded ? '#1e293b' : '#94a3b8',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="font-sans"
      style={{ height: 'var(--app-height)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header — normal flow, fixed height */}
      <div
        className="flex-shrink-0 z-[1000] flex items-center px-4 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm"
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
      </div>

      {isMobile ? (
        // ── Mobile: map (top 50%) + tile panel (bottom 50%) ─────────────────
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Map section */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
            <CourseMap
              gpxPoints={gpxPoints}
              markers={officialMarkers}
              spectatorPredictions={spectatorPredictions}
              displayUnit={displayUnit}
              markerPredictions={markerPredictions}
              selectedSpotId={selectedSpotId}
              hoveredSpotId={hoveredSpotId}
              includedSpotIds={includedSpotIds}
              onSpotSelect={setSelectedSpotId}
            />
            {/* Right panel floats in the top-right of the map */}
            <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 1000 }}>
              {rightPanel}
            </div>
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
            {/* Right-fade + scroll arrow */}
            {sortedSpots.length > 3 && (
              <>
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 56,
                  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9))',
                  pointerEvents: 'none', zIndex: 2,
                }} />
                <button
                  onClick={() => cardRowRef.current?.scrollBy({ left: TILE_EXPANDED_W + 6, behavior: 'smooth' })}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
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

            {/* Scrollable tile row — horizontal only, tiles align to bottom */}
            <div
              ref={cardRowRef}
              className="spectator-key-panel"
              style={{
                height: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 6,
                padding: '8px',
                boxSizing: 'border-box',
                paddingRight: sortedSpots.length > 3 ? 52 : 8,
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
              hoveredSpotId={hoveredSpotId}
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
                  <div style={{
                    position: 'absolute', right: 8, bottom: 8, width: 72, height: TILE_COLLAPSED_H,
                    background: 'linear-gradient(to right, transparent, rgba(241,245,249,0.95))',
                    pointerEvents: 'none', zIndex: 2,
                  }} />
                  <button
                    onClick={() => cardRowRef.current?.scrollBy({ left: TILE_EXPANDED_W + 6, behavior: 'smooth' })}
                    style={{
                      position: 'absolute', right: 14, bottom: 16,
                      zIndex: 3, width: 32, height: 32, borderRadius: '50%',
                      background: 'white', border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#7c3aed', pointerEvents: 'auto',
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
                style={{
                  display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 6,
                  overflowX: 'auto', scrollbarWidth: 'none',
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
