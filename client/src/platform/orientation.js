// FILE: client/src/platform/orientation.js
import { isNativePlatform } from './detection';
import { ScreenOrientation } from '@capacitor/screen-orientation';

/**
 * Mengunci orientasi layar ke Landscape (dipakai saat masuk room poker/biliar jika user mengaktifkan fullscreen landscape)
 */
export async function lockLandscape() {
  if (isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (err) {
      console.warn('[ScreenOrientation] Gagal mengunci landscape native:', err);
    }
  } else if (
    typeof screen !== 'undefined' &&
    screen.orientation &&
    typeof screen.orientation.lock === 'function'
  ) {
    try {
      await screen.orientation.lock('landscape');
    } catch {
      // browser web sering butuh fullscreen dulu sebelum bisa lock
    }
  }
}

/**
 * Mengunci orientasi layar ke Portrait
 */
export async function lockPortrait() {
  if (isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (err) {
      console.warn('[ScreenOrientation] Gagal mengunci portrait native:', err);
    }
  } else if (
    typeof screen !== 'undefined' &&
    screen.orientation &&
    typeof screen.orientation.lock === 'function'
  ) {
    try {
      await screen.orientation.lock('portrait');
    } catch {
      // noop
    }
  }
}

/**
 * Membuka kunci orientasi layar sehingga rotasi kembali bebas mengikuti sensor perangkat
 */
export async function unlockOrientation() {
  if (isNativePlatform()) {
    try {
      await ScreenOrientation.unlock();
    } catch (err) {
      console.warn('[ScreenOrientation] Gagal membuka kunci orientasi native:', err);
    }
  } else if (
    typeof screen !== 'undefined' &&
    screen.orientation &&
    typeof screen.orientation.unlock === 'function'
  ) {
    try {
      screen.orientation.unlock();
    } catch {
      // noop
    }
  }
}