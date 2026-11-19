// FILE: client/src/utils/pushNotifications.js
import { focusApi } from '../api/focus.api';
import { isNativePlatform } from '../platform/detection';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isWebPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const isIosDevice = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isStandalonePwa = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true);

export const registerPortalServiceWorker = async () => {
  if (isNativePlatform()) {
    // Pada klien native Capacitor, service worker tidak didaftarkan agar tidak bentrok dengan WebView
    return null;
  }
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
};

export const getCurrentPushSubscription = async () => {
  if (!isWebPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
};

export const subscribeToWebPush = async () => {
  if (!isWebPushSupported()) {
    throw new Error('Browser ini belum mendukung Web Push Notification.');
  }
  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error(
      'Di iPhone/iPad, Web Push hanya aktif setelah aplikasi dipasang ke Layar Utama ("Add to Home Screen").'
    );
  }

  const permission =
    window.Notification.permission === 'granted'
      ? 'granted'
      : await window.Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Izin notifikasi browser ditolak. Aktifkan izin notifikasi di pengaturan situs.');
  }

  const registration = (await registerPortalServiceWorker()) || (await navigator.serviceWorker.ready);
  const vapidRes = await focusApi.getVapidPublicKey();
  const publicKey = vapidRes?.data?.publicKey;
  if (!publicKey) {
    throw new Error('Kunci publik VAPID server belum tersedia.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe().catch(() => {});
  }

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const subJson = sub.toJSON();
  await focusApi.subscribePush({
    endpoint: subJson.endpoint,
    keys: subJson.keys,
  });

  return sub;
};

export const unsubscribeFromWebPush = async () => {
  const existing = await getCurrentPushSubscription();
  if (!existing) return false;
  await focusApi.unsubscribePush(existing.endpoint).catch(() => {});
  await existing.unsubscribe();
  return true;
};
