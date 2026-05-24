const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const insuranceReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const insuranceWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

const CLAIM_STATUS_VALUES = new Set(['filed', 'processing', 'approved', 'rejected', 'paid']);

function signBody(bodyString, secret) {
  return crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

function getRequestBodyForSignature(req) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  return JSON.stringify(req.body || {});
}

function isTimingSafeMatch(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isValidIsoDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function mapClaimStatusToInquiryStatus(claimStatus, currentStatus) {
  if (claimStatus === 'filed' || claimStatus === 'processing') return 'claimed';
  if (claimStatus === 'approved' || claimStatus === 'paid') return 'claim_settled';
  return currentStatus;
}

function verifyInsuranceWebhookSignature(req, res) {
  const secret = (process.env.INSURANCE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.warn('[insurance webhook] INSURANCE_WEBHOOK_SECRET 未配置，已跳过验签（仅建议开发环境使用）');
    return true;
  }
  const headerSignature = String(req.get('X-Insurance-Signature') || '').trim().replace(/^sha256=/i, '');
  const expectedSignature = signBody(getRequestBodyForSignature(req), secret);
  if (!headerSignature || !isTimingSafeMatch(headerSignature, expectedSignature)) {
    console.warn('[insurance webhook] 签名验证失败');
    res.status(401).json({ error: '签名验证失败' });
    return false;
  }
  return true;
}

async function tryCreateInsuranceNotification(userId, content, relatedId) {
  if (!userId) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO notifications (user_id, type, content, related_id)
      VALUES (${userId}, 'insurance', ${content}, ${relatedId})
    `;
  } catch (error) {
    console.warn('[insurance] 写入通知失败:', error?.message || error);
  }
}

// GET /api/insurance/plans
router.get('/plans', insuranceReadLimiter, async (req, res) => {
  try {
    const plans = await prisma.$queryRaw`SELECT * FROM insurance_plans ORDER BY price_cny ASC`;
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/insurance/plans/:id
router.get('/plans/:id', insuranceReadLimiter, async (req, res) => {
  try {
    const plan = (await prisma.$queryRaw`SELECT * FROM insurance_plans WHERE id = ${Number(req.params.id)}`)[0];
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/insurance/inquire — 提交购买询价
router.post('/inquire', insuranceWriteLimiter, auth, async (req, res) => {
  try {
    const { name, phone, plan_id, peak_name, departure_date } = req.body;
    if (!name || !phone || !plan_id) {
      return res.status(400).json({ error: '请填写姓名、电话和保险方案' });
    }
    const plan = (await prisma.$queryRaw`SELECT * FROM insurance_plans WHERE id = ${plan_id}`)[0];
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });

    const [{ id: newInquiryId }] = await prisma.$queryRaw`
      INSERT INTO insurance_inquiries (user_id, plan_id, plan_name, name, phone, peak_name, departure_date)
      VALUES (${req.user.id}, ${plan_id}, ${plan.name}, ${name}, ${phone}, ${peak_name || ''}, ${departure_date || ''})
      RETURNING id
    `;
    const id = Number(newInquiryId);

    res.json({
      success: true,
      id,
      message: '询价已提交，我们将在24小时内联系您',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/insurance/my-policies — 查询当前用户保单列表
router.get('/my-policies', insuranceReadLimiter, auth, async (req, res) => {
  try {
    const policies = await prisma.$queryRaw`
      SELECT
        id, plan_name, name, phone, peak_name, departure_date, status, policy_no, issued_at, policy_pdf_url, claim_status, created_at
      FROM insurance_inquiries
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    res.json(policies);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/insurance/webhook/policy-issued — 出单回调
router.post('/webhook/policy-issued', insuranceWriteLimiter, async (req, res) => {
  try {
    if (!verifyInsuranceWebhookSignature(req, res)) return;

    const { inquiry_id, policy_no, provider_ref, policy_pdf_url, issued_at } = req.body || {};
    if (!inquiry_id || !policy_no) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (issued_at && !isValidIsoDate(issued_at)) {
      return res.status(400).json({ error: 'issued_at 格式无效' });
    }

    const inquiry = (await prisma.$queryRaw`
      SELECT id, user_id FROM insurance_inquiries WHERE id = ${Number(inquiry_id)}
    `)?.[0];
    if (!inquiry) return res.status(404).json({ error: '询价记录不存在' });

    await prisma.$executeRaw`
      UPDATE insurance_inquiries
      SET status = 'issued',
          policy_no = ${String(policy_no)},
          provider_ref = ${provider_ref || null},
          policy_pdf_url = ${policy_pdf_url || null},
          issued_at = ${issued_at || null}
      WHERE id = ${Number(inquiry_id)}
    `;

    await tryCreateInsuranceNotification(inquiry.user_id, `您的攀登保险已出单，保单号：${policy_no}`, Number(inquiry_id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/insurance/webhook/claim-update — 理赔状态更新
router.post('/webhook/claim-update', insuranceWriteLimiter, async (req, res) => {
  try {
    if (!verifyInsuranceWebhookSignature(req, res)) return;

    const { policy_no, claim_status, claim_note, claim_updated_at } = req.body || {};
    if (!policy_no || !claim_status) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!CLAIM_STATUS_VALUES.has(claim_status)) {
      return res.status(400).json({ error: 'claim_status 无效' });
    }
    if (claim_updated_at && !isValidIsoDate(claim_updated_at)) {
      return res.status(400).json({ error: 'claim_updated_at 格式无效' });
    }

    const inquiry = (await prisma.$queryRaw`
      SELECT id, user_id, status FROM insurance_inquiries WHERE policy_no = ${String(policy_no)}
    `)?.[0];
    if (!inquiry) return res.status(404).json({ error: '保单不存在' });

    await prisma.$executeRaw`
      UPDATE insurance_inquiries
      SET claim_status = ${claim_status},
          claim_note = ${claim_note || null},
          claim_updated_at = ${claim_updated_at || null},
          status = ${mapClaimStatusToInquiryStatus(claim_status, inquiry.status)}
      WHERE id = ${inquiry.id}
    `;

    await tryCreateInsuranceNotification(inquiry.user_id, `您的保险理赔状态已更新：${claim_status}`, inquiry.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/insurance/policy/:policyNo — 查询当前用户指定保单
router.get('/policy/:policyNo', insuranceReadLimiter, auth, async (req, res) => {
  try {
    const policy = (await prisma.$queryRaw`
      SELECT
        id, user_id, plan_id, plan_name, name, peak_name, departure_date,
        policy_no, status, issued_at, policy_pdf_url, provider_ref,
        claim_status, claim_updated_at, claim_note, created_at
      FROM insurance_inquiries
      WHERE policy_no = ${String(req.params.policyNo)} AND user_id = ${req.user.id}
      LIMIT 1
    `)?.[0];
    if (!policy) return res.status(404).json({ error: '保单不存在' });
    res.json(policy);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
