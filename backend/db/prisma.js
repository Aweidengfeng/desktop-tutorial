/**
 * Prisma Client 单例
 *
 * 用法：
 *   const prisma = require('./prisma');
 *   const user = await prisma.user.findUnique({ where: { id } });
 *
 * 环境变量（.env 或 Railway 设置）：
 *   DATABASE_URL="file:./dev.db"          ← 开发/测试（SQLite）
 *   DATABASE_URL="postgresql://..."       ← 生产（配合将 schema.prisma provider 改为 postgresql）
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['warn', 'error']
      : process.env.NODE_ENV === 'test'
        ? []
        : ['query', 'warn', 'error'],
  });

  // Verify the connection is usable and log a clear message on failure.
  // This runs asynchronously so it never blocks module load or crashes the process.
  client.$connect()
    .then(() => {
      console.log('✅ Prisma connected to database');
    })
    .catch((err) => {
      console.error(
        '⚠️  Prisma failed to connect to database (will retry on first query):',
        err.message
      );
      // Prisma will automatically retry on the next query — no process.exit here
      // so the app can still start and serve non-database routes (e.g. /health).
    });

  return client;
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  // 开发/测试环境：复用全局单例，避免热重载时连接泄漏
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;
