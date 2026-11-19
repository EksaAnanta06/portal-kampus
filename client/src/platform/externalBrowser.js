// FILE: client/src/platform/externalBrowser.js
import { isNativePlatform } from './detection';
import { Browser } from '@capacitor/browser';

/**
 * Membuka URL eksternal secara aman di browser sistem atau In-App Browser tab.
 * Mencegah pengguna terjebak di situs pihak ketiga dalam WebView aplikasi utama.
 */
export async function openExternalUrl(url) {
  if (!url) return;
  if (isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch (err) {
      console.warn('[ExternalBrowser] Gagal membuka browser Capacitor:', err);
    }
  }

  // Web fallback
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}