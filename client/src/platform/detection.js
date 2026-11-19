// FILE: client/src/platform/detection.js
import { Capacitor } from '@capacitor/core';

/**
 * Deteksi apakah aplikasi sedang berjalan di lingkungan native (Android/iOS via Capacitor).
 */
export function isNativePlatform() {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
}

/**
 * Mendapatkan nama platform saat ini: 'android', 'ios', atau 'web'.
 */
export function getPlatform() {
  if (typeof Capacitor !== 'undefined') {
    return Capacitor.getPlatform();
  }
  return 'web';
}

export function isAndroid() {
  return getPlatform() === 'android';
}

export function isIOS() {
  return getPlatform() === 'ios';
}

export function isWeb() {
  return !isNativePlatform();
}

/**
 * Cek apakah aplikasi web sedang dibuka dalam mode PWA Standalone (terpasang di layar utama).
 */
export function isPWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}
