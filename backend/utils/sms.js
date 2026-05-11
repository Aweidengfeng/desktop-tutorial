/**
 * @file sms.js
 * @description 短信服务商抽象层。通过 SMS_PROVIDER 环境变量切换实现。
 *   - 默认：MockSmsProvider（打印到控制台，用于内测/开发）
 *   - 生产：SMS_PROVIDER=aliyun 对接阿里云短信服务
 *
 * 阿里云短信所需环境变量：
 *   ALIYUN_SMS_ACCESS_KEY_ID     - 阿里云 AccessKey ID
 *   ALIYUN_SMS_ACCESS_KEY_SECRET - 阿里云 AccessKey Secret
 *   ALIYUN_SMS_SIGN_NAME         - 短信签名（如"SummitLink"，需在控制台申请）
 *   ALIYUN_SMS_TEMPLATE_CODE     - 短信模板 Code（如 SMS_xxxxxxxx，模板内容须含 ${code}）
 */

/**
 * @class SmsProvider
 * @abstract 短信服务商抽象基类
 */
class SmsProvider {
  /**
   * 发送短信验证码
   * @param {string} phone - 手机号（国内 11 位格式）
   * @param {string} code  - 6 位验证码
   * @returns {Promise<{ok: boolean}>}
   */
  async send(phone, code) {
    throw new Error('SmsProvider.send() not implemented');
  }
}

/** 手机号脱敏：保留前3位和后2位，中间用 **** 替代；不足6位则全部遮掩 */
function maskPhone(phone) {
  const str = String(phone);
  if (str.length < 6) return '****';
  return str.slice(0, 3) + '****' + str.slice(-2);
}

/**
 * @class MockSmsProvider
 * @description 模拟短信服务商 —— 仅打印到控制台，用于内测/开发阶段。
 */
class MockSmsProvider extends SmsProvider {
  async send(phone, code) {
    console.log(`📱 [Mock SMS] ${maskPhone(phone)} → [验证码已生成]`);
    return { ok: true };
  }
}

/**
 * @class AliyunSmsProvider
 * @description 阿里云短信服务商。需设置以下环境变量：
 *   ALIYUN_SMS_ACCESS_KEY_ID, ALIYUN_SMS_ACCESS_KEY_SECRET,
 *   ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE
 */
class AliyunSmsProvider extends SmsProvider {
  constructor() {
    super();
    const Dysmsapi = require('@alicloud/dysmsapi20170525');
    const OpenApi = require('@alicloud/openapi-client');
    const Util = require('@alicloud/tea-util');

    const config = new OpenApi.Config({
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
    });
    // 阿里云短信服务 endpoint
    config.endpoint = 'dysmsapi.aliyuncs.com';
    this._client = new Dysmsapi.default(config);
    this._Dysmsapi = Dysmsapi;
    this._Util = Util;
  }

  async send(phone, code) {
    const sendSmsRequest = new this._Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: process.env.ALIYUN_SMS_SIGN_NAME,
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    });
    const runtime = new this._Util.RuntimeOptions({});
    const resp = await this._client.sendSmsWithOptions(sendSmsRequest, runtime);
    const body = resp.body;
    if (body.code !== 'OK') {
      throw new Error(`阿里云短信发送失败: ${body.code} - ${body.message}`);
    }
    console.log(`📱 [Aliyun SMS] ${maskPhone(phone)} → 验证码已发送 (RequestId: ${body.requestId})`);
    return { ok: true };
  }
}

/** 根据环境变量选择短信服务商 */
const provider = process.env.SMS_PROVIDER === 'aliyun'
  ? new AliyunSmsProvider()
  : new MockSmsProvider();

module.exports = provider;
