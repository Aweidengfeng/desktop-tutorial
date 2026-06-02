/**
 * @file email.js
 * @description 邮件发送工具。根据环境变量自动选择实现。
 *   - 默认：MockEmailProvider（打印到控制台，用于内测/开发）
 *   - Resend：配置 RESEND_API_KEY 后自动启用
 *
 * Resend 所需环境变量：
 *   RESEND_API_KEY - Resend API Key
 *   RESEND_FROM    - 发件人邮箱地址
 */

/**
 * @class EmailProvider
 * @abstract 邮件服务商抽象基类
 */
class EmailProvider {
  /**
   * 发送验证码邮件
   * @param {string} email - 收件邮箱地址
   * @param {string} code  - 6 位验证码
   * @returns {Promise<{ok: boolean}>}
   */
  async send(email, code) {
    throw new Error('EmailProvider.send() not implemented');
  }
}

/** 邮箱脱敏：仅显示首字符和域名部分。
 *  使用 indexOf 而非正则，避免在畸形输入（如 'aa@aa@...'）上触发多项式回溯（ReDoS）。
 */
function maskEmail(email) {
  const str = String(email);
  const atIndex = str.indexOf('@');
  if (atIndex < 0) return '****';
  return str[0] + '****' + str.slice(atIndex);
}

/**
 * @class MockEmailProvider
 * @description 模拟邮件服务商 —— 仅打印到控制台，用于内测/开发阶段。
 */
class MockEmailProvider extends EmailProvider {
  async send(email, code) {
    // 脱敏：遮掩用户名中间部分（仅显示首字符 + 域名）
    console.log(`📧 [Mock Email] ${maskEmail(email)} → [验证码已生成]`);
    return { ok: true };
  }
}

/**
 * @class ResendEmailProvider
 * @description 基于 Resend SDK 的邮件服务商。
 */
class ResendEmailProvider extends EmailProvider {
  constructor() {
    super();
    const { Resend } = require('resend');
    this._client = new Resend(process.env.RESEND_API_KEY);
    this._from = process.env.RESEND_FROM || 'noreply@mail.ussummit.cn';
  }

  async send(email, code) {
    // Sanitize code to digits only before embedding in HTML
    const safeCode = String(code).replace(/[^0-9]/g, '');
    const { error } = await this._client.emails.send({
      from: this._from,
      to: email,
      subject: '【SummitLink】您的邮箱验证码',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
          <h2 style="color:#10b981;margin-bottom:8px;">SummitLink 邮箱验证</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">您正在进行邮箱验证，请使用以下验证码：</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#10b981;">${safeCode}</span>
          </div>
          <p style="color:#64748b;font-size:13px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#475569;font-size:12px;margin-top:16px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
      text: `您的 SummitLink 邮箱验证码为：${safeCode}，5 分钟内有效，请勿泄露给他人。`,
    });
    if (error) throw new Error(error.message || '邮件发送失败');
    console.log(`📧 [Resend Email] ${maskEmail(email)} → 验证码已发送`);
    return { ok: true };
  }
}

/** 根据环境变量选择邮件服务商 */
const provider = process.env.RESEND_API_KEY
  ? new ResendEmailProvider()
  : new MockEmailProvider();

module.exports = provider;
