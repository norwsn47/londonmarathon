import { formatDuration } from '../lib/paceUtils';
import type { Segment } from '../lib/types';
import { getPositionAtTime, totalTimeSeconds, MARATHON_KM } from '../lib/paceUtils';

interface Props {
  segments: Segment[];
  elapsedSec: number;
  onChange: (sec: number) => void;
}

export default function PositionSlider({ segments, elapsedSec, onChange }: Props) {
  const totalSec = totalTimeSeconds(segments);
  const posKm = getPositionAtTime(segments, elapsedSec);
  const pct = Math.min(100, (posKm / MARATHON_KM) * 100);

  return (
    <div className="bg-surface rounded-2xl px-4 py-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Where am I?
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400">
            {posKm.toFixed(1)} km
          </span>
          <span className="text-[11px] font-mono text-orange-400 font-semibold">
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
          background: `linear-gradient(to right, #f97316 ${pct}%, #2a2a3d ${pct}%)`,
        }}
        className="w-full"
        aria-label="Elapsed race time"
      />

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-600">Start</span>
        <span className="text-[10px] text-slate-600">Finish</span>
      </div>
    </div>
  );
}
