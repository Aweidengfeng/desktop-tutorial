// sw.js
const CACHE_NAME = 'alpinelink-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  // 关键静态资源（CSS/JS 由 Tailwind/Alpine CDN 提供，只缓存核心页面）
];

// Install：预缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch：网络优先，失败时返回缓存
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求，API 请求直接穿透
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

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
