// FILE: client/src/platform/googleAuth.js
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativePlatform } from './detection';

const handledDeepLinkUrls = new Set();

function sanitizeClientRedirectPath(rawPath) {
  if (typeof rawPath !== 'string') return '/';
  const trimmed = rawPath.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed;
}

/**
 * Memulai alur login/registrasi Google OAuth baik untuk Browser Web maupun Android Native (Chrome Custom Tabs).
 */
export async function startGoogleOAuth({ apiBaseUrl, redirectPath = '/' }) {
  if (!apiBaseUrl) {
    throw new Error('Endpoint API belum tersedia.');
  }
  const safeRedirect = sanitizeClientRedirectPath(redirectPath);

  if (isNativePlatform()) {
    const authUrl = `${apiBaseUrl}/auth/google?platform=native&redirect=${encodeURIComponent(
      safeRedirect
    )}`;
    await Browser.open({ url: authUrl, presentationStyle: 'popover' });
    return;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const authUrl = `${apiBaseUrl}/auth/google?platform=web&origin=${encodeURIComponent(
    origin
  )}&redirect=${encodeURIComponent(safeRedirect)}`;
  window.location.assign(authUrl);
}

/**
 * Mendaftarkan listener deep link `portalpasim://auth/callback` dari Chrome Custom Tabs saat kembali ke app Android.
 */
export function initGoogleDeepLinkListener(navigate) {
  if (!isNativePlatform() || typeof navigate !== 'function') {
    return () => {};
  }

  const handleDeepLink = (rawUrl) => {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('portalpasim://auth/callback')) {
      return;
    }
    if (handledDeepLinkUrls.has(rawUrl)) {
      return;
    }
    handledDeepLinkUrls.add(rawUrl);
    if (handledDeepLinkUrls.size > 50) {
      const oldest = handledDeepLinkUrls.values().next().value;
      handledDeepLinkUrls.delete(oldest);
    }

    try {
      const parsed = new URL(rawUrl);
      Browser.close().catch(() => {});
      navigate(`/auth/google/callback${parsed.search}`, { replace: true });
    } catch {
      // Abaikan URL deep link yang tidak dapat diparsing
    }
  };

  const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    handleDeepLink(url);
  });

  CapacitorApp.getLaunchUrl()
    .then((res) => {
      if (res?.url) {
        handleDeepLink(res.url);
      }
    })
    .catch(() => {});

  return () => {
    Promise.resolve(listenerPromise)
      .then((handle) => handle?.remove?.())
      .catch(() => {});
  };
}
