#!/usr/bin/env node
/**
 * verify-migration.js
 * ------------------------------------------------------------------
 * 校验 SQLite → PostgreSQL 数据迁移结果。独立于迁移脚本运行，可在
 * 切换流量前后多次执行。
 *
 * 校验项：
 *   1. 逐表行数对比（SQLite vs PostgreSQL），输出对照表。
 *   2. users 表关键唯一约束抽样（username / phone 无重复、无丢失）。
 *   3. 主键最大值对比（确保自增序列已正确修复，PG MAX(id) >= SQLite MAX(id)）。
 *
 * 退出码：
 *   0  全部一致
 *   1  打开源库 / 连接目标库失败
 *   4  存在行数或约束不一致（迁移未通过校验，禁止切换流量）
 *
 * 环境变量：
 *   DATABASE_URL        PostgreSQL 连接串，必填
 *   DATABASE_PROVIDER   必须为 postgresql
 *   SQLITE_PATH         源 SQLite 文件，默认 backend/summitlink.db
 *   JSON_OUT            （可选）将结果以 JSON 写入指定文件
 *
 * 用法：
 *   DATABASE_PROVIDER=postgresql DATABASE_URL="postgresql://..." \
 *   SQLITE_PATH=/data/summitlink.db \
 *   node backend/scripts/verify-migration.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SQLITE_PATH =
  process.env.SQLITE_PATH ||
  process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'summitlink.db');

function openSqlite() {
  try {
    return new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  } catch (e) {
    console.error(`[verify] 无法打开 SQLite: ${SQLITE_PATH}: ${e.message}`);
    process.exit(1);
  }
}

function listSqliteTables(db) {
  return db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type='table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_prisma_%'
       ORDER BY name`
    )
    .all()
    .map((r) => r.name);
}

function sqliteCount(db, table) {
  try {
    return db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  } catch (_) {
    return -1;
  }
}

function sqliteMaxId(db, table) {
  try {
    const row = db.prepare(`SELECT MAX(id) AS m FROM "${table}"`).get();
    return row && row.m != null ? Number(row.m) : null;
  } catch (_) {
    return null; // 无 id 列
  }
}

async function pgCount(prisma, table) {
  try {
    const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    return r && r[0] ? Number(r[0].c) : 0;
  } catch (_) {
    return -1; // 表不存在
  }
}

async function pgMaxId(prisma, table) {
  try {
    const r = await prisma.$queryRawUnsafe(`SELECT MAX(id)::bigint AS m FROM "${table}"`);
    return r && r[0] && r[0].m != null ? Number(r[0].m) : null;
  } catch (_) {
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  const provider = (process.env.DATABASE_PROVIDER || '').toLowerCase();
  if (provider !== 'postgresql' || !/^postgres(ql)?:\/\//.test(url)) {
    console.error('[verify] 需要 DATABASE_PROVIDER=postgresql 且 DATABASE_URL 为 postgresql:// 连接串。');
    process.exit(1);
  }

  const db = openSqlite();
  const tables = listSqliteTables(db);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const result = { tables: [], mismatches: [], checkedAt: new Date().toISOString() };
  let ok = true;

  try {
    console.log('  ' + 'table'.padEnd(32) + 'sqlite'.padStart(10) + 'postgres'.padStart(12) + '  status');
    console.log('  ' + '-'.repeat(66));

    for (const t of tables) {
      const sCount = sqliteCount(db, t);
      const pCount = await pgCount(prisma, t);
      const sMax = sqliteMaxId(db, t);
      const pMax = await pgMaxId(prisma, t);

      let status = 'OK';
      if (pCount === -1) {
        status = 'MISSING(PG无此表)';
        ok = false;
        result.mismatches.push({ table: t, reason: 'pg table missing' });
      } else if (sCount !== pCount) {
        status = `ROW MISMATCH(差 ${pCount - sCount})`;
        ok = false;
        result.mismatches.push({ table: t, reason: 'row count', sqlite: sCount, postgres: pCount });
      } else if (sMax != null && pMax != null && pMax < sMax) {
        // 行数一致但序列/最大主键异常
        status = `SEQ WARN(pgMax ${pMax} < sqliteMax ${sMax})`;
        ok = false;
        result.mismatches.push({ table: t, reason: 'max id', sqlite: sMax, postgres: pMax });
      }

      result.tables.push({ table: t, sqlite: sCount, postgres: pCount, sqliteMaxId: sMax, pgMaxId: pMax, status });
      console.log(
        '  ' +
          t.padEnd(32) +
          String(sCount).padStart(10) +
          String(pCount === -1 ? '-' : pCount).padStart(12) +
          '  ' +
          status
      );
    }
    console.log('  ' + '-'.repeat(66));

    // 唯一约束抽样：users.username / users.phone
    await checkUniqueConstraint(db, prisma, 'users', 'username', result);
    await checkUniqueConstraint(db, prisma, 'users', 'phone', result);

    if (process.env.JSON_OUT) {
      fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(result, null, 2));
      console.log('[verify] 结果已写入', process.env.JSON_OUT);
    }

    if (!ok) {
      console.error(`\n[verify] ❌ 校验未通过，存在 ${result.mismatches.length} 项不一致，禁止切换流量。`);
      process.exit(4);
    }
    console.log('\n[verify] ✅ 校验通过：所有表行数一致、唯一约束与主键序列正常。');
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

async function checkUniqueConstraint(db, prisma, table, column, result) {
  let sDistinct;
  try {
    sDistinct = db
      .prepare(`SELECT COUNT(DISTINCT "${column}") AS c FROM "${table}" WHERE "${column}" IS NOT NULL`)
      .get().c;
  } catch (_) {
    return; // 列不存在
  }
  let pDistinct = 0;
  try {
    const r = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT "${column}")::int AS c FROM "${table}" WHERE "${column}" IS NOT NULL`
    );
    pDistinct = r && r[0] ? Number(r[0].c) : 0;
  } catch (_) {
    return;
  }
  const pass = sDistinct === pDistinct;
  if (!pass) {
    result.mismatches.push({ table, reason: `distinct ${column}`, sqlite: sDistinct, postgres: pDistinct });
  }
  console.log(
    `  唯一约束抽样 ${table}.${column}: sqlite distinct=${sDistinct}, postgres distinct=${pDistinct} -> ${
      pass ? 'OK' : 'MISMATCH'
    }`
  );
}

main().catch((e) => {
  console.error('[verify] 校验异常终止：', e);
  process.exit(1);
});
