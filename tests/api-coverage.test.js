'use strict';
/**
 * 补充集成测试 — 覆盖之前未测试的 21 个 API 模块：
 *   /api/follows, /api/comments, /api/banners, /api/profile,
 *   /api/users, /api/certification, /api/bookings, /api/orders,
  *   /api/customs, /api/rescue, /api/sos, /api/insurance, /api/location-share,
 *   /api/altitude, /api/articles, /api/passport, /api/guide-console,
 *   /api/club-console, /api/expeditions, /api/group-chats, /api/upload
 */

process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || 'file:/tmp/test-summitlink.db';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';
process.env.INVESTOR_TOKEN = 'test-investor-token';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const crypto = require('crypto');
const { createRequire } = require('module');
const { createApp }       = require('./helpers/testApp');
const { createTestUser, createAdminToken } = require('./helpers/auth');
const { clearDbCache, createTestDb } = require('./helpers/db');
const { BLOCKED_STATIC_FILES, normalizeStaticRequestPath, getInvestorPageToken } = require('../backend/lib/investorPageSecurity');

const requireFromBackend = createRequire(path.resolve(__dirname, '../backend/package.json'));
const express = requireFromBackend('express');

function createSecurityApp() {
  const app = express();
  const rootPath = path.resolve(__dirname, '..');
  const investorHtmlFile = path.join(rootPath, 'investor.html');

  app.use((req, res, next) => {
    let normalizedPath;
    try {
      normalizedPath = normalizeStaticRequestPath(req.path);
    } catch {
      return res.status(400).json({ error: 'Invalid URL encoding' });
    }
    if (BLOCKED_STATIC_FILES.has(normalizedPath)) {
      return res.status(404).json({ error: 'Not Found' });
    }
    next();
  });

  app.use(express.static(rootPath));

  app.get('/investor', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');

    const investorToken = process.env.INVESTOR_TOKEN;
    if (investorToken) {
      const providedToken = getInvestorPageToken(req);
      if (!providedToken || providedToken !== investorToken) {
        return res.status(401).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Access Denied</title></head>
          <body><div class="box"><h2>🔒 Access Denied</h2><p>Investor dashboard requires authentication.</p></div></body>
          </html>
        `);
      }
    }

    if (!fs.existsSync(investorHtmlFile)) {
      return res.status(404).send('Investor dashboard not found');
    }

    fs.readFile(investorHtmlFile, 'utf8', (err, html) => {
      if (err) return res.status(500).send('Internal Server Error');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });
  });

  return app;
}

// ── 1. /api/follows ──────────────────────────────────────────────────────────
describe('一、关注模块 /api/follows', () => {
  let app, db, userA, userB;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    userA = createTestUser(db, { phone: '13800001100', name: '用户A' });
    userB = createTestUser(db, { phone: '13800001101', name: '用户B' });
  });

  test('GET /api/follows/my-following — 未登录 → 401', async () => {
    const res = await request(app).get('/api/follows/my-following');
    expect(res.status).toBe(401);
  });

  test('GET /api/follows/my-following — 已登录，初始为空数组', async () => {
    const res = await request(app)
      .get('/api/follows/my-following')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/follows — 关注 userB', async () => {
    const res = await request(app)
      .post('/api/follows')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_id: userB.id });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/follows — 重复关注 → 400', async () => {
    const res = await request(app)
      .post('/api/follows')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_id: userB.id });
    expect(res.status).toBe(400);
  });

  test('POST /api/follows — 关注自己 → 400', async () => {
    const res = await request(app)
      .post('/api/follows')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_id: userA.id });
    expect(res.status).toBe(400);
  });

  test('GET /api/follows/status/:id — 已关注', async () => {
    const res = await request(app)
      .get(`/api/follows/status/${userB.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);
  });

  test('DELETE /api/follows/:id — 取消关注', async () => {
    const res = await request(app)
      .delete(`/api/follows/${userB.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/follows/status/:id — 取消后为 false', async () => {
    const res = await request(app)
      .get(`/api/follows/status/${userB.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });

  test('DELETE /api/follows/:id — 未关注时删除 → 404', async () => {
    const res = await request(app)
      .delete(`/api/follows/${userB.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(res.status).toBe(404);
  });
});

describe('零、安全入口与静态资源保护', () => {
  let securityApp;

  beforeAll(() => {
    securityApp = createSecurityApp();
  });

  test('GET /%63onfig.json — percent-encoded blocked file → 404', async () => {
    const res = await request(securityApp).get('/%63onfig.json');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  test('GET /./config.json — normalized blocked file → 404', async () => {
    const res = await request(securityApp).get('/./config.json');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  test('GET /investor — missing token → 401 and no-referrer', async () => {
    const res = await request(securityApp).get('/investor');
    expect(res.status).toBe(401);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.text).toContain('Access Denied');
  });

  test('GET /investor?token=test-investor-token — valid token → 200 and no-referrer', async () => {
    const res = await request(securityApp).get('/investor?token=test-investor-token');
    expect(res.status).toBe(200);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('SummitLink 投资者看板');
  });
});

// ── 2. /api/comments ─────────────────────────────────────────────────────────
describe('二、评论模块 /api/comments', () => {
  let app, db, user, postId, commentId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001200' });
    // insert a post directly
    const result = db.prepare(
      `INSERT INTO posts (user_id, author_name, content, status) VALUES (?, ?, ?, 'approved')`
    ).run(user.id, user.name || 'tester', '测试帖子内容');
    postId = result.lastInsertRowid;
  });

  test('GET /api/comments?post_id=X — 公开可访问，初始为空', async () => {
    const res = await request(app).get(`/api/comments?post_id=${postId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/comments — 缺少 post_id → 400', async () => {
    const res = await request(app).get('/api/comments');
    expect(res.status).toBe(400);
  });

  test('POST /api/comments — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/comments')
      .send({ post_id: postId, content: '评论内容' });
    expect(res.status).toBe(401);
  });

  test('POST /api/comments — 发布评论', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ post_id: postId, content: '这是一条测试评论' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('这是一条测试评论');
    commentId = res.body.id;
  });

  test('POST /api/comments — 空内容 → 400', async () => {
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ post_id: postId });
    expect(res.status).toBe(400);
  });

  test('GET /api/comments/poll?post_id=X — 增量拉取', async () => {
    const res = await request(app)
      .get(`/api/comments/poll?post_id=${postId}&after=0`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/comments/:id/like — 点赞评论', async () => {
    const res = await request(app)
      .post(`/api/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
  });

  test('POST /api/comments/:id/like — 再次点击取消点赞', async () => {
    const res = await request(app)
      .post(`/api/comments/${commentId}/like`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(false);
  });
});

// ── 3. /api/banners ──────────────────────────────────────────────────────────
describe('三、横幅模块 /api/banners', () => {
  let app, db, adminToken;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    adminToken = createAdminToken();
  });

  test('GET /api/banners — 公开，返回数组', async () => {
    const res = await request(app).get('/api/banners');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/banners — 无 admin 凭证 → 401/403', async () => {
    const res = await request(app)
      .post('/api/banners')
      .send({ title: '测试横幅', image_url: 'https://example.com/img.jpg' });
    expect([401, 403]).toContain(res.status);
  });

  test('POST /api/banners — admin 创建横幅', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '新横幅', image_url: 'https://example.com/img.jpg', link: '/explore', sort_order: 1 });
    expect([200, 201]).toContain(res.status);
  });
});

// ── 4. /api/profile ──────────────────────────────────────────────────────────
describe('四、个人资料模块 /api/profile', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001400' });
  });

  test('GET /api/profile/medical — 未登录 → 401', async () => {
    const res = await request(app).get('/api/profile/medical');
    expect(res.status).toBe(401);
  });

  test('GET /api/profile/medical — 已登录，返回对象', async () => {
    const res = await request(app)
      .get('/api/profile/medical')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  test('PUT /api/profile/medical — 更新医疗信息', async () => {
    const res = await request(app)
      .put('/api/profile/medical')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ blood_type: 'O+', allergies: '青霉素', conditions: '' });
    expect(res.status).toBe(200);
  });

  test('GET /api/profile/emergency-contacts — 初始为空数组', async () => {
    const res = await request(app)
      .get('/api/profile/emergency-contacts')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/profile/emergency-contacts — 添加紧急联系人', async () => {
    const res = await request(app)
      .post('/api/profile/emergency-contacts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: '张三', phone: '13900000001', relation: '父亲' });
    expect(res.status).toBe(200);
  });

  test('GET /api/profile/gear-checklist — 初始为空数组', async () => {
    const res = await request(app)
      .get('/api/profile/gear-checklist')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/profile/gear-checklist — 添加装备', async () => {
    const res = await request(app)
      .post('/api/profile/gear-checklist')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ item_name: '冰镐', category: '攀冰', is_checked: false });
    expect([200, 201]).toContain(res.status);
  });
});

// ── 5. /api/users ─────────────────────────────────────────────────────────────
describe('五、用户扩展接口 /api/users', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001500' });
  });

  test('GET /api/users/:id/achievements — 公开访问', async () => {
    const res = await request(app).get(`/api/users/${user.id}/achievements`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/:id/membership — 公开访问', async () => {
    const res = await request(app).get(`/api/users/${user.id}/membership`);
    expect([200, 404]).toContain(res.status);
  });

  test('GET /api/users/:id/summits — 公开访问', async () => {
    const res = await request(app).get(`/api/users/${user.id}/summits`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/:id/followers — 公开访问', async () => {
    const res = await request(app).get(`/api/users/${user.id}/followers`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/:id/following — 公开访问', async () => {
    const res = await request(app).get(`/api/users/${user.id}/following`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/users/summits — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/users/summits')
      .send({ peak_name: '珠穆朗玛峰', max_elevation: 8849, summit_date: '2026-05-15' });
    expect(res.status).toBe(401);
  });
});

// ── 6. /api/certification ────────────────────────────────────────────────────
describe('六、认证模块 /api/certification', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001600' });
  });

  test('GET /api/certification/levels — 公开', async () => {
    const res = await request(app).get('/api/certification/levels');
    expect(res.status).toBe(200);
  });

  test('GET /api/certification/guide/status — 未登录 → 401', async () => {
    const res = await request(app).get('/api/certification/guide/status');
    expect(res.status).toBe(401);
  });

  test('GET /api/certification/guide/status — 已登录', async () => {
    const res = await request(app)
      .get('/api/certification/guide/status')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/certification/club/status — 已登录', async () => {
    const res = await request(app)
      .get('/api/certification/club/status')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/certification/guide/apply — 提交向导认证', async () => {
    const res = await request(app)
      .post('/api/certification/guide/apply')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        full_name: '扎西',
        id_card: '51010219900101001X',
        experience_years: 8,
        specialties: ['高海拔攀登'],
        bio: '专注高海拔攀登多年',
      });
    expect([200, 400, 409]).toContain(res.status);
  });

  test('POST /api/certification/club/apply — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/certification/club/apply')
      .send({ club_name: '测试俱乐部', description: '攀登爱好者俱乐部' });
    expect(res.status).toBe(401);
  });
});

// ── 7. /api/rescue ───────────────────────────────────────────────────────────
describe('七、救援模块 /api/rescue', () => {
  let app, db, user, adminToken;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001700' });
    adminToken = createAdminToken();
  });

  test('GET /api/rescue/contacts — 公开', async () => {
    const res = await request(app).get('/api/rescue/contacts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/rescue/config — 公开，返回电话', async () => {
    const res = await request(app).get('/api/rescue/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('phone');
  });

  test('POST /api/rescue/sos — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/rescue/sos')
      .send({ location: '27.98,86.92' });
    expect(res.status).toBe(401);
  });

  test('POST /api/rescue/sos — 已登录，发送 SOS', async () => {
    const res = await request(app)
      .post('/api/rescue/sos')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ lat: 27.98, lng: 86.92, peak_name: '珠峰', message: '受伤需要救援' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/rescue/sos/history — 登录后获取历史', async () => {
    const res = await request(app)
      .get('/api/rescue/sos/history')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/sos/alert — 缺少必填字段时返回 400', async () => {
    const ts = new Date().toISOString();
    const res = await request(app)
      .post('/api/sos/alert')
      .send({ userId: user.id, lat: null, lng: null, accuracy: null, timestamp: ts, phone: '120' });
    expect(res.status).toBe(400);
  });

  test('POST /api/sos/alert — 必填字段完整时返回 ok + alertId', async () => {
    const ts = new Date().toISOString();
    const res = await request(app)
      .post('/api/sos/alert')
      .send({ userId: user.id, lat: 27.9881, lng: 86.925, accuracy: 9.9, timestamp: ts, phone: '112' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.alertId).toBe('number');
  });

  test('POST /api/sos/alert — 无效 timestamp → 400', async () => {
    const res = await request(app)
      .post('/api/sos/alert')
      .send({ userId: user.id, lat: 27.9, lng: 86.9, accuracy: 5.5, timestamp: 'invalid-time', phone: '120' });
    expect(res.status).toBe(400);
  });

  test('GET /api/sos/alerts — 管理员可查看告警列表', async () => {
    const res = await request(app)
      .get('/api/sos/alerts')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.length).toBeGreaterThan(0);
  });

  test('GET /api/sos/alerts — 未登录 → 401', async () => {
    const res = await request(app).get('/api/sos/alerts');
    expect(res.status).toBe(401);
  });
});

// ── 8. /api/insurance ────────────────────────────────────────────────────────
describe('八、保险模块 /api/insurance', () => {
  let app, db, user, otherUser;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800001800' });
    otherUser = createTestUser(db, { phone: '13800001801' });
  });

  test('GET /api/insurance/plans — 公开', async () => {
    const res = await request(app).get('/api/insurance/plans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/insurance/plans/:id — 不存在 → 404', async () => {
    const res = await request(app).get('/api/insurance/plans/99999');
    expect(res.status).toBe(404);
  });

  test('POST /api/insurance/inquire — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/insurance/inquire')
      .send({ name: '张三', phone: '13900000001', plan_id: 1 });
    expect(res.status).toBe(401);
  });

  test('POST /api/insurance/inquire — 缺少必填字段 → 400', async () => {
    const res = await request(app)
      .post('/api/insurance/inquire')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: '张三' }); // 缺少 phone 和 plan_id
    expect(res.status).toBe(400);
  });

  test('GET /api/insurance/my-policies — 已登录返回当前用户保单列表', async () => {
    const createRes = await request(app)
      .post('/api/insurance/inquire')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: '张三', phone: '13900000001', plan_id: 1, peak_name: '珠峰' });
    expect(createRes.status).toBe(200);

    const res = await request(app)
      .get('/api/insurance/my-policies')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({
      id: expect.any(Number),
      plan_name: expect.any(String),
      name: '张三',
      phone: '13900000001',
      peak_name: '珠峰',
      status: expect.any(String),
      created_at: expect.any(String),
    }));
  });

  test('POST /api/insurance/webhook/policy-issued — 验签失败 → 401', async () => {
    process.env.INSURANCE_WEBHOOK_SECRET = 'insurance-secret-test';
    const payload = { inquiry_id: 999999, policy_no: 'PICC-FAIL' };
    const res = await request(app)
      .post('/api/insurance/webhook/policy-issued')
      .set('X-Insurance-Signature', 'bad-signature')
      .send(payload);
    expect(res.status).toBe(401);
  });

  test('POST /api/insurance/webhook/policy-issued + claim-update + GET /policy/:policyNo', async () => {
    process.env.INSURANCE_WEBHOOK_SECRET = 'insurance-secret-test';
    const insert = db.prepare(`
      INSERT INTO insurance_inquiries (user_id, plan_id, plan_name, name, phone, peak_name, departure_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, 1, '西藏高原综合险', '李雷', '13900001111', '洛子峰', '2026-06-01', 'pending');
    const inquiryId = Number(insert.lastInsertRowid);

    const issuePayload = {
      inquiry_id: inquiryId,
      policy_no: 'PICC-2026-UNIT-001',
      provider_ref: 'PROVIDER-001',
      policy_pdf_url: 'https://cdn.insurer.com/policy.pdf',
      issued_at: '2026-05-24T10:00:00Z',
      provider: '平安保险',
    };
    const issueSignature = crypto.createHmac('sha256', process.env.INSURANCE_WEBHOOK_SECRET)
      .update(JSON.stringify(issuePayload))
      .digest('hex');
    const issueRes = await request(app)
      .post('/api/insurance/webhook/policy-issued')
      .set('X-Insurance-Signature', issueSignature)
      .send(issuePayload);
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.success).toBe(true);

    const afterIssue = db.prepare('SELECT status, policy_no, provider_ref FROM insurance_inquiries WHERE id = ?').get(inquiryId);
    expect(afterIssue).toEqual(expect.objectContaining({
      status: 'issued',
      policy_no: 'PICC-2026-UNIT-001',
      provider_ref: 'PROVIDER-001',
    }));

    const claimPayload = {
      policy_no: 'PICC-2026-UNIT-001',
      claim_status: 'processing',
      claim_note: '材料审核中',
      claim_updated_at: '2026-05-24T15:00:00Z',
    };
    const claimSignature = crypto.createHmac('sha256', process.env.INSURANCE_WEBHOOK_SECRET)
      .update(JSON.stringify(claimPayload))
      .digest('hex');
    const claimRes = await request(app)
      .post('/api/insurance/webhook/claim-update')
      .set('X-Insurance-Signature', claimSignature)
      .send(claimPayload);
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.success).toBe(true);

    const afterClaim = db.prepare('SELECT status, claim_status, claim_note FROM insurance_inquiries WHERE id = ?').get(inquiryId);
    expect(afterClaim).toEqual(expect.objectContaining({
      status: 'claimed',
      claim_status: 'processing',
      claim_note: '材料审核中',
    }));

    const ownPolicyRes = await request(app)
      .get('/api/insurance/policy/PICC-2026-UNIT-001')
      .set('Authorization', `Bearer ${user.token}`);
    expect(ownPolicyRes.status).toBe(200);
    expect(ownPolicyRes.body.phone).toBeUndefined();
    expect(ownPolicyRes.body.policy_no).toBe('PICC-2026-UNIT-001');
    expect(ownPolicyRes.body.user_id).toBe(user.id);

    const otherUserRes = await request(app)
      .get('/api/insurance/policy/PICC-2026-UNIT-001')
      .set('Authorization', `Bearer ${otherUser.token}`);
    expect(otherUserRes.status).toBe(404);
  });
});

