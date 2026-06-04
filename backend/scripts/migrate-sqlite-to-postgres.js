#!/usr/bin/env node
/**
 * migrate-sqlite-to-postgres.js
 * ------------------------------------------------------------------
 * 将现有 SQLite 数据库的全部业务数据迁移到一个**已经建好表结构**的
 * PostgreSQL 数据库（表结构由 `prisma migrate deploy` 预先创建）。
 *
 * 设计原则（对应迁移要求）：
 *   1. 保留 SQLite 作为回滚库 —— 本脚本以只读方式打开 SQLite，绝不写源库。
 *   2. 不覆盖现有数据 —— 默认情况下，若任一目标表已有数据则中止；
 *      不会执行 TRUNCATE / DROP。仅在显式 FORCE_LOAD=1 时才允许向
 *      非空表追加（不推荐，仅用于断点续传场景）。
 *   3. 不使用 `prisma db push --accept-data-loss`。表结构迁移由
 *      `prisma migrate deploy` 完成，本脚本只负责数据搬运。
 *
 * 工作方式：
 *   - 源：better-sqlite3（只读）。逐表读取全部行。
 *   - 目标：Prisma Client（provider=postgresql）。通过 information_schema
 *     自省每列的真实类型，对布尔 / 时间戳等做类型自适应转换后批量插入。
 *   - 外键顺序：采用「多轮重试」策略——插入失败（多为外键依赖未就绪）
 *     的行会在后续轮次重试，直到不再有进展为止，无需手工维护拓扑顺序。
 *   - 自增序列：数据导入后，对整型自增主键执行 setval 修正，避免后续
 *     新写入主键冲突。
 *
 * 环境变量：
 *   DATABASE_URL        PostgreSQL 连接串（postgresql://...），必填
 *   DATABASE_PROVIDER   必须为 postgresql（安全校验）
 *   SQLITE_PATH         源 SQLite 文件，默认 backend/summitlink.db
 *   DRY_RUN=1           只读取源库并打印每表行数，不连接 / 写入 PG
 *   FORCE_LOAD=1        允许向已有数据的目标表追加（默认禁止）
 *   BATCH_SIZE          单条 INSERT 的行数，默认 200
 *
 * 用法：
 *   # 演练：仅统计源库行数
 *   DRY_RUN=1 SQLITE_PATH=/data/summitlink.db node backend/scripts/migrate-sqlite-to-postgres.js
 *
 *   # 正式迁移（PG 表结构须已由 prisma migrate deploy 建好）
 *   DATABASE_PROVIDER=postgresql \
 *   DATABASE_URL="******host:5432/summitlink" \
 *   SQLITE_PATH=/data/summitlink.db \
 *   node backend/scripts/migrate-sqlite-to-postgres.js
 */

const path = require('path');
const Database = require('better-sqlite3');

const SQLITE_PATH =
  process.env.SQLITE_PATH ||
  process.env.DATABASE_PATH ||
  path.join(__dirname, '..', 'summitlink.db');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const FORCE_LOAD = process.env.FORCE_LOAD === '1' || process.env.FORCE_LOAD === 'true';
const BATCH_SIZE = Math.max(1, parseInt(process.env.BATCH_SIZE || '200', 10));

function log(...args) {
  console.log('[migrate]', ...args);
}

