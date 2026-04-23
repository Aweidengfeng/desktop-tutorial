/**
 * SummitLink API 集成测试
 * 针对线上地址测试所有后端接口
 * 使用 Node.js 18+ 内置 fetch，无需额外依赖
 */

const BASE_URL = process.env.BASE_URL || 'https://precious-miracle-production.up.railway.app';

// 测试结果统计
let passed = 0;
let failed = 0;

// 辅助函数：断言
function assert(condition, message) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

// 辅助函数：运行单个测试
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

// 全局 token（登录后设置）
let authToken = null;
// 全局帖子 ID（获取帖子列表后设置）
let firstPostId = null;

// ─── 认证相关测试 ────────────────────────────────────────────────────────────

async function testLogin() {
  console.log('\n🔑 认证接口测试');

  await runTest('POST /api/auth/login - 登录成功并返回 token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13800138000', password: '123456' }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.token, '响应中缺少 token 字段');
    assert(typeof data.token === 'string', 'token 不是字符串');
    authToken = data.token; // 保存 token 供后续测试使用
  });

  await runTest('POST /api/auth/login - 错误密码返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13800138000', password: 'wrong_password' }),
    });
    assert(res.status === 401 || res.status === 400, `预期 401/400，实际 ${res.status}`);
  });

  await runTest('POST /api/auth/register - 注册新用户', async () => {
    // 使用1亿级别的随机号码（8位随机后缀），避免与历史注册数据冲突及并发冲突
    const randomPhone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '测试用户',
        phone: randomPhone,
        password: 'test123',
        agreedPrivacy: true,
        agreedTerms: true,
        policyVersion: '2026-04-20',
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.token, '注册响应中缺少 token 字段');
  });

  await runTest('GET /api/auth/me - 获取当前用户信息', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.phone === '13800138000', '用户手机号不匹配');
  });
}

// ─── 山峰接口测试 ────────────────────────────────────────────────────────────

async function testPeaks() {
  console.log('\n🏔️  山峰接口测试');

  await runTest('GET /api/peaks - 返回山峰数组且有数据', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '山峰列表为空');
    assert(data[0].name, '山峰缺少 name 字段');
    assert(data[0].altitude, '山峰缺少 altitude 字段');
  });

  await runTest('GET /api/peaks?type=8000ers - 过滤 8000 米山峰', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks?type=8000ers`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '8000ers 列表为空');
    // 所有返回的山峰类型应为 8000ers
    const wrongType = data.find(p => p.type !== '8000ers');
    assert(!wrongType, `发现非 8000ers 类型山峰: ${wrongType?.name}`);
  });

  await runTest('GET /api/peaks?type=continental - 过滤洲最高峰', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks?type=continental`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, 'continental 列表为空');
  });
}

// ─── 向导接口测试 ────────────────────────────────────────────────────────────

async function testGuides() {
  console.log('\n🧑‍🦯 向导接口测试');

  await runTest('GET /api/guides - 返回向导列表且有数据', async () => {
    const res = await fetch(`${BASE_URL}/api/guides`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '向导列表为空');
    assert(data[0].name, '向导缺少 name 字段');
  });
}

// ─── 队伍接口测试 ────────────────────────────────────────────────────────────

async function testTeams() {
  console.log('\n👥 队伍接口测试');

  await runTest('GET /api/teams - 返回队伍列表且有数据', async () => {
    const res = await fetch(`${BASE_URL}/api/teams`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '队伍列表为空');
    assert(data[0].name, '队伍缺少 name 字段');
  });

  await runTest('POST /api/teams/1/join - 加入队伍（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/teams/1/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    // 成功加入或已经是成员都算通过
    assert(res.ok || res.status === 400, `HTTP ${res.status}`);
    const data = await res.json();
    // 加入成功返回 success:true，已是成员返回 error
    assert(data.success === true || data.error, '响应格式不符合预期');
  });
}

// ─── 装备接口测试 ────────────────────────────────────────────────────────────

