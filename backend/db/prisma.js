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

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['warn', 'error'],
  });
} else {
  // 开发/测试环境：复用全局单例，避免热重载时连接泄漏
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'test' ? [] : ['query', 'warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

module.exports = prisma;
