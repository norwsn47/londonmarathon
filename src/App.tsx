import { useState, useMemo, useEffect, useRef } from 'react';
import type { Segment, CourseMarker } from './lib/types';
import { generateSegments } from './lib/paceUtils';
import { parseGpx, type GpxPoint } from './lib/gpxParser';
import { predictSpotTimes, type SpotPrediction } from './lib/spectatorSpots';
import CourseMap from './components/CourseMap';

// Pre-populated official course markers
const OFFICIAL_MARKERS: CourseMarker[] = [
  { id: 'start',        lat: 51.4730,  lng:  0.0034,  title: 'Start Line',     description: 'Blackheath — Championship & Mass start', type: 'official' },
  { id: 'km10',         lat: 51.4830,  lng: -0.0028,  title: '10 km',          description: 'Deptford / New Cross area',               type: 'official' },
  { id: 'tower-bridge', lat: 51.5056,  lng: -0.0754,  title: 'Tower Bridge',   description: '~20 km — iconic crossing',                type: 'official' },
  { id: 'half',         lat: 51.5094,  lng: -0.0610,  title: 'Half Marathon',  description: '21.1 km',                                 type: 'official' },
  { id: 'km30',         lat: 51.5050,  lng: -0.0224,  title: '30 km',          description: 'Isle of Dogs / Docklands',                type: 'official' },
  { id: 'km40',         lat: 51.5057,  lng: -0.1228,  title: '40 km',          description: 'Embankment — nearly there!',              type: 'official' },
  { id: 'finish',       lat: 51.5032,  lng: -0.1374,  title: 'Finish Line',    description: 'The Mall',                               type: 'official' },
];

const DEFAULT_TARGET = 4 * 3600;
const UNIT = 'km' as const;

function secToHMM(sec: number): string {
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
}

export default function App() {
  const [targetSec, setTargetSec] = useState(DEFAULT_TARGET);
  const [segments, setSegments] = useState<Segment[]>(() =>
    generateSegments(DEFAULT_TARGET, 'even', UNIT),
  );
  const [gpxPoints, setGpxPoints] = useState<GpxPoint[]>([]);
  const [displayUnit, setDisplayUnit] = useState<'km' | 'mi'>('km');
  const [startTimeStr, setStartTimeStr] = useState('10:00');

  // Editable target time state
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputVal, setTargetInputVal] = useState(secToHMM(DEFAULT_TARGET));
  const targetInputRef = useRef<HTMLInputElement>(null);

  const runnerStartTime = useMemo(() => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, [startTimeStr]);

  const spectatorPredictions = useMemo<SpotPrediction[]>(
    () => predictSpotTimes(runnerStartTime, segments),
    [runnerStartTime, segments],
  );

  const predictedFinishTime = useMemo(() => {
    const finish = new Date(runnerStartTime.getTime() + targetSec * 1000);
    return finish.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, [runnerStartTime, targetSec]);

  useEffect(() => {
    fetch('/london-marathon.gpx')
      .then(r => r.text())
      .then(text => {
        const pts = parseGpx(text);
        if (pts.length) setGpxPoints(pts);
      })
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
          markers={OFFICIAL_MARKERS}
          positionKm={null}
          spectatorPredictions={spectatorPredictions}
          displayUnit={displayUnit}
        />
      </div>

      {/* Top bar: logo left, editable target time right */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        {/* Logo + title */}
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

        {/* Editable target time */}
        <div className="flex items-center gap-2.5">
          <span className="t-xs text-slate-400 uppercase tracking-widest">Target</span>
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
              className="w-20 text-center t-lg font-bold font-mono text-orange-600 bg-orange-500/5 border border-orange-500/50 rounded-xl px-2 py-0.5 outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setTargetInputVal(secToHMM(targetSec)); setEditingTarget(true); }}
              title="Click to edit target time"
              className="t-lg font-bold font-mono text-orange-600 bg-orange-500/5 border border-orange-500/20 rounded-xl px-3 py-0.5 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all"
            >
              {secToHMM(targetSec)}
            </button>
          )}
        </div>
      </div>

      {/* Right panel — below top bar */}
      <div className="absolute right-4 top-[64px] z-[1000] w-56">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-border shadow-xl flex flex-col gap-4">
          {/* Predicted finish time */}
          <div>
            <p className="t-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Predicted finish</p>
            <p className="t-lg font-bold text-slate-900">{predictedFinishTime}</p>
          </div>

          {/* Start time */}
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

          {/* km / mi toggle */}
          <div>
            <p className="t-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Distance</p>
            <div className="flex gap-2">
              {(['km', 'mi'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setDisplayUnit(u)}
                  className={`t-sm font-semibold px-3 py-1 rounded-lg border transition-all ${
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
