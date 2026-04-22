const CACHE_NAME = 'summitlink-offline-v1';
const OFFLINE_ASSETS = [
  '/',
  '/summitlink',
  '/www/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) {
    // Network first for API, fallback to cache
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || new Response(JSON.stringify({ error: '离线状态' }), { headers: { 'Content-Type': 'application/json' } }))
      )
    );
    return;
  }
  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }))
  );
});

// Background sync for offline moments
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-moments') {
    event.waitUntil(syncMoments());
  }
});

async function syncMoments() {
  // Handled by the main app's Alpine.js data
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'SYNC_MOMENTS' }));
}
