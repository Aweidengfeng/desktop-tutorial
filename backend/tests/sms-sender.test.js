const path = require('path');

const smsSenderPath = path.resolve(__dirname, '../lib/smsSender.js');

describe('smsSender', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    for (const k of ['TENCENT_SMS_SECRET_ID', 'TENCENT_SMS_SECRET_KEY', 'TENCENT_SMS_APP_ID', 'TENCENT_SMS_SIGN_NAME']) {
      delete process.env[k];
    }
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('未配置腾讯云凭据时返回 mock 成功', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const smsSender = require(smsSenderPath);
    const result = await smsSender.sendSms('+8613800000000', '123', ['654321']);
    expect(result.success).toBe(true);
    expect(result.mock).toBe(true);
    warnSpy.mockRestore();
  });

  test('配置腾讯云凭据时调用腾讯 SDK', async () => {
    process.env.TENCENT_SMS_SECRET_ID = 'id';
    process.env.TENCENT_SMS_SECRET_KEY = 'key';
    process.env.TENCENT_SMS_APP_ID = '1400000000';
    process.env.TENCENT_SMS_SIGN_NAME = 'SummitLink';

    const sendSmsMock = jest.fn().mockResolvedValue({
      SendStatusSet: [{ Code: 'Ok', Message: 'send success' }],
    });
    jest.doMock('tencentcloud-sdk-nodejs-sms', () => ({
      sms: { v20210111: { Client: class { SendSms = sendSmsMock; } } },
    }));

    const smsSender = require(smsSenderPath);
    const result = await smsSender.sendSms('+8613800000000', '123', ['654321']);
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.mock).toBe(false);
  });
});
