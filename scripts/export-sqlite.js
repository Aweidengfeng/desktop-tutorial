#!/usr/bin/env node
/**
 * SQLite 数据导出脚本（用于 Phase 1 PostgreSQL 迁移）
 * 用法：node scripts/export-sqlite.js > backup-YYYYMMDD.json
 *
 * 可选环境变量：
 *   DATABASE_PATH — SQLite 文件路径，默认为 backend/summitlink.db
 *
 * 示例：
 *   node scripts/export-sqlite.js > backup-$(date +%Y%m%d).json
 *   DATABASE_PATH=/data/summitlink.db node scripts/export-sqlite.js > backup.json
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../backend/summitlink.db');

let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.error('无法打开数据库:', e.message);
  console.error('请确认 DATABASE_PATH 指向正确的 SQLite 文件，或在 backend/ 目录中存在 summitlink.db');
  process.exit(1);
}

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type='table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '_prisma_%'
     ORDER BY name`
  )
  .all()
  .map((r) => r.name);

const backup = { _meta: { exportedAt: new Date().toISOString(), tables: [] } };

for (const table of tables) {
  try {
    backup[table] = db.prepare(`SELECT * FROM ${table}`).all();
    backup._meta.tables.push({ name: table, rows: backup[table].length });
  } catch (e) {
    backup[table] = [];
    backup._meta.tables.push({ name: table, rows: 0, error: e.message });
  }
}

db.close();

console.log(JSON.stringify(backup, null, 2));
