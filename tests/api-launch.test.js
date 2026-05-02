process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createApp } = require('./helpers/testApp');

let app;

beforeEach(() => {
  app = createApp();
});

describe('Global launch API', () => {
  test('GET /api/launch/global-climbing returns launch program collections and timeline', async () => {
    const res = await request(app).get('/api/launch/global-climbing');
    expect(res.status).toBe(200);
    expect(res.body.selectionSize).toBe(20);
    expect(res.body.collections.sevenSummits).toHaveLength(7);
    expect(res.body.collections.eightThousanders).toHaveLength(14);
    expect(res.body.collections.commercialDestinations.length).toBeGreaterThanOrEqual(10);
    expect(res.body.timeline.map(item => item.period)).toContain('6月1日-8月30日');
  });

  test('POST /api/launch/applications accepts climber application with risk consent', async () => {
    const res = await request(app)
      .post('/api/launch/applications')
      .send({
        type: 'climber',
        name: 'Test Climber',
        contact: 'climber@example.com',
        nationality: 'China',
        experience: 'Has climbed 5000m peaks',
        target: 'Seven Summits',
        agreedRisk: true,
        budgetConfirmed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.application.type).toBe('climber');
    expect(res.body.application.status).toBe('received');
  });

  test('POST /api/launch/applications requires risk consent for climbers', async () => {
    const res = await request(app)
      .post('/api/launch/applications')
      .send({ type: 'climber', name: 'No Consent', contact: 'test@example.com' });

    expect(res.status).toBe(400);
  });

  test('POST /api/launch/applications accepts provider recruiting application', async () => {
    const res = await request(app)
      .post('/api/launch/applications')
      .send({
        type: 'provider',
        name: 'Seven Summits Operator',
        contact: 'ops@example.com',
        services: ['Everest', 'Aconcagua'],
        notes: 'Licensed provider',
      });

    expect(res.status).toBe(201);
    expect(res.body.application.type).toBe('provider');
  });
});
