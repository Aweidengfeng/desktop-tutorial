/**
 * 测试用 Express app 工厂
 * 不依赖 pino/pino-http，直接挂载路由
 * 每次调用 createApp() 会清除模块缓存、重建内存数据库
 */

// 必须在 require 任何后端模块之前设置环境变量
process.env.DATABASE_PATH   = process.env.DATABASE_PATH   || ':memory:';
process.env.JWT_SECRET      = process.env.JWT_SECRET      || 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || 'test-admin-password';
process.env.ADMIN_USERNAME  = process.env.ADMIN_USERNAME  || 'admin';
process.env.NODE_ENV        = 'test';

const express = require('express');
const cors    = require('cors');

const { clearDbCache } = require('./db');

/**
 * 创建一个全新的 Express 测试应用，挂载所有后端路由。
 * 注意：每次调用都会清空模块缓存并重新初始化 in-memory 数据库。
 * @returns {import('express').Application}
 */
function createApp() {
  clearDbCache();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 挂载路由（顺序与 backend/app.js 一致）
  app.use('/api/auth',          require('../../backend/routes/auth'));
  app.use('/api/peaks',         require('../../backend/routes/peaks'));
  app.use('/api/guides',        require('../../backend/routes/guides'));
  app.use('/api/teams',         require('../../backend/routes/teams'));
  app.use('/api/tracks',        require('../../backend/routes/tracks'));
  app.use('/api/gear',          require('../../backend/routes/gear'));
  app.use('/api/posts',         require('../../backend/routes/posts'));
  app.use('/api/weather',       require('../../backend/routes/weather'));
  app.use('/api/leaderboard',   require('../../backend/routes/leaderboard'));
  app.use('/api/comments',      require('../../backend/routes/comments'));
  app.use('/api/clubs',         require('../../backend/routes/clubs'));
  app.use('/api/notifications', require('../../backend/routes/notifications'));
  app.use('/api/admin',         require('../../backend/routes/admin'));
  app.use('/api/expeditions',   require('../../backend/routes/expeditions'));
  app.use('/api/search',        require('../../backend/routes/search'));
  app.use('/api/certificates',  require('../../backend/routes/certificates'));
  app.use('/api/certification', require('../../backend/routes/certification'));
  app.use('/api/messages',      require('../../backend/routes/messages'));
  app.use('/api/mountains',     require('../../backend/routes/mountains'));
  app.use('/api/badges',        require('../../backend/routes/badges'));
  app.use('/api/activity-orders',       require('../../backend/routes/activityOrders'));
  app.use('/api/guide-service-orders',  require('../../backend/routes/guideServiceOrders'));

  // AI 助手（仅当 ENABLE_ASSISTANT=true 时挂载）
  if (process.env.ENABLE_ASSISTANT === 'true') {
    app.use('/api/assistant', require('../../backend/routes/assistant'));
  }

  // 健康检查
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), version: '1.0.0' });
  });

  return app;
}

module.exports = { createApp };
