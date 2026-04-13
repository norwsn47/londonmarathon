import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
  /** Optional prompt shown above the form, e.g. "Sign in to save markers" */
  reason?: string;
}

type Step = 'email' | 'sent';

export default function AuthModal({ onClose, reason }: Props) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect back to wherever the app is hosted
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setStep('sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Sign in</h2>
            {reason && (
              <p className="text-xs text-slate-400 mt-0.5">{reason}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-white text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/60 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>

            <p className="text-center text-xs text-slate-500">
              We'll email you a link — no password needed.
            </p>
          </form>
        ) : (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-sm font-semibold text-white mb-1">Check your inbox</p>
            <p className="text-xs text-slate-400 mb-4">
              We sent a magic link to <span className="text-slate-200">{email}</span>.
              Click it to sign in — you can close this.
            </p>
            <button
              onClick={() => { setStep('email'); setEmail(''); }}
              className="text-xs text-slate-500 hover:text-orange-400 transition-colors"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
