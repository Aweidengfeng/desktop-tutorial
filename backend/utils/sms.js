/**
 * @file sms.js
 * @description 短信服务商抽象层。通过 SMS_PROVIDER 环境变量切换实现。
 *   - 当前默认：MockSmsProvider（打印到控制台，用于内测）
 *   - 未来切换：SMS_PROVIDER=aliyun 对接阿里云短信 SDK（阶段 B）
 */

/**
 * @class SmsProvider
 * @abstract 短信服务商抽象基类
 */
class SmsProvider {
  /**
   * 发送短信验证码
   * @param {string} phone - 手机号（E.164 或国内 11 位格式）
   * @param {string} code  - 6 位验证码
   * @returns {Promise<{ok: boolean}>}
   */
  async send(phone, code) {
    throw new Error('SmsProvider.send() not implemented');
  }
}

/**
 * @class MockSmsProvider
 * @description 模拟短信服务商 —— 仅打印到控制台，用于内测阶段。
 */
class MockSmsProvider extends SmsProvider {
  async send(phone, code) {
    console.log(`📱 [Mock SMS] ${phone} → ${code}`);
    return { ok: true };
  }
}

/**
 * @class AliyunSmsProvider
 * @description 阿里云短信服务商（阶段 B 实现）。
 * TODO: 阶段 B 接入阿里云短信 SDK（@alicloud/sms-dysms）
 */
class AliyunSmsProvider extends SmsProvider {
  async send(phone, code) {
    // TODO: 阶段 B 替换为真实阿里云短信调用
    throw new Error('AliyunSmsProvider not implemented yet (TODO: B2 阶段接入阿里云短信 SDK)');
  }
}

/** 根据环境变量选择短信服务商 */
const provider = process.env.SMS_PROVIDER === 'aliyun'
  ? new AliyunSmsProvider()
  : new MockSmsProvider();

module.exports = provider;
