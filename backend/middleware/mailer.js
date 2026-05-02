/**
 * mailer.js — 邮件发送服务（渐进增强）
 * 若未配置 SMTP_HOST，则静默跳过（仅日志）。
 *
 * 环境变量：
 *   SMTP_HOST      SMTP 服务器，如 smtp.aliyun.com 或 smtp.gmail.com
 *   SMTP_PORT      端口，默认 465
 *   SMTP_SECURE    true/false，默认 true
 *   SMTP_USER      发件人邮箱
 *   SMTP_PASS      邮箱密码/授权码
 *   SMTP_FROM      发件人显示名，如 "SummitLink <noreply@summitlink.com>"
 */

const MAIL_ENABLED = !!process.env.SMTP_HOST;
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  } catch (e) {
    console.warn('[mailer] nodemailer 未安装或初始化失败:', e.message);
    return null;
  }
}

const FROM = process.env.SMTP_FROM || 'SummitLink <noreply@summitlink.com>';

async function sendMail({ to, subject, html, text }) {
  if (!MAIL_ENABLED) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[mailer] 邮件未配置，跳过发送 → subject: ${subject}`);
    }
    return { skipped: true };
  }
  const t = getTransporter();
  if (!t) return { skipped: true };
  try {
    const info = await t.sendMail({ from: FROM, to, subject, html, text });
    console.log('[mailer] 已发送:', info.messageId);
    return { sent: true, messageId: info.messageId };
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

module.exports = { sendMail, bookingConfirmEmail, certificationResultEmail, emailVerifyCode, MAIL_ENABLED };
