/**
 * SummitLink API 集成测试
 * 针对线上地址测试所有后端接口
 * 使用 Node.js 18+ 内置 fetch，无需额外依赖
 */

const BASE_URL = 'https://precious-miracle-production.up.railway.app';

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
