import { formatDuration } from '../lib/paceUtils';
import type { Segment } from '../lib/types';
import { getPositionAtTime, totalTimeSeconds, MARATHON_KM } from '../lib/paceUtils';

interface Props {
  segments: Segment[];
  elapsedSec: number;
  onChange: (sec: number) => void;
  displayUnit?: 'km' | 'mi';
}

export default function PositionSlider({ segments, elapsedSec, onChange, displayUnit = 'km' }: Props) {
  const totalSec = totalTimeSeconds(segments);
  const posKm = getPositionAtTime(segments, elapsedSec);
  const pct = Math.min(100, (posKm / MARATHON_KM) * 100);
  const posDisplay = displayUnit === 'mi'
    ? `${(posKm * 0.621371).toFixed(1)} mi`
    : `${posKm.toFixed(1)} km`;

  return (
    <div className="bg-surface rounded-2xl px-4 py-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="t-xs font-semibold text-slate-500 uppercase tracking-widest">
          Where am I?
        </p>
        <div className="flex items-center gap-3">
          <span className="t-xs font-mono text-slate-500">
            {posDisplay}
          </span>
          <span className="t-xs font-mono text-orange-600 font-semibold">
            {formatDuration(elapsedSec)}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.round(totalSec)}
        step={30}
        value={elapsedSec}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, #f97316 ${pct}%, #e2e8f0 ${pct}%)`,
        }}
        className="w-full"
        aria-label="Elapsed race time"
      />

      <div className="flex justify-between mt-1">
        <span className="t-xs text-slate-400">Start</span>
        <span className="t-xs text-slate-400">Finish</span>
      </div>
    </div>
  );
}