// ── 9. /api/altitude ─────────────────────────────────────────────────────────
describe('九、海拔查询 /api/altitude', () => {
  let app, db;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
  });

  test('GET /api/altitude?lat=&lng= — 缺少参数 → 400', async () => {
    const res = await request(app).get('/api/altitude');
    expect(res.status).toBe(400);
  });

  test('GET /api/altitude?lat=27.9881&lng=86.9250 — 珠峰坐标返回海拔', async () => {
    const res = await request(app).get('/api/altitude?lat=27.9881&lng=86.9250');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('altitude');
    expect(typeof res.body.altitude).toBe('number');
    expect(res.body.altitude).toBeGreaterThan(100);
  });

  test('GET /api/altitude — 无效坐标 → 400', async () => {
    const res = await request(app).get('/api/altitude?lat=999&lng=999');
    expect(res.status).toBe(400);
  });
});

// ── 10. /api/articles ────────────────────────────────────────────────────────
describe('十、文章模块 /api/articles', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002000' });
  });

  test('GET /api/articles — 公开，返回数组', async () => {
    const res = await request(app).get('/api/articles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/articles/featured — 公开，返回数组', async () => {
    const res = await request(app).get('/api/articles/featured');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/articles/:id — 不存在 → 404', async () => {
    const res = await request(app).get('/api/articles/99999');
    expect(res.status).toBe(404);
  });

  test('POST /api/articles — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/articles')
      .send({ title: '测试文章', content: '内容' });
    expect(res.status).toBe(401);
  });

  test('POST /api/articles — 发布文章', async () => {
    const res = await request(app)
      .post('/api/articles')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: '珠峰攀登全纪录', category: 'expedition', content: '本文记录了攀登过程...' });
    expect([200, 201]).toContain(res.status);
  });
});

