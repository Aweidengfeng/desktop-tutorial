require('dotenv').config();

const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // 防止日志中泄露 PII / 凭证（手机号、邮箱、token、密码、Stripe 签名等）
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.headers["x-investor-token"]',
      'req.headers["x-admin-token"]',
      'req.headers["x-api-key"]',
      'req.headers["stripe-signature"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.refresh_token',
      '*.accessToken',
      '*.access_token',
      '*.jwt',
      '*.secret',
      '*.apiKey',
      '*.api_key',
      '*.phone',
      '*.email',
      '*.mobile',
      '*.idCard',
      '*.id_card',
      '*.cardNumber',
      '*.card_number',
      '*.cvc',
      '*.cvv',
      '*.pin',
    ],
    censor: '[Filtered]',
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { initSentry, sentryRequestHandler, sentryErrorHandler } = require('./middleware/sentry');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { defaultLimiter } = require('./middleware/rateLimits');
const { cacheMiddleware, noCache } = require('./middleware/cache');
const { detectRegion, getRegionConfig } = require('./lib/region');
const { getPrismaClient } = require('./lib/db');
const { registerAdminV2Page } = require('./routes/admin-v2-page');

// 页面路由限流（防止爬虫对文件系统操作造成压力）
const htmlPageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
app.use(compression());

initSentry(app);
app.use(sentryRequestHandler());

// 信任 Railway / Nginx 等反向代理（修复 express-rate-limit xForwardedFor 报错）
app.set('trust proxy', 1);

// CORS 配置：生产环境只允许 CORS_ORIGINS 白名单，开发环境允许所有来源
const corsOrigins = process.env.CORS_ORIGINS;
// Capacitor App 使用的固定 origin（移动端 WebView）
const CAPACITOR_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'http://localhost'];
// API_BASE（服务本身的对外 URL），去掉末尾斜杠后用于识别同源请求（admin 后台访问 /api/*）
const selfOrigin = process.env.API_BASE ? process.env.API_BASE.replace(/\/$/, '') : null;
app.use(cors({
  origin: (origin, callback) => {
    // 无 Origin 头（如移动端 / curl）直接放行
    if (!origin) return callback(null, true);
    // Capacitor/Ionic App 的 WebView origin 始终放行
    if (CAPACITOR_ORIGINS.includes(origin)) return callback(null, true);
    // 同源请求（admin.html 从服务自身域名发出的请求）始终放行，避免管理后台被自身 CORS 拦截
    if (selfOrigin && origin === selfOrigin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!corsOrigins) return callback(new Error('生产环境未配置 CORS_ORIGINS'), false);
    const whitelist = corsOrigins.split(',').map(o => o.trim());
    if (whitelist.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Helmet：补齐缺失的安全响应头（HSTS / CSP / 防 MIME 嗅探 / Origin-Agent-Cluster 等）
// 注意事项：
//  1) 前端目前仍依赖 CDN（Tailwind / Alpine / AMap / Mapbox）与少量内联脚本，
//     因此 CSP 暂用宽松策略 + 'unsafe-inline'；后续把内联脚本全部外提后可收紧到 nonce/hash。
//  2) crossOriginEmbedderPolicy 关闭，避免影响 Service Worker / 第三方图片资源。
//  3) HSTS 仅在生产开启（避免本地 HTTP 调试时浏览器卡死在 https）。
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // 业务现状：CDN 脚本 + 少量 inline 脚本；后续外提完毕可移除 unsafe-inline
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'", // Alpine.js x-data 内嵌表达式编译需要
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net',
        'https://cdn.socket.io',
        'https://webapi.amap.com',
        'https://*.amap.com',
        'https://api.mapbox.com',
        'https://*.mapbox.com',
        'https://js.stripe.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://api.mapbox.com',
      ],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://i.pravatar.cc',
        'https://*.amap.com',
        'https://restapi.amap.com',
        'https://api.mapbox.com',
        'https://*.mapbox.com',
        'https://events.mapbox.com',
        'https://api.stripe.com',
        'https://*.sentry.io',
        'https://*.ingest.sentry.io',
        'wss:',
        'ws:',
      ],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // HSTS 仅生产开启
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true, preload: false }
    : false,
}));
app.use(cookieParser());
app.use((req, res, next) => {
  req.region = detectRegion(req);
  req.regionConfig = getRegionConfig(req.region);
  req.prisma = getPrismaClient(req.region);
  res.setHeader('X-Region', req.region);
  next();
});
// Stripe webhook 需要 raw body（必须在 express.json() 之前注册）
app.use('/api/payment/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customProps: (req) => ({ userId: req.user?.id }),
}));

