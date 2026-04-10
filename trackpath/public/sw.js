const CACHE = 'trackpath-v1';
const APP_SHELL = ['/'];

// Tile CDN pattern
const TILE_ORIGIN = 'tile.openstreetmap.org';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Cache map tiles (CacheFirst, max 500 entries)
  if (url.hostname.includes(TILE_ORIGIN)) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Skip SSE stream — can't cache
  if (url.pathname === '/api/garmin/stream') return;

  // API endpoints: NetworkFirst, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell (JS/CSS/HTML): CacheFirst
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
