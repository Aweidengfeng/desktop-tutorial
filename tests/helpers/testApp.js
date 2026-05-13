/**
 * 测试用 Express app 工厂
 * 不依赖 pino/pino-http，直接挂载路由
 * 每次调用 createApp() 会清除模块缓存、重建内存数据库
 */

// 必须在 require 任何后端模块之前设置环境变量
// Prisma 不支持 :memory:，因此使用临时文件同时让 better-sqlite3 和 Prisma 共用同一个数据库文件
const testDbPath = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
process.env.DATABASE_PATH     = process.env.DATABASE_PATH     || testDbPath;
// Note: DATABASE_URL is intentionally NOT set here at module level.
// It is synced with DATABASE_PATH inside createApp() on every call so that
// CI environments injecting a stale DATABASE_URL (e.g. `file:./test.db`) do not
// cause a mismatch between the file used by better-sqlite3 and the file used by Prisma.
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET      = process.env.JWT_SECRET      || 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || 'test-admin-password';
process.env.ADMIN_USERNAME  = process.env.ADMIN_USERNAME  || 'admin';
process.env.PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED || 'true';
process.env.NODE_ENV        = 'test';

const path = require('path');
const { createRequire } = require('module');

const requireFromBackend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const express = requireFromBackend('express');
const cors = requireFromBackend('cors');

const { clearDbCache } = require('./db');

/**
 * 创建一个全新的 Express 测试应用，挂载所有后端路由。
 * 注意：每次调用都会清空模块缓存并重新初始化 in-memory 数据库。
 * @returns {import('express').Application}
 */
function createApp() {
  // Sync DATABASE_URL with DATABASE_PATH so both better-sqlite3 (database.js) and
  // Prisma connect to the same SQLite file. CI workflows may inject DATABASE_URL as a
  // relative path (e.g. `file:./test.db`) that doesn't match the test-specific
  // absolute DATABASE_PATH, causing all Prisma queries to return 500 errors.
  const dbPath = process.env.DATABASE_PATH;
  if (dbPath && dbPath !== ':memory:') {
    process.env.DATABASE_URL = `file:${dbPath}`;
  }

  clearDbCache();

  // Ensure tables are created by database.js before routes use Prisma
  try {
    require('../../backend/db/database');
  } catch (e) {
    console.error('[testApp] Failed to initialise database.js:', e.message);
    throw e;
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 挂载路由（顺序与 backend/app.js 一致）
  // Wrap each require so module-load failures print the exact path and full stack
  // instead of a truncated "at require (testApp.js:N:M)" line.
  function loadRoute(routePath) {
    try {
      return require(routePath);
    } catch (e) {
      console.error(
        `[testApp] Failed to load route module "${routePath}":\n` +
        `  ${e.message}\n` +
        (e.stack || '')
      );
      throw e;
    }
  }

  app.use('/api/auth',          loadRoute('../../backend/routes/auth'));
  app.use('/api/peaks',         loadRoute('../../backend/routes/peaks'));
  app.use('/api/guides',        loadRoute('../../backend/routes/guides'));
  app.use('/api/teams',         loadRoute('../../backend/routes/teams'));
  app.use('/api/tracks',        loadRoute('../../backend/routes/tracks'));
  app.use('/api/gear',          loadRoute('../../backend/routes/gear'));
  app.use('/api/posts',         loadRoute('../../backend/routes/posts'));
  app.use('/api/weather',       loadRoute('../../backend/routes/weather'));
  app.use('/api/leaderboard',   loadRoute('../../backend/routes/leaderboard'));
  app.use('/api/comments',      loadRoute('../../backend/routes/comments'));
  app.use('/api/clubs',         loadRoute('../../backend/routes/clubs'));
  app.use('/api/notifications', loadRoute('../../backend/routes/notifications'));
  app.use('/api/admin',         loadRoute('../../backend/routes/admin'));
  app.use('/api/expeditions',   loadRoute('../../backend/routes/expeditions'));
  app.use('/api/launch',        loadRoute('../../backend/routes/launch'));
  app.use('/api/search',        loadRoute('../../backend/routes/search'));
  app.use('/api/certificates',  loadRoute('../../backend/routes/certificates'));
  app.use('/api/certification', loadRoute('../../backend/routes/certification'));
  app.use('/api/messages',      loadRoute('../../backend/routes/messages'));
  app.use('/api/mountains',     loadRoute('../../backend/routes/mountains'));
  app.use('/api/badges',        loadRoute('../../backend/routes/badges'));
  app.use('/api/bookings',      loadRoute('../../backend/routes/bookings'));
  app.use('/api/customs',       loadRoute('../../backend/routes/customs'));
  app.use('/api/group-chats',   loadRoute('../../backend/routes/groupChats'));
  app.use('/api/activity-orders',       loadRoute('../../backend/routes/activityOrders'));
  app.use('/api/guide-service-orders',  loadRoute('../../backend/routes/guideServiceOrders'));

  app.use('/api/offline-expeditions', loadRoute('../../backend/routes/offlineExpeditions'));
  app.use('/api/climbing-log',        loadRoute('../../backend/routes/climbingLog'));
  app.use('/api/routes',              loadRoute('../../backend/routes/routes'));
  app.use('/api/guide-console',       loadRoute('../../backend/routes/guideConsole'));
  app.use('/api/club-console',        loadRoute('../../backend/routes/clubConsole'));
  app.use('/api/ai-coach',            loadRoute('../../backend/routes/aiCoach'));
  app.use('/api/investor',            loadRoute('../../backend/routes/investor'));
  app.use('/api/profile',             loadRoute('../../backend/routes/profile'));
  app.use('/api/follows',             loadRoute('../../backend/routes/follows'));
  app.use('/api/comments',            loadRoute('../../backend/routes/comments'));
  app.use('/api/banners',             loadRoute('../../backend/routes/banners'));
  app.use('/api/users',               loadRoute('../../backend/routes/users'));
  app.use('/api/user',                loadRoute('../../backend/routes/passport'));
  app.use('/api/passport',            loadRoute('../../backend/routes/passport'));
  app.use('/api/rescue',              loadRoute('../../backend/routes/rescue'));
  app.use('/api/insurance',           loadRoute('../../backend/routes/insurance'));
  app.use('/api/location-share',      loadRoute('../../backend/routes/locationShare'));
  app.use('/api/altitude',            loadRoute('../../backend/routes/altitude'));
  app.use('/api/articles',            loadRoute('../../backend/routes/articles'));
  app.use('/api/orders',              loadRoute('../../backend/routes/orders'));
  app.use('/api/pay',                 loadRoute('../../backend/routes/pay'));
  app.use('/api/upload',              loadRoute('../../backend/routes/upload'));
  app.use('/api/config',              loadRoute('../../backend/routes/config'));

  // AI 助手（仅当 ENABLE_ASSISTANT=true 时挂载）
  if (process.env.ENABLE_ASSISTANT === 'true') {
    app.use('/api/assistant', loadRoute('../../backend/routes/assistant'));
  }

  // Phase 8 新路由（与 backend/app.js 保持一致）
  app.use('/api/coach',        loadRoute('../../backend/routes/coach'));
  app.use('/api/payment',      loadRoute('../../backend/routes/payment'));
  app.use('/api/admin/stats',  loadRoute('../../backend/routes/admin-stats'));
  app.use('/api/currency',     loadRoute('../../backend/routes/currency'));

  // 健康检查
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), version: '1.0.0' });
  });

  return app;
}

module.exports = { createApp };