async function testGear() {
  console.log('\n🎒 装备接口测试');

  await runTest('GET /api/gear - 返回所有装备', async () => {
    const res = await fetch(`${BASE_URL}/api/gear`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '装备列表为空');
  });

  await runTest('GET /api/gear?mode=buy - 过滤购买模式装备', async () => {
    const res = await fetch(`${BASE_URL}/api/gear?mode=buy`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '购买装备列表为空');
  });

  await runTest('GET /api/gear?mode=rent - 过滤租赁模式装备', async () => {
    const res = await fetch(`${BASE_URL}/api/gear?mode=rent`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });
}

// ─── 帖子接口测试 ────────────────────────────────────────────────────────────

async function testPosts() {
  console.log('\n📝 帖子接口测试');

  await runTest('GET /api/posts - 返回帖子列表且有数据', async () => {
    const res = await fetch(`${BASE_URL}/api/posts`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length > 0, '帖子列表为空');
    assert(data[0].id, '帖子缺少 id 字段');
    assert(data[0].content, '帖子缺少 content 字段');
    firstPostId = data[0].id; // 保存第一篇帖子 ID
  });

  await runTest('POST /api/posts - 发帖（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        content: `自动化测试帖子 ${Date.now()}`,
        location: '测试地点',
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.id, '新帖子缺少 id 字段');
    assert(data.content, '新帖子缺少 content 字段');
  });

  await runTest('POST /api/posts/:id/like - 点赞（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    assert(firstPostId, '需要先获取帖子列表');
    const res = await fetch(`${BASE_URL}/api/posts/${firstPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.success === true, '点赞响应 success 不为 true');
    assert(typeof data.likes === 'number', '点赞响应缺少 likes 字段');
  });
}

// ─── 排行榜接口测试 ──────────────────────────────────────────────────────────

async function testLeaderboard() {
  console.log('\n🏆 排行榜接口测试');

  await runTest('GET /api/leaderboard/monthly - 返回排行榜数据', async () => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/monthly`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });
}

// ─── 天气接口测试 ────────────────────────────────────────────────────────────

async function testWeather() {
  console.log('\n🌤️  天气接口测试');

  await runTest('GET /api/weather - 返回天气数据', async () => {
    const res = await fetch(`${BASE_URL}/api/weather`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    // 天气数据可以是数组或对象
    assert(data !== null && data !== undefined, '天气数据为空');
  });
}

// ─── 用户资料接口测试 ────────────────────────────────────────────────────────

async function testProfile() {
  console.log('\n👤 用户资料接口测试');

  await runTest('PUT /api/auth/profile - 更新用户资料（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: '测试用户' }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.name, '响应中缺少 name 字段');
  });

  await runTest('GET /api/auth/me - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/auth/me - 无效 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid_token_xyz' },
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/auth/register - 重复手机号返回 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '重复用户', phone: '13800138000', password: '123456', policyVersion: '2026-04-20', agreedPrivacy: true, agreedTerms: true }),
    });
    assert(res.status === 400, `预期 400，实际 ${res.status}`);
    const data = await res.json();
    assert(data.error, '响应中缺少 error 字段');
  });

  await runTest('POST /api/auth/register - 无效手机号格式返回 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试用户', phone: '12345', password: '123456' }),
    });
    assert(res.status === 400, `预期 400，实际 ${res.status}`);
  });

  await runTest('POST /api/auth/register - 密码太短返回 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试用户', phone: '13912345678', password: '123' }),
    });
    assert(res.status === 400, `预期 400，实际 ${res.status}`);
  });

  await runTest('POST /api/auth/login - 无效手机号格式返回 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '12345', password: '123456' }),
    });
    assert(res.status === 400, `预期 400，实际 ${res.status}`);
  });
}

// ─── 山峰详情接口测试 ────────────────────────────────────────────────────────

async function testPeakDetail() {
  console.log('\n🏔️  山峰详情接口测试');

  await runTest('GET /api/peaks/:id - 返回山峰详情', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks/1`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.id, '山峰缺少 id 字段');
    assert(data.name, '山峰缺少 name 字段');
    assert(data.altitude, '山峰缺少 altitude 字段');
  });

  await runTest('GET /api/peaks/:id - 不存在的山峰返回 404', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks/999999`);
    assert(res.status === 404, `预期 404，实际 ${res.status}`);
    const data = await res.json();
    assert(data.error, '响应中缺少 error 字段');
  });

  await runTest('GET /api/peaks?type=commercial - 过滤商业攀登山峰', async () => {
    const res = await fetch(`${BASE_URL}/api/peaks?type=commercial`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });
}