// 用 __dirname 计算仓库根目录，比 process.cwd() 更可靠（不受启动目录影响）
const rootPath = path.join(__dirname, '..');
console.log('📁 根目录:', rootPath);
console.log('📁 __dirname:', __dirname);
if (!process.env.API_BASE) {
  console.warn('⚠️  API_BASE 环境变量未设置，移动端(Capacitor)将无法正确访问API。请在 Railway 中设置 API_BASE=https://你的服务URL');
}

// Universal Links (iOS) + App Links (Android) – must be registered before static middleware
// so Apple CDN and Google probes hit the JSON handlers directly without any redirect.
const { mountUniversalLinks } = require('./middleware/universalLinks');
mountUniversalLinks(app);

// 专门处理HTML文件路由（避免中文文件名问题）
const htmlFile = path.join(rootPath, 'index.html');
const renderMainPage = (req, res) => {
  console.log('📄 请求HTML文件:', htmlFile);
  console.log('📄 文件存在:', fs.existsSync(htmlFile));
  const amapKey = process.env.AMAP_KEY || '';
  const amapSecurityCode = process.env.AMAP_SECURITY_CODE || '';
  fs.readFile(htmlFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取HTML文件失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    let result = html
      .replaceAll('YOUR_AMAP_KEY', amapKey);
    // 注入 SENTRY_DSN、API_BASE、ENV 和 MAP_PROVIDER 到前端
    const sentryDsn = process.env.SENTRY_DSN || '';
    const apiBase = process.env.API_BASE || '';
    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    const appleClientId = process.env.APPLE_CLIENT_ID || '';
    const injected = `<head>
  <script>
    window.__SENTRY_DSN = ${JSON.stringify(sentryDsn)};
    window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};
    window.__MAP_PROVIDER = ${JSON.stringify(process.env.MAPBOX_TOKEN ? 'mapbox' : 'amap')};
    window.__AMAP_KEY__ = ${JSON.stringify(amapKey)};
    window.__AMAP_SECURITY_CODE__ = ${JSON.stringify(amapSecurityCode)};${apiBase ? `\n    window.__API_BASE__ = ${JSON.stringify(apiBase)};` : ''}${googleClientId ? `\n    window.__GOOGLE_CLIENT_ID__ = ${JSON.stringify(googleClientId)};` : ''}${appleClientId ? `\n    window.__APPLE_CLIENT_ID__ = ${JSON.stringify(appleClientId)};` : ''}
  </script>`;
    result = result.replace('<head>', injected);
    // 在 AMap script 标签之前注入安全密钥配置（高德官方要求：必须先于 AMap JS 加载）
    if (amapSecurityCode) {
      const amapSecurityScript = `<script>window._AMapSecurityConfig = { securityJsCode: ${JSON.stringify(amapSecurityCode)} };</script>`;
      result = result.replace(
        /<script[^>]+webapi\.amap\.com\/maps[^>]*>/,
        amapSecurityScript + '\n$&'
      );
    }
    // 若 Key 或安全密钥未配置，注入提示脚本
    if (!amapKey || !amapSecurityCode) {
      const missingVars = [!amapKey && 'AMAP_KEY', !amapSecurityCode && 'AMAP_SECURITY_CODE'].filter(Boolean).join(' / ');
      const warningScript = `<script>
(function(){
  var msg = '地图未配置：请在环境变量中设置 ${missingVars}';
  console.error('[SummitLink]', msg);
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[id*="map"],[id*="Map"],[class*="map-container"]').forEach(function(el){
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f87171;font-size:13px;text-align:center;padding:12px;">' + msg + '</div>';
    });
  });
})();
</script>`;
      result = result.replace('</head>', warningScript + '\n</head>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(result);
  });
};
// 根路径和 SummitLink 入口都走动态注入逻辑，避免 express.static 直接返回未替换占位符
app.get(['/', '/index.html', '/summitlink', '/summitlink.html'], htmlPageLimiter, renderMainPage);

// 静态文件服务 - 根目录（必须放在根路径 HTML 注入路由之后）
app.use(express.static(rootPath));
// 前端核心脚本：index.html 引用 `/js/app-core.js`，但物理路径是 `www/js/`，
// 因此显式映射 `/js` → `<rootPath>/www/js`，避免 404 导致整个 SPA 加载失败。
app.use('/js', express.static(path.join(rootPath, 'www', 'js')));

// 上传文件静态服务（支持 UPLOADS_DIR 环境变量覆盖路径）
const uploadsPath = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// SQLite 模式：确保 better-sqlite3 建表语句在 Prisma 路由初始化之前执行
// （PostgreSQL 模式的 Prisma 连接在启动 IIFE 中 await，见文件底部）
if (process.env.DATABASE_PROVIDER !== 'postgresql') {
  try {
    require('./db/database');
  } catch (e) {
    console.error('⚠️  数据库初始化失败（SQLite）:', e.message);
  }
}

// 全局速率限制兜底（仅对 /api 前缀，不影响静态文件服务）
const testApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '测试环境请求过于频繁' },
});
app.use('/api', process.env.NODE_ENV === 'test' ? testApiLimiter : defaultLimiter);
// 精细限流：auth/gdpr（任务五要求）
// payment 限流分别在 expeditions/guides/pay 路由内通过 paymentLimiter 中间件应用
const { authStrictLimiter, gdprLimiter } = require('./middleware/rateLimits');
const testStrictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '测试环境请求过于频繁' },
});
app.use('/api/auth', process.env.NODE_ENV === 'test' ? testStrictLimiter : authStrictLimiter);
app.use('/api/gdpr', process.env.NODE_ENV === 'test' ? testStrictLimiter : gdprLimiter);

