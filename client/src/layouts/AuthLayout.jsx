// FILE: client/src/layouts/AuthLayout.jsx
import { Outlet, Link } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { BrandLogo } from '../components/common/BrandLogo';
import { ThemeToggleButton } from '../components/common/ThemeToggleButton';
import { CAMPUS_INFO } from '../utils/constants';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Kolom kiri: Hero visual (desktop) dengan latar foto kampus PASIM & Glassmorphism Card */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 p-10 xl:p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Background Foto Gedung Kampus PASIM HD */}
        <div className="absolute inset-0 z-0">
          <img
            src="/kampus-pasim.jpg"
            alt="Gedung Kampus UNAS PASIM Bandung"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover object-[48%_36%] filter brightness-[0.88] contrast-[1.05]"
          />
          {/* Natural Vignette: Lapisan gradient gelap elegan dan serasi dengan warna foto */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-900/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/30 to-transparent" />
          {/* Aksen warna brand PASIM tipis dan halus */}
          <div className="absolute inset-0 bg-pasim-950/20 mix-blend-color" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo light />
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full bg-slate-900/40 px-3.5 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/20 hover:text-white border border-white/15 shadow-sm"
          >
            <ArrowBackRoundedIcon fontSize="small" />
            Ke Beranda
          </Link>
        </div>

        {/* Hero Card yang Menyatu Harmonis (Glassmorphism Elegan) */}
        <div className="relative z-10 max-w-lg rounded-3xl bg-slate-950/60 p-6 sm:p-7 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-pasim-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-200 border border-pasim-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-pasim-400 animate-pulse" />
            Kampus Dakota • Cicendo Bandung
          </div>

          <h1 className="mt-3.5 text-2xl xl:text-3xl font-extrabold leading-snug tracking-tight text-white m-0">
            Dokumentasi & Jejaring Sivitas Kampus Dakota.
          </h1>

          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300 font-normal mb-0">
            Ruang terpadu arsip kenangan angkatan, warta akademik resmi, dan direktori jejaring mahasiswa serta alumni {CAMPUS_INFO.name}.
          </p>

          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 font-medium">
            <span>🏛️ Gedung Rektorat</span>
            <span>🎓 12+ Angkatan</span>
            <span>✨ Terverifikasi</span>
          </div>
        </div>

        {/* Footer info yang bersih dan tidak bertabrakan */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/10">
          <span>© {new Date().getFullYear()} {CAMPUS_INFO.name}</span>
          <span>Jl. Dr. Dakota No. 8A, Bandung</span>
        </div>
      </div>

      {/* Kolom kanan: Form Login (dilengkapi background foto kampus & gradient halus di mobile) */}
      <div className="relative flex flex-1 flex-col min-h-screen overflow-hidden">
        {/* Background Foto Gedung Kampus PASIM di Mobile */}
        <div className="absolute inset-0 z-0 lg:hidden pointer-events-none overflow-hidden">
          <img
            src="/kampus-pasim.jpg"
            alt="Kampus UNAS PASIM"
            className="h-full w-full object-cover object-[48%_30%] filter brightness-[0.70] contrast-[1.05]"
          />
          {/* Lapisan Gradient Gelap yang serasi dengan warna PASIM (Deep Slate & Maroon) */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 via-slate-950/85 to-pasim-950/90" />
        </div>

        <header className="relative z-10 flex items-center justify-between p-4 sm:p-6 lg:justify-end">
          <div className="lg:hidden">
            <BrandLogo light />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <Link
              to="/"
              className="hidden items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 sm:flex dark:text-slate-300 dark:hover:text-white"
            >
              <ArrowBackRoundedIcon fontSize="small" />
              Ke Beranda
            </Link>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
