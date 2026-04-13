import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Segment, Strategy, Unit, NegativePct, CourseMarker } from './lib/types';
import {
  generateSegments,
  totalTimeSeconds,
  getAutoBalanceIdxs,
  calcAutoBalancePace,
  getPaceBounds,
  getPositionAtTime,
  formatDuration,
} from './lib/paceUtils';
import { parseGpx, type GpxPoint } from './lib/gpxParser';
import { predictSpotTimes, type SpotPrediction } from './lib/spectatorSpots';
import Header from './components/Header';
import CourseMap from './components/CourseMap';
import PositionSlider from './components/PositionSlider';

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

export default function App() {
  // Pace plan state
  const [targetSec, setTargetSec] = useState(DEFAULT_TARGET);
  const [unit] = useState<Unit>('km');
  const [strategy, setStrategy] = useState<Strategy>('even');
  const [negativePct] = useState<NegativePct>(3);
  const [segments, setSegments] = useState<Segment[]>(() =>
    generateSegments(DEFAULT_TARGET, 'even', 'km'),
  );
  const [autoBalance, setAutoBalance] = useState(false);

  // Map / GPX state
  const [gpxPoints, setGpxPoints] = useState<GpxPoint[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [displayUnit, setDisplayUnit] = useState<'km' | 'mi'>('km');

  const autoBalanceIdxs = useMemo(() => getAutoBalanceIdxs(segments), [segments]);

  const displaySegments = useMemo<Segment[]>(() => {
    if (!autoBalance || strategy !== 'custom') return segments;
    const { min, max } = getPaceBounds(targetSec);
    const pace = calcAutoBalancePace(segments, autoBalanceIdxs, targetSec);
    if (pace < min || pace > max) return segments;
    const idxSet = new Set(autoBalanceIdxs);
    return segments.map((s, i) => (idxSet.has(i) ? { ...s, paceSecPerKm: pace } : s));
  }, [autoBalance, strategy, segments, autoBalanceIdxs, targetSec]);

  const projectedSec = totalTimeSeconds(displaySegments);
  const positionKm = getPositionAtTime(displaySegments, elapsedSec);

  // Gun start time — user-configurable, default 10:00
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const runnerStartTime = useMemo(() => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }, [startTimeStr]);

  const spectatorPredictions = useMemo<SpotPrediction[]>(
    () => predictSpotTimes(runnerStartTime, displaySegments),
    [runnerStartTime, displaySegments],
  );

  // Load London Marathon GPX from public folder
  useEffect(() => {
    fetch('/london-marathon.gpx')
      .then(r => r.text())
      .then(text => {
        const pts = parseGpx(text);
        if (pts.length) setGpxPoints(pts);
      })
      .catch(() => { /* GPX not yet uploaded to /public */ });
  }, []);

  const handleTargetChange = useCallback((newTarget: number) => {
    setTargetSec(newTarget);
    if (strategy !== 'custom') {
      setSegments(generateSegments(newTarget, strategy, unit, negativePct));
    }
  }, [strategy, unit, negativePct]);

  const handleStrategySelect = useCallback((s: Strategy) => {
    setStrategy(s);
    setAutoBalance(false);
    if (s !== 'custom') {
      setSegments(generateSegments(targetSec, s, unit, negativePct));
    }
  }, [targetSec, unit, negativePct]);

  return (
    <div className="w-screen h-screen overflow-hidden relative font-sans">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <CourseMap
          gpxPoints={gpxPoints}
          markers={OFFICIAL_MARKERS}
          positionKm={positionKm}
          spectatorPredictions={spectatorPredictions}
          displayUnit={displayUnit}
        />
      </div>

      {/* Floating right panel */}
      <div className="absolute right-4 top-4 bottom-4 w-80 z-[1000] flex flex-col gap-3 overflow-y-auto">
        {/* Header card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-border shadow-xl px-4 pt-2 pb-3">
          <Header />
        </div>

        {/* Target time + gun start */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-border shadow-xl">
          <p className="t-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Target Finish Time
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: '3:30', sec: 3 * 3600 + 30 * 60 },
              { label: '4:00', sec: 4 * 3600 },
              { label: '4:30', sec: 4 * 3600 + 30 * 60 },
              { label: '5:00', sec: 5 * 3600 },
            ].map(({ label, sec }) => (
              <button
                key={label}
                onClick={() => handleTargetChange(sec)}
                className={`t-base font-medium px-3 py-1.5 rounded-xl border transition-all ${
                  targetSec === sec
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-600'
                    : 'bg-surface-2 border-border text-slate-500 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="flex items-center gap-2 mt-2 w-full">
              <span className="t-xs text-slate-500">Strategy:</span>
              {(['even', 'negative'] as Strategy[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStrategySelect(s)}
                  className={`t-sm font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    strategy === s
                      ? 'bg-orange-500/10 border-orange-500/50 text-orange-600'
                      : 'border-border text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {s === 'even' ? 'Even' : 'Negative'}
                </button>
              ))}
            </div>
          </div>

          {/* Distance unit toggle */}
          <div className="flex items-center gap-2 mt-2">
            <span className="t-xs text-slate-500">Distance:</span>
            {(['km', 'mi'] as const).map(u => (
              <button
                key={u}
                onClick={() => setDisplayUnit(u)}
                className={`t-sm font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  displayUnit === u
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-600'
                    : 'border-border text-slate-500 hover:text-slate-900'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {/* Gun start time */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <label className="t-xs font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">
              Gun start
            </label>
            <input
              type="time"
              value={startTimeStr}
              onChange={e => setStartTimeStr(e.target.value)}
              className="ml-auto t-sm font-mono font-semibold text-slate-900 bg-surface-2 border border-border rounded-lg px-2 py-1 outline-none focus:border-orange-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Position slider */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-border shadow-xl">
          <PositionSlider
            segments={displaySegments}
            elapsedSec={elapsedSec}
            onChange={setElapsedSec}
            displayUnit={displayUnit}
          />
        </div>

        {/* Pace summary */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-border shadow-xl">
          <p className="t-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Pace Summary
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-2 rounded-xl p-3 border border-border">
              <p className="t-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target</p>
              <p className="t-sm font-bold font-mono text-slate-900">{formatDuration(targetSec)}</p>
            </div>
            <div className="bg-surface-2 rounded-xl p-3 border border-border">
              <p className="t-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Projected</p>
              <p className={`t-sm font-bold font-mono ${
                Math.abs(projectedSec - targetSec) < 15 ? 'text-slate-900'
                : projectedSec < targetSec ? 'text-green-600'
                : 'text-red-500'
              }`}>
                {formatDuration(projectedSec)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
