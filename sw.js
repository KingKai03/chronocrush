/* ============================================================
   CHRONOCRUSH Service Worker v2
   ============================================================ */

const CACHE_NAME  = 'chronocrush-v2';
const OFFLINE_URL = '/chronocrush/';

const PRECACHE_URLS = [
  '/chronocrush/',
  '/chronocrush/index.html',
  '/chronocrush/core-engine/style.css',
  '/chronocrush/core-engine/logic.js',
  '/chronocrush/manifest.json',
  '/chronocrush/icons/icon-192.png',
  '/chronocrush/icons/icon-512.png'
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for game assets, network-first for Firebase ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go to network for Firebase / external APIs
  if (url.includes('firebase') || url.includes('googleapis') ||
      url.includes('gstatic')  || url.includes('firebasestorage')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── Background Sync — retry failed saves when back online ────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

async function syncGameData() {
  // Placeholder — extend this when you add a backend
  console.log('[SW] Background sync triggered');
}

// ── Periodic Background Sync — daily challenge reminder ───────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-reminder') {
    event.waitUntil(showDailyReminder());
  }
});

async function showDailyReminder() {
  const registration = self.registration;
  await registration.showNotification('CHRONOCRUSH ⚡', {
    body:    'Your daily challenge is waiting! Claim your reward before midnight.',
    icon:    '/chronocrush/icons/icon-192.png',
    badge:   '/chronocrush/icons/icon-96.png',
    vibrate: [100, 50, 100],
    tag:     'daily-reminder',
    renotify: false,
    data:    { url: '/chronocrush/' }
  });
}

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'CHRONOCRUSH', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CHRONOCRUSH 🎵', {
      body:    data.body    || 'Something new is waiting for you!',
      icon:    '/chronocrush/icons/icon-192.png',
      badge:   '/chronocrush/icons/icon-96.png',
      vibrate: [100, 50, 100],
      tag:     data.tag    || 'general',
      data:    { url: data.url || '/chronocrush/' }
    })
  );
});

// ── Notification click — open game ────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If game already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/chronocrush/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/chronocrush/');
      }
    })
  );
});
