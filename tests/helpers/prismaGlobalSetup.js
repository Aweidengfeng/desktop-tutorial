/**
 * Jest 全局 setup：在所有测试运行前，删除旧的测试 SQLite 文件。
 * 表结构由 backend/db/database.js（better-sqlite3）在首次 require 时自动创建；
 * Prisma 连接到同一个文件并复用这些表（通过 @map() 列名对齐）。
 */

const fs = require('fs');

module.exports = async function globalSetup() {
  // 保持既有测试用例行为：默认开启支付能力（生产默认仍由代码控制为 false）
  process.env.PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED || 'true';
  const dbPath = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
  // 删除旧的测试数据库，确保每次 CI 从干净状态开始
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  // 表结构由 backend/db/database.js 在首次 require 时创建；Prisma 复用同一文件
  console.log('✅ Test DB reset (will be initialized by database.js on first require):', dbPath);
};
