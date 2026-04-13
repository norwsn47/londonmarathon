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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl max-w-sm w-full p-5 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-white mb-1">Add marker</h3>
        <p className="text-[11px] text-slate-500 mb-4 font-mono">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Title *
            </label>
            <input
              autoFocus
              type="text"
              required
              maxLength={60}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Cheering point, Baggage, Water"
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Notes (optional)
            </label>
            <textarea
              maxLength={200}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any notes…"
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/60 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded-xl border border-border text-slate-400 text-sm font-semibold hover:text-white hover:border-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
