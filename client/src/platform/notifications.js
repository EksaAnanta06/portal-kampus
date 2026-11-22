// FILE: client/src/platform/notifications.js
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './detection';

const NATIVE_NOTIF_PREF_KEY = 'pasim_native_notif_enabled';
export const CHANNEL_GENERAL = 'pasim_general';
export const CHANNEL_FOCUS = 'pasim_focus';
export const CHANNEL_FOCUS_STATUS = 'pasim_focus_status';

const FOCUS_TIMER_NOTIF_ID = 900001;
const CONFIRM_NOTIF_ID = 900002;
const FOCUS_ACTIVE_NOTIF_ID = 900003;

const NOTIFICATION_SMALL_ICON = 'ic_stat_pasim';
const NOTIFICATION_LARGE_ICON = 'ic_notif_pasim';
const NOTIFICATION_ICON_COLOR = '#8B1E24';

let channelsInitialized = false;

/**
 * Mendaftarkan kanal notifikasi Android (idempoten, aman dipanggil berulang).
 */
export async function ensureNativeNotificationChannels() {
  if (!isNativePlatform() || channelsInitialized) return;

  const channels = [
    {
      id: CHANNEL_GENERAL,
      name: 'Notifikasi Portal Kampus',
      description: 'Info kampus, materi, komentar, dan aktivitas akun.',
      importance: 4,
      visibility: 1,
      vibration: true,
    },
    {
      id: CHANNEL_FOCUS,
      name: 'Timer Fokus & Pengingat Belajar',
      description: 'Alarm sesi Pomodoro dan pengingat jadwal/deadline tugas.',
      importance: 4,
      visibility: 1,
      vibration: true,
    },
    {
      id: CHANNEL_FOCUS_STATUS,
      name: 'Status Timer Pomodoro',
      description: 'Menampilkan status sesi Pomodoro yang sedang berjalan atau dijeda.',
      importance: 3,
      visibility: 1,
      vibration: false,
    },
  ];

  for (const ch of channels) {
    try {
      await LocalNotifications.createChannel(ch);
    } catch {
      // Abaikan pada platform non-Android / API lama
    }
  }

  channelsInitialized = true;
}

/**
 * Membaca izin runtime (POST_NOTIFICATIONS) dan status notifikasi tingkat OS Android.
 */
async function readNativePermissionState() {
  const perm = await LocalNotifications.checkPermissions();
  const areEnabledRes = await LocalNotifications.areEnabled().catch(() => ({ value: true }));
  const osEnabled = areEnabledRes?.value !== false;
  return {
    perm,
    osEnabled,
    granted: perm?.display === 'granted' && osEnabled,
  };
}

/**
 * Memastikan kanal & izin notifikasi Android aktif; meminta izin jika diminta.
 */
async function assertNativePermission({ request = false } = {}) {
  await ensureNativeNotificationChannels();

  let state = await readNativePermissionState();
  if (request && state.perm?.display !== 'granted') {
    await LocalNotifications.requestPermissions();
    state = await readNativePermissionState();
  }

  if (!state.granted) {
    throw new Error(
      'Izin notifikasi Android masih nonaktif. Aktifkan di Pengaturan HP → Aplikasi → Portal Pasim → Notifikasi.'
    );
  }
  return state;
}

/**
 * Membentuk objek payload dasar notifikasi Android lengkap dengan ikon Universitas Nasional Pasim.
 */
function buildNotificationPayload({
  id,
  channelId = CHANNEL_GENERAL,
  title,
  body,
  extra,
  ongoing = false,
  autoCancel = true,
  schedule,
}) {
  const bodyText = String(body || '');
  return {
    id,
    channelId,
    title: String(title || 'Portal Pasim'),
    body: bodyText,
    largeBody: bodyText,
    smallIcon: NOTIFICATION_SMALL_ICON,
    largeIcon: NOTIFICATION_LARGE_ICON,
    iconColor: NOTIFICATION_ICON_COLOR,
    ongoing,
    autoCancel,
    ...(schedule ? { schedule } : {}),
    ...(extra ? { extra } : {}),
  };
}

/**
 * Mengirim payload notifikasi Android secara langsung via notificationManager.notify() (tanpa AlarmManager).
 */
async function notifyImmediately({
  id,
  channelId = CHANNEL_GENERAL,
  title,
  body,
  extra,
  ongoing = false,
  autoCancel = true,
}) {
  await LocalNotifications.schedule({
    notifications: [
      buildNotificationPayload({
        id,
        channelId,
        title,
        body,
        extra,
        ongoing,
        autoCancel,
      }),
    ],
  });
}

