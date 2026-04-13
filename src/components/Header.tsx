export default function Header() {
  return (
    <header className="flex items-center py-5 mb-2">
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
    </header>
  );
}
