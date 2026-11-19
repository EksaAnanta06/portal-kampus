// FILE: client/src/sw.js
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 1. Bersihkan cache versi lama & daftarkan manifest precache Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 2. ATURAN KEAMANAN UTAMA: API & WEBSOCKET JANGAN DI-CACHE!
// Seluruh endpoint /api/* dan koneksi WebSocket selalu NetworkOnly untuk menjaga privasi
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/'),
  new NetworkOnly()
);

// 3. Cache Gambar Cloudinary (Stale-While-Revalidate dengan batas jumlah & masa aktif)
registerRoute(
  ({ url }) => url.hostname === 'res.cloudinary.com',
  new StaleWhileRevalidate({
    cacheName: 'pasim-cloudinary-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// 4. Cache Font Google & Font Statis
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'pasim-google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 tahun
      }),
    ],
  })
);

// 5. Fallback Halaman Offline saat Koneksi Terputus
const navigationHandler = async (params) => {
  try {
    return await fetch(params.request);
  } catch (_error) {
    const offlineCache = await caches.match('/offline.html');
    if (offlineCache) return offlineCache;
    return new Response('Kamu sedang offline', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
};
registerRoute(new NavigationRoute(navigationHandler));

// 6. Penanganan Skip Waiting saat pengguna meminta pembaruan
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 7. PENYATUAN WEB PUSH NOTIFICATIONS (Terintegrasi utuh tanpa tabrakan 2 service worker)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Pengingat Portal PASIM',
    body: 'Waktunya memeriksa jadwal belajar atau tugas Anda.',
    url: '/fokus',
    tag: 'pasim-notification',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo-pasim.png',
      badge: '/logo-pasim.png',
      tag: payload.tag || 'pasim-notification',
      renotify: true,
      data: {
        url: payload.url || '/fokus',
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || '/fokus';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