// ─── 向导申请测试 ────────────────────────────────────────────────────────────

async function testGuideApply() {
  console.log('\n🧑‍🦯 向导申请接口测试');

  await runTest('POST /api/guides/apply - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/guides/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试向导', specialty: '高山攀登' }),
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/guides/apply - 提交向导申请（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/guides/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: '测试向导',
        cert: 'IFMGA-0001',
        specialty: '高山攀登',
        languages: '中文,英文',
        dayRate: 800,
        region: '西藏',
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.success === true, '申请响应 success 不为 true');
  });
}

// ─── 队伍创建测试 ────────────────────────────────────────────────────────────

async function testTeamCreate() {
  console.log('\n👥 队伍创建接口测试');

  await runTest('POST /api/teams - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试队伍', peak: '珠穆朗玛峰', date: '2025-05-01' }),
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/teams - 创建队伍（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: `E2E测试队伍 ${Date.now()}`,
        peak: '珠穆朗玛峰',
        date: '2025-05-01',
        totalSpots: 6,
        level: '高级',
        description: '自动化测试创建',
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.id, '队伍缺少 id 字段');
    assert(data.name, '队伍缺少 name 字段');
  });

  await runTest('POST /api/teams/:id/join - 加入不存在的队伍返回 404', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/teams/999999/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 404, `预期 404，实际 ${res.status}`);
  });
}

// ─── 装备发布测试 ────────────────────────────────────────────────────────────

async function testGearCreate() {
  console.log('\n🎒 装备发布接口测试');

  await runTest('POST /api/gear - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/gear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '测试装备', price: 100 }),
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/gear - 发布装备（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/gear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: `测试装备 ${Date.now()}`,
        brand: 'TestBrand',
        price: 299,
        condition: '9成新',
        description: '自动化测试装备',
        mode: 'buy',
        category: '登山靴',
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.id, '装备缺少 id 字段');
    assert(data.name, '装备缺少 name 字段');
  });

  await runTest('GET /api/gear?category=登山靴 - 按分类过滤', async () => {
    const res = await fetch(`${BASE_URL}/api/gear?category=${encodeURIComponent('登山靴')}`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });
}

// ─── 帖子错误用例测试 ────────────────────────────────────────────────────────

async function testPostsErrors() {
  console.log('\n📝 帖子错误用例测试');

  await runTest('POST /api/posts - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '未授权发帖' }),
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/posts/:id/like - 点赞不存在帖子返回 404', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/posts/999999/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.status === 404, `预期 404，实际 ${res.status}`);
  });
}

// ─── 轨迹接口测试（完全未测试）────────────────────────────────────────────────

async function testTracks() {
  console.log('\n🗺️  轨迹接口测试');

  await runTest('GET /api/tracks/my - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/tracks/my`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/tracks/my - 返回当前用户轨迹列表（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/tracks/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });

  await runTest('POST /api/tracks - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '未授权轨迹' }),
    });
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/tracks - 上传轨迹（需登录）', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: `测试轨迹 ${Date.now()}`,
        date: '2025-04-01',
        distance: 12.5,
        elevation: 800,
        duration: 360,
      }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.id, '轨迹缺少 id 字段');
    assert(data.name, '轨迹缺少 name 字段');
  });
}

// ─── 支付接口测试（完全未测试）──────────────────────────────────────────────

let testOrderNo = null;

