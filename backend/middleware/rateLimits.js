const rateLimit = require('express-rate-limit');

// 通用默认限制（所有未分类接口的兜底保护）
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

// 认证接口（登录/注册）— 严格限制防暴力破解
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
});

// 写操作（发帖/评论/预约）
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

// 消息发送（已有，迁移过来）
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '消息发送过于频繁' },
});

// 上传接口
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '上传过于频繁，请稍后再试' },
});

// 搜索/查询接口
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '查询过于频繁，请稍后再试' },
});

// 天气/地图等外部 API 代理（防止 Key 被刷爆）
const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

// 管理员接口
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '管理操作过于频繁' },
});

// 评论轮询（已有，迁移过来）
const commentPollLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '轮询过于频繁' },
});

// 认证接口精细限制 — 10 req/min/IP（任务五要求）
const authStrictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录/注册请求过于频繁，请稍后再试' },
});

// GDPR 数据接口 — 5 req/hour/IP
const gdprLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'GDPR 请求频率超出限制，请1小时后再试' },
});

// 支付接口 — 20 req/min/IP
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '支付请求过于频繁，请稍后再试' },
});

module.exports = {
  defaultLimiter,
  authLimiter,
  authStrictLimiter,
  writeLimiter,
  messageLimiter,
  uploadLimiter,
  searchLimiter,
  externalApiLimiter,
  adminLimiter,
  commentPollLimiter,
  gdprLimiter,
  paymentLimiter,
};
