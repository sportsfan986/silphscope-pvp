// SilphScope PvP PWA Service Worker (v7.28)
const CACHE_NAME = 'silphscope-pwa-v728';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-icon-192.svg',
  '/pwa-icon-512.svg',
  '/overlay.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SilphScope SW] Pre-cache skipped some assets:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use Network-Only for dynamic APIs, WebSockets, Range video requests and Stripe
  if (
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('stripe.com') ||
    url.hostname.includes('buymeacoffee.com') ||
    event.request.headers.has('range') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-first with Cache fallback for HTML navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Stale-While-Revalidate for icons and static scripts/styles
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