async function testPay() {
  console.log('\n💳 支付接口测试');

  await runTest('POST /api/pay/create - 创建订单', async () => {
    const res = await fetch(`${BASE_URL}/api/pay/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 9800, method: 'alipay' }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.success === true, '订单创建响应 success 不为 true');
    assert(data.orderNo, '响应中缺少 orderNo 字段');
    assert(typeof data.orderNo === 'string', 'orderNo 不是字符串');
    testOrderNo = data.orderNo;
  });

  await runTest('GET /api/pay/status/:orderNo - 查询订单状态', async () => {
    assert(testOrderNo, '需要先创建订单');
    const res = await fetch(`${BASE_URL}/api/pay/status/${testOrderNo}`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.orderNo === testOrderNo, 'orderNo 不匹配');
    assert(typeof data.amount === 'number', '响应中缺少 amount 字段');
    assert(data.status, '响应中缺少 status 字段');
  });

  await runTest('POST /api/pay/create - wechat 支付方式', async () => {
    const res = await fetch(`${BASE_URL}/api/pay/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 4500, method: 'wechat' }),
    });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.success === true, '订单创建响应 success 不为 true');
    assert(data.orderNo, '响应中缺少 orderNo 字段');
  });

  await runTest('GET /api/pay/status/:orderNo - 不存在的订单返回 404', async () => {
    const res = await fetch(`${BASE_URL}/api/pay/status/SL_NOT_EXISTS_000000`);
    assert(res.status === 404, `预期 404，实际 ${res.status}`);
    const data = await res.json();
    assert(data.error, '响应中缺少 error 字段');
  });
}

// ─── 天气详细测试 ────────────────────────────────────────────────────────────

async function testWeatherDetail() {
  console.log('\n🌤️  天气详细接口测试');

  await runTest('GET /api/weather?location=珠峰大本营 - 返回已知营地天气', async () => {
    const res = await fetch(`${BASE_URL}/api/weather?location=${encodeURIComponent('珠峰大本营')}`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.location === '珠峰大本营', `location 不匹配，实际: ${data.location}`);
    assert(typeof data.temp === 'number', '响应中缺少 temp 字段');
    assert(typeof data.wind === 'number', '响应中缺少 wind 字段');
    assert(typeof data.humidity === 'number', '响应中缺少 humidity 字段');
    assert(typeof data.visibility === 'number', '响应中缺少 visibility 字段');
  });

  await runTest('GET /api/weather?location=K2大本营 - 返回已知营地天气', async () => {
    const res = await fetch(`${BASE_URL}/api/weather?location=${encodeURIComponent('K2大本营')}`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.location === 'K2大本营', `location 不匹配，实际: ${data.location}`);
    assert(typeof data.temp === 'number', '响应中缺少 temp 字段');
  });

  await runTest('GET /api/weather?location=未知山峰 - 返回默认天气数据', async () => {
    const res = await fetch(`${BASE_URL}/api/weather?location=${encodeURIComponent('未知山峰')}`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data !== null && data !== undefined, '天气数据为空');
    assert(typeof data.temp === 'number', '默认天气数据缺少 temp 字段');
    assert(typeof data.wind === 'number', '默认天气数据缺少 wind 字段');
  });

  await runTest('GET /api/weather - 无 location 参数返回默认数据', async () => {
    const res = await fetch(`${BASE_URL}/api/weather`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data !== null && data !== undefined, '天气数据为空');
  });
}

// ─── 管理后台接口测试 ────────────────────────────────────────────────────────

async function testAdmin() {
  console.log('\n🔐 管理后台接口测试');

  await runTest('POST /api/admin/login - 错误凭据返回 401 或 500', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong_password_xyz' }),
    });
    // 若 ADMIN_PASSWORD 未配置则返回 500，否则凭据错误返回 401
    assert(
      res.status === 401 || res.status === 500,
      `预期 401 或 500，实际 ${res.status}`
    );
  });

  await runTest('GET /api/admin/check - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/check`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/admin/stats - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/stats`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/admin/users - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/admin/posts - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/posts`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/admin/guides - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/guides`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('GET /api/admin/orders - 无 Token 返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/orders`);
    assert(res.status === 401, `预期 401，实际 ${res.status}`);
  });

  await runTest('POST /api/admin/logout - 注销成功', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/logout`, { method: 'POST' });
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(data.success === true, '注销响应 success 不为 true');
  });

  await runTest('GET /api/admin/check - 使用普通用户 Token 返回 403', async () => {
    assert(authToken, '需要先登录获取 token');
    const res = await fetch(`${BASE_URL}/api/admin/check`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // 普通用户 token 不含 isAdmin，应返回 403
    assert(res.status === 403, `预期 403，实际 ${res.status}`);
  });
}


// ─── 新增：精选俱乐部接口测试 ────────────────────────────────────────────────