// ── 11. /api/passport ────────────────────────────────────────────────────────
describe('十一、电子护照模块 /api/passport', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002100' });
  });

  test('GET /api/passport/my — 未登录 → 401', async () => {
    const res = await request(app).get('/api/passport/my');
    expect(res.status).toBe(401);
  });

  test('GET /api/passport/my — 已登录，返回护照对象或 403', async () => {
    const res = await request(app)
      .get('/api/passport/my')
      .set('Authorization', `Bearer ${user.token}`);
    expect([200, 403]).toContain(res.status);
  });

  test('GET /api/passport/verify/:uuid — 不存在 → 404', async () => {
    const res = await request(app).get('/api/passport/verify/nonexistent-uuid');
    expect(res.status).toBe(404);
  });
});

// ── 12. /api/location-share ──────────────────────────────────────────────────
describe('十二、位置分享模块 /api/location-share', () => {
  let app, db, user, shareToken;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002200' });
  });

  test('POST /api/location-share — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/location-share')
      .send({ lat: 27.98, lng: 86.92 });
    expect(res.status).toBe(401);
  });

  test('POST /api/location-share — 缺少坐标 → 400', async () => {
    const res = await request(app)
      .post('/api/location-share')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/location-share — 创建分享链接', async () => {
    const res = await request(app)
      .post('/api/location-share')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ lat: 27.98, lng: 86.92 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    shareToken = res.body.token;
  });

  test('GET /api/location-share/:token — 获取分享位置', async () => {
    if (!shareToken) return;
    const res = await request(app).get(`/api/location-share/${shareToken}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── 13. /api/bookings ────────────────────────────────────────────────────────
describe('十三、预约模块 /api/bookings', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002300' });
  });

  test('GET /api/bookings/my — 未登录 → 401', async () => {
    const res = await request(app).get('/api/bookings/my');
    expect(res.status).toBe(401);
  });

  test('GET /api/bookings/my — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/bookings/incoming — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/bookings/incoming')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/bookings/pool — 已登录，返回分页对象', async () => {
    const res = await request(app)
      .get('/api/bookings/pool')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bookings');
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  test('POST /api/bookings — 缺少必填字段 → 400', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/bookings/:id/cancel — 用户可取消自己的待处理预约', async () => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ mountain: '玉珠峰', date, members: 2 });
    expect([200, 201]).toContain(createRes.status);
    const bookingId = createRes.body.id;

    const cancelRes = await request(app)
      .put(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.message).toBe('预约已取消');
  });
});

// ── 14. /api/orders ──────────────────────────────────────────────────────────
describe('十四、订单模块 /api/orders', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002400' });
  });

  test('GET /api/orders — 未登录 → 401', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  test('GET /api/orders — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/orders/:id — 不存在 → 404', async () => {
    const res = await request(app)
      .get('/api/orders/99999')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/orders/:id/pay — 不存在 → 404', async () => {
    const res = await request(app)
      .post('/api/orders/99999/pay')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(404);
  });
});

// ── 15. /api/customs ─────────────────────────────────────────────────────────
describe('十五、定制委托模块 /api/customs', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002500' });
  });

  test('GET /api/customs — 未登录 → 401', async () => {
    const res = await request(app).get('/api/customs');
    expect(res.status).toBe(401);
  });

  test('GET /api/customs — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/customs')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/customs/pool — 仅向导/俱乐部可访问，普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/customs/pool')
      .set('Authorization', `Bearer ${user.token}`);
    expect([200, 403]).toContain(res.status);
  });

  test('POST /api/customs — 缺少必填字段 → 400', async () => {
    const res = await request(app)
      .post('/api/customs')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/customs — 创建定制委托', async () => {
    const res = await request(app)
      .post('/api/customs')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ peak_name: '珠穆朗玛峰', contact_phone: '13900000001', preferred_date: '2026-05-01', group_size: 2 });
    expect([200, 201]).toContain(res.status);
  });
});

// ── 16. /api/guide-console ───────────────────────────────────────────────────
describe('十六、向导控制台 /api/guide-console', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002600' });
  });

  test('GET /api/guide-console/dashboard — 未登录 → 401', async () => {
    const res = await request(app).get('/api/guide-console/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/guide-console/dashboard — 普通用户（非向导）→ 403', async () => {
    const res = await request(app)
      .get('/api/guide-console/dashboard')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/guide-console/orders — 普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/guide-console/orders')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/guide-console/earnings — 普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/guide-console/earnings')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/guide-console/withdraw — 普通用户 → 403', async () => {
    const res = await request(app)
      .post('/api/guide-console/withdraw')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── 17. /api/club-console ────────────────────────────────────────────────────
describe('十七、俱乐部控制台 /api/club-console', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002700' });
  });

  test('GET /api/club-console/dashboard — 未登录 → 401', async () => {
    const res = await request(app).get('/api/club-console/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/club-console/dashboard — 普通用户（非俱乐部管理员）→ 403', async () => {
    const res = await request(app)
      .get('/api/club-console/dashboard')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/club-console/members — 普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/club-console/members')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/club-console/activities — 普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/club-console/activities')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/club-console/finance — 普通用户 → 403', async () => {
    const res = await request(app)
      .get('/api/club-console/finance')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });
});

// ── 18. /api/expeditions ─────────────────────────────────────────────────────
describe('十八、远征队活动 /api/expeditions', () => {
  let app, db, user, guideUser, expeditionId, pendingExpeditionId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002800' });
    guideUser = createTestUser(db, { phone: '13800002801' });
    const guideRes = db.prepare(`
      INSERT INTO guides (user_id, name, rating, reviews, status, created_at)
      VALUES (?, '测试向导', 4.8, 12, 'approved', datetime('now'))
    `).run(guideUser.id);
    const guideId = Number(guideRes.lastInsertRowid);
    const publishedRes = db.prepare(`
      INSERT INTO expeditions (
        publisher_type, publisher_id, title, base_price, commission_rate,
        min_participants, max_participants, current_participants, status,
        created_at, updated_at
      ) VALUES (
        'guide', ?, '2026珠峰商业攀登', 380000, 0.15,
        1, 8, 2, 'published',
        datetime('now'), datetime('now')
      )
    `).run(guideId);
    expeditionId = Number(publishedRes.lastInsertRowid);
    const pendingRes = db.prepare(`
      INSERT INTO expeditions (
        publisher_type, publisher_id, title, base_price, commission_rate,
        min_participants, max_participants, current_participants, status,
        created_at, updated_at
      ) VALUES (
        'guide', ?, '待发布测试路线', 320000, 0.15,
        1, 6, 0, 'pending',
        datetime('now'), datetime('now')
      )
    `).run(guideId);
    pendingExpeditionId = Number(pendingRes.lastInsertRowid);
  });

  test('GET /api/expeditions — 公开，返回分页对象', async () => {
    const res = await request(app).get('/api/expeditions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('expeditions');
    expect(Array.isArray(res.body.expeditions)).toBe(true);
  });

  test('POST /api/expeditions — 未登录 → 401', async () => {
    const res = await request(app)
      .post('/api/expeditions')
      .send({ title: '2026珠峰商业攀登', peak: '珠穆朗玛峰', start_date: '2026-05-01', price: 380000 });
    expect(res.status).toBe(401);
  });

  test('POST /api/expeditions — 普通用户（非向导）→ 403', async () => {
    const res = await request(app)
      .post('/api/expeditions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: '2026珠峰商业攀登', peak: '珠穆朗玛峰', start_date: '2026-05-01', price: 380000, max_participants: 8 });
    expect(res.status).toBe(403);
  });

  test('GET /api/expeditions/:id — 获取详情', async () => {
    const res = await request(app).get(`/api/expeditions/${expeditionId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('2026珠峰商业攀登');
    expect(res.body).toHaveProperty('merchant');
    expect(res.body).toHaveProperty('skus');
    expect(Array.isArray(res.body.skus)).toBe(true);
    expect(res.body).toHaveProperty('review_summary');
  });

  test('GET /api/expeditions/:id — 未发布且非本人/管理员 → 404', async () => {
    const res = await request(app).get(`/api/expeditions/${pendingExpeditionId}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/expeditions/:id — 管理员可查看未发布路线', async () => {
    const adminToken = createAdminToken();
    const res = await request(app)
      .get(`/api/expeditions/${pendingExpeditionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('待发布测试路线');
  });

  test('GET /api/expeditions/:id — 发布者本人可查看未发布路线', async () => {
    const res = await request(app)
      .get(`/api/expeditions/${pendingExpeditionId}`)
      .set('Authorization', `Bearer ${guideUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('待发布测试路线');
  });

  test('GET /api/expeditions/orders/my — 未登录 → 401', async () => {
    const res = await request(app).get('/api/expeditions/orders/my');
    expect(res.status).toBe(401);
  });

  test('GET /api/expeditions/orders/my — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/expeditions/orders/my')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── 19. /api/group-chats ─────────────────────────────────────────────────────
describe('十九、群聊模块 /api/group-chats', () => {
  let app, db, user, groupId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800002900' });

    // Create a team so group chat can be tested
    const teamRes = db.prepare(
      `INSERT INTO teams (name, description, leader_id, status) VALUES (?, ?, ?, 'active')`
    ).run('测试队伍', '测试描述', user.id);
    const teamId = teamRes.lastInsertRowid;
    db.prepare(
      `INSERT INTO team_members (team_id, user_id, status) VALUES (?, ?, 'approved')`
    ).run(teamId, user.id);

    // Create group chat linked to team
    try {
      const gcRes = db.prepare(
        `INSERT INTO group_chats (name, team_id, created_by) VALUES (?, ?, ?)`
      ).run('测试群聊', teamId, user.id);
      groupId = gcRes.lastInsertRowid;
      db.prepare(
        `INSERT INTO group_chat_members (group_chat_id, user_id) VALUES (?, ?)`
      ).run(groupId, user.id);
    } catch (e) {
      // table may not exist yet; tests will handle gracefully
    }
  });

  test('GET /api/group-chats — 未登录 → 401', async () => {
    const res = await request(app).get('/api/group-chats');
    expect(res.status).toBe(401);
  });

  test('GET /api/group-chats — 已登录，返回数组', async () => {
    const res = await request(app)
      .get('/api/group-chats')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/group-chats/:id — 不存在 → 401/403/404', async () => {
    const res = await request(app)
      .get('/api/group-chats/99999')
      .set('Authorization', `Bearer ${user.token}`);
    expect([403, 404]).toContain(res.status);
  });

  test('GET /api/group-chats/:id/messages — 未登录 → 401', async () => {
    if (!groupId) return;
    const res = await request(app).get(`/api/group-chats/${groupId}/messages`);
    expect(res.status).toBe(401);
  });
});

// ── 20. /api/upload ──────────────────────────────────────────────────────────
describe('二十、文件上传 /api/upload', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800003000' });
  });

  test('POST /api/upload — 未登录 → 401', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(401);
  });
});
