/**
 * leads.js — 官网线索收集（Lead Collection）
 *
 * 处理官网 4 个公开表单，写入 PostgreSQL（生产）/ SQLite（开发）的 leads 表：
 *   POST /api/contact                       联系咨询
 *   POST /api/partnerships                  商务合作
 *   POST /api/applications/guide            向导申请
 *   POST /api/applications/seven-summits    七大洲报名
 *
 * 管理端可见：
 *   GET  /api/admin/leads                   （需管理员权限）
 *
 * 邮件通知：每条线索写库成功后，向管理员发送通知邮件，并向提交人发送确认邮件（失败降级，不影响提交）。
 *
 * 挂载方式（backend/app.js）：app.use('/api', require('./routes/leads'))，
 * 必须在 app.use('/api/admin', ...) 之前，以便 GET /admin/leads 命中本路由。
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const { sendMail, leadNotificationEmail, leadConfirmationEmail } = require('../middleware/mailer');

const router = express.Router();

// 公开表单限流：每分钟每 IP 最多 10 次，防刷
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提交过于频繁，请稍后再试' },
});

function trimString(value, max = 2000) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

// 极简邮箱格式校验（线性扫描，避免 ReDoS）
function isValidEmail(email) {
  const str = String(email);
  if (str.length > 254) return false;
  const at = str.indexOf('@');
  if (at <= 0 || at !== str.lastIndexOf('@')) return false;
  const dot = str.indexOf('.', at);
  return dot > at + 1 && dot < str.length - 1;
}

/**
 * 构造线索写库 + 通知逻辑。
 * @param {string} type - 线索类型
 * @param {(body:object)=>object} extract - 从请求体提取常用字段
 */
function makeHandler(type, extract) {
  return async (req, res) => {
    try {
      const body = (req.body && typeof req.body === 'object') ? req.body : {};
      const fields = extract(body);

      // 校验：邮箱必填且格式正确（4 个表单均含 email）
      if (!fields.email || !isValidEmail(fields.email)) {
        return res.status(400).json({ error: '请提供有效的邮箱地址' });
      }
      // 校验：姓名/称呼必填
      if (!fields.name) {
        return res.status(400).json({ error: '请填写姓名' });
      }

      // 完整表单 JSON（裁剪每个字段，限制总量），便于管理端查看原始提交
      const rawPayload = {};
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string') rawPayload[trimString(k, 60)] = trimString(v, 2000);
        else if (v != null && typeof v !== 'object') rawPayload[trimString(k, 60)] = v;
      }

      const lead = await prisma.lead.create({
        data: {
          type,
          name: fields.name || null,
          email: fields.email || null,
          phone: fields.phone || null,
          company: fields.company || null,
          subject: fields.subject || null,
          message: fields.message || null,
          source: fields.source || 'website',
          status: 'new',
          payload: JSON.stringify(rawPayload).slice(0, 8000),
        },
      });

      const confirmationEmail = isMailProviderConfigured();
      const adminNotificationEmail = isAdminLeadNotificationConfigured();

      // 管理员通知邮件：失败降级，绝不阻塞提交结果。
      notifyAdmin(lead);
      // 提交人确认邮件：失败降级，绝不阻塞提交结果。
      notifyCustomer(lead);

      return res.status(201).json({
        success: true,
        id: lead.id,
        status: lead.status,
        confirmationEmail,
        adminNotificationEmail,
        nextSteps: leadNextSteps(lead.type),
      });
    } catch (e) {
      console.error(`[leads] ${type} 提交失败:`, e.message);
      return res.status(500).json({ error: '提交失败，请稍后再试' });
    }
  };
}

function isMailProviderConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM;
}

function isAdminLeadNotificationConfigured() {
  return isMailProviderConfigured() && !!(process.env.LEADS_NOTIFY_EMAIL || process.env.ADMIN_EMAIL);
}

function leadNextSteps(type) {
  const steps = {
    contact: 'SummitLink will review your message and reply within 1–2 business days.',
    partnership: 'Our partnership team will evaluate the opportunity and follow up with relevant sponsor, investor, or strategic partner materials.',
    guide_application: 'Our operations team will review your certifications, mountain experience, and regional availability before contacting you.',
    seven_summits: 'Our expedition team will review your goals, experience level, and safety readiness before the cohort selection window.',
  };
  return steps[type] || 'Our team will review your submission and follow up with next steps.';
}

