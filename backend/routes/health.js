const express = require('express');
const router = express.Router();
const prismaModule = require('../db/prisma');
const { getPrismaClient } = prismaModule;

// GET /api/health — 基础健康检查（已存在，保持兼容）
router.get('/', async (req, res) => {
  const start = Date.now();
  const region = req.region || 'us';
  const regionConfig = req.regionConfig || {};
  const prisma = req.prisma || getPrismaClient(region);
  const stripeEnabled = !!regionConfig.stripeEnabled;
  const wechatEnabled = region === 'cn' && (
    (Array.isArray(regionConfig.paymentProviders) && regionConfig.paymentProviders.includes('wechat')) ||
    !!process.env.WECHAT_APP_ID
  );
  const checks = {
    status: 'ok',
    region,
    version: process.env.npm_package_version || 'unknown',
    deploy_target: regionConfig.deployTarget || process.env.DEPLOY_TARGET || 'railway',
    db_connected: true,
    stripe_enabled: stripeEnabled,
    wechat_enabled: wechatEnabled,
    timestamp: new Date().toISOString(),
    sentry: process.env.SENTRY_DSN ? 'enabled' : 'disabled',
  };
  if (region === 'cn') {
    checks.icp_number = regionConfig.icpNumber || process.env.ICP_NUMBER || '京ICP备XXXXXXXX号（备案中）';
  }

  // DB 连通性检查
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (e) {
    checks.db = 'error';
    checks.db_connected = false;
    checks.status = 'degraded';
  }

  checks.uptime = Math.floor(process.uptime());
  checks.memory = Math.floor(process.memoryUsage().rss / 1024 / 1024) + 'MB';
  checks.latency = (Date.now() - start) + 'ms';

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// GET /api/health/ready — K8s readiness probe
router.get('/ready', async (req, res) => {
  try {
    const prisma = req.prisma || getPrismaClient(req.region || 'us');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch (e) {
    res.status(503).json({ ready: false, error: e.message });
  }
});

// GET /api/health/live — K8s liveness probe
router.get('/live', (req, res) => {
  res.json({ alive: true, pid: process.pid, uptime: process.uptime() });
});

module.exports = router;
