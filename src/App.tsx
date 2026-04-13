import { useState, useMemo, useEffect, useRef } from 'react';
import type { Segment, CourseMarker } from './lib/types';
import { generateSegments, MARATHON_KM, KM_PER_MILE } from './lib/paceUtils';
import { parseGpx, type GpxPoint } from './lib/gpxParser';
import { predictSpotTimes, type SpotPrediction, type SpectatorSpot, SPECTATOR_SPOTS } from './lib/spectatorSpots';
import CourseMap from './components/CourseMap';

// Pre-populated official course markers
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
  { label: '5 km',   dist: 5         },
  { label: '10 km',  dist: 10        },
  { label: '15 km',  dist: 15        },
  { label: '20 km',  dist: 20        },
  { label: 'HM',     dist: MARATHON_KM / 2 },
  { label: '25 km',  dist: 25        },
  { label: '30 km',  dist: 30        },
  { label: '35 km',  dist: 35        },
  { label: '40 km',  dist: 40        },
  { label: '42.2 km', dist: MARATHON_KM },
];

const DEFAULT_TARGET = 4 * 3600;
const UNIT = 'km' as const;

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

  // Editable target time state
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputVal, setTargetInputVal] = useState(secToHMM(DEFAULT_TARGET));
  const targetInputRef = useRef<HTMLInputElement>(null);
  const [showSplits, setShowSplits] = useState(false);

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

  // Predicted pass-through times for official course markers
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

  // Splits table data
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
      setTargetInputVal(secToHMM(targetSec)); // revert on invalid input
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative font-sans">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <CourseMap
          gpxPoints={gpxPoints}
          markers={officialMarkers}
          spectatorPredictions={spectatorPredictions}
          displayUnit={displayUnit}
          markerPredictions={markerPredictions}
        />
      </div>

      {/* Top bar: logo only */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center px-4 h-14 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
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

      {/* Right panel — below top bar, expands leftward when splits open */}
      <div className="absolute right-4 top-[64px] z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-border shadow-xl flex flex-row">

          {/* Splits column — shown to the left of main content */}
          {showSplits && (
            <div className="p-4 border-r border-border w-44 flex flex-col gap-0.5">
              <div className="flex t-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                <span className="w-12">Mark</span>
                <span className="flex-1 text-right">Split</span>
                <span className="w-14 text-right">Total</span>
              </div>
              {splits.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center py-0.5 px-0.5 rounded ${i === 4 ? 'bg-orange-500/5' : ''}`}
                >
                  <span className={`w-12 t-xs font-semibold ${i === 4 ? 'text-orange-600' : 'text-slate-500'}`}>
                    {row.label}
                  </span>
                  <span className="flex-1 text-right t-xs font-mono text-slate-400">{row.split}</span>
                  <span className={`w-14 text-right t-xs font-mono font-semibold ${i === splits.length - 1 ? 'text-orange-600' : 'text-slate-700'}`}>
                    {row.total}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Main content column */}
          <div className="p-4 flex flex-col gap-4 w-56">

            {/* Target time + pace */}
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

            {/* Splits toggle */}
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

            {/* Start time — editable */}
            <div>
              <label className="t-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1">
                Start time
              </label>
              <input
                type="time"
                value={startTimeStr}
                onChange={e => setStartTimeStr(e.target.value)}
                className="t-md font-semibold font-mono text-slate-900 bg-surface-2 border border-border rounded-lg px-2 py-1 outline-none focus:border-orange-500/60 transition-colors w-full"
              />
            </div>

            {/* Finish time — read-only */}
            <div>
              <p className="t-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Finish time</p>
              <p className="t-lg font-bold text-slate-900">{predictedFinishTime}</p>
            </div>

            {/* km / mi toggle */}
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
      </div>
    </div>
  );
}
