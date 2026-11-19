// FILE: client/src/components/pwa/UpdateBanner.jsx
import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativePlatform } from '../../platform/detection';

/**
 * Banner notifikasi pembaruan aplikasi PWA.
 * Aturan Penting:
 * - Tidak muncul di native Capacitor
 * - Tidak mengganggu atau memuat ulang otomatis di tengah permainan poker atau sesi fokus aktif
 */
export default function UpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (isNativePlatform()) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // Jika ada worker yang sudah menunggu update
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowBanner(true);
      }

      // Dengarkan jika ada service worker baru yang sedang diunduh/install
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowBanner(true);
          }
        });
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowBanner(false);
  }, [waitingWorker]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
  }, []);

  // Jangan tampilkan banner jika di dalam meja poker aktif agar tidak mengganggu fokus bermain
  const isInsidePokerRoom = location.pathname.startsWith('/poker/room');
  if (!showBanner || isInsidePokerRoom) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-blue-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all duration-300 sm:left-auto sm:right-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/30 text-blue-400">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white">Versi Baru Tersedia</h4>
          <p className="mt-0.5 text-xs text-slate-300">
            Pembaruan Portal Pasim telah siap. Muat ulang sekarang untuk mendapatkan fitur terbaru.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdate}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-500 active:scale-95 transition-all"
            >
              Perbarui Sekarang
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
      </div>
    </div>
  );
}