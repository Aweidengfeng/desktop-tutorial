const path = require('path');
const express = require('express');
const request = require('supertest');

const paymentModulePath = path.resolve(__dirname, '../routes/payment.js');
const ORIGINAL_ENV = { ...process.env };

function resetProcessEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function resetPaymentModule() {
  jest.resetModules();
}

function loadPaymentRouter() {
  let router;
  jest.isolateModules(() => {
    router = require(paymentModulePath);
  });
  return router;
}

function createAppWithPaymentRoute() {
  const app = express();
  app.use(express.json());
  app.use('/api/payment', loadPaymentRouter());
  return app;
}

describe('payment degraded mode', () => {
  beforeEach(() => {
    resetProcessEnv();
    resetPaymentModule();
    process.env.STRIPE_DISABLED = '';
    process.env.STRIPE_SECRET_KEY = '';
  });

  afterAll(() => {
    resetProcessEnv();
    resetPaymentModule();
  });

  test('STRIPE_DISABLED=true 时 /create-payment-intent 返回 503', async () => {
    process.env.STRIPE_DISABLED = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const app = createAppWithPaymentRoute();

    const res = await request(app).post('/api/payment/create-payment-intent').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('payment_unavailable');
  });

  test('STRIPE_DISABLED=true + sk_live_ 仍优先降级', async () => {
    process.env.STRIPE_DISABLED = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_live_123';
    const app = createAppWithPaymentRoute();

    const res = await request(app).post('/api/payment/create-payment-intent').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('payment_unavailable');
    expect(res.body.reason).toBe('STRIPE_DISABLED=true');
  });

  test('production 且缺失 STRIPE_SECRET_KEY 时自动降级', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_DISABLED = '';
    process.env.STRIPE_SECRET_KEY = '';
    const app = createAppWithPaymentRoute();

    const res = await request(app).post('/api/payment/create-payment-intent').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('payment_unavailable');
    expect(res.body.reason).toBe('STRIPE_SECRET_KEY missing');
  });

  test('production + sk_test_* 且无 STRIPE_DISABLED 时仍抛错（Live Guard）', () => {
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_DISABLED = '';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    expect(() => loadPaymentRouter()).toThrow(/生产环境禁止使用测试密钥[\s\S]*STRIPE_DISABLED=true/);
  });

  test('production + sk_test_* + STRIPE_DISABLED=true 时不抛错并降级', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_DISABLED = 'true';
    const app = createAppWithPaymentRoute();

    const res = await request(app).post('/api/payment/create-payment-intent').send({});
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('payment_unavailable');
  });
});
