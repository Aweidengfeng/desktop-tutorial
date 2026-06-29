/**
 * mailer.js — 邮件发送服务（渐进增强）
 * 若未配置 RESEND_API_KEY，则静默跳过（仅日志）。
 *
 * 环境变量：
 *   RESEND_API_KEY  Resend API Key
 *   RESEND_FROM     发件人邮箱，如 no-reply@unsummit.cn
 */

const MAIL_ENABLED = !!process.env.RESEND_API_KEY;
let resend = null;

function getResendClient() {
  if (resend) return resend;
  try {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
    return resend;
  } catch (e) {
    console.warn('[mailer] resend 未安装或初始化失败:', e.message);
    return null;
  }
}

const FROM = process.env.RESEND_FROM || 'no-reply@unsummit.cn';

async function sendMail({ to, subject, html, text }) {
  if (!MAIL_ENABLED) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mailer] 邮件未配置，跳过发送 → subject: ${subject}`);
    }
    return { skipped: true };
  }
  const client = getResendClient();
  if (!client) return { skipped: true };
  try {
    const { data, error } = await client.emails.send({ from: FROM, to, subject, html, text });
    if (error) throw new Error(error.message || '邮件发送失败');
    console.log('[mailer] 已发送:', data?.id || 'unknown message ID');
    return { sent: true, messageId: data?.id };
  } catch (e) {
    console.error('[mailer] 发送失败:', e.message);
    return { error: e.message };
  }
}

// ── 邮件模板 ──────────────────────────────────────────────

function bookingConfirmEmail({ userName, peakName, date, guideOrClub, orderNo }) {
  return {
    subject: `【SummitLink】预约确认 - ${peakName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e40af">🏔️ SummitLink 预约确认</h2>
        <p>您好 <strong>${userName}</strong>，</p>
        <p>您的预约已确认：</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">山峰</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${peakName}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">日期</td><td style="padding:8px;border:1px solid #e5e7eb">${date}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">向导/俱乐部</td><td style="padding:8px;border:1px solid #e5e7eb">${guideOrClub}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">订单号</td><td style="padding:8px;border:1px solid #e5e7eb">${orderNo}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:14px">如有问题请联系客服。祝攀登顺利！</p>
        <hr style="border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px">SummitLink © 2026</p>
      </div>
    `,
  };
}

function certificationResultEmail({ userName, type, status, reviewNote }) {
  const statusText = status === 'approved' ? '✅ 已通过' : '❌ 未通过';
  const typeText = type === 'guide' ? '向导认证' : '俱乐部认证';
  return {
    subject: `【SummitLink】${typeText}审核结果`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e40af">🏔️ SummitLink 认证审核结果</h2>
        <p>您好 <strong>${userName}</strong>，</p>
        <p>您的 <strong>${typeText}</strong> 申请审核结果：<strong>${statusText}</strong></p>
        ${reviewNote ? `<p style="background:#f3f4f6;padding:12px;border-radius:6px">审核意见：${reviewNote}</p>` : ''}
        ${status !== 'approved' ? '<p>您可以修改材料后重新申请。</p>' : '<p>恭喜！您现在可以在平台上为用户提供服务。</p>'}
        <hr style="border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px">SummitLink © 2026</p>
      </div>
    `,
  };
}

function emailVerifyCode({ code, purpose }) {
  const purposeText = purpose === 'login' ? '登录' : purpose === 'register' ? '注册' : '验证';
  return {
    subject: `【SummitLink】${purposeText}验证码：${code}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e40af">🏔️ SummitLink 验证码</h2>
        <p>您的${purposeText}验证码为：</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e40af;text-align:center;padding:20px;background:#eff6ff;border-radius:8px">${code}</p>
        <p style="color:#6b7280">验证码有效期 10 分钟，请勿泄露给他人。</p>
        <hr style="border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px">SummitLink © 2026</p>
      </div>
    `,
  };
}

/**
 * 官网线索通知邮件（发送给管理员）。
 * @param {object} lead - 已落库的 Lead 记录
 */
