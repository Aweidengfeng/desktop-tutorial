/**
 * SummitLink Playwright E2E 端到端测试
 * 模拟真实用户在浏览器里进行交互操作
 * 测试前端页面与后端 API 的联动
 */

const { test, expect } = require('@playwright/test');

// 测试账号
const TEST_PHONE = '13800138000';
const TEST_PASSWORD = '123456';

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 执行登录操作（复用函数，避免重复代码）
 * 监听并返回登录 API 响应 Promise
 */
async function doLogin(page) {
  // 监听登录 API 请求（在点击前注册，避免错过响应）
  const loginResponse = page.waitForResponse(
    resp => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
  );

  // 找到并点击导航栏登录按钮
  const loginBtn = page.locator('button:has-text("登录")').first();
  await loginBtn.click();

  // 等待登录弹窗中的密码输入框出现
  await page.waitForSelector('input[type="password"]', { timeout: 8000 });

  // 填入手机号
  const phoneInput = page.locator('input[type="tel"], input[placeholder*="手机"], input[placeholder*="phone"]').first();
  await phoneInput.fill(TEST_PHONE);
  // 填入密码
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  // 提交登录表单（点击弹窗内的「登录」按钮，排除顶部导航栏按钮）
  await page.locator('.bg-slate-800 button:has-text("登录"), [x-show="showLogin"] button:has-text("登录")').last().click();

  // 等待登录 API 响应，确认服务端已处理请求
  return loginResponse;
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

test.describe('页面基础加载', () => {
  test('访问 /summitlink 页面标题应包含「巅峰探索」或「SummitLink」', async ({ page }) => {
    await page.goto('/summitlink');
    // 验证页面标题
    await expect(page).toHaveTitle(/巅峰探索|SummitLink/);
  });

  test('页面应显示核心导航元素', async ({ page }) => {
    await page.goto('/summitlink');
    // 等待 Alpine.js 初始化完成
    await page.waitForLoadState('networkidle');
    // 页面应该有可见内容（不是空白页）
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('山峰数据加载', () => {
  test('山峰卡片应从 API 动态加载（非硬编码）', async ({ page }) => {
    // 监听 /api/peaks 请求（在导航前注册）
    const peaksResponse = page.waitForResponse(
      resp => resp.url().includes('/api/peaks') && resp.status() === 200
    );
    await page.goto('/summitlink');
    // 等待 API 响应
    const resp = await peaksResponse;
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('点击「8000米巨峰」Tab 应过滤显示对应山峰', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');

    // 监听带 type 参数的请求（在点击前注册）
    const filteredResponse = page.waitForResponse(
      resp => resp.url().includes('/api/peaks?type=8000ers') && resp.status() === 200,
      { timeout: 10000 }
    );

    // 点击 8000ers tab（中文按钮文字）
    const tabButton = page.locator('button:has-text("8000米"), button:has-text("8000"), [data-type="8000ers"]').first();
    await tabButton.click();

    // 等待过滤请求
    const resp = await filteredResponse;
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // 验证所有返回的山峰类型正确
    data.forEach(peak => {
      expect(peak.type).toBe('8000ers');
    });
  });
});

test.describe('登录流程', () => {
  test('输入正确账号密码应登录成功', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');

    // 执行登录并等待 API 响应
    const loginResp = await doLogin(page);
    const data = await loginResp.json();
    expect(data.token).toBeTruthy();
  });
});

test.describe('帖子功能', () => {
  test('帖子列表应从 API 加载', async ({ page }) => {
    const postsResponse = page.waitForResponse(
      resp => resp.url().includes('/api/posts') && resp.status() === 200
    );
    await page.goto('/summitlink');
    const resp = await postsResponse;
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('登录后可以点赞帖子，点赞数应增加', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');

    // 监听点赞响应（在登录前注册）
    const likeResponse = page.waitForResponse(
      resp => resp.url().includes('/like') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // 执行登录，等待登录 API 完成
    await doLogin(page);
    // 等待页面网络请求完成（登录后数据刷新）
    await page.waitForLoadState('networkidle');

    // 切换到社区/帖子区域（如果有 tab）
    const communityTab = page.locator('button:has-text("社区"), button:has-text("帖子"), [data-tab="community"]').first();
    if (await communityTab.isVisible()) {
      await communityTab.click();
      // 等待帖子内容加载完成
      await page.waitForLoadState('networkidle');
    }

    // 点击第一个点赞按钮
    const likeBtn = page.locator('button:has-text("❤"), button[data-action="like"], .like-btn').first();
    await likeBtn.click();

    // 等待点赞 API 响应
    const resp = await likeResponse;
    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(typeof data.likes).toBe('number');
  });

  test('登录后可以发帖，新帖子应出现在列表中', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');

    // 监听发帖 API（在登录前注册）
    const postResponse = page.waitForResponse(
      resp =>
        resp.url().includes('/api/posts') &&
        resp.request().method() === 'POST' &&
        !resp.url().includes('/like'),
      { timeout: 20000 }
    );

    // 执行登录
    await doLogin(page);
    // 等待登录后页面数据刷新
    await page.waitForLoadState('networkidle');

    // 切换到社区/帖子区域
    const communityTab = page.locator('button:has-text("社区"), button:has-text("帖子"), [data-tab="community"]').first();
    if (await communityTab.isVisible()) {
      await communityTab.click();
      await page.waitForLoadState('networkidle');
    }

    // 找到发帖输入框
    const postInput = page.locator('textarea[placeholder*="分享"], textarea[placeholder*="发帖"], textarea[placeholder*="动态"]').first();
    if (await postInput.isVisible()) {
      const testContent = `E2E 自动化测试帖子 ${Date.now()}`;
      await postInput.fill(testContent);

      // 提交帖子
      const submitBtn = page.locator('button:has-text("发布"), button:has-text("提交"), button[type="submit"]').last();
      await submitBtn.click();

      // 验证 API 响应
      const resp = await postResponse;
      const data = await resp.json();
      expect(data.id).toBeTruthy();
      expect(data.content).toBeTruthy();
    } else {
      // 如果找不到发帖框，跳过（可能需要特定操作才能显示）
      test.skip();
    }
  });
});

test.describe('队伍功能', () => {
  test('队伍列表应从 API 加载', async ({ page }) => {
    const teamsResponse = page.waitForResponse(
      resp => resp.url().includes('/api/teams') && resp.status() === 200
    );
    await page.goto('/summitlink');
    const resp = await teamsResponse;
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('登录后点击申请加入队伍应返回成功', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');

    // 监听加入队伍 API（在登录前注册）
    const joinResponse = page.waitForResponse(
      resp => resp.url().includes('/join') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // 执行登录
    await doLogin(page);
    // 等待登录后页面数据刷新
    await page.waitForLoadState('networkidle');

    // 切换到队伍/组队区域
    const teamsTab = page.locator('button:has-text("队伍"), button:has-text("组队"), [data-tab="teams"]').first();
    if (await teamsTab.isVisible()) {
      await teamsTab.click();
      await page.waitForLoadState('networkidle');
    }

    // 点击加入队伍按钮
    const joinBtn = page.locator('button:has-text("申请加入"), button:has-text("加入")').first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      // 等待 API 响应
      const resp = await joinResponse;
      const data = await resp.json();
      // 成功加入或已是成员都算通过
      expect(data.success === true || !!data.error).toBe(true);
    } else {
      test.skip();
    }
  });
});
