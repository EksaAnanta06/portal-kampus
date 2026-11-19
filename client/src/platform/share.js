// FILE: client/src/platform/share.js
import { isNativePlatform } from './detection';
import { Share } from '@capacitor/share';

/**
 * Berbagi teks atau tautan ke aplikasi lain (WhatsApp, Telegram, dsb).
 * Di Native: Lembar berbagi sistem Android/iOS.
 * Di Web: Web Share API jika didukung, atau fallback ke Clipboard.
 */
export async function shareContent({ title, text, url, dialogTitle = 'Bagikan ke Teman' }) {
  if (isNativePlatform()) {
    try {
      await Share.share({ title, text, url, dialogTitle });
      return true;
    } catch (err) {
      console.warn('[Share] Gagal memanggil native share:', err);
    }
  }

  // Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      // Pembatalan user atau tidak didukung
    }
  }

  // Fallback Web: Salin ke clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // noop
    }
  }

  return false;
}