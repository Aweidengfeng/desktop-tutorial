// sw.js
const CACHE_NAME = 'summitlink-v2';
const TILE_CACHE = 'summitlink-tiles-v1';
const TILE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30天
const STATIC_ASSETS = [
  '/',
  '/index.html',
  // 关键静态资源（CSS/JS 由 Tailwind/Alpine CDN 提供，只缓存核心页面）
];

// 地图瓦片 URL 匹配规则
const TILE_PATTERNS = [
  /tile\.openstreetmap\.org/,
  /opentopomap\.org/,
  /webst\d+\.is\.autonavi\.com/,
  /basemaps\.cartocdn\.com/,
  /tile\.opentopomap\.org/,
];

function isTileRequest(url) {
  return TILE_PATTERNS.some(p => p.test(url));
}

// Install：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate：清理旧缓存（保留 TILE_CACHE）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch：地图瓦片 Cache-First，其他资源 Network-First
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求，API 请求直接穿透
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // 地图瓦片：Cache-First（离线可用，在线时后台更新）
  if (isTileRequest(event.request.url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) {
          // 在线时后台刷新（stale-while-revalidate）
          const ts = cached.headers.get('sw-cached-at');
          const age = ts ? Date.now() - Number(ts) : Infinity;
          if (age > TILE_CACHE_MAX_AGE_MS) {
            fetch(event.request).then(response => {
              if (response.ok) {
                const cloned = response.clone();
                const headers = new Headers(cloned.headers);
                headers.set('sw-cached-at', String(Date.now()));
                cloned.blob().then(body => {
                  cache.put(event.request, new Response(body, { status: cloned.status, statusText: cloned.statusText, headers }));
                }).catch(err => console.warn('[SW] Background tile cache write failed:', err));
              }
            }).catch(() => {});
          }
          return cached;
        }
        // 缓存未命中：从网络获取并缓存
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const toCache = response.clone();
            const headers = new Headers(toCache.headers);
            headers.set('sw-cached-at', String(Date.now()));
            toCache.blob().then(body => {
              cache.put(event.request, new Response(body, { status: toCache.status, statusText: toCache.statusText, headers }));
            }).catch(() => {});
          }
          return response;
        } catch (e) {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || new Response('Offline', { status: 503 })))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SummitLink', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
