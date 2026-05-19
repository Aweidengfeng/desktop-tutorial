/**
 * HTTP 缓存头中间件
 * 对公开只读 API 接口设置适当的缓存头
 */

// 公开接口缓存策略（5分钟）
const PUBLIC_CACHE_ROUTES = [
  '/api/peaks',
  '/api/expeditions',
  '/api/mountains',
  '/api/routes',
  '/api/leaderboard',
  '/api/weather',
  '/api/guides',
  '/api/clubs',
  '/api/articles',
  '/api/banners',
  '/api/badges',
  '/api/search',
  '/api/config',
  '/api/posts',
];

function cacheMiddleware(req, res, next) {
  // 非 GET 请求不缓存
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return next();
  }

  // 已登录用户的请求不缓存（有 Authorization 头）
  if (req.headers.authorization || req.cookies?.token) {
    res.setHeader('Cache-Control', 'no-store');
    return next();
  }

  // 判断是否是公开可缓存路由
  const isPublic = PUBLIC_CACHE_ROUTES.some(route => req.path.startsWith(route));

  if (isPublic) {
    // 5分钟公开缓存
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
}

function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
}

module.exports = { cacheMiddleware, noCache };