/** 向管理员发送线索通知邮件（fire-and-forget，吞掉所有错误）。 */
function notifyAdmin(lead) {
  const to = process.env.LEADS_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) {
    // 未配置收件人时跳过（开发/未配置场景）
    if (process.env.NODE_ENV !== 'production') {
      console.log('[leads] 未配置 LEADS_NOTIFY_EMAIL/ADMIN_EMAIL，跳过通知邮件');
    }
    return;
  }
  Promise.resolve()
    .then(() => sendMail({ to, ...leadNotificationEmail(lead) }))
    .then((result) => {
      if (result && result.error) {
        console.error('[leads] 通知邮件发送失败（已降级，不影响提交）:', result.error);
      }
    })
    .catch((err) => {
      console.error('[leads] 通知邮件异常（已降级，不影响提交）:', err.message);
    });
}

/** 向提交人发送确认邮件（fire-and-forget，吞掉所有错误）。 */
function notifyCustomer(lead) {
  if (!lead.email) return;
  Promise.resolve()
    .then(() => sendMail({ to: lead.email, ...leadConfirmationEmail(lead) }))
    .then((result) => {
      if (result && result.error) {
        console.error('[leads] 提交人确认邮件发送失败（已降级，不影响提交）:', result.error);
      }
    })
    .catch((err) => {
      console.error('[leads] 提交人确认邮件异常（已降级，不影响提交）:', err.message);
    });
}

// ── 公开表单端点 ─────────────────────────────────────────

// 联系咨询：name, email, subject, message
router.post('/contact', leadLimiter, makeHandler('contact', (b) => ({
  name: trimString(b.name, 120),
  email: trimString(b.email, 254),
  subject: trimString(b.subject, 200),
  message: trimString(b.message, 4000),
  source: trimString(b.source, 80),
})));

// 商务合作：name, company, email, investmentType, message
router.post('/partnerships', leadLimiter, makeHandler('partnership', (b) => ({
  name: trimString(b.name, 120),
  email: trimString(b.email, 254),
  company: trimString(b.company, 200),
  subject: trimString(b.investmentType, 200),
  message: trimString(b.message, 4000),
  source: trimString(b.source, 80),
})));

// 向导申请：fullName, email, country, phone, yearsOfExperience, certifications, ...
router.post('/applications/guide', leadLimiter, makeHandler('guide_application', (b) => ({
  name: trimString(b.fullName || b.name, 120),
  email: trimString(b.email, 254),
  phone: trimString(b.phone, 60),
  company: trimString(b.country, 120),
  subject: '向导申请',
  message: trimString(b.personalBio || b.certifications, 4000),
  source: trimString(b.source, 80),
})));

// 七大洲报名：fullName, email, phone, country, targetSummit, experienceLevel, ...
router.post('/applications/seven-summits', leadLimiter, makeHandler('seven_summits', (b) => ({
  name: trimString(b.fullName || b.name, 120),
  email: trimString(b.email, 254),
  phone: trimString(b.phone, 60),
  company: trimString(b.country, 120),
  subject: trimString(b.targetSummit, 200) || '七大洲报名',
  message: trimString(b.personalStatement, 4000),
  source: trimString(b.source, 80),
})));

// ── 管理端 ───────────────────────────────────────────────

// GET /api/admin/leads —— 线索列表（管理员）
router.get('/admin/leads', adminAuth, async (req, res) => {
  try {
    const where = {};
    const type = trimString(req.query.type, 40);
    const status = trimString(req.query.status, 40);
    if (type) where.type = type;
    if (status) where.status = status;

    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      prisma.lead.count({ where }),
    ]);

    const items = leads.map((l) => {
      let payload = {};
      try { payload = JSON.parse(l.payload || '{}'); } catch (_) { payload = {}; }
      return { ...l, payload };
    });

    return res.json({ total, count: items.length, leads: items });
  } catch (e) {
    console.error('[leads] 管理端查询失败:', e.message);
    return res.status(500).json({ error: '查询失败' });
  }
});

module.exports = router;
