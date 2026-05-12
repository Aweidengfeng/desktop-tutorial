'use strict';

const { sentryBeforeSend } = require('../middleware/sentry');

describe('sentry beforeSend PII 脱敏', () => {
  test('应替换手机号、邮箱、JWT、Stripe secret 为 [REDACTED]', () => {
    const event = {
      message: 'phone=13800138000 email=foo.bar+1@Example.com token=eyJabc.def_123.ghi-456 stripe=sk_LIVE_abcd1234',
      request: {
        data: {
          contact: '13800138000',
          email: 'foo.bar+1@Example.com',
          jwt: 'eyJabc.def_123.ghi-456',
          stripeSecret: 'sk_test_abcd1234',
        },
      },
      exception: {
        values: [
          { value: 'JWT eyJabc.def_123.ghi-456 + stripe sk_live_xyz123 + 13800138000 + foo@test.com' },
        ],
      },
      user: {
        id: 12345,
        email: 'foo@test.com',
        phone: '13800138000',
      },
    };

    const out = sentryBeforeSend(event);

    expect(out.message).not.toContain('13800138000');
    expect(out.message).not.toContain('foo.bar+1@Example.com');
    expect(out.message).not.toContain('eyJabc.def_123.ghi-456');
    expect(out.message).not.toContain('sk_LIVE_abcd1234');
    expect(out.message).toContain('[REDACTED]');

    expect(out.request.data.contact).toBe('[REDACTED]');
    expect(out.request.data.email).toBe('[REDACTED]');
    expect(out.request.data.jwt).toBe('[REDACTED]');
    expect(out.request.data.stripeSecret).toBe('[REDACTED]');

    expect(out.exception.values[0].value).not.toContain('13800138000');
    expect(out.exception.values[0].value).not.toContain('foo@test.com');
    expect(out.exception.values[0].value).not.toContain('eyJabc.def_123.ghi-456');
    expect(out.exception.values[0].value).not.toContain('sk_live_xyz123');
    expect(out.exception.values[0].value).toContain('[REDACTED]');

    expect(out.user).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
  });
});
