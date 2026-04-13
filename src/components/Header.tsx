import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
}

export default function Header({ user }: Props) {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <header className="flex items-center justify-between py-5 mb-2">
      <div className="flex items-center gap-2.5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <circle cx="14" cy="16" r="10" stroke="#f97316" strokeWidth="2"/>
          <rect x="11.5" y="5" width="5" height="2.5" rx="1.25" fill="#f97316"/>
          <rect x="13.25" y="4" width="1.5" height="2" rx="0.75" fill="#f97316"/>
          <path d="M16 10.5L10.5 17H14.5L12 22.5L19 15.5H15L16 10.5Z" fill="#f97316"/>
        </svg>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight tracking-tight">
            London Marathon Pacer
          </h1>
          <p className="text-xs text-slate-500 leading-none">Plan your perfect race</p>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block truncate max-w-[160px]">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-xs font-semibold text-slate-400 hover:text-white border border-border hover:border-slate-500 px-3 py-1.5 rounded-lg transition-all"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
