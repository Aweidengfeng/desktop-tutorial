'use strict';

const request = require('supertest');
const { createApp } = require('../../tests/helpers/testApp');
const { createAdminToken, authHeader, createTestUser } = require('../../tests/helpers/auth');
const { clearDbCache } = require('../../tests/helpers/db');

describe('admin missing backend APIs', () => {
  let app;
  let db;
  let adminToken;

  beforeEach(() => {
    clearDbCache();
    app = createApp();
    db = require('../db/database');
    adminToken = createAdminToken();
  });

  test('supports GMV, disputes, featured slots, and admin banner management', async () => {
    db.exec(`
      ALTER TABLE orders ADD COLUMN region TEXT;
      CREATE TABLE IF NOT EXISTS platform_expeditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        region TEXT,
        is_featured INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare(`INSERT INTO orders (user_id, order_no, amount, method, status, created_at, region) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(1, 'PAID-CN', 100, 'card', 'paid', new Date().toISOString(), 'cn');
    db.prepare(`INSERT INTO orders (user_id, order_no, amount, method, status, created_at, region) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(2, 'PAID-US', 150, 'card', 'paid', new Date().toISOString(), 'us');
    db.prepare(`INSERT INTO orders (user_id, order_no, amount, method, status, created_at, region) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(3, 'DISPUTE-1', 88, 'card', 'disputed', new Date().toISOString(), 'cn');
    db.prepare(`
      INSERT INTO banners (title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('首页 Banner', '', 'https://img/banner.png', 'url', '/promo', '#111111', '#222222', 1, 1);
    db.prepare(`INSERT INTO platform_expeditions (title, region, is_featured) VALUES (?, ?, ?)`)
      .run('精选珠峰路线', 'us', 1);

    const gmvRes = await request(app)
      .get('/api/admin/gmv?region=all&period=7d')
      .set(authHeader(adminToken));
    expect(gmvRes.status).toBe(200);
    expect(gmvRes.body.total).toBe(250);
    expect(gmvRes.body.byRegion.cn).toBe(100);
    expect(gmvRes.body.byRegion.us).toBe(150);
    expect(Array.isArray(gmvRes.body.chart)).toBe(true);

    const disputesRes = await request(app)
      .get('/api/admin/disputes?status=open')
      .set(authHeader(adminToken));
    expect(disputesRes.status).toBe(200);
    expect(disputesRes.body.total).toBe(1);
    expect(disputesRes.body.disputes[0].order_no).toBe('DISPUTE-1');

    const resolveRes = await request(app)
      .put(`/api/admin/disputes/${disputesRes.body.disputes[0].id}/resolve`)
      .set(authHeader(adminToken))
      .send({ resolution: '同意退款', refund_amount: 20 });
    expect(resolveRes.status).toBe(200);

    const resolvedDisputesRes = await request(app)
      .get('/api/admin/disputes?status=resolved')
      .set(authHeader(adminToken));
    expect(resolvedDisputesRes.status).toBe(200);
    expect(resolvedDisputesRes.body.total).toBe(1);
    expect(resolvedDisputesRes.body.disputes[0].resolution).toBe('同意退款');

    const slotsRes = await request(app)
      .get('/api/admin/featured-slots')
      .set(authHeader(adminToken));
    expect(slotsRes.status).toBe(200);
    expect(slotsRes.body.slots.us).toHaveLength(1);
    expect(slotsRes.body.slots.us[0].displayName).toBe('精选珠峰路线');

    const bannersRes = await request(app)
      .get('/api/admin/banners')
      .set(authHeader(adminToken));
    expect(bannersRes.status).toBe(200);
    expect(bannersRes.body.banners.some((banner) => banner.title === '首页 Banner')).toBe(true);

    const bannerUpdateRes = await request(app)
      .put(`/api/admin/banners/${bannersRes.body.banners[0].id}`)
      .set(authHeader(adminToken))
      .send({ is_active: false });
    expect(bannerUpdateRes.status).toBe(200);
    expect(Number(bannerUpdateRes.body.is_active)).toBe(0);
  });

  test('supports commission config, merchant KYC, platform routes, and invite code management', async () => {
    const guideUser = createTestUser(db, { phone: '13800001001', name: '向导用户' });
    const clubUser = createTestUser(db, { phone: '13800001002', name: '俱乐部用户' });

    db.prepare(`INSERT INTO guides (user_id, name, region, status, commission_rate) VALUES (?, ?, ?, ?, ?)`)
      .run(guideUser.id, '测试向导', 'cn', 'pending', 0.12);
    db.prepare(`INSERT INTO clubs (name, description, creator_id, region, status, commission_rate) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('测试俱乐部', 'desc', clubUser.id, 'us', 'active', 0.1);
    const guideAppId = db.prepare(`INSERT INTO guide_applications (user_id, name, region, status) VALUES (?, ?, ?, ?)`)
      .run(guideUser.id, '测试向导申请', 'cn', 'pending').lastInsertRowid;
    const clubAppId = db.prepare(`INSERT INTO club_applications (user_id, club_name, region, status) VALUES (?, ?, ?, ?)`)
      .run(clubUser.id, '测试俱乐部申请', 'us', 'pending').lastInsertRowid;
    const routeId = db.prepare(`INSERT INTO climbing_routes (name, peak, region, status) VALUES (?, ?, ?, ?)`)
      .run('待审线路', '珠峰', 'cn', 'pending').lastInsertRowid;
    const rejectRouteId = db.prepare(`INSERT INTO climbing_routes (name, peak, region, status) VALUES (?, ?, ?, ?)`)
      .run('待拒绝线路', '梅里雪山', 'cn', 'pending').lastInsertRowid;

    const commissionUpdateRes = await request(app)
      .put('/api/admin/commission-rates')
      .set(authHeader(adminToken))
      .send({ guide_rate: 0.18, club_rate: 0.09 });
    expect(commissionUpdateRes.status).toBe(200);

    const commissionGetRes = await request(app)
      .get('/api/admin/commission-rates')
      .set(authHeader(adminToken));
    expect(commissionGetRes.status).toBe(200);
    expect(commissionGetRes.body.guide_rate).toBe(0.18);
    expect(commissionGetRes.body.club_rate).toBe(0.09);

    const customRateRes = await request(app)
      .put('/api/admin/merchants/1/custom-rate')
      .set(authHeader(adminToken))
      .send({ custom_rate: 0.07 });
    expect(customRateRes.status).toBe(200);
    expect(db.prepare('SELECT commission_rate FROM guides WHERE id = 1').get().commission_rate).toBe(0.07);

    const merchantKycRes = await request(app)
      .get('/api/admin/merchant-kyc?status=pending')
      .set(authHeader(adminToken));
    expect(merchantKycRes.status).toBe(200);
    expect(merchantKycRes.body.merchants).toHaveLength(2);

    const approveGuideRes = await request(app)
      .post(`/api/admin/merchant-kyc/${guideAppId}/approve`)
      .set(authHeader(adminToken))
      .send({ type: 'guide' });
    expect(approveGuideRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM guide_applications WHERE id = ?').get(guideAppId).status).toBe('approved_pending_payment');

    const rejectClubRes = await request(app)
      .post(`/api/admin/merchant-kyc/${clubAppId}/reject`)
      .set(authHeader(adminToken))
      .send({ type: 'club', reason: '资料不完整' });
    expect(rejectClubRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM club_applications WHERE id = ?').get(clubAppId).status).toBe('rejected');

    const platformRoutesRes = await request(app)
      .get('/api/admin/platform-routes')
      .set(authHeader(adminToken));
    expect(platformRoutesRes.status).toBe(200);
    expect(platformRoutesRes.body.total).toBe(2);

    const approveRouteRes = await request(app)
      .put(`/api/admin/platform-routes/${routeId}/approve`)
      .set(authHeader(adminToken))
      .send({});
    expect(approveRouteRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM climbing_routes WHERE id = ?').get(routeId).status).toBe('active');

    const rejectRouteRes = await request(app)
      .put(`/api/admin/platform-routes/${rejectRouteId}/reject`)
      .set(authHeader(adminToken))
      .send({});
    expect(rejectRouteRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM climbing_routes WHERE id = ?').get(rejectRouteId).status).toBe('rejected');

    const createCodesRes = await request(app)
      .post('/api/admin/invite-codes')
      .set(authHeader(adminToken))
      .send({ count: 2, max_uses: 3, expires_at: '2030-01-01T00:00:00.000Z' });
    expect(createCodesRes.status).toBe(200);
    expect(createCodesRes.body.codes).toHaveLength(2);

    const listCodesRes = await request(app)
      .get('/api/admin/invite-codes')
      .set(authHeader(adminToken));
    expect(listCodesRes.status).toBe(200);
    expect(listCodesRes.body.total).toBe(2);

    const deleteCodeRes = await request(app)
      .delete(`/api/admin/invite-codes/${listCodesRes.body.codes[0].id}`)
      .set(authHeader(adminToken));
    expect(deleteCodeRes.status).toBe(200);

    const listAfterDeleteRes = await request(app)
      .get('/api/admin/invite-codes')
      .set(authHeader(adminToken));
    expect(listAfterDeleteRes.body.total).toBe(1);
  });

  test('supports merchant suspension by application id, note-based commercial review, and SOS admin routes', async () => {
    const guideUser = createTestUser(db, { phone: '13800003001', name: '暂停向导' });
    const clubUser = createTestUser(db, { phone: '13800003002', name: '暂停俱乐部用户' });

    db.prepare(`INSERT INTO guides (user_id, name, region, status) VALUES (?, ?, ?, ?)`)
      .run(guideUser.id, '待暂停向导', 'cn', 'active');
    db.prepare(`INSERT INTO clubs (name, description, creator_id, region, status) VALUES (?, ?, ?, ?, ?)`)
      .run('待暂停俱乐部', 'desc', clubUser.id, 'cn', 'active');

    const guideAppId = db.prepare(`INSERT INTO guide_applications (user_id, name, region, status) VALUES (?, ?, ?, ?)`)
      .run(guideUser.id, '待暂停向导申请', 'cn', 'approved_pending_payment').lastInsertRowid;
    const clubAppId = db.prepare(`INSERT INTO club_applications (user_id, club_name, region, status) VALUES (?, ?, ?, ?)`)
      .run(clubUser.id, '待暂停俱乐部申请', 'cn', 'approved_pending_payment').lastInsertRowid;

    const suspendGuideRes = await request(app)
      .put(`/api/admin/merchants/${guideAppId}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'suspended' });
    expect(suspendGuideRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM guides WHERE user_id = ?').get(guideUser.id).status).toBe('suspended');

    const suspendClubRes = await request(app)
      .put(`/api/admin/merchants/${clubAppId}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'suspended' });
    expect(suspendClubRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM clubs WHERE creator_id = ?').get(clubUser.id).status).toBe('suspended');

    const clubCommercialId = db.prepare(`
      INSERT INTO clubs (name, description, creator_id, region, status, commercial_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('商业俱乐部', 'desc', clubUser.id, 'cn', 'active', 'pending').lastInsertRowid;
    const guideCommercialId = db.prepare(`
      INSERT INTO guides (user_id, name, region, status, commercial_status)
      VALUES (?, ?, ?, ?, ?)
    `).run(guideUser.id, '商业向导', 'cn', 'active', 'pending').lastInsertRowid;

    const clubCommercialRes = await request(app)
      .post(`/api/admin/clubs/${clubCommercialId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'need_info', note: '请补充营业执照' });
    expect(clubCommercialRes.status).toBe(200);
    expect(db.prepare('SELECT commercial_status, commercial_reject_reason FROM clubs WHERE id = ?').get(clubCommercialId))
      .toEqual(expect.objectContaining({ commercial_status: 'need_info', commercial_reject_reason: '请补充营业执照' }));

    const guideCommercialRes = await request(app)
      .post(`/api/admin/guides/${guideCommercialId}/commercial-review`)
      .set(authHeader(adminToken))
      .send({ action: 'reject', note: '请补充保险材料' });
    expect(guideCommercialRes.status).toBe(200);
    expect(db.prepare('SELECT commercial_status, commercial_reject_reason FROM guides WHERE id = ?').get(guideCommercialId))
      .toEqual(expect.objectContaining({ commercial_status: 'rejected', commercial_reject_reason: '请补充保险材料' }));

    const alertId = db.prepare(`
      INSERT INTO sos_alerts (user_id, lat, lng, accuracy, timestamp, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guideUser.id, 30.12345, 103.54321, 12.5, new Date().toISOString(), '13800003001').lastInsertRowid;

    const sosListRes = await request(app)
      .get('/api/admin/sos-records?page=1&limit=20')
      .set(authHeader(adminToken));
    expect(sosListRes.status).toBe(200);
    expect(sosListRes.body.records.some((record) => Number(record.id) === Number(alertId))).toBe(true);

    const sosUpdateRes = await request(app)
      .put(`/api/admin/sos-records/${alertId}/status`)
      .set(authHeader(adminToken))
      .send({ status: 'resolved' });
    expect(sosUpdateRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM sos_alerts WHERE id = ?').get(alertId).status).toBe('resolved');
  });

  test('supports admin message center and broadcast notifications', async () => {
    const user = createTestUser(db, { phone: '13800002001', name: '工单用户' });

    db.exec(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        subject TEXT,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        content TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const ticketId = db.prepare(`
      INSERT INTO support_tickets (user_id, subject, content, status, priority)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, '无法支付', '订单支付失败', 'open', 'high').lastInsertRowid;
    db.prepare(`
      INSERT INTO ticket_replies (ticket_id, sender_type, sender_id, content, is_read)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticketId, 'user', String(user.id), '请尽快处理', 0);

    const unreadRes = await request(app)
      .get('/api/admin/messages/unread-count')
      .set(authHeader(adminToken));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBe(1);

    const listRes = await request(app)
      .get('/api/admin/messages?status=open&page=1&limit=20')
      .set(authHeader(adminToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.tickets[0].subject).toBe('无法支付');

    const detailRes = await request(app)
      .get(`/api/admin/messages/${ticketId}`)
      .set(authHeader(adminToken));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.replies).toHaveLength(1);
    expect(db.prepare('SELECT is_read FROM ticket_replies WHERE ticket_id = ?').get(ticketId).is_read).toBe(1);

    const replyRes = await request(app)
      .post(`/api/admin/messages/${ticketId}/reply`)
      .set(authHeader(adminToken))
      .send({ content: '我们已处理，请重试。' });
    expect(replyRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM support_tickets WHERE id = ?').get(ticketId).status).toBe('replied');

    const closeRes = await request(app)
      .put(`/api/admin/messages/${ticketId}/close`)
      .set(authHeader(adminToken))
      .send({});
    expect(closeRes.status).toBe(200);
    expect(db.prepare('SELECT status FROM support_tickets WHERE id = ?').get(ticketId).status).toBe('closed');

    const broadcastRes = await request(app)
      .post('/api/admin/broadcast')
      .set(authHeader(adminToken))
      .send({ title: '系统维护', content: '今晚 22:00 维护', user_ids: [user.id] });
    expect(broadcastRes.status).toBe(200);
    expect(broadcastRes.body.sent).toBe(1);
    expect(db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = 'system_broadcast'`).get(user.id).c).toBe(1);
  });
});
