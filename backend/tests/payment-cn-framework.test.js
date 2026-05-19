const path = require('path');

const wechatPayPath = path.resolve(__dirname, '../lib/payment/wechat-pay.js');
const alipayPath = path.resolve(__dirname, '../lib/payment/alipay.js');
const wechatSplitPath = path.resolve(__dirname, '../lib/payment/wechat-split.js');
const middlewarePath = path.resolve(__dirname, '../middleware/payment.js');

describe('CN payment framework mock mode', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const key of [
      'WECHAT_MCH_ID',
      'WECHAT_APP_ID',
      'WECHAT_API_V3_KEY',
      'WECHAT_CERT_SERIAL',
      'WECHAT_PRIVATE_KEY',
      'WECHAT_PLATFORM_PUBLIC_KEY',
      'ALIPAY_APP_ID',
      'ALIPAY_PRIVATE_KEY',
      'ALIPAY_PUBLIC_KEY',
      'WECHAT_SPLIT_ENABLED',
    ]) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('wechat-pay 在缺失环境变量时返回 mock 下单参数', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const wechatPay = require(wechatPayPath);
    const result = await wechatPay.createOrder({
      body: '测试订单',
      outTradeNo: 'ORDER_CN_1',
      totalFee: 100,
      notifyUrl: 'https://example.com/notify',
      openid: 'openid_xxx',
    });
    expect(result.mock).toBe(true);
    expect(result.prepayId).toContain('mock_prepay_id_');
    warnSpy.mockRestore();
  });

  test('alipay 在缺失环境变量时返回 mock 订单参数', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const alipay = require(alipayPath);
    const result = await alipay.createOrder({
      subject: '测试订单',
      outTradeNo: 'ORDER_ALI_1',
      totalAmount: '1.00',
      returnUrl: 'https://example.com/return',
      notifyUrl: 'https://example.com/notify',
    });
    expect(result.mock).toBe(true);
    expect(result.sign_str).toContain('mock_alipay_sign_');
    warnSpy.mockRestore();
  });

  test('middleware.createPaymentWithProvider(wechat) 走 wechat-pay mock', async () => {
    const paymentMiddleware = require(middlewarePath);
    const result = await paymentMiddleware.createPaymentWithProvider('wechat', {
      orderNo: 'ORDER_CN_2',
      amount: 29900,
      description: '测试订单',
      openid: 'openid_xxx',
    });
    expect(result.provider).toBe('mock');
    expect(result.payParams.mock).toBe(true);
  });

  test('wechat-split 默认返回 mock', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const split = require(wechatSplitPath);
    const result = await split.splitOrder({
      transactionId: '420000123456',
      receivers: [{ type: 'PERSONAL_OPENID', account: 'openid_xxx', amount: 1, description: 'test' }],
    });
    expect(result.mock).toBe(true);
    expect(result.action).toBe('splitOrder');
    warnSpy.mockRestore();
  });
});
