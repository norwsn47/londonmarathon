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
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import CourseMap from './components/CourseMap';
import PositionSlider from './components/PositionSlider';
import AddMarkerModal from './components/AddMarkerModal';

// Pre-populated official course markers — edit / extend as needed
const OFFICIAL_MARKERS: CourseMarker[] = [
  { id: 'start',        lat: 51.4878,  lng:  0.0063,  title: 'Start Line',     description: 'Blackheath — Championship & Mass start', type: 'official' },
  { id: 'km10',         lat: 51.4938,  lng: -0.0518,  title: '10 km',          description: 'Charlton Way / Woolwich Road',            type: 'official' },
  { id: 'tower-bridge', lat: 51.5055,  lng: -0.0754,  title: 'Tower Bridge',   description: '~12.5 km — iconic crossing',              type: 'official' },
  { id: 'half',         lat: 51.5074,  lng: -0.0834,  title: 'Half Marathon',  description: '21.1 km',                                 type: 'official' },
  { id: 'km30',         lat: 51.4855,  lng: -0.0541,  title: '30 km',          description: 'Isle of Dogs turnaround',                 type: 'official' },
  { id: 'km40',         lat: 51.5007,  lng: -0.1196,  title: '40 km',          description: 'Embankment — nearly there!',              type: 'official' },
  { id: 'finish',       lat: 51.5015,  lng: -0.1247,  title: 'Finish Line',    description: 'The Mall — Buckingham Palace',            type: 'official' },
];

const DEFAULT_TARGET = 4 * 3600;

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // Auth modal
  const [showAuth, setShowAuth] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>();

  function promptSignIn(reason?: string) {
    setAuthReason(reason);
    setShowAuth(true);
  }

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
  const [userMarkers, setUserMarkers] = useState<CourseMarker[]>([]);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [addingMarker, setAddingMarker] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

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

  const allMarkers = useMemo(() => [...OFFICIAL_MARKERS, ...userMarkers], [userMarkers]);

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

  // Load this user's saved markers from Supabase
  useEffect(() => {
    if (!user) { setUserMarkers([]); return; }
    supabase
      .from('markers')
      .select('*')
      .eq('created_by', user.id)
      .then(({ data }) => {
        if (data) setUserMarkers(data as CourseMarker[]);
      });
  }, [user]);

  // When auth modal closes after sign-in, resume any pending action
  useEffect(() => {
    if (user && showAuth) setShowAuth(false);
  }, [user, showAuth]);

  function handleAddMarkerClick() {
    if (!user) {
      promptSignIn('Sign in to save markers on the course');
      return;
    }
    setAddingMarker(v => !v);
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!addingMarker || !user) return;
    setPendingLatLng({ lat, lng });
  }, [addingMarker, user]);

  async function saveMarker(title: string, description: string) {
    if (!pendingLatLng || !user) return;
    const newMarker = {
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      title,
      description,
      type: 'user' as const,
      created_by: user.id,
    };
    const { data, error } = await supabase.from('markers').insert(newMarker).select().single();
    if (!error && data) setUserMarkers(prev => [...prev, data as CourseMarker]);
    setPendingLatLng(null);
    setAddingMarker(false);
  }

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

  // Brief loading spinner while Supabase checks for an existing session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d12] text-slate-100 font-sans">
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <Header user={user} onSignInClick={() => promptSignIn()} />

        <div className="space-y-4">
          {/* Course map */}
          <CourseMap
            gpxPoints={gpxPoints}
            markers={allMarkers}
            positionKm={positionKm}
            onMapClick={handleMapClick}
            canAddMarkers={addingMarker}
          />

          {/* Add marker / login prompt */}
          <div className="flex items-center justify-between">
            {!user && (
              <p className="text-xs text-slate-500">
                <button
                  onClick={() => promptSignIn('Sign in to save your own markers')}
                  className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
                >
                  Sign in
                </button>
                {' '}to add your own markers
              </p>
            )}
            <div className="ml-auto">
              <button
                onClick={handleAddMarkerClick}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                  addingMarker
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                    : 'bg-surface border-border text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                {addingMarker ? '✕ Cancel' : '+ Add marker'}
              </button>
            </div>
          </div>

          {/* Target time presets */}
          <div className="bg-surface rounded-2xl p-4 border border-border">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
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
                  className={`text-sm font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    targetSec === sec
                      ? 'bg-orange-500/20 border-orange-500/60 text-orange-400'
                      : 'bg-surface-2 border-border text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">Strategy:</span>
                {(['even', 'negative'] as Strategy[]).map(s => (
                  <button
                    key={s}
                    onClick={() => handleStrategySelect(s)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                      strategy === s
                        ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                        : 'border-border text-slate-500 hover:text-white'
                    }`}
                  >
                    {s === 'even' ? 'Even' : 'Negative'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Position slider */}
          <PositionSlider
            segments={displaySegments}
            elapsedSec={elapsedSec}
            onChange={setElapsedSec}
          />

          {/* Pace summary */}
          <div className="bg-surface rounded-2xl p-4 border border-border">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Pace Summary
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-xl p-3 border border-border">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Target</p>
                <p className="text-sm font-bold font-mono text-white">{formatDuration(targetSec)}</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 border border-border">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Projected</p>
                <p className={`text-sm font-bold font-mono ${
                  Math.abs(projectedSec - targetSec) < 15 ? 'text-white'
                  : projectedSec < targetSec ? 'text-green-400'
                  : 'text-red-400'
                }`}>
                  {formatDuration(projectedSec)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAuth && (
        <AuthModal reason={authReason} onClose={() => setShowAuth(false)} />
      )}
      {pendingLatLng && (
        <AddMarkerModal
          lat={pendingLatLng.lat}
          lng={pendingLatLng.lng}
          onSave={saveMarker}
          onCancel={() => { setPendingLatLng(null); setAddingMarker(false); }}
        />
      )}
    </div>
  );
}
