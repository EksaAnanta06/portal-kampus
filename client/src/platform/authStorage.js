// FILE: client/src/platform/authStorage.js
import { isNativePlatform } from './detection';
import { Preferences } from '@capacitor/preferences';

const REFRESH_TOKEN_KEY = 'pasim_native_rt';

/**
 * Mengambil refresh token pada klien native dari penyimpanan aman.
 * Pada web browser standar, fungsi ini mengembalikan null karena web mengandalkan cookie httpOnly.
 */
export async function getNativeRefreshToken() {
  if (!isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return value || null;
  } catch (err) {
    console.warn('[Platform AuthStorage] Gagal mengambil token:', err);
    return null;
  }
}

/**
 * Menyimpan refresh token pada klien native setelah login atau rotasi token.
 */
export async function setNativeRefreshToken(token) {
  if (!isNativePlatform() || !token) return;
  try {
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
  } catch (err) {
    console.warn('[Platform AuthStorage] Gagal menyimpan token:', err);
  }
}

/**
 * Menghapus refresh token saat logout pada klien native.
 */
export async function clearNativeRefreshToken() {
  if (!isNativePlatform()) return;
  try {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  } catch (err) {
    console.warn('[Platform AuthStorage] Gagal menghapus token:', err);
  }
}
