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

const { getPrismaClient, getDefaultRegion } = require('../lib/db');

const defaultRegion = getDefaultRegion();
const prisma = getPrismaClient(defaultRegion);

module.exports = prisma;
module.exports.getPrismaClient = getPrismaClient;
