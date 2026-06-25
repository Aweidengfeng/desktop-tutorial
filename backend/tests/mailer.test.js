const path = require('path');

const mailerPath = path.resolve(__dirname, '../middleware/mailer.js');
const emailProviderPath = path.resolve(__dirname, '../utils/email.js');

describe('Resend mail helpers', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.dontMock('resend');
    process.env = { ...OLD_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('mailer skips sending when RESEND_API_KEY is not configured', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { sendMail, MAIL_ENABLED } = require(mailerPath);

    expect(MAIL_ENABLED).toBe(false);
    await expect(sendMail({ to: 'user@example.com', subject: 'hello', html: '<p>ok</p>' }))
      .resolves.toEqual({ skipped: true });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[mailer] 邮件未配置'));

    logSpy.mockRestore();
  });

  test('mailer sends through Resend with configured sender', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'custom@example.com';

    const sendMock = jest.fn().mockResolvedValue({ data: { id: 'email_123' } });
    jest.doMock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: { send: sendMock },
      })),
    }));

    const { sendMail, MAIL_ENABLED } = require(mailerPath);
    const result = await sendMail({
      to: 'user@example.com',
      subject: 'hello',
      html: '<p>ok</p>',
      text: 'ok',
    });

    expect(MAIL_ENABLED).toBe(true);
    expect(sendMock).toHaveBeenCalledWith({
      from: 'custom@example.com',
      to: 'user@example.com',
      subject: 'hello',
      html: '<p>ok</p>',
      text: 'ok',
    });
    expect(result).toEqual({ sent: true, messageId: 'email_123' });
  });

  test('email provider uses Resend and sanitizes verification code', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'noreply@test.example';

    const sendMock = jest.fn().mockResolvedValue({ data: { id: 'email_456' } });
    jest.doMock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: { send: sendMock },
      })),
    }));

    const emailProvider = require(emailProviderPath);
    const result = await emailProvider.send('user@example.com', '12a34<script>56');

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'noreply@test.example',
      to: 'user@example.com',
      subject: '【SummitLink】您的邮箱验证码',
      text: '您的 SummitLink 邮箱验证码为：123456，5 分钟内有效，请勿泄露给他人。',
    }));
    expect(sendMock.mock.calls[0][0].html).toContain('123456');
    expect(result).toEqual({ ok: true });
  });

  test('lead confirmation email escapes applicant content and explains next steps', () => {
    const { leadConfirmationEmail } = require(mailerPath);
    const email = leadConfirmationEmail({
      id: 42,
      type: 'seven_summits',
      name: '<Alex>',
      subject: 'Everest & Vinson',
    });

    expect(email.subject).toContain('Seven Summits application received');
    expect(email.html).toContain('&lt;Alex&gt;');
    expect(email.html).toContain('Reference ID');
    expect(email.html).toContain('selection window');
    expect(email.html).not.toContain('<Alex>');
    expect(email.text).toContain('#42');
  });
});
