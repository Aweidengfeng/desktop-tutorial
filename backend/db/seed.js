/**
 * seed.js — 数据库种子数据入口
 *
 * Phase 1.1: 已迁移到 Prisma Client（不再使用 better-sqlite3）。
 * 通过 seed-prisma.js 执行实际的种子数据逻辑。
 *
 * SEED_ON_START 开关由 seed-prisma.js 内部控制，
 * 未设为 true 时直接跳过并 exit(0)。
 */
require('./seed-prisma');
