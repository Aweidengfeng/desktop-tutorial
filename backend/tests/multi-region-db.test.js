describe('multi-region prisma client factory', () => {
  const originalEnv = { ...process.env };

  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('returns different clients for cn/us when URLs differ', async () => {
    let instanceCounter = 0;
    const disconnectMock = jest.fn().mockResolvedValue();
    const PrismaClientMock = jest.fn().mockImplementation((options = {}) => ({
      __instanceId: ++instanceCounter,
      __options: options,
      $disconnect: disconnectMock,
    }));

    jest.doMock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));
    process.env.DATABASE_URL = 'file:/tmp/default.db';
    process.env.DATABASE_URL_CN = 'file:/tmp/cn.db';
    process.env.DATABASE_URL_US = 'file:/tmp/us.db';

    const { getPrismaClient, __clearPrismaClientCacheForTests } = require('../lib/db');
    const cnClient = getPrismaClient('cn');
    const usClient = getPrismaClient('us');
    const cnClientAgain = getPrismaClient('cn');

    expect(cnClient).not.toBe(usClient);
    expect(cnClientAgain).toBe(cnClient);
    expect(PrismaClientMock).toHaveBeenCalledTimes(2);
    expect(PrismaClientMock.mock.calls[0][0].datasources.db.url).toBe('file:/tmp/cn.db');
    expect(PrismaClientMock.mock.calls[1][0].datasources.db.url).toBe('file:/tmp/us.db');

    await __clearPrismaClientCacheForTests();
    expect(disconnectMock).toHaveBeenCalledTimes(2);
  });

  test('cn falls back to DATABASE_URL when DATABASE_URL_CN is not set', () => {
    const PrismaClientMock = jest.fn().mockImplementation((options = {}) => ({
      __options: options,
      $disconnect: jest.fn().mockResolvedValue(),
    }));
    jest.doMock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));

    process.env.DATABASE_URL = 'file:/tmp/default.db';
    delete process.env.DATABASE_URL_CN;
    delete process.env.DATABASE_URL_US;

    const { getPrismaClient } = require('../lib/db');
    getPrismaClient('cn');
    getPrismaClient('us');

    expect(PrismaClientMock.mock.calls[0][0].datasources.db.url).toBe('file:/tmp/default.db');
    expect(PrismaClientMock.mock.calls[1][0].datasources.db.url).toBe('file:/tmp/default.db');
  });

  test('both regions use DATABASE_URL fallback when region-specific urls are unset', () => {
    const PrismaClientMock = jest.fn().mockImplementation((options = {}) => ({
      __options: options,
      $disconnect: jest.fn().mockResolvedValue(),
    }));
    jest.doMock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));

    process.env.DATABASE_URL = 'file:/tmp/shared.db';
    delete process.env.DATABASE_URL_CN;
    delete process.env.DATABASE_URL_US;

    const { getPrismaClient } = require('../lib/db');
    getPrismaClient('cn');
    getPrismaClient('us');

    expect(PrismaClientMock.mock.calls[0][0].datasources.db.url).toBe('file:/tmp/shared.db');
    expect(PrismaClientMock.mock.calls[1][0].datasources.db.url).toBe('file:/tmp/shared.db');
  });
});
