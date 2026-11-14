// FILE: client/src/components/common/BrandLogo.jsx
import { Link } from 'react-router-dom';

export function BrandLogo({ compact = false, light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 min-w-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1 shadow-sm border ${
          light
            ? 'bg-white/10 border-white/20 backdrop-blur-sm'
            : 'bg-pasim-50 border-pasim-100 dark:bg-pasim-900/40 dark:border-pasim-800/60'
        }`}
      >
        <img src="/logo-pasim.png" alt="Logo UNAS PASIM" className="h-full w-full object-contain" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <span
            className={`block truncate text-sm font-extrabold tracking-tight ${
              light ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}
          >
            Portal PASIM
          </span>
          <span
            className={`block truncate text-[10px] font-semibold uppercase tracking-wider ${
              light ? 'text-gold-light' : 'text-pasim dark:text-pasim-300'
            }`}
          >
            UNAS PASIM Bandung
          </span>
        </div>
      )}
    </Link>
  );
}

export default BrandLogo;
