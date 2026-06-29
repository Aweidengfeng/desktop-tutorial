const { validateProductionEnv } = require('../utils/productionEnv');

describe('production environment validation', () => {
  test('skips fail-closed checks outside production', () => {
    expect(validateProductionEnv({ NODE_ENV: 'test' })).toEqual([]);
  });

  test('requires production lead email and CORS settings', () => {
    const errors = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_PROVIDER: 'sqlite',
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('DATABASE_PROVIDER 必须设置为 postgresql'),
      'CORS_ORIGINS 未设置',
      'RESEND_API_KEY 未设置，官网线索邮件不会真实发送',
      'RESEND_FROM 未设置，必须使用 Resend 已验证域名下的发件邮箱',
      'LEADS_NOTIFY_EMAIL 或 ADMIN_EMAIL 至少设置一个，用于接收官网线索通知',
    ]));
  });

  test('accepts complete production configuration with admin email fallback', () => {
    expect(validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_PROVIDER: 'postgresql',
      CORS_ORIGINS: 'https://unsummit.cn,https://www.unsummit.cn',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM: 'SummitLink <no-reply@unsummit.cn>',
      ADMIN_EMAIL: 'admin@example.com',
    })).toEqual([]);
  });

  test('rejects non-HTTPS CORS origins and origins with paths', () => {
    const errors = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_PROVIDER: 'postgresql',
      CORS_ORIGINS: 'http://unsummit.cn,https://www.unsummit.cn/contact',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM: 'SummitLink <no-reply@unsummit.cn>',
      LEADS_NOTIFY_EMAIL: 'ops@example.com',
    });

    expect(errors).toEqual(expect.arrayContaining([
      'CORS_ORIGINS 中的 http://unsummit.cn 必须使用 HTTPS',
      'CORS_ORIGINS 中的 https://www.unsummit.cn/contact 必须是完整 origin，不能包含路径、查询或片段',
    ]));
  });
});
