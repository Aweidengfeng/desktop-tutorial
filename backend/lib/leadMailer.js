/**
 * @file leadMailer.js
 * @description 官网线索（Lead）管理员通知邮件。基于已有的 Resend 依赖封装。
 *   - 配置 RESEND_API_KEY 后通过 Resend 真实发信；
 *   - 未配置时退化为打印到控制台（Mock），便于开发/测试。
 *
 * 设计原则（MVP）：
 *   - best-effort：邮件发送失败绝不影响已写入数据库的 Lead，只记录日志。
 *   - 收件箱可通过环境变量覆盖：
 *       LEAD_INBOX_HELLO    （默认 hello@summitlink.com）
 *       LEAD_INBOX_PARTNERS （默认 partners@summitlink.com）
 *       LEAD_INBOX_GUIDES   （默认 guides@summitlink.com）
 *       RESEND_FROM         发件人地址（默认 noreply@mail.ussummit.cn）
 */

'use strict';

// 每种表单类型对应的管理员收件箱与中文标题
const INBOX = {
  contact: () => process.env.LEAD_INBOX_HELLO || 'hello@summitlink.com',
  partnership: () => process.env.LEAD_INBOX_PARTNERS || 'partners@summitlink.com',
  guide: () => process.env.LEAD_INBOX_GUIDES || 'guides@summitlink.com',
  seven_summits: () => process.env.LEAD_INBOX_HELLO || 'hello@summitlink.com',
};

const TYPE_LABEL = {
  contact: 'Contact',
  partnership: 'Partnership',
  guide: 'Guide Application',
  seven_summits: 'Seven Summits Application',
};

// 最小化 HTML 转义，避免线索内容破坏邮件结构或注入脚本
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRows(fields) {
  return Object.entries(fields)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => {
      const value = Array.isArray(v) ? v.join(', ') : String(v);
      return `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;color:#0f172a;">${escapeHtml(k)}</td><td style="padding:6px 12px;color:#334155;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`;
    })
    .join('');
}

let resendClient = null;
function getResendClient() {
  if (resendClient) return resendClient;
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * 发送一封线索通知邮件给对应管理员收件箱。
 * @param {object} params
 * @param {string} params.type   线索类型（contact|partnership|guide|seven_summits）
 * @param {object} params.fields 该表单的字段键值对（用于渲染邮件正文）
 * @returns {Promise<{ok: boolean, skipped?: boolean, error?: string}>}
 */
async function sendLeadNotification({ type, fields }) {
  const to = (INBOX[type] || INBOX.contact)();
  const label = TYPE_LABEL[type] || 'Website Lead';
  const subject = `[SummitLink] New ${label} submission`;

  // 未配置 Resend：Mock 输出，便于开发/测试且不阻断主流程
  if (!process.env.RESEND_API_KEY) {
    console.log(`📧 [Mock Lead Email] → ${to} | ${subject}`);
    return { ok: true, skipped: true };
  }

  const from = process.env.RESEND_FROM || 'noreply@mail.ussummit.cn';
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
      <h2 style="color:#0f172a;">New ${escapeHtml(label)} submission</h2>
      <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;">
        ${renderRows(fields)}
      </table>
    </div>
  `;

  try {
    const client = getResendClient();
    const { error } = await client.emails.send({ from, to, subject, html });
    if (error) throw new Error(error.message || 'send failed');
    console.log(`📧 [Resend Lead Email] → ${to} | ${subject}`);
    return { ok: true };
  } catch (e) {
    // best-effort：仅记录，不抛出，确保已写入的 Lead 不受影响
    console.warn('[leadMailer] notification failed:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendLeadNotification, INBOX, TYPE_LABEL };
