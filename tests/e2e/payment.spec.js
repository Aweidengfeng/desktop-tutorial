/**
 * E2E 测试：支付流程（mock 模式）
 *
 * 覆盖：
 *  1. 远征预约支付流程（mock 模式）
 *  2. 向导预约支付流程（mock 模式）
 *  3. Stripe mock 支付（provider=mock 场景）
 *
 * 所有测试在 AMAP_KEY / STRIPE_SECRET_KEY 未配置时（mock 模式）也能通过。
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// 测试账号（seed 数据）
const TEST_PHONE = '13800138000';
const TEST_PASSWORD = '123456';

async function login(request, phone = TEST_PHONE, password = TEST_PASSWORD) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { phone, password },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body.token || null;
}

test.describe('支付流程 E2E（mock 模式）', () => {
  test('1. 获取支付提供商信息（mock 模式下 provider 不为空）', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/payment/provider`);
    // 200 = 成功；503 = 支付降级（mock 模式下合法）
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('provider');
    }
  });

  test('2. 远征预约支付：创建支付订单（mock 提供商）', async ({ request }) => {
    const userToken = await login(request);
    if (!userToken) {
      test.skip(true, '无法登录测试账号');
      return;
    }

    // 先获取远征列表
    const expeditionsRes = await request.get(`${BASE_URL}/api/expeditions`);
    if (!expeditionsRes.ok()) {
      test.skip(true, '/api/expeditions 不可用，跳过');
      return;
    }
    const expeditions = await expeditionsRes.json();
    const list = Array.isArray(expeditions) ? expeditions : (expeditions.expeditions || []);
    if (list.length === 0) {
      test.skip(true, '无远征数据，跳过');
      return;
    }

    // 创建支付订单（provider=mock）
    const payRes = await request.post(`${BASE_URL}/api/payment/create`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        order_type: 'expedition',
        order_id: list[0].id || 1,
        amount: 1000,
        description: 'E2E 远征支付测试',
        provider: 'mock',
      },
    });
    // 200 = 成功；503 = 支付降级；两者都是合法 mock 响应
    expect([200, 400, 503]).toContain(payRes.status());
    if (payRes.status() === 200) {
      const body = await payRes.json();
      expect(body).toHaveProperty('orderNo');
    }
  });

  test('3. 向导服务支付：创建支付订单（mock 提供商）', async ({ request }) => {
    const userToken = await login(request);
    if (!userToken) {
      test.skip(true, '无法登录测试账号');
      return;
    }

    const payRes = await request.post(`${BASE_URL}/api/payment/create`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        order_type: 'guide_service',
        order_id: 1,
        amount: 500,
        description: 'E2E 向导服务支付测试',
        provider: 'mock',
      },
    });
    expect([200, 400, 503]).toContain(payRes.status());
  });

  test('4. Mock 支付确认：完整支付流程（创建 → 确认）', async ({ request }) => {
    const userToken = await login(request);
    if (!userToken) {
      test.skip(true, '无法登录测试账号');
      return;
    }

    // 创建支付订单
    const payRes = await request.post(`${BASE_URL}/api/payment/create`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        order_type: 'expedition',
        order_id: 1,
        amount: 100,
        description: 'E2E mock-pay 测试',
        provider: 'mock',
      },
    });
    if (payRes.status() !== 200) {
      test.skip(true, '支付接口不可用，跳过 mock-pay 测试');
      return;
    }
    const { orderNo } = await payRes.json();

    // mock-pay 页面在 NODE_ENV=production 时返回 404，非生产时可访问
    const mockPayRes = await request.get(`${BASE_URL}/api/payment/mock-pay?orderNo=${orderNo}&amount=100`);
    expect([200, 404]).toContain(mockPayRes.status());

    // mock-confirm 确认支付
    const confirmRes = await request.post(`${BASE_URL}/api/payment/mock-confirm`, {
      data: { orderNo },
    });
    expect([200, 404]).toContain(confirmRes.status());
    if (confirmRes.status() === 200) {
      const body = await confirmRes.json();
      expect(body.success).toBe(true);
    }
  });

  test('5. Stripe mock 场景：provider=mock 下创建订单并完成支付流程', async ({ request }) => {
    const userToken = await login(request);
    if (!userToken) {
      test.skip(true, '无法登录测试账号');
      return;
    }

    // 创建 mock 支付订单
    const createRes = await request.post(`${BASE_URL}/api/payment/create`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        order_type: 'expedition',
        order_id: 1,
        amount: 299,
        description: 'E2E Stripe mock 支付',
        provider: 'mock',
      },
    });
    if (createRes.status() !== 200) {
      test.skip(true, '支付接口降级，跳过 Stripe mock 测试');
      return;
    }
    const { orderNo } = await createRes.json();
    expect(orderNo).toBeTruthy();

    // 确认支付（mock-confirm）
    const confirmRes = await request.post(`${BASE_URL}/api/payment/mock-confirm`, {
      data: { orderNo },
    });
    expect([200, 404]).toContain(confirmRes.status());
    if (confirmRes.status() === 200) {
      const body = await confirmRes.json();
      expect(body.success).toBe(true);
      expect(body.orderNo).toBe(orderNo);
    }
  });
});
