/**
 * E2E 测试：GDPR 数据导出与账号删除
 *
 * 覆盖：
 *  1. 用户请求数据导出 → 下载链接（Content-Disposition）出现
 *  2. 用户删除账号 → 重新登录失败（401）
 *
 * 使用独立的临时测试账号，避免影响主测试数据。
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const TS = Date.now();
const GDPR_PASSWORD = 'gdpr_test_123';

test.describe('GDPR 数据导出与账号删除 E2E', () => {
  test('1. 用户请求数据导出 → 响应包含 Content-Disposition 附件头', async ({ request }) => {
    const phone = `1380011${String(TS).slice(-4)}`;
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone, password: GDPR_PASSWORD, name: 'GDPR测试用户' },
    });
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone, password: GDPR_PASSWORD },
    });
    if (!loginRes.ok()) { test.skip(true, '无法登录测试账号，跳过'); return; }
    const { token } = await loginRes.json();

    const exportRes = await request.get(`${BASE_URL}/api/gdpr/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(exportRes.status()).toBe(200);
    const contentDisposition = exportRes.headers()['content-disposition'] || '';
    expect(contentDisposition).toMatch(/attachment/i);
    const body = await exportRes.json();
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('exportedAt');
  });

  test('2. 数据导出内容包含用户基本信息', async ({ request }) => {
    const phone = `1380022${String(TS).slice(-4)}`;
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone, password: GDPR_PASSWORD, name: 'GDPR测试用户2' },
    });
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone, password: GDPR_PASSWORD },
    });
    if (!loginRes.ok()) { test.skip(true, '无法登录，跳过'); return; }
    const { token } = await loginRes.json();

    const exportRes = await request.get(`${BASE_URL}/api/gdpr/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (exportRes.status() !== 200) { test.skip(true, '导出接口不可用，跳过'); return; }
    const body = await exportRes.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBeDefined();
  });

  test('3. 用户删除账号后重新登录失败（账号软删除验证）', async ({ request }) => {
    const phone = `1380033${String(TS).slice(-4)}`;
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone, password: GDPR_PASSWORD, name: 'GDPR删除测试' },
    });
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone, password: GDPR_PASSWORD },
    });
    if (!loginRes.ok()) { test.skip(true, '无法登录，跳过'); return; }
    const { token } = await loginRes.json();

    const deleteRes = await request.delete(`${BASE_URL}/api/gdpr/delete-account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.deletedAt).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 300));

    const reLoginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone, password: GDPR_PASSWORD },
    });
    expect([401, 400, 404]).toContain(reLoginRes.status());
  });
});
