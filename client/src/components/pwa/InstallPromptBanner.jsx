// FILE: client/src/components/pwa/InstallPromptBanner.jsx
import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativePlatform, isPWA } from '../../platform/detection';

const DISMISS_KEY = 'pasim_pwa_install_dismissed_until';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isIosSafari() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWebview = /CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && !isWebview;
}

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Jangan muncul jika di aplikasi native Capacitor atau sudah terpasang PWA standalone
    if (isNativePlatform() || isPWA()) return;

    // Cek apakah pernah ditutup dalam 7 hari terakhir
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    // Handler event beforeinstallprompt (Chromium / Android / Desktop)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Munculkan ajakan setelah pengguna berinteraksi / aktif beberapa detik (tidak mengganggu)
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Untuk iOS Safari (yang tidak mendukung beforeinstallprompt)
    if (isIosSafari() && !isPWA()) {
      const iosTimer = setTimeout(() => {
        setShowIosGuide(true);
      }, 7000);
      return () => {
        clearTimeout(iosTimer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    setShowPrompt(false);
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * SEVEN_DAYS_MS));
      } else {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS_MS));
      }
    } catch {
      // noop
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setShowIosGuide(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS_MS));
  }, []);

  // Sembunyikan jika sedang di ruang poker aktif
  const isInsidePokerRoom = location.pathname.startsWith('/poker/room');
  if (isInsidePokerRoom) return null;

  // Banner untuk browser Chromium / Android
  if (showPrompt && deferredPrompt) {
    return (
      <div
        role="region"
        aria-label="Pemasangan Aplikasi"
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all sm:left-auto sm:right-6"
      >
        <div className="flex items-start gap-3.5">
          <img
            src="/logo-pasim.png"
            alt="Logo Portal Pasim"
            className="h-11 w-11 rounded-xl object-contain bg-slate-800 p-1 shadow-inner flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white">Pasang Portal Pasim</h4>
            <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">
              Akses cepat tanpa browser, responsif, dan hemat kuota langsung dari layar utama perangkat Anda.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 active:scale-95 transition-all"
              >
                Pasang Aplikasi
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Nanti
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup"
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Banner petunjuk untuk iOS Safari
  if (showIosGuide) {
    return (
      <div
        role="region"
        aria-label="Petunjuk Pemasangan iOS"
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all sm:left-auto sm:right-6"
      >
        <div className="flex items-start gap-3.5">
          <img
            src="/logo-pasim.png"
            alt="Logo Portal Pasim"
            className="h-10 w-10 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white">Tambahkan ke Layar Utama</h4>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              Buka menu browser dengan mengetuk tombol{' '}
              <span className="inline-flex items-center px-1 py-0.5 rounded bg-slate-800 font-medium text-slate-200">
                Bagikan <span className="ml-1">⎋</span>
              </span>{' '}
              lalu pilih <strong className="text-white">Tambah ke Layar Utama</strong>.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all"
              >
                Mengerti
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup"
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}