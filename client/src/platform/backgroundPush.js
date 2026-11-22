// FILE: client/src/platform/backgroundPush.js
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './detection';

const PUSH_STREAM_TOKEN_KEY = 'pasim_bg_push_stream_token';
const PUSH_STREAM_USER_KEY = 'pasim_bg_push_user_id';

const NativePushService = registerPlugin('NativePushService');

/**
 * Mengecek apakah plugin NativePushService (Android Foreground Service) tersedia pada APK saat ini.
 */
export function isNativePushServiceAvailable() {
  return isNativePlatform() && Capacitor.isPluginAvailable('NativePushService');
}

export async function getStoredPushStreamMeta() {
  if (!isNativePlatform()) return { streamToken: null, userId: null };
  try {
    const [tokenRes, userRes] = await Promise.all([
      Preferences.get({ key: PUSH_STREAM_TOKEN_KEY }),
      Preferences.get({ key: PUSH_STREAM_USER_KEY }),
    ]);
    return {
      streamToken: tokenRes?.value || null,
      userId: userRes?.value || null,
    };
  } catch {
    return { streamToken: null, userId: null };
  }
}

export async function getStoredPushStreamToken() {
  const meta = await getStoredPushStreamMeta();
  return meta.streamToken;
}

async function setStoredPushStreamMeta({ streamToken, userId }) {
  if (!isNativePlatform()) return;
  try {
    if (streamToken) {
      await Preferences.set({ key: PUSH_STREAM_TOKEN_KEY, value: String(streamToken) });
    }
    if (userId != null) {
      await Preferences.set({ key: PUSH_STREAM_USER_KEY, value: String(userId) });
    }
  } catch {
    // Abaikan kegagalan storage non-kritikal
  }
}

async function clearStoredPushStreamMeta() {
  if (!isNativePlatform()) return;
  try {
    await Promise.all([
      Preferences.remove({ key: PUSH_STREAM_TOKEN_KEY }),
      Preferences.remove({ key: PUSH_STREAM_USER_KEY }),
    ]);
  } catch {
    // Abaikan
  }
}

export async function isNativeBackgroundPushConfigured() {
  if (!isNativePushServiceAvailable()) return false;
  try {
    const res = await NativePushService.isConfigured();
    return Boolean(res?.configured);
  } catch {
    return false;
  }
}

export async function startNativeBackgroundPush({
  apiBaseUrl,
  streamToken,
  lastNotificationId = 0,
  userId = null,
}) {
  if (!isNativePushServiceAvailable() || !apiBaseUrl || !streamToken) {
    return false;
  }

  await setStoredPushStreamMeta({ streamToken, userId });
  await NativePushService.startService({
    serverUrl: apiBaseUrl,
    streamToken,
    lastNotificationId: Number(lastNotificationId) || 0,
  });
  return true;
}

export async function stopNativeBackgroundPush() {
  const oldToken = await getStoredPushStreamToken();
  await clearStoredPushStreamMeta();
  if (isNativePushServiceAvailable()) {
    await NativePushService.stopService().catch(() => {});
  }
  return oldToken;
}

export async function syncNativePushLastId(id) {
  if (!isNativePushServiceAvailable()) return;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) return;
  await NativePushService.updateLastNotificationId({ lastNotificationId: numericId }).catch(() => {});
}

export function onNativePushNotificationReceived(callback) {
  if (!isNativePushServiceAvailable() || typeof callback !== 'function') {
    return () => {};
  }

  const handlePromise = NativePushService.addListener('notificationReceived', (event) => {
    callback(event);
  });

  return () => {
    Promise.resolve(handlePromise)
      .then((handle) => handle?.remove?.())
      .catch(() => {});
  };
}

export function initNativePushLinkListener(navigate) {
  if (!isNativePushServiceAvailable()) {
    return () => {};
  }

  const handlePromise = NativePushService.addListener('notificationLinkTapped', (event) => {
    if (event?.link && typeof navigate === 'function') {
      navigate(event.link);
    }
  });

  NativePushService.consumePendingLink()
    .then((res) => {
      if (res?.link && typeof navigate === 'function') {
        navigate(res.link);
      }
    })
    .catch(() => {});

  return () => {
    Promise.resolve(handlePromise)
      .then((handle) => handle?.remove?.())
      .catch(() => {});
  };
}
