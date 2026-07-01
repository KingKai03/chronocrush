/* ============================================================
   CHRONOCRUSH Service Worker v4 — Full Offline Support
   ============================================================ */

const CACHE_NAME    = 'chronocrush-v14';
const OFFLINE_URL   = '/chronocrush/';

// Everything the game needs to run with zero internet
const PRECACHE_URLS = [
  '/chronocrush/',
  '/chronocrush/index.html',
  '/chronocrush/core-engine/style.css',
  '/chronocrush/core-engine/logic.js',
  '/chronocrush/manifest.json',
  '/chronocrush/icons/icon-72.png',
  '/chronocrush/icons/icon-96.png',
  '/chronocrush/icons/icon-192.png',
  '/chronocrush/icons/icon-512.png',
  '/chronocrush/audio/background.mp3',
  '/chronocrush/privacy.html',
  '/chronocrush/delete-account.html'
];

// ── Install: cache everything upfront ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase, Google APIs — network only, fail gracefully offline
  if (url.includes('firebase') ||
      url.includes('googleapis') ||
      url.includes('gstatic') ||
      url.includes('firebasestorage') ||
      url.includes('accounts.google')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return empty 503 so Firebase fails gracefully
        return new Response('{"error":"offline"}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Game assets — cache first, network fallback
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
        // Offline fallback for page navigations
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        // For other assets return empty response
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── Background Sync ───────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

async function syncGameData() {
  console.log('[SW] Background sync triggered');
}

// ── Periodic Sync — daily reminder ────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-reminder') {
    event.waitUntil(showDailyReminder());
  }
});

async function showDailyReminder() {
  await self.registration.showNotification('CHRONOCRUSH ⚡', {
    body:    'Your daily challenge is waiting! Claim your reward before midnight.',
    icon:    '/chronocrush/icons/icon-192.png',
    badge:   '/chronocrush/icons/icon-96.png',
    vibrate: [100, 50, 100],
    tag:     'daily-reminder',
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
      body:    data.body || 'Something new is waiting!',
      icon:    '/chronocrush/icons/icon-192.png',
      badge:   '/chronocrush/icons/icon-96.png',
      vibrate: [100, 50, 100],
      tag:     data.tag || 'general',
      data:    { url: data.url || '/chronocrush/' }
    })
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/chronocrush/') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/chronocrush/');
    })
  );
});
