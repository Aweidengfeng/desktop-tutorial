const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /api/health — 基础健康检查（已存在，保持兼容）
router.get('/', async (req, res) => {
  const start = Date.now();
  const checks = { status: 'ok', timestamp: new Date().toISOString(), version: process.env.npm_package_version || '1.0.0', region: process.env.REGION || 'default' };

  // DB 连通性检查
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (e) {
    checks.db = 'error';
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
