import { useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  onSave: (title: string, description: string) => void;
  onCancel: () => void;
}

export default function AddMarkerModal({ lat, lng, onSave, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), description.trim());
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/20" onClick={onCancel}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-slate-900 mb-1">Add spectator spot</h3>
        <p className="text-[11px] text-slate-400 mb-4 font-mono">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Spot name *
            </label>
            <input
              autoFocus
              type="text"
              required
              maxLength={60}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Mile 13 cheer zone, Family meeting point"
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Access / crowd notes (optional)
            </label>
            <textarea
              maxLength={200}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Nearest station, arrive early, meet by the railings…"
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-500/60 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-xl border border-border text-slate-500 text-sm font-semibold hover:text-slate-900 hover:border-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
            >
              Save spot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