/**
 * Mengecek izin Exact Alarm Android (Android 12+) untuk ketepatan alarm Pomodoro background.
 */
export async function getExactAlarmStatus() {
  if (!isNativePlatform()) return 'granted';
  try {
    const res = await LocalNotifications.checkExactNotificationSetting();
    return res?.exact_alarm || 'granted';
  } catch {
    return 'granted';
  }
}

/**
 * Membuka halaman pengaturan izin Alarm & Pengingat Android untuk Portal Pasim.
 */
export async function openExactAlarmSettings() {
  if (!isNativePlatform()) return 'granted';
  try {
    const res = await LocalNotifications.changeExactNotificationSetting();
    return res?.exact_alarm || (await getExactAlarmStatus());
  } catch {
    return getExactAlarmStatus();
  }
}

/**
 * Mengecek status izin sistem & preferensi notifikasi lokal pada perangkat native.
 */
export async function getNativeNotificationStatus() {
  if (!isNativePlatform()) {
    return {
      supported: false,
      granted: false,
      osEnabled: false,
      enabled: false,
      permission: 'unsupported',
      exactAlarm: 'granted',
    };
  }

  try {
    const [{ perm, osEnabled, granted }, prefRes, exactAlarm] = await Promise.all([
      readNativePermissionState(),
      Preferences.get({ key: NATIVE_NOTIF_PREF_KEY }),
      getExactAlarmStatus(),
    ]);
    const enabled = granted && prefRes?.value !== 'false';
    return {
      supported: true,
      granted,
      osEnabled,
      enabled,
      permission: perm?.display || 'prompt',
      exactAlarm,
    };
  } catch {
    return {
      supported: true,
      granted: false,
      osEnabled: false,
      enabled: false,
      permission: 'prompt',
      exactAlarm: 'granted',
    };
  }
}

/**
 * Meminta izin notifikasi Android (POST_NOTIFICATIONS pada Android 13+) dan mengaktifkan preferensi lokal.
 */
export async function enableNativeNotifications({ sendConfirmation = true } = {}) {
  if (!isNativePlatform()) {
    throw new Error('Bukan perangkat native.');
  }

  await assertNativePermission({ request: true });
  await Preferences.set({ key: NATIVE_NOTIF_PREF_KEY, value: 'true' });

  if (sendConfirmation) {
    await notifyImmediately({
      id: CONFIRM_NOTIF_ID,
      channelId: CHANNEL_GENERAL,
      title: 'Notifikasi Portal Pasim Aktif',
      body: 'Pengingat fokus, jadwal belajar, dan notifikasi kampus siap masuk ke HP Anda.',
    });
  }

  return { granted: true, enabled: true };
}

/**
 * Mematikan preferensi notifikasi lokal perangkat native dan membatalkan alarm timer tertunda.
 */
export async function disableNativeNotifications() {
  if (!isNativePlatform()) {
    return { granted: false, enabled: false };
  }

  await Preferences.set({ key: NATIVE_NOTIF_PREF_KEY, value: 'false' });
  await cancelFocusRunningNotification();
  await cancelFocusTimerNotification();
  return { granted: true, enabled: false };
}

/**
 * Menampilkan notifikasi sistem Android secara langsung.
 */
export async function showNativeNotification({
  id,
  title,
  body,
  channelId = CHANNEL_GENERAL,
  link = null,
}) {
  if (!isNativePlatform()) return false;

  const status = await getNativeNotificationStatus();
  if (!status.enabled) return false;

  await ensureNativeNotificationChannels();
  const notifId = Math.abs(Math.trunc(Number(id) || (Date.now() % 100000000))) || 1;

  await notifyImmediately({
    id: notifId,
    channelId,
    title,
    body,
    extra: link ? { link } : undefined,
  });
  return true;
}

/**
 * Menampilkan status sesi Pomodoro yang sedang berjalan atau dijeda di panel notifikasi Android.
 */
