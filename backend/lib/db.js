const { PrismaClient } = require('@prisma/client');
const { getDatabaseUrl } = require('./region');

const prismaClients = new Map();

function getNormalizedRegion(region) {
  return region === 'cn' ? 'cn' : 'us';
}

function getDefaultRegion() {
  const raw = String(process.env.REGION || process.env.DEPLOY_REGION || '').toLowerCase();
  return raw.startsWith('cn') ? 'cn' : 'us';
}

function createPrismaClient(url) {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
  });
}

function getPrismaClient(region) {
  const normalizedRegion = getNormalizedRegion(region || getDefaultRegion());
  let databaseUrl = getDatabaseUrl(normalizedRegion) || process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      databaseUrl = 'file:/tmp/summitlink.db';
    } else {
      throw new Error('DATABASE_URL is not configured');
    }
  }

  const cacheKey = `${normalizedRegion}:${databaseUrl}`;
  if (!prismaClients.has(cacheKey)) {
    prismaClients.set(cacheKey, createPrismaClient(databaseUrl));
  }
  return prismaClients.get(cacheKey);
}

async function __clearPrismaClientCacheForTests() {
  const clients = Array.from(prismaClients.values());
  prismaClients.clear();
  await Promise.all(clients.map((client) => client.$disconnect().catch(() => {})));
}

module.exports = {
  getPrismaClient,
  getDefaultRegion,
  __clearPrismaClientCacheForTests,
};
