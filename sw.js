const STATIC_CACHE = 'summitlink-static-v5';
const TILE_CACHE = 'summitlink-tiles-v5';
const API_CACHE = 'summitlink-api-v5';
const TILE_MAX = 200;
const TILE_TTL = 7 * 24 * 60 * 60 * 1000;

const PRECACHE = [
  '/www/js/app-core.js',
  '/www/js/currency.js',
  '/js/app-core.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => ![STATIC_CACHE, TILE_CACHE, API_CACHE].includes(k)).map((k) => caches.delete(k)),
    )),
  );
  self.clients.claim();
});

function isTile(url) {
  return /(^https:\/\/[abc]\.tile\.openstreetmap\.org\/)|(^https:\/\/webrd0\d+\.is\.autonavi\.com\/)/i.test(url);
}

function isCachedApi(pathname) {
  return pathname.startsWith('/api/expeditions') || pathname.startsWith('/api/peaks');
}

async function putTileWithMeta(request, response) {
  const cache = await caches.open(TILE_CACHE);
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', String(Date.now()));
  const body = await response.clone().blob();
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));

  const keys = await cache.keys();
  if (keys.length > TILE_MAX) {
    const entries = await Promise.all(keys.map(async (key) => {
      const res = await cache.match(key);
      return { key, ts: Number(res?.headers.get('sw-cached-at') || 0) };
    }));
    entries.sort((a, b) => a.ts - b.ts);
    const remove = entries.slice(0, keys.length - TILE_MAX);
    await Promise.all(remove.map((e) => cache.delete(e.key)));
  }
}

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const ts = Number(cached.headers.get('sw-cached-at') || 0);
    if (!ts || Date.now() - ts <= TILE_TTL) return cached;
  }
  try {
    const res = await fetch(request);
    if (res.ok) await putTileWithMeta(request, res);
    return res;
  } catch (_) {
    return cached || new Response('', { status: 503 });
  }
}

async function staleWhileRevalidateApi(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' || request.destination === 'document') return;
  const url = new URL(request.url);

  if (isTile(request.url)) {
    event.respondWith(cacheFirstTile(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (isCachedApi(url.pathname)) {
      event.respondWith(staleWhileRevalidateApi(request));
      return;
    }
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res && res.ok) {
        const cloned = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned)).catch(() => {});
      }
      return res;
    })),
  );
});