export async function showFocusRunningNotification({
  modeLabel,
  taskLabel,
  endAtMs,
  isPaused = false,
  remainingText = '',
}) {
  if (!isNativePlatform()) return false;

  const status = await getNativeNotificationStatus();
  if (!status.enabled) return false;

  await ensureNativeNotificationChannels();

  const label = modeLabel || 'Fokus';
  const task = taskLabel || 'Fokus Bebas';
  let title;
  let body;
  let ongoing;

  if (isPaused) {
    title = `${label} Dijeda`;
    body = `Sisa ${remainingText || '00:00'} · ${task}. Ketuk untuk melanjutkan.`;
    ongoing = false;
  } else {
    const finishTime = Number.isFinite(endAtMs)
      ? new Date(endAtMs).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '';
    title = `${label} Sedang Berjalan`;
    body = finishTime ? `Selesai sekitar pukul ${finishTime} · ${task}` : task;
    ongoing = false;
  }

  await notifyImmediately({
    id: FOCUS_ACTIVE_NOTIF_ID,
    channelId: CHANNEL_FOCUS_STATUS,
    title,
    body,
    ongoing,
    autoCancel: true,
    extra: { link: '/fokus' },
  });
  return true;
}

/**
 * Menghapus notifikasi status berjalan/dijeda Timer Pomodoro dari panel Android.
 */
export async function cancelFocusRunningNotification() {
  if (!isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_ACTIVE_NOTIF_ID }] }).catch(() => {});
}

/**
 * Mengirim notifikasi uji langsung ke panel Android untuk memverifikasi notifikasi sistem.
 */
export async function sendTestNativeNotification({
  channelId = CHANNEL_GENERAL,
  title = 'Uji Notifikasi Portal Pasim',
  body = 'Notifikasi Android berhasil tampil langsung di panel HP Anda!',
  link = '/',
} = {}) {
  if (!isNativePlatform()) {
    throw new Error('Bukan perangkat native.');
  }

  await assertNativePermission({ request: false });
  await notifyImmediately({
    id: 900100 + (Date.now() % 10000),
    channelId,
    title,
    body,
    extra: link ? { link } : undefined,
  });
  return true;
}

/**
 * Menjadwalkan alarm notifikasi lokal ketika sesi Pomodoro berakhir (tetap berjalan walau WebView di background).
 */
export async function scheduleFocusTimerNotification({ endAtMs, title, body }) {
  if (!isNativePlatform() || !Number.isFinite(endAtMs) || endAtMs <= Date.now() + 1500) {
    return false;
  }

  const status = await getNativeNotificationStatus();
  if (!status.enabled) return false;

  await ensureNativeNotificationChannels();
  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_TIMER_NOTIF_ID }] }).catch(() => {});

  await LocalNotifications.schedule({
    notifications: [
      buildNotificationPayload({
        id: FOCUS_TIMER_NOTIF_ID,
        channelId: CHANNEL_FOCUS,
        title: title || 'Timer Fokus Selesai!',
        body,
        autoCancel: true,
        schedule: { at: new Date(endAtMs), allowWhileIdle: true },
        extra: { link: '/fokus' },
      }),
    ],
  });
  return true;
}

/**
 * Membatalkan alarm notifikasi timer fokus yang sedang terjadwal.
 */
export async function cancelFocusTimerNotification() {
  if (!isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_TIMER_NOTIF_ID }] }).catch(() => {});
}

/**
 * Mendaftarkan listener saat aplikasi Android kembali aktif ke foreground.
 */
export function onNativeAppResume(callback) {
  if (!isNativePlatform() || typeof callback !== 'function') {
    return () => {};
  }

  const handlePromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      callback();
    }
  });

  return () => {
    Promise.resolve(handlePromise)
      .then((handle) => handle?.remove?.())
      .catch(() => {});
  };
}

/**
 * Mendaftarkan listener klik & penerimaan notifikasi lokal untuk navigasi dan sinkronisasi status.
 */
export function initNativeNotificationListeners({ navigate } = {}) {
  if (!isNativePlatform()) return () => {};

  ensureNativeNotificationChannels().catch(() => {});

  const actionHandlePromise = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const link = event?.notification?.extra?.link;
    if (link && typeof navigate === 'function') {
      navigate(link);
    }
  });

  const receivedHandlePromise = LocalNotifications.addListener('localNotificationReceived', (event) => {
    if (Number(event?.id) === FOCUS_TIMER_NOTIF_ID) {
      cancelFocusRunningNotification().catch(() => {});
    }
  });

  return () => {
    Promise.all([Promise.resolve(actionHandlePromise), Promise.resolve(receivedHandlePromise)])
      .then((handles) => {
        for (const handle of handles) {
          handle?.remove?.();
        }
      })
      .catch(() => {});
  };
}
