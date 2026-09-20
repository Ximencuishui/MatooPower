/**

 * Matoo Power H5-App Service Worker
 * --------------------------------------------------------------------------
 * Strategy:
 *   - Install: precache the app shell (manifest, icon, offline fallback)
 *   - Fetch   (HTML):       network-first, fall back to cache, then offline page
 *   - Fetch   (static):     stale-while-revalidate
 *   - Fetch   (/_next/*):   stale-while-revalidate (Next.js build assets)
 *   - Activate: clean up old cache versions
 *
 * Notes for production:
 *   - Versioned cache names: bump CACHE_VERSION when you need to invalidate.
 *   - Offline fallback is /offline.html (you should ship a static page with
 *     brand message and a retry button).
 *   - This SW is intentionally small. For a production-grade offline app
 *     consider Workbox or next-pwa, but this stays dependency-free.
 */

const CACHE_VERSION = 'matoo-v1';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/offline.html',
];

// ----- Install: precache shell -----
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // addAll fails the whole install if any URL 404s. Use individual add() so
      // a missing optional resource (e.g. offline.html) doesn't kill install.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
              .catch((err) => console.warn('[SW] precache skipped:', url, err.message))
        )
      );
    })
  );
});

// ----- Activate: clean old caches + claim clients -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ----- Helper: classify a request -----
function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' &&
          request.headers.get('accept') &&
          request.headers.get('accept').includes('text/html'));
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|json)$/.test(url.pathname);
}

function isNextAsset(url) {
  return url.pathname.startsWith('/_next/');
}

// ----- Fetch handlers -----
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only same-origin (third-party like fonts.googleapis.com handled separately if needed)
  if (url.origin !== self.location.origin) return;

  // 1) HTML pages: network-first, fall back to cache, then /offline.html
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for offline reuse
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html') ||
                 new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 2) Static + Next assets: stale-while-revalidate
  if (isStaticAsset(url) || isNextAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // 3) Everything else: pass through to network
});

// ----- Messages from clients (for cache invalidation / forced refresh) -----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
