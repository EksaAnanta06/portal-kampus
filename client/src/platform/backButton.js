// FILE: client/src/platform/backButton.js
import { isNativePlatform } from './detection';
import { App as CapacitorApp } from '@capacitor/app';

// Antrean handler modal / dialog / overlay teratas
const customBackHandlers = [];

/**
 * Daftarkan handler kustom untuk tombol back (misal dialog, drawer, bottom sheet aktif).
 * Mengembalikan fungsi unsubscribe.
 * Handler harus mengembalikan `true` jika aksi back telah ditangani dan tidak boleh dilanjutkan.
 */
export function registerBackHandler(handler) {
  customBackHandlers.push(handler);
  return () => {
    const idx = customBackHandlers.indexOf(handler);
    if (idx !== -1) {
      customBackHandlers.splice(idx, 1);
    }
  };
}

let lastBackPressTime = 0;

/**
 * Inisialisasi pendengar tombol back fisik Android
 * @param {object} options
 * @param {(path: string) => void} options.navigate - Fungsi navigasi react-router
 * @param {() => string} options.getCurrentPath - Fungsi membaca path URL saat ini
 * @param {(msg: string) => void} [options.showToast] - Fungsi menampilkan pesan singkat
 */
export function initBackButtonListener({ navigate, getCurrentPath, showToast }) {
  if (!isNativePlatform()) return () => {};

  const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    // 1. Periksa handler kustom teratas (dialog/modal/bottom-sheet aktif)
    if (customBackHandlers.length > 0) {
      const topHandler = customBackHandlers[customBackHandlers.length - 1];
      const handled = topHandler();
      if (handled) return;
    }

    const currentPath = getCurrentPath ? getCurrentPath() : window.location.pathname;

    // 2. Jika sedang di dalam meja poker aktif, tanyakan konfirmasi keluar room
    if (currentPath.startsWith('/poker/room')) {
      const confirmLeave = window.confirm('Apakah Anda yakin ingin keluar dari permainan poker?');
      if (confirmLeave) {
        navigate('/poker');
      }
      return;
    }

    // 3. Jika di halaman akar (Home atau Login), butuh 2x tekan untuk keluar dari aplikasi
    const isRootPage = currentPath === '/' || currentPath === '/login';
    if (isRootPage) {
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPressTime = now;
        const msg = 'Tekan sekali lagi untuk keluar dari aplikasi';
        if (typeof showToast === 'function') {
          showToast(msg);
        } else {
          // Fallback sederhana jika tidak ada toast UI
          console.info(msg);
        }
      }
      return;
    }

    // 4. Navigasi mundur pada riwayat browser
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  });

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}