function openSqlite() {
  try {
    return new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  } catch (e) {
    console.error(`[migrate] 无法以只读方式打开 SQLite: ${SQLITE_PATH}`);
    console.error('         ', e.message);
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

function readTableRows(db, table) {
  return db.prepare(`SELECT * FROM "${table}"`).all();
}

/**
 * 自省 PostgreSQL 中目标表的列类型，返回 { columnName: data_type }
 */
async function introspectPgColumns(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    table
  );
  const map = {};
  for (const r of rows) map[r.column_name] = String(r.data_type).toLowerCase();
  return map;
}

/**
 * 根据 PG 列类型，把 SQLite 取出的原始值转换为 PG 可接受的 JS 值。
 */
function coerceValue(value, pgType) {
  if (value === null || value === undefined) return null;

  if (pgType === 'boolean') {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    const s = String(value).toLowerCase();
    if (s === 'true' || s === 't') return true;
    if (s === 'false' || s === 'f') return false;
    return Boolean(value);
  }

  if (
    pgType === 'timestamp without time zone' ||
    pgType === 'timestamp with time zone' ||
    pgType === 'date'
  ) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      // SQLite 可能以 epoch 秒或毫秒存储
      const ms = value > 1e12 ? value : value * 1000;
      return new Date(ms);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d;
  }

  if (
    pgType === 'integer' ||
    pgType === 'bigint' ||
    pgType === 'smallint' ||
    pgType === 'numeric' ||
    pgType === 'double precision' ||
    pgType === 'real'
  ) {
    if (typeof value === 'number') return value;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }

  if (pgType === 'json' || pgType === 'jsonb') {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  // text / varchar / uuid / 其它
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return value;
}

function buildInsertSql(table, columns, rowsChunk) {
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const valuesSql = [];
  const params = [];
  let p = 1;
  for (const row of rowsChunk) {
    const placeholders = columns.map(() => `$${p++}`);
    valuesSql.push(`(${placeholders.join(', ')})`);
    for (const c of columns) params.push(row[c]);
  }
  const sql = `INSERT INTO "${table}" (${cols}) VALUES ${valuesSql.join(', ')}`;
  return { sql, params };
}

/**
 * 把单个表的所有行插入 PG。返回成功插入的行数与失败的行（用于多轮重试）。
 */
async function insertRows(prisma, table, columns, rows) {
  let inserted = 0;
  const failed = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      const { sql, params } = buildInsertSql(table, columns, chunk);
      await prisma.$executeRawUnsafe(sql, ...params);
      inserted += chunk.length;
    } catch (_) {
      // 批量失败时退化为逐行插入，区分「外键暂未就绪」与「真实错误」
      for (const row of chunk) {
        try {
          const { sql, params } = buildInsertSql(table, columns, [row]);
          await prisma.$executeRawUnsafe(sql, ...params);
          inserted += 1;
        } catch (rowErr) {
          failed.push({ row, error: rowErr.message });
        }
      }
    }
  }
  return { inserted, failed };
}

async function fixSequence(prisma, table) {
  try {
    // 仅对存在整型自增主键 id 的表生效；pg_get_serial_sequence 对非序列列返回 NULL
    await prisma.$executeRawUnsafe(
      `SELECT setval(
         pg_get_serial_sequence('"${table}"', 'id'),
         GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${table}"), 1),
         (SELECT COUNT(*) > 0 FROM "${table}")
       )
       WHERE pg_get_serial_sequence('"${table}"', 'id') IS NOT NULL`
    );
  } catch (_) {
    // 无 id 列或非整型主键，跳过
  }
}

