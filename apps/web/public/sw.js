const CACHE = 'trackpath-v3';

// Tile CDN pattern
const TILE_ORIGIN = 'tile.openstreetmap.org';

self.addEventListener('install', (e) => {
  // Pre-cache the app shell, then skip waiting so the new SW activates
  // immediately without needing all tabs to close first.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add('/'))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // Delete stale caches, then claim clients so the new SW controls
  // all open pages without a reload.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Cache map tiles — CacheFirst
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

  // Skip SSE stream — can't cache a streaming response
  if (url.pathname === '/api/stream') return;

  // API endpoints — NetworkFirst, fall back to cache for offline
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation requests (HTML pages) — always NetworkFirst so deployments
  // are picked up immediately; fall back to cached shell when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets (JS/CSS/images) — CacheFirst (Vite hashes filenames,
  // so a cache hit is always the correct version).
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
