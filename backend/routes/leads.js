/**
 * @file leads.js
 * @description 官网线索收集（MVP）。承载官网四类公开表单的提交，并提供管理员查看列表。
 *
 * 公开提交端点（无需登录，CORS 由 app.js 白名单控制）：
 *   POST /api/contact                       → Contact        → hello@
 *   POST /api/partnerships                  → Partnerships   → partners@
 *   POST /api/applications/guide            → Guide          → guides@
 *   POST /api/applications/seven-summits    → Seven Summits  → hello@
 *
 * 管理端点（复用 adminAuth：Cookie 会话 + 双提交 CSRF，或 Bearer）：
 *   GET  /api/admin/leads?type=&status=&page=&pageSize=
 *
 * 每次提交：honeypot 静默丢弃 → 输入校验 → 写库 → 发管理员邮件（best-effort）→ 返回成功确认。
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const { sendLeadNotification } = require('../lib/leadMailer');

const router = express.Router();

// 蜜罐字段名：正常用户看不到（前端 CSS 隐藏），机器人常会填写
const HONEYPOT_FIELD = 'website';

// 提交限流：按 IP，60s 内最多 5 次；测试环境放宽以免相互干扰
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '提交过于频繁，请稍后再试' },
});

// 各表单字段白名单与必填项；超出白名单的字段一律忽略，避免脏数据/注入
const FORM_CONFIG = {
  contact: {
    fields: ['name', 'email', 'subject', 'message'],
    required: ['name', 'email', 'message'],
    nameKey: 'name',
    successMessage: 'Thank you! We received your message and will reply soon.',
  },
  partnership: {
    fields: ['name', 'company', 'email', 'investmentType', 'message'],
    required: ['name', 'email'],
    nameKey: 'name',
    successMessage: 'Thank you! Our partnerships team will be in touch.',
  },
  guide: {
    fields: ['fullName', 'email', 'country', 'phone', 'yearsOfExperience', 'certifications', 'specialtyMountains', 'personalBio'],
    required: ['fullName', 'email'],
    nameKey: 'fullName',
    successMessage: 'Thank you for applying to join as a guide. We will review your application.',
  },
  seven_summits: {
    fields: ['fullName', 'email', 'country', 'phone', 'experienceLevel', 'targetSummit', 'personalStatement', 'source'],
    required: ['fullName', 'email'],
    nameKey: 'fullName',
    successMessage: 'Thank you for your application. Selected climbers will be announced as scheduled.',
  },
};

const MAX_FIELD_LENGTH = 2000;
// 邮箱校验：用 indexOf 风格的轻量规则，避免在畸形输入上触发回溯（ReDoS）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimString(value, max = MAX_FIELD_LENGTH) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => trimString(v, max)).filter(Boolean).join(', ');
  return String(value).trim().slice(0, max);
}

// 对来源 IP 做 SHA-256 哈希（可选加盐），避免在数据库中存储明文 PII
function hashIp(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  if (!ip) return null;
  const salt = process.env.LEAD_IP_SALT || '';
  return crypto.createHash('sha256').update(`${salt}${ip}`).digest('hex');
}

/**
 * 构造某一类表单的提交处理器。
 * @param {string} type 表单类型，对应 FORM_CONFIG 的键
 */
function makeHandler(type) {
  const config = FORM_CONFIG[type];
  return async (req, res) => {
    const body = req.body || {};

    // 1) 蜜罐：非空即视为机器人，静默返回成功（不写库、不发信）
    if (trimString(body[HONEYPOT_FIELD], 200)) {
      return res.status(200).json({ success: true, message: config.successMessage });
    }

    // 2) 输入校验 + 字段白名单收敛
    const fields = {};
    for (const key of config.fields) {
      const val = trimString(body[key]);
      if (val) fields[key] = val;
    }
    for (const key of config.required) {
      if (!fields[key]) {
        return res.status(400).json({ success: false, error: `字段 ${key} 不能为空` });
      }
    }
    if (fields.email && !EMAIL_RE.test(fields.email)) {
      return res.status(400).json({ success: false, error: '邮箱格式不正确' });
    }

    const name = config.nameKey ? fields[config.nameKey] || null : null;
    const email = fields.email || null;

    // 3) 写库（数据优先）
    let lead;
    try {
      lead = await prisma.lead.create({
        data: {
          type,
          name,
          email,
          payload: JSON.stringify(fields),
          status: 'new',
          ipHash: hashIp(req),
        },
      });
    } catch (e) {
      console.error('[leads] insert error:', e.message);
      return res.status(500).json({ success: false, error: '提交失败，请稍后重试' });
    }

    // 4) 发管理员邮件（best-effort：失败不影响已写入的线索）
    try {
      await sendLeadNotification({ type, fields });
    } catch (e) {
      console.warn('[leads] notification error:', e.message);
    }

    // 5) 返回用户成功确认
    return res.status(201).json({ success: true, id: lead.id, message: config.successMessage });
  };
}

// 公开提交端点（保持与官网现有 data-api 路径一致）
router.post('/contact', submitLimiter, makeHandler('contact'));
router.post('/partnerships', submitLimiter, makeHandler('partnership'));
router.post('/applications/guide', submitLimiter, makeHandler('guide'));
router.post('/applications/seven-summits', submitLimiter, makeHandler('seven_summits'));

// 管理员列表：分页 + 类型/状态过滤，按创建时间倒序
router.get('/admin/leads', adminAuth, async (req, res) => {
  try {
    const where = {};
    const type = trimString(req.query.type, 40);
    const status = trimString(req.query.status, 40);
    if (type && FORM_CONFIG[type]) where.type = type;
    if (status) where.status = status;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);

    const [total, rows] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const leads = rows.map((row) => {
      let payload = null;
      try {
        payload = row.payload ? JSON.parse(row.payload) : null;
      } catch (e) {
        payload = null;
      }
      return {
        id: row.id,
        type: row.type,
        name: row.name,
        email: row.email,
        status: row.status,
        payload,
        createdAt: row.createdAt,
      };
    });

    return res.json({ leads, total, page, pageSize });
  } catch (e) {
    console.error('[leads] admin list error:', e.message);
    return res.status(500).json({ error: '获取线索列表失败' });
  }
});

module.exports = router;
