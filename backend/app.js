require('dotenv').config();

const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// ── Sentry 初始化（仅当 SENTRY_DSN 存在时启用，否则无副作用）──────────────
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
      release: process.env.SENTRY_RELEASE,
    });
    console.log('✅ Sentry 已启用');
  } catch (e) {
    console.warn('⚠️  Sentry 初始化失败（不影响服务运行）:', e.message);
    Sentry = null;
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// 页面路由限流（防止爬虫对文件系统操作造成压力）
const htmlPageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Sentry 请求处理中间件（路由最前，仅当 Sentry 启用时）
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

// CORS 配置：生产环境只允许 CORS_ORIGINS 白名单，开发环境允许所有来源
const corsOrigins = process.env.CORS_ORIGINS;
app.use(cors({
  origin: (origin, callback) => {
    // 无 Origin 头（如移动端 / curl）直接放行
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!corsOrigins) return callback(new Error('生产环境未配置 CORS_ORIGINS'), false);
    const whitelist = corsOrigins.split(',').map(o => o.trim());
    if (whitelist.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));
app.use(express.json());

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
  customProps: (req) => ({ userId: req.user?.id }),
}));

// 从根目录启动(node backend/app.js)，process.cwd() = /app (仓库根目录)
const rootPath = process.cwd();
console.log('📁 根目录:', rootPath);
console.log('📁 __dirname:', __dirname);

// 静态文件服务 - 根目录
app.use(express.static(rootPath));

// 上传文件静态服务（支持 UPLOADS_DIR 环境变量覆盖路径）
const uploadsPath = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// 专门处理HTML文件路由（避免中文文件名问题）
const htmlFile = path.join(rootPath, '攀登4-20260416-summitlink.html');
app.get(['/summitlink', '/summitlink.html'], htmlPageLimiter, (req, res) => {
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
      .replaceAll('YOUR_AMAP_KEY', amapKey)
      .replaceAll('YOUR_AMAP_SECURITY_CODE', amapSecurityCode);
    // 注入 SENTRY_DSN 到前端
    const sentryDsn = process.env.SENTRY_DSN || '';
    const sentryScript = `<script>window.__SENTRY_DSN__ = ${JSON.stringify(sentryDsn)};</script>`;
    result = result.replace('</head>', sentryScript + '\n</head>');
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
    res.send(result);
  });
});

// 挂载路由
app.use('/api/auth', require('./routes/auth'));
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
app.use('/api/follows', require('./routes/follows'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/customs', require('./routes/customs'));
app.use('/api/rescue', require('./routes/rescue'));
app.use('/api/insurance', require('./routes/insurance'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/expeditions', require('./routes/expeditions'));
app.use('/legal', require('./routes/legal'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/search', require('./routes/search'));
if (process.env.ENABLE_ASSISTANT === 'true') {
  app.use('/api/assistant', require('./routes/assistant'));
}
app.use('/api/certificates', require('./routes/certificates'));

// Admin 面板（注入 SENTRY_DSN）
const adminHtmlFile = path.join(rootPath, 'admin.html');
app.get('/admin', htmlPageLimiter, (req, res) => {
  fs.readFile(adminHtmlFile, 'utf8', (err, html) => {
    if (err) {
      console.error('❌ 读取 admin.html 失败:', err);
      return res.status(500).send('Internal Server Error');
    }
    const sentryDsn = process.env.SENTRY_DSN || '';
    const sentryScript = `<script>window.__SENTRY_DSN__ = ${JSON.stringify(sentryDsn)};</script>`;
    const result = html.replace('</head>', sentryScript + '\n</head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result);
  });
});

// 健康检查（/api/health 为标准路径，/health 保留兼容）
const pkgVersion = (() => {
  try { return require('../package.json').version; } catch (e) { return '1.0.0'; }
})();
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), version: pkgVersion });
});

// 根路径
app.get('/', (req, res) => {
  res.redirect('/summitlink');
});

const PORT = process.env.PORT || 8080;

// Sentry 错误处理中间件（必须在其他错误处理之前）
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

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

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'SummitLink API started');
});
