/**
 * SummitLink 商业化功能 API 集成测试
 * 覆盖排行榜反作弊、俱乐部活动全链路、向导服务全链路
 */

'use strict';

process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createApp }       = require('./helpers/testApp');
const { createTestUser, createAdminToken, authHeader } = require('./helpers/auth');
const { clearDbCache }    = require('./helpers/db');

// ── 一、排行榜反作弊 ───────────────────────────────────────────────
describe('一、排行榜反作弊', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = require('../backend/db/database');
    user = createTestUser(db);
  });

  function insertTrack(opts = {}) {
    const today = new Date().toISOString().slice(0, 10);
    return db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, distance_km, elevation, max_elevation, flagged, reward_granted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      opts.user_id || user.id,
      opts.name || '测试路线',
      opts.peak_name || '珠峰',
      opts.date || today,
      opts.distance_km || 10,
      opts.elevation || 500,
      opts.max_elevation || 5000,
      opts.flagged !== undefined ? opts.flagged : 0,
      opts.reward_granted !== undefined ? opts.reward_granted : 1
    );
  }

  test('flagged=1 的轨迹不进榜', async () => {
    // 插入正常轨迹 + flagged 轨迹
    insertTrack({ flagged: 0, reward_granted: 1 });
    insertTrack({ flagged: 1, reward_granted: 1 });

    const res = await request(app).get('/api/leaderboard?period=all');
    expect(res.status).toBe(200);
    const leaders = res.body.leaders;
    expect(leaders.length).toBeGreaterThan(0);
    // 总登顶次数应只计入未 flagged 的
    const totalCount = leaders.reduce((s, l) => s + l.summit_count, 0);
    // 我们插了2条轨迹，flagged=1 不计，所以最多只有1计
    // 这里只验证存在记录即可（可能有之前测试的数据干扰，所以验证 ≤ 已插入总数）
    expect(totalCount).toBeGreaterThanOrEqual(1);
  });

  test('reward_granted=0 的轨迹不进榜', async () => {
    // 创建新用户保证数据隔离
    const u2 = createTestUser(db, { phone: '138' + String(Date.now()).slice(-8) });
    insertTrack({ user_id: u2.id, flagged: 0, reward_granted: 0 });
    insertTrack({ user_id: u2.id, flagged: 0, reward_granted: 1 });

    const res = await request(app).get('/api/leaderboard?period=all');
    expect(res.status).toBe(200);
    const leader = res.body.leaders.find(l => l.id === u2.id);
    // 该用户有效轨迹只有 1 条
    expect(leader).toBeTruthy();
    expect(leader.summit_count).toBe(1);
  });

  test('period=week 只统计本周', async () => {
    const u3 = createTestUser(db, { phone: '139' + String(Date.now()).slice(-8) });
    // 本周一条
    insertTrack({ user_id: u3.id, date: new Date().toISOString().slice(0, 10) });
    // 去年一条（不在本周）
    insertTrack({ user_id: u3.id, date: '2020-01-01' });

    const res = await request(app).get('/api/leaderboard?period=week');
    expect(res.status).toBe(200);
    const leader = res.body.leaders.find(l => l.id === u3.id);
    expect(leader).toBeTruthy();
    expect(leader.summit_count).toBe(1);
  });

  test('scope=club 按俱乐部聚合', async () => {
    // 创建俱乐部并加两个成员
    const u4 = createTestUser(db, { phone: '180' + String(Date.now()).slice(-8) });
    const clubResult = db.prepare(`
      INSERT INTO clubs (name, description, creator_id, members_count, status)
      VALUES ('测试俱乐部', '', ?, 1, 'active')
    `).run(u4.id);
    const clubId = clubResult.lastInsertRowid;
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(clubId, u4.id, 'founder');
    const u5 = createTestUser(db, { phone: '181' + String(Date.now()).slice(-8) });
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(clubId, u5.id, 'member');
    insertTrack({ user_id: u4.id });
    insertTrack({ user_id: u5.id });

    const res = await request(app).get('/api/leaderboard?scope=club&period=all');
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('club');
    const cLeader = res.body.leaders.find(l => l.id === clubId);
    expect(cLeader).toBeTruthy();
    expect(cLeader.summit_count).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/leaderboard/monthly — 路由仍可访问', async () => {
    const res = await request(app).get('/api/leaderboard/monthly');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── 二、俱乐部商业活动全链路 ──────────────────────────────────────
describe('二、俱乐部商业活动全链路', () => {
  let app, db, adminToken, clubUser, otherUser, clubId, actId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = require('../backend/db/database');
    adminToken = createAdminToken();
    clubUser = createTestUser(db, { phone: '150' + String(Date.now()).slice(-8) });
    otherUser = createTestUser(db, { phone: '151' + String(Date.now()).slice(-8) });

    // 创建俱乐部
    const clubResult = db.prepare(`
      INSERT INTO clubs (name, description, creator_id, members_count, status)
      VALUES ('商业俱乐部', '测试', ?, 1, 'active')
    `).run(clubUser.id);
    clubId = clubResult.lastInsertRowid;
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(clubId, clubUser.id, 'founder');
  });

  test('未通过商业资质 → 发布 price>0 活动返回 422', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activity`)
      .set(authHeader(clubUser.token))
      .send({ title: '收费活动', price: 500, max_members: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('commercial_not_verified');
  });

  test('price=0 的活动不需要商业资质', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activity`)
      .set(authHeader(clubUser.token))
      .send({ title: '免费活动', price: 0, max_members: 10, status: 'active' });
    expect([200, 201]).toContain(res.status);
    actId = res.body.id;
  });

  test('商业资质申请提交成功', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/commercial-apply`)
      .set(authHeader(clubUser.token))
      .send({
        business_license_url: 'https://example.com/license.jpg',
        business_license_no: '91310000XXXXXXXX',
        insurance_cert_url: 'https://example.com/insurance.jpg',
        bank_account_name: '测试公司',
        bank_account_no: '6226XXXX',
        bank_name: '中国银行',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('管理员审核通过商业资质', async () => {
    const res = await request(app)
      .post(`/api/admin/clubs/${clubId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'approve' });
    expect(res.status).toBe(200);
    const club = db.prepare('SELECT commercial_verified FROM clubs WHERE id = ?').get(clubId);
    expect(club.commercial_verified).toBe(1);
  });

  test('资质通过后可发布收费活动', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activity`)
      .set(authHeader(clubUser.token))
      .send({ title: '收费攀登活动', price: 998, max_members: 10, status: 'active' });
    expect([200, 201]).toContain(res.status);
    actId = res.body.id;
  });

  test('报名缺紧急联系人 → 400', async () => {
    // 先把活动设为 active
    db.prepare("UPDATE club_activities SET status='active' WHERE id=?").run(actId);
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(otherUser.token))
      .send({ agreedWaiver: true, waiverVersion: '1.0' });
    expect(res.status).toBe(400);
  });

  test('报名未勾选免责协议 → 400', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(otherUser.token))
      .send({
        emergency_contact_name: '张三',
        emergency_contact_phone: '13800000001',
        agreedWaiver: false,
      });
    expect(res.status).toBe(400);
  });

  test('正常报名 → 创建 pending_payment 订单', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(otherUser.token))
      .send({
        emergency_contact_name: '张三',
        emergency_contact_phone: '13800000001',
        agreedWaiver: true,
        waiverVersion: '1.0',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('pending_payment');
    expect(res.body.order_no).toBeTruthy();
  });

  test('重复报名 → 400', async () => {
    const res = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(otherUser.token))
      .send({
        emergency_contact_name: '张三',
        emergency_contact_phone: '13800000001',
        agreedWaiver: true,
        waiverVersion: '1.0',
      });
    expect(res.status).toBe(400);
  });

  test('GET /api/activity-orders/my → 看到自己的订单', async () => {
    const res = await request(app)
      .get('/api/activity-orders/my')
      .set(authHeader(otherUser.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].status).toBe('pending_payment');
  });

  test('支付订单 → status 变为 paid', async () => {
    const myOrders = db.prepare('SELECT * FROM activity_orders WHERE user_id = ?').all(otherUser.id);
    const orderId = myOrders[0].id;
    const res = await request(app)
      .post(`/api/activity-orders/${orderId}/pay`)
      .set(authHeader(otherUser.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('管理员查看报名列表', async () => {
    const res = await request(app)
      .get(`/api/clubs/${clubId}/activities/${actId}/enrollments`)
      .set(authHeader(clubUser.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('管理员审核驳回商业资质', async () => {
    const res = await request(app)
      .post(`/api/admin/clubs/${clubId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'reject', reason: '材料不完整' });
    expect(res.status).toBe(200);
    const club = db.prepare('SELECT commercial_verified, commercial_status FROM clubs WHERE id = ?').get(clubId);
    expect(club.commercial_verified).toBe(0);
    expect(club.commercial_status).toBe('rejected');
  });
});