async function main() {
  const db = openSqlite();
  const tables = listSqliteTables(db);
  log(`源 SQLite: ${SQLITE_PATH}`);
  log(`发现 ${tables.length} 张业务表`);

  // 读取源库每表行数与数据
  const source = {};
  const beforeCounts = {};
  for (const t of tables) {
    const rows = readTableRows(db, t);
    source[t] = rows;
    beforeCounts[t] = rows.length;
  }
  db.close();

  if (DRY_RUN) {
    log('DRY_RUN —— 仅打印源库行数：');
    printCountTable(beforeCounts, beforeCounts);
    log('DRY_RUN 完成，未连接 PostgreSQL。');
    return;
  }

  // 安全校验：必须显式指向 PostgreSQL
  const url = process.env.DATABASE_URL || '';
  const provider = (process.env.DATABASE_PROVIDER || '').toLowerCase();
  if (provider !== 'postgresql' || !/^postgres(ql)?:\/\//.test(url)) {
    console.error('[migrate] 安全中止：需要 DATABASE_PROVIDER=postgresql 且 DATABASE_URL 为 postgresql:// 连接串。');
    console.error('[migrate] 当前 provider=%s url=%s', provider || '(空)', url ? '(已设置)' : '(空)');
    process.exit(1);
  }

  // 懒加载 Prisma（须先以 PG provider 生成客户端）
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 不覆盖校验：任一目标表非空则中止（除非 FORCE_LOAD）
    const afterCountsBefore = {};
    let nonEmpty = [];
    for (const t of tables) {
      let count = 0;
      try {
        const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
        count = r && r[0] ? Number(r[0].c) : 0;
      } catch (_) {
        // 目标表不存在 —— 说明 migrate deploy 未建该表，记为 -1 并跳过
        count = -1;
      }
      afterCountsBefore[t] = count;
      if (count > 0) nonEmpty.push(`${t}(${count})`);
    }

    if (nonEmpty.length && !FORCE_LOAD) {
      console.error('[migrate] 安全中止：以下目标表已存在数据，拒绝覆盖：');
      console.error('          ' + nonEmpty.join(', '));
      console.error('[migrate] 如确需向非空表追加，请显式设置 FORCE_LOAD=1（不推荐）。');
      process.exit(2);
    }

    // 多轮插入，自动解决外键依赖顺序
    const pending = {};
    const columnsByTable = {};
    for (const t of tables) {
      if (afterCountsBefore[t] === -1) {
        log(`跳过：PG 中不存在表 ${t}（migrate deploy 未建该表）`);
        continue;
      }
      const pgCols = await introspectPgColumns(prisma, t);
      const cols = Object.keys(pgCols);
      columnsByTable[t] = cols;
      // 仅迁移源表与目标表共有的列；按 PG 类型转换每个值
      const rows = source[t].map((row) => {
        const out = {};
        for (const c of cols) {
          if (Object.prototype.hasOwnProperty.call(row, c)) {
            out[c] = coerceValue(row[c], pgCols[c]);
          }
        }
        return out;
      });
      pending[t] = rows;
    }

    const insertedTotal = {};
    for (const t of Object.keys(pending)) insertedTotal[t] = 0;

    let pass = 0;
    let progress = true;
    while (progress) {
      pass += 1;
      progress = false;
      let remaining = 0;
      for (const t of Object.keys(pending)) {
        const rows = pending[t];
        if (!rows.length) continue;
        const { inserted, failed } = await insertRows(prisma, t, columnsByTable[t], rows);
        if (inserted > 0) {
          progress = true;
          insertedTotal[t] += inserted;
        }
        pending[t] = failed.map((f) => f.row);
        remaining += pending[t].length;
        pending[`__err_${t}`] = failed;
      }
      log(`第 ${pass} 轮插入完成，剩余待插入行：${remaining}`);
      if (remaining === 0) break;
      if (pass > 20) {
        log('已达最大重试轮数（20），停止重试。');
        break;
      }
    }

    // 修正自增序列
    for (const t of Object.keys(columnsByTable)) {
      await fixSequence(prisma, t);
    }

    // 统计目标库最终行数
    const afterCounts = {};
    for (const t of tables) {
      if (afterCountsBefore[t] === -1) {
        afterCounts[t] = -1;
        continue;
      }
      const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      afterCounts[t] = r && r[0] ? Number(r[0].c) : 0;
    }

    log('迁移前后行数对比（SQLite → PostgreSQL）：');
    printCountTable(beforeCounts, afterCounts);

    // 报告失败行
    let hadFailures = false;
    for (const t of tables) {
      const errs = pending[`__err_${t}`];
      if (errs && errs.length) {
        hadFailures = true;
        console.error(`[migrate] 表 ${t} 有 ${errs.length} 行最终插入失败，示例错误：`);
        console.error('          ', errs[0].error);
      }
    }

    if (hadFailures) {
      console.error('[migrate] 迁移完成但存在失败行，请检查上述错误后再切换流量。');
      process.exit(3);
    }
    log('✅ 数据迁移完成，无失败行。');
  } finally {
    await prisma.$disconnect();
  }
}

function printCountTable(before, after) {
  const names = Object.keys(before).sort();
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log('  ' + pad('table', 32) + padL('sqlite', 10) + padL('postgres', 12) + '  status');
  console.log('  ' + '-'.repeat(66));
  let totalBefore = 0;
  let totalAfter = 0;
  for (const t of names) {
    const b = before[t];
    const a = after[t];
    totalBefore += b > 0 ? b : 0;
    if (a > 0) totalAfter += a;
    let status = 'OK';
    if (a === -1) status = 'MISSING(PG无此表)';
    else if (a !== b) status = `MISMATCH(差 ${a - b})`;
    console.log('  ' + pad(t, 32) + padL(b, 10) + padL(a === -1 ? '-' : a, 12) + '  ' + status);
  }
  console.log('  ' + '-'.repeat(66));
  console.log('  ' + pad('TOTAL', 32) + padL(totalBefore, 10) + padL(totalAfter, 12));
}

main().catch((e) => {
  console.error('[migrate] 迁移异常终止：', e);
  process.exit(1);
});