function leadNotificationEmail(lead) {
  const TYPE_LABELS = {
    contact: '联系咨询',
    partnership: '商务合作',
    guide_application: '向导申请',
    seven_summits: '七大洲报名',
  };
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const label = TYPE_LABELS[lead.type] || lead.type;
  const row = (k, v) => v
    ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280">${esc(k)}</td><td style="padding:8px;border:1px solid #e5e7eb">${esc(v)}</td></tr>`
    : '';
  return {
    subject: `【SummitLink】新线索：${label}${lead.name ? ' - ' + lead.name : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e40af">🏔️ SummitLink 官网新线索</h2>
        <p>收到一条 <strong>${esc(label)}</strong> 线索（ID #${esc(lead.id)}）：</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          ${row('姓名', lead.name)}
          ${row('邮箱', lead.email)}
          ${row('电话', lead.phone)}
          ${row('公司/机构', lead.company)}
          ${row('主题', lead.subject)}
          ${row('留言', lead.message)}
          ${row('来源', lead.source)}
        </table>
        <p style="color:#6b7280;font-size:14px">请登录管理后台查看完整信息并跟进。</p>
        <hr style="border:none;border-top:1px solid #e5e7eb">
        <p style="color:#9ca3af;font-size:12px">SummitLink © 2026</p>
      </div>
    `,
    text: `新线索（${label}）#${lead.id}：姓名=${lead.name || ''} 邮箱=${lead.email || ''} 电话=${lead.phone || ''} 留言=${lead.message || ''}`,
  };
}

/**
 * 官网线索确认邮件（发送给提交人）。
 * @param {object} lead - 已落库的 Lead 记录
 */
function leadConfirmationEmail(lead) {
  const TYPE_LABELS = {
    contact: 'your inquiry',
    partnership: 'your partnership inquiry',
    guide_application: 'your guide application',
    seven_summits: 'your Seven Summits application',
  };
  const NEXT_STEPS = {
    contact: 'Our team will review your message and reply within 1–2 business days.',
    partnership: 'Our partnership team will review your organization, sponsorship, or investment fit and follow up with next-step materials.',
    guide_application: 'Our guide operations team will review your certifications, mountain experience, and regional availability before contacting you.',
    seven_summits: 'Our expedition team will review your summit goals, experience, safety readiness, and cohort fit before the selection window.',
  };
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const label = TYPE_LABELS[lead.type] || 'your submission';
  const nextStep = NEXT_STEPS[lead.type] || 'Our team will review your submission and follow up with next steps.';
  const subjectLabel = lead.type === 'seven_summits'
    ? 'Seven Summits application received'
    : lead.type === 'guide_application'
      ? 'Guide application received'
      : 'Submission received';

  return {
    subject: `【SummitLink】${subjectLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="color:#1e40af;margin-bottom:12px">🏔️ SummitLink received ${esc(label)}</h2>
        <p>Hello ${esc(lead.name || 'there')},</p>
        <p>Thank you for reaching SummitLink. We have received ${esc(label)} and created a secure internal lead record for follow-up.</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0">
          <tr><td style="padding:9px;border:1px solid #e5e7eb;color:#6b7280">Reference ID</td><td style="padding:9px;border:1px solid #e5e7eb"><strong>#${esc(lead.id)}</strong></td></tr>
          <tr><td style="padding:9px;border:1px solid #e5e7eb;color:#6b7280">Submission type</td><td style="padding:9px;border:1px solid #e5e7eb">${esc(label)}</td></tr>
          ${lead.subject ? `<tr><td style="padding:9px;border:1px solid #e5e7eb;color:#6b7280">Topic</td><td style="padding:9px;border:1px solid #e5e7eb">${esc(lead.subject)}</td></tr>` : ''}
        </table>
        <p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;color:#1e3a8a"><strong>Next step:</strong> ${esc(nextStep)}</p>
        <p style="color:#4b5563;font-size:14px">You do not need to resubmit the form. If you need to add documents or urgent context, reply to this email or contact hello@unsummit.cn.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px">SummitLink © 2026 · Summit Technology LLC & 未登峰（北京）科技有限公司</p>
      </div>
    `,
    text: `SummitLink received ${label}. Reference ID: #${lead.id}. Next step: ${nextStep}`,
  };
}

module.exports = {
  sendMail,
  bookingConfirmEmail,
  certificationResultEmail,
  emailVerifyCode,
  leadNotificationEmail,
  leadConfirmationEmail,
  MAIL_ENABLED,
};