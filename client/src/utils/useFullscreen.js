// FILE: client/src/utils/useFullscreen.js
import { useState, useEffect, useCallback } from 'react';

/**
 * Cek apakah browser saat ini sedang dalam mode Fullscreen.
 */
export function isFullscreenActive() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
  );
}

/**
 * Cek apakah browser mendukung Fullscreen API.
 */
export function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled ||
      document.documentElement?.requestFullscreen ||
      document.documentElement?.webkitRequestFullscreen
  );
}

/**
 * Minta layar penuh (Fullscreen) dengan menyembunyikan navigasi / address bar browser Chrome Android.
 */
export async function requestAppFullscreen(targetElement = null) {
  if (typeof document === 'undefined') return false;
  try {
    const el = targetElement || document.documentElement;
    if (el.requestFullscreen) {
      // navigationUI: 'hide' menyembunyikan address bar & navigasi browser di Chrome Android
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }

    // Pastikan orientasi layar bebas berputar antara vertikal dan horizontal
    if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.unlock) {
      try {
        screen.orientation.unlock();
      } catch (_e) {
        // Abaikan jika browser tidak mengizinkan unlock
      }
    }
    return true;
  } catch (err) {
    console.warn('Layar penuh tidak dapat diaktifkan:', err);
    return false;
  }
}

/**
 * Keluar dari mode layar penuh.
 */
export async function exitAppFullscreen() {
  if (typeof document === 'undefined') return false;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      await document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      await document.msExitFullscreen();
    }
    return true;
  } catch (err) {
    console.warn('Gagal keluar dari layar penuh:', err);
    return false;
  }
}

/**
 * React Hook untuk mengelola status Fullscreen dan sinkronisasi real-time.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => isFullscreenActive());
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(isFullscreenSupported());
    setIsFullscreen(isFullscreenActive());

    const handleFullscreenChange = () => {
      setIsFullscreen(isFullscreenActive());
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (isFullscreenActive()) {
      await exitAppFullscreen();
    } else {
      await requestAppFullscreen();
    }
  }, []);

  return {
    isFullscreen,
    isSupported,
    enter: requestAppFullscreen,
    exit: exitAppFullscreen,
    toggle,
  };
}