async function testFeaturedClubs() {
  console.log('\n🏛️  精选俱乐部接口测试');

  await runTest('GET /api/clubs/featured - 返回精选俱乐部（数组）', async () => {
    const res = await fetch(`${BASE_URL}/api/clubs/featured`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length >= 1, `精选俱乐部数量不足: ${data.length}`);
    const club = data[0];
    assert(club.name, '俱乐部缺少 name 字段');
    assert(club.cover !== undefined, '俱乐部缺少 cover 字段');
  });

  await runTest('GET /api/clubs/:id/posts - 返回俱乐部动态', async () => {
    const res = await fetch(`${BASE_URL}/api/clubs/1/posts`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    if (data.length > 0) {
      assert(data[0].content, '帖子缺少 content 字段');
    }
  });

  await runTest('GET /api/clubs/:id/photos - 返回俱乐部相册', async () => {
    const res = await fetch(`${BASE_URL}/api/clubs/1/photos`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    if (data.length > 0) {
      assert(data[0].url, '照片缺少 url 字段');
    }
  });

  await runTest('GET /api/clubs/:id/guides - 返回俱乐部向导', async () => {
    const res = await fetch(`${BASE_URL}/api/clubs/1/guides`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
  });

  await runTest('POST /api/clubs/payment - 未登录返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/clubs/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_application_id: 1, amount: 500 }),
    });
    assert(res.status === 401 || res.status === 403, `预期 401/403，实际 ${res.status}`);
  });
}

// ─── 新增：向导帖子/照片接口测试 ────────────────────────────────────────────

async function testGuidePosts() {
  console.log('\n🧗 向导动态/相册接口测试');

  await runTest('GET /api/guides/:id/posts - 返回向导动态', async () => {
    const res = await fetch(`${BASE_URL}/api/guides/1/posts`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    if (data.length > 0) {
      assert(data[0].content, '帖子缺少 content 字段');
    }
  });

  await runTest('GET /api/guides/:id/photos - 返回向导相册', async () => {
    const res = await fetch(`${BASE_URL}/api/guides/1/photos`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    if (data.length > 0) {
      assert(data[0].url, '照片缺少 url 字段');
    }
  });

  await runTest('POST /api/guides/payment - 未登录返回 401', async () => {
    const res = await fetch(`${BASE_URL}/api/guides/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guide_application_id: 1, amount: 300 }),
    });
    assert(res.status === 401 || res.status === 403, `预期 401/403，实际 ${res.status}`);
  });
}

// ─── 新增：热门山峰天气接口测试 ──────────────────────────────────────────────

async function testPopularPeaksWeather() {
  console.log('\n⛅ 热门山峰天气接口测试');

  await runTest('GET /api/weather/popular-peaks - 返回热门山峰天气', async () => {
    const res = await fetch(`${BASE_URL}/api/weather/popular-peaks`);
    assert(res.ok, `HTTP ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), '响应不是数组');
    assert(data.length >= 4, `热门山峰数量不足: ${data.length}`);
    const peak = data[0];
    assert(peak.name, '山峰缺少 name 字段');
    assert(peak.temp !== undefined, '山峰缺少 temp 字段');
    assert(peak.altitude !== undefined, '山峰缺少 altitude 字段');
  });
}


// ─── 主函数 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 SummitLink API 集成测试开始');
  console.log(`📡 测试地址: ${BASE_URL}`);
  console.log('═'.repeat(50));

  // 按依赖顺序运行（登录需要先跑，获取 token）
  await testLogin();
  await testPeaks();
  await testGuides();
  await testTeams();
  await testGear();
  await testPosts();
  await testLeaderboard();
  await testWeather();
  await testFeaturedClubs();
  await testGuidePosts();
  await testPopularPeaksWeather();

  // 新增测试套件
  await testProfile();
  await testPeakDetail();
  await testGuideApply();
  await testTeamCreate();
  await testGearCreate();
  await testPostsErrors();
  await testTracks();
  await testPay();
  await testWeatherDetail();
  await testAdmin();

  // 输出汇总
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 测试结果: ${passed} 通过，${failed} 失败`);

  if (failed > 0) {
    console.log('❌ 有测试失败，请检查以上错误信息');
    process.exit(1);
  } else {
    console.log('✅ 全部测试通过！');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('💥 测试运行出错:', err);
  process.exit(1);
});
