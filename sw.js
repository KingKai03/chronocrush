/* ============================================================
   CHRONOCRUSH Service Worker
   Caches the game for offline play and fast loading
   ============================================================ */

const CACHE_NAME    = 'chronocrush-v1';
const OFFLINE_URL   = '/chronocrush/';

// Files to cache on install — the whole game
const PRECACHE_URLS = [
  '/chronocrush/',
  '/chronocrush/index.html',
  '/chronocrush/core-engine/style.css',
  '/chronocrush/core-engine/logic.js',
  '/chronocrush/manifest.json',
  '/chronocrush/icons/icon-192.png',
  '/chronocrush/icons/icon-512.png'
];

// ── Install: cache everything ─────────────────────────────────
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
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ─────────────
self.addEventListener('fetch', event => {
  // Skip Firebase and external requests — always go to network
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic') ||
      event.request.url.includes('firebasestorage')) {
    return; // let browser handle normally
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            // Cache successful GET responses
            if (response.ok && event.request.method === 'GET') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'CHRONOCRUSH', {
      body:    data.body    || 'Your daily challenge is waiting!',
      icon:    '/chronocrush/icons/icon-192.png',
      badge:   '/chronocrush/icons/icon-96.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/chronocrush/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/chronocrush/')
  );
});
