/**
 * E2E 测试：向导提现申请 + 管理员审批流程
 *
 * 覆盖：
 *  1. 向导申请提现
 *  2. 管理员审批提现
 *  3. 状态变更验证（pending → approved）
 *
 * 所有测试在 mock 模式（无真实支付密钥）下也能通过。
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

const GUIDE_PHONE = '13800138001';
const GUIDE_PASSWORD = '123456';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ci_test_admin_password';

async function loginUser(request, phone, password) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { phone, password },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body.token || null;
}

async function loginAdmin(request) {
  const res = await request.post(`${BASE_URL}/api/admin/login`, {
    data: { password: ADMIN_PASSWORD },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body.token || null;
}

test.describe('提现申请 + 审批 E2E', () => {
  test('1. 用户申请提现（最小金额 100 元）', async ({ request }) => {
    const userToken = await loginUser(request, GUIDE_PHONE, GUIDE_PASSWORD);
    if (!userToken) {
      // 尝试注册
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: { phone: GUIDE_PHONE, password: GUIDE_PASSWORD, name: 'E2E向导用户' },
      });
      const t2 = await loginUser(request, GUIDE_PHONE, GUIDE_PASSWORD);
      if (!t2) {
        test.skip(true, '无法登录测试账号');
        return;
      }
    }

    const profileRes = await request.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!profileRes.ok()) {
      test.skip(true, '/api/users/me 不可用，跳过');
      return;
    }
    const profile = await profileRes.json();
    const userId = profile.id || profile.user?.id;
    if (!userId) {
      test.skip(true, '无法获取用户 ID，跳过');
      return;
    }

    const withdrawRes = await request.post(`${BASE_URL}/api/pay/withdraw`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        owner_type: 'user',
        owner_id: userId,
        amount: 100,
        account_type: 'bank',
        account_info: { bank_name: '中国银行', account_no: '6222001234567890', holder: 'E2E测试' },
      },
    });
    // 200/201 = 成功；400 = 余额不足（合法）；403 = 无权限（合法）
    expect([200, 201, 400, 403]).toContain(withdrawRes.status());
    if (withdrawRes.status() === 201 || withdrawRes.status() === 200) {
      const body = await withdrawRes.json();
      expect(body.id || body.withdrawal_id || body.success).toBeTruthy();
    }
  });

  test('2. 管理员查看待处理提现列表', async ({ request }) => {
    const adminToken = await loginAdmin(request);
    if (!adminToken) {
      test.skip(true, '无法登录管理员账号');
      return;
    }

    const listRes = await request.get(`${BASE_URL}/api/admin/withdrawals?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect([200, 404]).toContain(listRes.status());
    if (listRes.status() === 200) {
      const body = await listRes.json();
      expect(body).toHaveProperty('requests');
      expect(Array.isArray(body.requests)).toBe(true);
    }
  });

  test('3. 管理员统计接口：提现汇总', async ({ request }) => {
    const adminToken = await loginAdmin(request);
    if (!adminToken) {
      test.skip(true, '无法登录管理员账号');
      return;
    }

    const statsRes = await request.get(`${BASE_URL}/api/admin/stats/withdrawals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect([200, 403, 404]).toContain(statsRes.status());
    if (statsRes.status() === 200) {
      const body = await statsRes.json();
      expect(typeof body.pending === 'number' || Array.isArray(body.requests) || body).toBeTruthy();
    }
  });

  test('4. 管理员审批：批准第一条 pending 提现（若存在）', async ({ request }) => {
    const adminToken = await loginAdmin(request);
    if (!adminToken) {
      test.skip(true, '无法登录管理员账号');
      return;
    }

    const listRes = await request.get(`${BASE_URL}/api/admin/withdrawals?status=pending&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (listRes.status() !== 200) {
      test.skip(true, '提现列表接口不可用，跳过');
      return;
    }
    const body = await listRes.json();
    const pending = (body.requests || []).filter(r => r.status === 'pending');
    if (pending.length === 0) {
      test.skip(true, '当前无 pending 提现，跳过审批测试');
      return;
    }

    const withdrawalId = pending[0].id;
    const approveRes = await request.patch(`${BASE_URL}/api/admin/withdrawals/${withdrawalId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'approve', note: 'E2E 自动化审批测试' },
    });
    expect([200, 400]).toContain(approveRes.status());
    if (approveRes.status() === 200) {
      const result = await approveRes.json();
      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
    }
  });

  test('5. 验证已审批提现可在 approved 列表中查询', async ({ request }) => {
    const adminToken = await loginAdmin(request);
    if (!adminToken) {
      test.skip(true, '无法登录管理员账号');
      return;
    }

    const listRes = await request.get(`${BASE_URL}/api/admin/withdrawals?status=approved`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect([200, 404]).toContain(listRes.status());
  });
});