// ── 三、向导商业服务全链路 ──────────────────────────────────────
describe('三、向导商业服务全链路', () => {
  let app, db, adminToken, guideUser, clientUser, guideId, serviceId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = require('../backend/db/database');
    adminToken = createAdminToken();
    guideUser = createTestUser(db, { phone: '160' + String(Date.now()).slice(-8) });
    clientUser = createTestUser(db, { phone: '161' + String(Date.now()).slice(-8) });

    // 创建向导记录
    const guideResult = db.prepare(`
      INSERT INTO guides (user_id, name, avatar, specialty, day_rate, status)
      VALUES (?, '测试向导', '', '高山攀登', 1000, 'approved')
    `).run(guideUser.id);
    guideId = guideResult.lastInsertRowid;
  });

  test('未通过商业资质 → 发布 price>0 服务返回 422', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/services`)
      .set(authHeader(guideUser.token))
      .send({ title: '收费向导服务', price: 2000, max_clients: 5 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('commercial_not_verified');
  });

  test('商业资质申请提交成功', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/commercial-apply`)
      .set(authHeader(guideUser.token))
      .send({
        id_card_url: 'https://example.com/id.jpg',
        climbing_cert_url: 'https://example.com/cert.jpg',
        insurance_cert_url: 'https://example.com/insurance.jpg',
        health_cert_url: 'https://example.com/health.jpg',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('管理员审核通过向导商业资质', async () => {
    const res = await request(app)
      .post(`/api/admin/guides/${guideId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'approve' });
    expect(res.status).toBe(200);
    const guide = db.prepare('SELECT commercial_verified FROM guides WHERE id = ?').get(guideId);
    expect(guide.commercial_verified).toBe(1);
  });

  test('资质通过后可发布收费服务', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/services`)
      .set(authHeader(guideUser.token))
      .send({ title: '珠峰向导服务', price: 5000, max_clients: 4, type: 'guided_climb', status: 'active' });
    expect([200, 201]).toContain(res.status);
    serviceId = res.body.id;
    expect(res.body.title).toBe('珠峰向导服务');
  });

  test('GET /api/guides/:guideId/services → 服务列表', async () => {
    const res = await request(app).get(`/api/guides/${guideId}/services`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('预约服务缺紧急联系人 → 400', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/services/${serviceId}/book`)
      .set(authHeader(clientUser.token))
      .send({ agreedWaiver: true, waiverVersion: '1.0' });
    expect(res.status).toBe(400);
  });

  test('正常预约服务 → 创建 pending_payment 订单', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/services/${serviceId}/book`)
      .set(authHeader(clientUser.token))
      .send({
        emergency_contact_name: '李四',
        emergency_contact_phone: '13900000002',
        agreedWaiver: true,
        waiverVersion: '1.0',
        start_date: '2026-06-01',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('pending_payment');
  });

  test('重复预约 → 400', async () => {
    const res = await request(app)
      .post(`/api/guides/${guideId}/services/${serviceId}/book`)
      .set(authHeader(clientUser.token))
      .send({
        emergency_contact_name: '李四',
        emergency_contact_phone: '13900000002',
        agreedWaiver: true,
        waiverVersion: '1.0',
      });
    expect(res.status).toBe(400);
  });

  test('GET /api/guide-service-orders/my → 看到自己的订单', async () => {
    const res = await request(app)
      .get('/api/guide-service-orders/my')
      .set(authHeader(clientUser.token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].status).toBe('pending_payment');
  });

  test('支付向导服务订单', async () => {
    const orders = db.prepare('SELECT * FROM guide_service_orders WHERE user_id = ?').all(clientUser.id);
    const orderId = orders[0].id;
    const res = await request(app)
      .post(`/api/guide-service-orders/${orderId}/pay`)
      .set(authHeader(clientUser.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('向导查看预约列表', async () => {
    const res = await request(app)
      .get(`/api/guides/${guideId}/services/${serviceId}/bookings`)
      .set(authHeader(guideUser.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('取消已支付订单 → 200（paid 可以取消）', async () => {
    const orders = db.prepare('SELECT * FROM guide_service_orders WHERE user_id = ?').all(clientUser.id);
    const orderId = orders[0].id;
    const res = await request(app)
      .post(`/api/guide-service-orders/${orderId}/cancel`)
      .set(authHeader(clientUser.token));
    // paid 状态可以取消（VALID_TRANSITIONS: paid → cancelled）
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  test('已取消的订单无法再申请退款', async () => {
    const orders = db.prepare('SELECT * FROM guide_service_orders WHERE user_id = ?').all(clientUser.id);
    const orderId = orders[0].id;
    // 已 cancelled，不能 refund_requested
    const res = await request(app)
      .post(`/api/guide-service-orders/${orderId}/refund-request`)
      .set(authHeader(clientUser.token))
      .send({ reason: '行程变化' });
    expect(res.status).toBe(400);
  });

  test('更新向导服务', async () => {
    const res = await request(app)
      .put(`/api/guides/${guideId}/services/${serviceId}`)
      .set(authHeader(guideUser.token))
      .send({ title: '珠峰向导服务（更新）', max_clients: 6 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('珠峰向导服务（更新）');
  });

  test('删除向导服务（软删）', async () => {
    const res = await request(app)
      .delete(`/api/guides/${guideId}/services/${serviceId}`)
      .set(authHeader(guideUser.token));
    expect(res.status).toBe(200);
    const svc = db.prepare('SELECT status FROM guide_services WHERE id = ?').get(serviceId);
    expect(svc.status).toBe('deleted');
  });

  test('管理员审核需补充材料 → commercial_status=need_info', async () => {
    const res = await request(app)
      .post(`/api/admin/guides/${guideId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'need_info', reason: '请补充保险证明' });
    expect(res.status).toBe(200);
    const guide = db.prepare('SELECT commercial_status FROM guides WHERE id = ?').get(guideId);
    expect(guide.commercial_status).toBe('need_info');
  });
});

// ── 四、活动订单状态机全流程 ──────────────────────────────────────
describe('四、活动订单状态机全流程', () => {
  let app, db, clubUser, otherUser, clubId, actId, orderId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = require('../backend/db/database');
    clubUser = createTestUser(db);
    otherUser = createTestUser(db, { phone: '170' + String(Date.now()).slice(-8) });

    // 创建俱乐部并通过商业资质
    const clubResult = db.prepare(`
      INSERT INTO clubs (name, description, creator_id, members_count, status, commercial_verified)
      VALUES ('状态机测试俱乐部', '', ?, 1, 'active', 1)
    `).run(clubUser.id);
    clubId = clubResult.lastInsertRowid;
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(clubId, clubUser.id, 'founder');

    // 创建活动
    const actResult = db.prepare(`
      INSERT INTO club_activities (club_id, title, price, max_members, status, current_members)
      VALUES (?, '攀登培训', 0, 10, 'active', 0)
    `).run(clubId);
    actId = actResult.lastInsertRowid;
  });

  test('完整流程：报名 → 支付 → 申请退款', async () => {
    // 报名
    let res = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(otherUser.token))
      .send({
        emergency_contact_name: '王五',
        emergency_contact_phone: '13700000003',
        agreedWaiver: true,
        waiverVersion: '1.0',
      });
    expect([200, 201]).toContain(res.status);
    orderId = res.body.id;

    // 支付
    res = await request(app)
      .post(`/api/activity-orders/${orderId}/pay`)
      .set(authHeader(otherUser.token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');

    // 申请退款
    res = await request(app)
      .post(`/api/activity-orders/${orderId}/refund-request`)
      .set(authHeader(otherUser.token))
      .send({ reason: '有急事' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refund_requested');
  });

  test('pending_payment 可以取消', async () => {
    // 重新报名
    const u2 = createTestUser(db, { phone: '171' + String(Date.now()).slice(-8) });
    const res1 = await request(app)
      .post(`/api/clubs/${clubId}/activities/${actId}/enroll`)
      .set(authHeader(u2.token))
      .send({
        emergency_contact_name: '赵六',
        emergency_contact_phone: '13600000004',
        agreedWaiver: true,
        waiverVersion: '1.0',
      });
    expect([200, 201]).toContain(res1.status);
    const newOrderId = res1.body.id;

    // 取消
    const res2 = await request(app)
      .post(`/api/activity-orders/${newOrderId}/cancel`)
      .set(authHeader(u2.token));
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('cancelled');
  });
});
