// FILE: client/src/services/nativePushSync.js
import { API_BASE_URL } from '../api/axiosInstance';
import { campusApi } from '../api/campus.api';
import {
  getNativeNotificationStatus,
  isNativePushServiceAvailable,
  isNativeBackgroundPushConfigured,
  getStoredPushStreamMeta,
  startNativeBackgroundPush,
  stopNativeBackgroundPush,
} from '../platform';

let inFlightEnsure = null;

/**
 * Memastikan Android Foreground Service (NotificationPushService) berjalan dengan token stream valid.
 */
export async function ensureNativeBackgroundPush({ forceNew = false, userId = null } = {}) {
  if (!isNativePushServiceAvailable()) return false;
  if (inFlightEnsure && !forceNew) return inFlightEnsure;

  const task = (async () => {
    const status = await getNativeNotificationStatus();
    if (!status.enabled) {
      await stopNativeBackgroundPush().catch(() => {});
      return false;
    }

    const [stored, nativeConfigured] = await Promise.all([
      getStoredPushStreamMeta(),
      isNativeBackgroundPushConfigured(),
    ]);

    const userChanged =
      userId != null && stored.userId != null && String(userId) !== String(stored.userId);

    if (!forceNew && !userChanged && nativeConfigured && stored.streamToken) {
      await startNativeBackgroundPush({
        apiBaseUrl: API_BASE_URL,
        streamToken: stored.streamToken,
        lastNotificationId: 0,
        userId: userId ?? stored.userId,
      });
      return true;
    }

    if (userChanged && stored.streamToken) {
      await campusApi.revokeNotificationPushSession(stored.streamToken).catch(() => {});
    }

    const res = await campusApi.createNotificationPushSession();
    const { streamToken, latestNotificationId } = res.data || {};
    if (!streamToken) return false;

    await startNativeBackgroundPush({
      apiBaseUrl: API_BASE_URL,
      streamToken,
      lastNotificationId: latestNotificationId || 0,
      userId: userId ?? stored.userId,
    });
    return true;
  })();

  inFlightEnsure = task.finally(() => {
    if (inFlightEnsure === task) {
      inFlightEnsure = null;
    }
  });
  return inFlightEnsure;
}

/**
 * Menghentikan service notifikasi latar belakang dan mencabut token stream di server (mis. saat logout/dimatikan).
 */
export async function teardownNativeBackgroundPush() {
  const oldToken = await stopNativeBackgroundPush().catch(() => null);
  if (oldToken) {
    await campusApi.revokeNotificationPushSession(oldToken).catch(() => {});
  }
}
