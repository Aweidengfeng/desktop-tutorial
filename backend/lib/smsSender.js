async function sendSms(phone, templateId, params = []) {
  const secretId = (process.env.TENCENT_SMS_SECRET_ID || '').trim();
  const secretKey = (process.env.TENCENT_SMS_SECRET_KEY || '').trim();
  const appId = (process.env.TENCENT_SMS_APP_ID || process.env.TENCENT_SMS_SDK_APP_ID || '').trim();
  const signName = (process.env.TENCENT_SMS_SIGN_NAME || '').trim();

  if (!secretId || !secretKey || !appId) {
    console.warn('[SMS mock]', { phone, templateId, params });
    return { success: true, mock: true };
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-sms');
    const SmsClient = tencentcloud.sms.v20210111.Client;
    const client = new SmsClient({
      credential: { secretId, secretKey },
      region: 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
    });

    const resp = await client.SendSms({
      SmsSdkAppId: appId,
      SignName: signName || 'SummitLink',
      TemplateId: String(templateId || process.env.TENCENT_SMS_TEMPLATE_ID || ''),
      TemplateParamSet: params.map(v => String(v)),
      PhoneNumberSet: [String(phone || '')],
    });
    const status = resp?.SendStatusSet?.[0];
    return {
      success: status?.Code === 'Ok',
      mock: false,
      code: status?.Code || 'Unknown',
      message: status?.Message || '',
    };
  } catch (e) {
    console.warn('[SMS mock fallback]', e);
    return { success: true, mock: true, fallback: true };
  }
}

module.exports = { sendSms };
