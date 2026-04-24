/**
 * @file email.js
 * @description 邮件发送工具。通过 EMAIL_PROVIDER 环境变量切换实现。
 *   - 默认：MockEmailProvider（打印到控制台，用于内测/开发）
 *   - SMTP：EMAIL_PROVIDER=smtp，对接任意 SMTP 服务（阿里云企业邮箱、QQ邮箱、163等）
 *
 * SMTP 所需环境变量：
 *   EMAIL_HOST     - SMTP 服务器地址（如 smtp.qiye.aliyun.com）
 *   EMAIL_PORT     - SMTP 端口（默认 465）
 *   EMAIL_SECURE   - 是否使用 SSL（'true'/'false'，默认 'true'）
 *   EMAIL_USER     - SMTP 登录用户名（发件邮箱地址）
 *   EMAIL_PASS     - SMTP 登录密码（授权码）
 *   EMAIL_FROM     - 发件人显示名，格式："SummitLink <noreply@your-domain.com>"
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

/**
 * @class MockEmailProvider
 * @description 模拟邮件服务商 —— 仅打印到控制台，用于内测/开发阶段。
 */
class MockEmailProvider extends EmailProvider {
  async send(email, code) {
    console.log(`📧 [Mock Email] ${email} → ${code}`);
    return { ok: true };
  }
}

/**
 * @class SmtpEmailProvider
 * @description 基于 SMTP 的邮件服务商（nodemailer）。
 */
class SmtpEmailProvider extends EmailProvider {
  constructor() {
    super();
    const nodemailer = require('nodemailer');
    this._transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.qiye.aliyun.com',
      port: parseInt(process.env.EMAIL_PORT || '465', 10),
      secure: process.env.EMAIL_SECURE !== 'false', // 默认 true（SSL）
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    this._from = process.env.EMAIL_FROM || `SummitLink <${process.env.EMAIL_USER}>`;
  }

  async send(email, code) {
    // Sanitize code to digits only before embedding in HTML
    const safeCode = String(code).replace(/[^0-9]/g, '');
    await this._transporter.sendMail({
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
    console.log(`📧 [SMTP Email] ${email} → 验证码已发送`);
    return { ok: true };
  }
}

/** 根据环境变量选择邮件服务商 */
const provider = process.env.EMAIL_PROVIDER === 'smtp'
  ? new SmtpEmailProvider()
  : new MockEmailProvider();

module.exports = provider;
