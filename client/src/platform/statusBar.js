// FILE: client/src/platform/statusBar.js
import { isNativePlatform } from './detection';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Sinkronkan status bar native dengan tema (gelap atau terang)
 * @param {'dark' | 'light'} mode - Mode tema aplikasi
 * @param {string} [color] - Warna heksadesimal background status bar (khusus Android)
 */
export async function syncStatusBarTheme(mode = 'dark', color = '#0f172a') {
  if (isNativePlatform()) {
    try {
      await StatusBar.setStyle({
        style: mode === 'dark' ? Style.Dark : Style.Light,
      });
      await StatusBar.setBackgroundColor({ color });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (err) {
      console.warn('[StatusBar] Gagal mengatur status bar native:', err);
    }
  } else if (typeof document !== 'undefined') {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', color);
    }
  }
}

/**
 * Sembunyikan status bar untuk mode layar penuh imersif (misal saat game poker)
 */
export async function hideStatusBar() {
  if (isNativePlatform()) {
    try {
      await StatusBar.hide();
    } catch {
      // noop
    }
  }
}

/**
 * Tampilkan kembali status bar
 */
export async function showStatusBar() {
  if (isNativePlatform()) {
    try {
      await StatusBar.show();
    } catch {
      // noop
    }
  }
}