// FILE: client/src/platform/haptics.js
import { isNativePlatform } from './detection';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptic feedback ringan (cocok untuk ketukan tombol umum / pilih kartu)
 */
export async function hapticImpactLight() {
  if (isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // noop
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10);
  }
}

/**
 * Haptic feedback sedang (cocok untuk aksi penting seperti Check, Call, Fold)
 */
export async function hapticImpactMedium() {
  if (isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // noop
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(25);
  }
}

/**
 * Haptic feedback kuat (cocok untuk All-in, Raise besar, atau kemenangan ronde)
 */
export async function hapticImpactHeavy() {
  if (isNativePlatform()) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // noop
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(50);
  }
}

/**
 * Haptic feedback notifikasi sukses (menang game, tugas selesai)
 */
export async function hapticSuccess() {
  if (isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // noop
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([30, 50, 30]);
  }
}

/**
 * Haptic feedback notifikasi error / peringatan
 */
export async function hapticError() {
  if (isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // noop
    }
  } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([50, 100, 50]);
  }
}