// HTTP 缓存头（在路由挂载之前）
app.use(cacheMiddleware);

app.get('/api/region', (req, res) => {
  const payload = {
    region: req.region || 'us',
    providers: (req.regionConfig && req.regionConfig.paymentProviders) || ['stripe'],
    stripeEnabled: !!(req.regionConfig && req.regionConfig.stripeEnabled),
    legalEntity: req.regionConfig && req.regionConfig.legalEntity,
    legalEntityEn: req.regionConfig && req.regionConfig.legalEntityEn,
    socialCreditCode: req.regionConfig && req.regionConfig.socialCreditCode,
    deployTarget: req.regionConfig && req.regionConfig.deployTarget,
  };
  if (payload.region === 'cn') {
    payload.icpNumber = req.regionConfig && req.regionConfig.icpNumber;
    payload.icpPoliceNumber = req.regionConfig && req.regionConfig.icpPoliceNumber;
  }
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json(payload);
});

// 挂载路由
app.use('/api/auth', noCache, require('./routes/auth'));
app.use('/api/peaks', require('./routes/peaks'));
app.use('/api/guides', require('./routes/guides'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/gear', require('./routes/gear'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/pay', require('./routes/pay'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/mountains', require('./routes/mountains'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/group-chats', require('./routes/groupChats'));
app.use('/api/follows', require('./routes/follows'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/location-share', require('./routes/locationShare'));
app.use('/api/location', require('./routes/location'));
app.use('/api/admin/stats', require('./routes/admin-stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/customs', require('./routes/customs'));
app.use('/api/rescue', require('./routes/rescue'));
app.use('/api/sos', require('./routes/sos'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/expeditions', require('./routes/expeditions'));
app.use('/api/launch', require('./routes/launch'));
app.use('/legal', require('./routes/legal'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/search', require('./routes/search'));
app.use('/api/activity-orders', require('./routes/activityOrders'));
app.use('/api/guide-service-orders', require('./routes/guideServiceOrders'));
if (process.env.ENABLE_ASSISTANT === 'true') {
  app.use('/api/assistant', require('./routes/assistant'));
}
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/certification', require('./routes/certification'));
app.use('/api/config', require('./routes/config')); // IP感知地图自动切换（CN→AMap，其他→Mapbox）
app.use('/api/push', require('./routes/push'));
app.use('/api/coach', require('./routes/coach'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/gdpr', require('./routes/gdpr'));
app.use('/api/currency', require('./routes/currency'));
app.use('/api/feedback', require('./routes/feedback'));

function getStripeStartupStatus() {
  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const stripeDisabledByFlag = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';
  const stripeDisabledByMissingKey = !stripeKey;
  if (stripeDisabledByFlag || stripeDisabledByMissingKey) {
    const reason = stripeDisabledByFlag ? 'STRIPE_DISABLED=true' : 'STRIPE_SECRET_KEY missing';
    return { message: `⚠️ 降级模式 (${reason}) — 支付不可用`, degraded: true };
  }
  if (process.env.NODE_ENV === 'production' && stripeKey.startsWith('sk_live_')) {
    return { message: '✅ Enabled (live mode)', degraded: false };
  }
  if (process.env.NODE_ENV !== 'production' && stripeKey.startsWith('sk_test_')) {
    return { message: '✅ Enabled (test mode)', degraded: false };
  }
  return { message: '✅ Enabled', degraded: false };
}

const databaseStatus = process.env.DATABASE_PROVIDER === 'postgresql'
  ? '✅ Connected (PostgreSQL)'
  : '✅ Connected (SQLite)';
const sentryStatus = process.env.SENTRY_DSN
  ? `✅ Enabled (env=${process.env.NODE_ENV || 'development'})`
  : '⚪ Disabled';
if (process.env.SENTRY_DSN) {
  const sentryRelease = process.env.SENTRY_RELEASE || 'v1.0.0-launch';
  const sentryEnv = process.env.SENTRY_ENV || process.env.NODE_ENV || 'production';
  console.log(`[sentry] enabled, release=${sentryRelease}, environment=${sentryEnv}`);
}
const stripeStatus = getStripeStartupStatus();
console.log('========== SummitLink Backend 启动摘要 ==========');
console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
console.log(`端口: ${process.env.PORT || 8080}`);
console.log(`Database: ${databaseStatus}`);
console.log(`Stripe: ${stripeStatus.message}`);
if (stripeStatus.degraded) {
  console.log('       恢复方法: 设置 STRIPE_SECRET_KEY=sk_live_... 并删除 STRIPE_DISABLED');
}
console.log(`Sentry: ${sentryStatus}`);
console.log('====================================================');

// 环境变量缺失时的优雅降级警告（不 throw，继续启动）
const startupWarnings = [];
if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_DISABLED) {
  startupWarnings.push('⚠️  STRIPE_SECRET_KEY 未配置，支付为演示模式');
}
if (!process.env.SENTRY_DSN) {
  startupWarnings.push('⚠️  SENTRY_DSN 未配置，错误监控已禁用');
}
if (!process.env.MAPBOX_TOKEN) {
  startupWarnings.push('⚠️  MAPBOX_TOKEN 未配置，地图使用 OpenStreetMap');
}
if (!process.env.TENCENT_COS_SECRET_ID && !process.env.COS_SECRET_ID) {
  startupWarnings.push('⚠️  COS 未配置，图片存储使用本地 Volume');
}
if (startupWarnings.length > 0) {
  console.log('--- 降级模式提示 ---');
  startupWarnings.forEach(w => console.warn(w));
  console.log('--------------------');
}

// Deep link handlers (email verification, password reset)
// These routes are also intercepted by iOS Universal Links / Android App Links
// when the SummitLink App is installed on the device.
app.use('/', require('./routes/deeplinks'));

// Admin 面板（注入 SENTRY_DSN）
const adminHtmlFile = path.join(rootPath, 'admin.html');
console.log('📄 admin.html 路径:', adminHtmlFile, '存在:', fs.existsSync(adminHtmlFile));
app.get('/admin', htmlPageLimiter, (req, res) => {
  fs.readFile(adminHtmlFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取 admin.html 失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    const sentryDsn = process.env.SENTRY_DSN || '';
    const sentryScript = `<script>window.__SENTRY_DSN = ${JSON.stringify(sentryDsn)}; window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};</script>`;
    const result = html.replace('</head>', sentryScript + '\n</head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result);
  });
});

registerAdminV2Page(app, { rootPath, htmlPageLimiter });

// 向导工作台
const guidePortalFile = path.join(rootPath, 'guide-portal.html');
app.get('/guide-portal', htmlPageLimiter, (req, res) => {
  fs.readFile(guidePortalFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取 guide-portal.html 失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    const sentryDsn = process.env.SENTRY_DSN || '';
    const sentryScript = `<script>window.__SENTRY_DSN = ${JSON.stringify(sentryDsn)}; window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};</script>`;
    const result = html.replace('</head>', sentryScript + '\n</head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result);
  });
});

// 俱乐部工作台
const clubPortalFile = path.join(rootPath, 'club-portal.html');
app.get('/club-portal', htmlPageLimiter, (req, res) => {
  fs.readFile(clubPortalFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取 club-portal.html 失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    const sentryDsn = process.env.SENTRY_DSN || '';
    const sentryScript = `<script>window.__SENTRY_DSN = ${JSON.stringify(sentryDsn)}; window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};</script>`;
    const result = html.replace('</head>', sentryScript + '\n</head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result);
  });
});

// 远征详情页（SEO path-based route）
const expeditionDetailFile = path.join(rootPath, 'expedition-detail.html');
app.get(['/expedition/:id', '/expedition'], htmlPageLimiter, (req, res) => {
  fs.readFile(expeditionDetailFile, 'utf8', (err, html) => {
    if (err) return res.status(404).send('Expedition detail not found');
    const injected = `<head>\n  <script>window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};</script>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html.replace('<head>', injected));
  });
});

app.use('/api/offline-expeditions', require('./routes/offlineExpeditions'));
app.use('/api/climbing-log', require('./routes/climbingLog'));
app.use('/api/guide-console', require('./routes/guideConsole'));
app.use('/api/club-console', require('./routes/clubConsole'));
app.use('/api/ai-coach', require('./routes/aiCoach'));
app.use('/api/investor', require('./routes/investor'));

// 电子护照（PDF 下载）
app.use('/api/passport', require('./routes/passport'));
app.use('/api/user', require('./routes/passport')); // /api/user/:id/passport.pdf

// 海拔查询
app.use('/api/altitude', require('./routes/altitude'));

// 投资者看板
const investorHtmlFile = path.join(rootPath, 'investor.html');
app.get('/investor', htmlPageLimiter, (req, res) => {
  if (!fs.existsSync(investorHtmlFile)) {
    return res.status(404).send('Investor dashboard not found');
  }
  fs.readFile(investorHtmlFile, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Internal Server Error');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
});

// 健康检查（/api/health 为标准路径，/health 保留兼容）
app.use('/api/health', require('./routes/health'));
app.use('/health', require('./routes/health'));

// ── OpenAPI 文档（开发和测试环境下开放）──────────────────────────────
if (
  process.env.NODE_ENV !== 'production'
  || process.env.ENABLE_API_DOCS === 'true'
  || process.env.ENABLE_SWAGGER === 'true'
) {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./swagger');
  const swaggerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/docs', swaggerLimiter, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', swaggerLimiter, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });
  console.log('📖 API 文档已启用: /api/docs');
}

const PORT = process.env.PORT || 8080;

// 404 兜底（必须在所有路由之后）
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});
app.use((req, res) => {
  if (req.accepts('json')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.status(404).send('Not Found');
});

// ── 全局错误处理 ────────────────────────────────────────────────
// JSON parse error
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法的 JSON' });
  }
  next(err);
});

// Sentry 错误处理中间件（必须在其他错误处理之前）
app.use(sentryErrorHandler());

// 通用错误处理（兜底）
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err, reqId: req.id }, '未捕获错误');
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ── 启动安全校验 ─────────────────────────────────────────────
const DEFAULT_JWT_SECRET = 'summitlink_secret_change_this_in_production';
const DEFAULT_ADMIN_PASSWORD = 'change_this_password';
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    console.error('❌ 安全错误: JWT_SECRET 未设置或仍为默认值，生产环境拒绝启动');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    console.error('❌ 安全错误: ADMIN_PASSWORD 未设置或仍为默认值，生产环境拒绝启动');
    process.exit(1);
  }
} else {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    console.warn('⚠️  警告: JWT_SECRET 使用默认值，生产环境请务必修改');
  }
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
    console.warn('⚠️  警告: ADMIN_PASSWORD 使用默认值，生产环境请务必修改');
  }
}

const http = require('http');
const server = http.createServer(app);

const { initChatGateway } = require('./routes/chat.gateway');
initChatGateway(server);

(async () => {
  // PostgreSQL 模式：在启动 HTTP 服务器之前等待 Prisma 连接就绪
  if (process.env.DATABASE_PROVIDER === 'postgresql') {
    const prisma = require('./db/prisma');
    try {
      await prisma.$connect();
      console.log('✅ Prisma 已连接到 PostgreSQL');
    } catch (e) {
      console.error('❌ Prisma 连接 PostgreSQL 失败，退出:', e.message);
      process.exit(1);
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, `SummitLink API started, listening on port ${PORT}`);
  });
})();
