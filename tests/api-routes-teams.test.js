/**
 * SummitLink 线路 & 组队接口集成测试
 * 覆盖 backend/routes/routes.js 和 backend/routes/teams.js 的所有接口
 * 使用 jest + supertest + SQLite (临时文件)
 */

'use strict';

process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-alpinelink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createApp }      = require('./helpers/testApp');
const { createTestUser, authHeader } = require('./helpers/auth');
const { clearDbCache }   = require('./helpers/db');

// ── 辅助：创建带 is_admin=1 的管理员用户（routes.js 通过 DB 查 is_admin 字段）
function createDbAdminUser(db) {
  const user = createTestUser(db, { phone: '160' + String(Date.now() + Math.random() * 1000 | 0).slice(-8) });
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// 一、线路接口（/api/routes）
// ─────────────────────────────────────────────────────────────────────────────
describe('一、线路接口 /api/routes', () => {
  let app, db, adminUser, normalUser, routeId, clubId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = require('../backend/db/database');
    adminUser  = createDbAdminUser(db);
    normalUser = createTestUser(db, { phone: '161' + String(Date.now()).slice(-8) });

    // 创建一个俱乐部供报价测试使用
    const clubResult = db.prepare(
      `INSERT INTO clubs (name, description, creator_id, members_count, status)
       VALUES ('测试俱乐部', '用于单元测试', ?, 1, 'active')`
    ).run(normalUser.id);
    clubId = clubResult.lastInsertRowid;
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(clubId, normalUser.id, 'founder');
  });

  // GET /api/routes ──────────────────────────────────────────────────────────
  test('GET /api/routes 返回线路数组', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // POST /api/routes ─────────────────────────────────────────────────────────
  test('POST /api/routes 未登录返回 401', async () => {
    const res = await request(app).post('/api/routes').send({ name: '测试线路' });
    expect(res.status).toBe(401);
  });

  test('POST /api/routes 普通用户返回 403', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set(authHeader(normalUser.token))
      .send({ name: '未授权线路' });
    expect(res.status).toBe(403);
  });

  test('POST /api/routes 管理员缺少 name 返回 400', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set(authHeader(adminUser.token))
      .send({ peak: '珠峰' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('POST /api/routes 管理员成功创建线路', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set(authHeader(adminUser.token))
      .send({
        name:         '测试登山线路',
        peak:         '珠穆朗玛峰',
        difficulty:   '极难',
        altitude:     8848,
        duration_days: 60,
        best_season:  '春季',
        region:       '西藏',
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('测试登山线路');
    routeId = res.body.id;
  });

  // GET /api/routes/:id ──────────────────────────────────────────────────────
  test('GET /api/routes/:id 返回线路详情', async () => {
    const res = await request(app).get(`/api/routes/${routeId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(routeId);
    expect(res.body.name).toBe('测试登山线路');
  });

  test('GET /api/routes/:id 不存在的线路返回 404', async () => {
    const res = await request(app).get('/api/routes/99999999');
    expect(res.status).toBe(404);
  });

  // GET /api/routes/:id/clubs ────────────────────────────────────────────────
  test('GET /api/routes/:id/clubs 返回报价数组（初始为空）', async () => {
    const res = await request(app).get(`/api/routes/${routeId}/clubs`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // POST /api/routes/pricing ─────────────────────────────────────────────────
  test('POST /api/routes/pricing 未登录返回 401', async () => {
    const res = await request(app)
      .post('/api/routes/pricing')
      .send({ club_id: clubId, route_id: routeId, price: 9999 });
    expect(res.status).toBe(401);
  });

  test('POST /api/routes/pricing 缺少必填字段返回 400', async () => {
    const res = await request(app)
      .post('/api/routes/pricing')
      .set(authHeader(normalUser.token))
      .send({ club_id: clubId, route_id: routeId });
    expect(res.status).toBe(400);
  });

  test('POST /api/routes/pricing 俱乐部创建者可以设置报价', async () => {
    const res = await request(app)
      .post('/api/routes/pricing')
      .set(authHeader(normalUser.token))
      .send({
        club_id:    clubId,
        route_id:   routeId,
        price:      12800,
        includes:   JSON.stringify(['专业向导', '高山保险', '营地设备']),
        duration:   60,
        max_people: 8,
      });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(12800);
  });

  test('POST /api/routes/pricing 非俱乐部成员返回 403', async () => {
    const stranger = createTestUser(db, { phone: '162' + String(Date.now()).slice(-8) });
    const res = await request(app)
      .post('/api/routes/pricing')
      .set(authHeader(stranger.token))
      .send({ club_id: clubId, route_id: routeId, price: 1 });
    expect(res.status).toBe(403);
  });

  test('GET /api/routes/:id/clubs 报价设置后返回俱乐部数据', async () => {
    const res = await request(app).get(`/api/routes/${routeId}/clubs`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].club_id).toBe(clubId);
  });

  // PUT /api/routes/:id ──────────────────────────────────────────────────────
  test('PUT /api/routes/:id 普通用户返回 403', async () => {
    const res = await request(app)
      .put(`/api/routes/${routeId}`)
      .set(authHeader(normalUser.token))
      .send({ name: '篡改线路' });
    expect(res.status).toBe(403);
  });

  test('PUT /api/routes/:id 管理员更新成功', async () => {
    const res = await request(app)
      .put(`/api/routes/${routeId}`)
      .set(authHeader(adminUser.token))
      .send({ name: '更新后的登山线路', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('更新后的登山线路');
  });

  // DELETE /api/routes/:id ───────────────────────────────────────────────────
  test('DELETE /api/routes/:id 普通用户返回 403', async () => {
    const res = await request(app)
      .delete(`/api/routes/${routeId}`)
      .set(authHeader(normalUser.token));
    expect(res.status).toBe(403);
  });

  test('DELETE /api/routes/:id 管理员软删除成功', async () => {
    const res = await request(app)
      .delete(`/api/routes/${routeId}`)
      .set(authHeader(adminUser.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 已软删（status='deleted'），不再出现在列表中
    const listRes = await request(app).get('/api/routes');
    const found = listRes.body.find(r => r.id === routeId);
    expect(found).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 二、组队接口（/api/teams）
// ─────────────────────────────────────────────────────────────────────────────
describe('二、组队接口 /api/teams', () => {
  let app, db, leader, member, otherUser, teamId, memberId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = require('../backend/db/database');
    leader    = createTestUser(db, { phone: '170' + String(Date.now()).slice(-8) });
    member    = createTestUser(db, { phone: '171' + String(Date.now()).slice(-8) });
    otherUser = createTestUser(db, { phone: '172' + String(Date.now()).slice(-8) });
  });

  // GET /api/teams ───────────────────────────────────────────────────────────
  test('GET /api/teams 返回招募中的队伍数组', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // POST /api/teams ──────────────────────────────────────────────────────────
  test('POST /api/teams 未登录返回 401', async () => {
    const res = await request(app).post('/api/teams').send({ name: '测试队伍', peak: '珠峰', totalSpots: 5 });
    expect(res.status).toBe(401);
  });

  test('POST /api/teams 登录后成功创建队伍', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set(authHeader(leader.token))
      .send({
        name:        '珠峰登顶队',
        peak:        '珠穆朗玛峰',
        date:        '2026-09-01',
        totalSpots:  4,
        level:       '专业',
        description: '招募有5000m以上经验的队员',
        difficulty:  '极难',
        fee:         '自理',
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('珠峰登顶队');
    // 创建者自动以 leader 身份加入 team_members
    teamId = res.body.id;
  });

  // GET /api/teams（创建后列表有数据）
  test('GET /api/teams 返回刚创建的队伍', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    const found = res.body.find(t => t.id === teamId);
    expect(found).toBeTruthy();
    expect(found.name).toBe('珠峰登顶队');
  });

  // GET /api/teams/:id ───────────────────────────────────────────────────────
  test('GET /api/teams/:id 返回队伍详情及成员列表', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(teamId);
    expect(Array.isArray(res.body.members)).toBe(true);
    // 创建者应已作为 leader 加入
    const leaderMember = res.body.members.find(m => m.userId === leader.id);
    expect(leaderMember).toBeTruthy();
    expect(leaderMember.status).toBe('leader');
  });

  test('GET /api/teams/:id 不存在的队伍返回 404', async () => {
    const res = await request(app).get('/api/teams/99999999');
    expect(res.status).toBe(404);
  });

  // POST /api/teams/:id/join ─────────────────────────────────────────────────
  test('POST /api/teams/:id/join 未登录返回 401', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/join`);
    expect(res.status).toBe(401);
  });

  test('POST /api/teams/:id/join 成员申请加入成功', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/join`)
      .set(authHeader(member.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/teams/:id/join 重复申请返回 400', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/join`)
      .set(authHeader(member.token));
    expect(res.status).toBe(400);
  });

  test('GET /api/teams/:id 申请后成员列表中有 pending 状态记录', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    const pendingMember = res.body.members.find(m => m.userId === member.id);
    expect(pendingMember).toBeTruthy();
    expect(pendingMember.status).toBe('pending');
    memberId = pendingMember.id;
  });

  // PUT /api/teams/:id/members/:memberId/approve ────────────────────────────
  test('PUT .../approve 非队长返回 403', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${memberId}/approve`)
      .set(authHeader(otherUser.token));
    expect(res.status).toBe(403);
  });

  test('PUT .../approve 队长审批通过成功', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${memberId}/approve`)
      .set(authHeader(leader.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT .../approve 重复审批同一申请返回 400', async () => {
    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${memberId}/approve`)
      .set(authHeader(leader.token));
    expect(res.status).toBe(400);
  });

  // PUT /api/teams/:id/members/:memberId/reject ─────────────────────────────
  test('PUT .../reject 可拒绝新申请成员', async () => {
    // 先让 otherUser 申请加入
    const joinRes = await request(app)
      .post(`/api/teams/${teamId}/join`)
      .set(authHeader(otherUser.token));
    expect(joinRes.status).toBe(200);

    const detailRes = await request(app).get(`/api/teams/${teamId}`);
    const pendingEntry = detailRes.body.members.find(m => m.userId === otherUser.id);
    expect(pendingEntry).toBeTruthy();
    const otherMemberId = pendingEntry.id;

    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${otherMemberId}/reject`)
      .set(authHeader(leader.token))
      .send({ reason: '名额不足' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT .../reject 非队长返回 403', async () => {
    // 让 otherUser 再次申请
    await request(app)
      .post(`/api/teams/${teamId}/join`)
      .set(authHeader(otherUser.token));

    const detailRes = await request(app).get(`/api/teams/${teamId}`);
    const pendingEntry = detailRes.body.members.find(m => m.userId === otherUser.id && m.status === 'pending');
    const otherMemberId = pendingEntry ? pendingEntry.id : 9999;

    const res = await request(app)
      .put(`/api/teams/${teamId}/members/${otherMemberId}/reject`)
      .set(authHeader(member.token));
    expect(res.status).toBe(403);
  });
});
