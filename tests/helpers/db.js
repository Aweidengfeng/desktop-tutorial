/**
 * 测试数据库辅助工具
 * 每次调用 createTestDb() 可重置内存数据库并返回 db 实例
 */

const path = require('path');

/**
 * 清除已缓存的 backend/db/database 模块，
 * 让下一次 require 重新初始化（使用新的 DATABASE_PATH）。
 */
function clearDbCache() {
  // 清除所有可能缓存了数据库路径的模块
  const keysToDelete = [];
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes('backend/db') ||
      key.includes('backend/routes') ||
      key.includes('backend/middleware') ||
      key.includes('backend/utils') ||
      key.includes('backend\\db') ||
      key.includes('backend\\routes') ||
      key.includes('backend\\middleware') ||
      key.includes('backend\\utils')
    ) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    delete require.cache[key];
  }
}

/**
 * 创建一个独立的测试 SQLite 数据库（in-memory 或临时文件），
 * 并返回数据库实例和创建好的 Express app。
 */
function createTestDb() {
  // 使用 in-memory 数据库，每次 require 都是全新的
  const tmpPath = ':memory:';
  process.env.DATABASE_PATH = tmpPath;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-summitlink';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';
  process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  process.env.NODE_ENV = 'test';

  clearDbCache();

  const db = require('../../backend/db/database');
  return db;
}

module.exports = { createTestDb, clearDbCache };
