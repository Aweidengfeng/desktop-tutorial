/**
 * Jest 全局 setup：在所有测试运行前，删除旧的测试 SQLite 文件。
 * 表结构由 backend/db/database.js（better-sqlite3）在首次 require 时自动创建；
 * Prisma 连接到同一个文件并复用这些表（通过 @map() 列名对齐）。
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  // 保持既有测试用例行为：默认开启支付能力（生产默认仍由代码控制为 false）
  process.env.PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED || 'true';
  const dbPath = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
  // 删除旧的测试数据库，确保每次 CI 从干净状态开始
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const prevDatabasePath = process.env.DATABASE_PATH;
  const prevDatabaseUrl = process.env.DATABASE_URL;
  const prevDatabaseProvider = process.env.DATABASE_PROVIDER;
  const databaseModulePath = path.resolve(__dirname, '../../backend/db/database');
  const prismaModulePath = path.resolve(__dirname, '../../backend/db/prisma');
  const migrationsModulePath = path.resolve(__dirname, '../../backend/db/migrations');
  let db = null;
  let prisma = null;
  try {
    process.env.DATABASE_PATH = dbPath;
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

    // 在测试开始前先创建基础表结构，再应用与生产启动一致的 schema patch
    db = require(databaseModulePath);
    prisma = require(prismaModulePath);
    const { runStartupMigrations } = require(migrationsModulePath);
    await runStartupMigrations(prisma);
  } finally {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
    if (db && typeof db.close === 'function') {
      db.close();
    }
    for (const modulePath of [databaseModulePath, prismaModulePath, migrationsModulePath]) {
      try {
        delete require.cache[require.resolve(modulePath)];
      } catch (e) {}
    }
    if (typeof prevDatabasePath === 'undefined') delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevDatabasePath;
    if (typeof prevDatabaseUrl === 'undefined') delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDatabaseUrl;
    if (typeof prevDatabaseProvider === 'undefined') delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = prevDatabaseProvider;
  }

  console.log('✅ Test DB reset and startup migrations applied:', dbPath);
};
