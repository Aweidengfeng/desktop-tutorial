#!/usr/bin/env node
'use strict';

const { PrismaClient } = require('@prisma/client');

/**
 * 单一信息源：所有需要 unique 约束清洗的 (表, 列) 对。
 * 未来新增约束只需在此追加一行。
 */
const TARGETS = [
  { table: 'expedition_orders', column: 'order_no' },
  { table: 'activity_orders',   column: 'order_no' },
];

// Allowlist of valid SQL identifier characters (letters, digits, underscore)
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validates that a table/column name is a safe SQL identifier.
 * Prevents SQL injection if this pattern is reused with external input.
 */
function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER_RE.test(value)) {
    throw new Error(`Unsafe SQL identifier for ${label}: "${value}"`);
  }
}

// Backward-compat export (expedition_orders only)
const FIND_DUPLICATE_ROWS_SQL = buildDuplicateRowsSql('expedition_orders', 'order_no');

function buildDuplicateRowsSql(table, column) {
  assertSafeIdentifier(table, 'table');
  assertSafeIdentifier(column, 'column');
  return `
WITH ranked AS (
  SELECT
    id,
    ${column},
    created_at,
    ROW_NUMBER() OVER (PARTITION BY ${column} ORDER BY created_at ASC, id ASC) AS rn
  FROM ${table}
  WHERE ${column} IS NOT NULL AND ${column} <> ''
)
SELECT id, ${column} AS colValue, created_at AS createdAt, rn
FROM ranked
WHERE rn > 1
ORDER BY ${column} ASC, rn ASC, id ASC
`;
}

function isMissingTableError(error) {
  const message = String(error && error.message ? error.message : error || '');
  return (
    message.includes('does not exist') ||
    message.includes('no such table') ||
    /relation ".+" does not exist/.test(message)
  );
}

function summarizeDuplicateRows(rows) {
  const groupCount = new Set(rows.map((row) => row.colValue)).size;
  return {
    duplicateRows: rows.length,
    preservedOriginalRows: groupCount,
  };
}

/**
 * 对单张表清洗指定列的重复值。
 * 独立运行，不影响其他表。
 */
async function fixDuplicateForTarget({
  prisma,
  table,
  column,
  dryRun = false,
  sampleSize = 10,
  logger = console,
} = {}) {
  const tag = `[fix-duplicate-unique-columns] ${table}.${column}`;
  const sql = buildDuplicateRowsSql(table, column);

  let duplicateRows;
  try {
    duplicateRows = await prisma.$queryRawUnsafe(sql);
  } catch (error) {
    if (isMissingTableError(error)) {
      logger.log(`${tag}: 表不存在，跳过`);
      return { skipped: true, duplicateRows: 0, fixedRows: 0, preservedOriginalRows: 0 };
    }
    throw error;
  }

  const summary = summarizeDuplicateRows(duplicateRows);

  if (summary.duplicateRows === 0) {
    logger.log(`${tag}: 未发现重复，跳过`);
    return { skipped: false, duplicateRows: 0, fixedRows: 0, preservedOriginalRows: 0 };
  }

  const sample = duplicateRows.slice(0, sampleSize);
  logger.log(`${tag}: 发现 ${summary.duplicateRows} 行重复，涉及 ${summary.preservedOriginalRows} 组。`);
  if (sample.length > 0 && sampleSize > 0) {
    logger.log(`${tag}: 样本（最多前 ${sampleSize} 行）:`);
    logger.log(sample);
  }

  if (dryRun) {
    logger.log(`${tag}: dry-run 模式，不写入数据库。`);
    return {
      skipped: false,
      duplicateRows: summary.duplicateRows,
      fixedRows: 0,
      preservedOriginalRows: summary.preservedOriginalRows,
    };
  }

  const fixedRows = await prisma.$transaction(async (tx) => {
    let changes = 0;
    const rowsToFix = await tx.$queryRawUnsafe(sql);
    for (const row of rowsToFix) {
      const nextVal = `${row.colValue}-dup-${row.id}`;
      changes += await tx.$executeRawUnsafe(
        `UPDATE ${table} SET ${column} = ? WHERE id = ? AND ${column} = ?`,
        nextVal,
        row.id,
        row.colValue
      );
    }
    return changes;
  });

  logger.log(`${tag}: 已修复 ${fixedRows} 行，保留最早的 ${summary.preservedOriginalRows} 个原值。`);

  return {
    skipped: false,
    duplicateRows: summary.duplicateRows,
    fixedRows,
    preservedOriginalRows: summary.preservedOriginalRows,
  };
}

/**
 * 遍历 TARGETS，对每张表独立清洗。
 * 单表失败时 log warning 并继续处理其他表。
 */
async function fixAllTargets({
  prisma,
  dryRun = false,
  sampleSize = 10,
  logger = console,
} = {}) {
  const client = prisma || new PrismaClient();
  const shouldDisconnect = !prisma;
  const results = {};
  try {
    for (const { table, column } of TARGETS) {
      try {
        results[table] = await fixDuplicateForTarget({
          prisma: client,
          table,
          column,
          dryRun,
          sampleSize,
          logger,
        });
      } catch (err) {
        logger.warn
          ? logger.warn(`[fix-duplicate-unique-columns] ${table}: 清洗失败: ${err.message}`)
          : logger.log(`[fix-duplicate-unique-columns] ${table}: 清洗失败: ${err.message}`);
        results[table] = { error: err.message, skipped: false, duplicateRows: 0, fixedRows: 0, preservedOriginalRows: 0 };
      }
    }
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
  return results;
}

/**
 * 前置安全检查：对每个 TARGETS 中的 (table, column)：
 *   - 表不存在 → safe（全新部署）
 *   - 表存在且无重复 → safe
 *   - 表存在且有重复 → needs_cleanup
 *
 * 返回 { allSafe: bool, details: [{table, column, status, reason, rowCount}] }
 */
async function precheckUniqueConstraints({
  prisma,
  logger = console,
} = {}) {
  const client = prisma || new PrismaClient();
  const shouldDisconnect = !prisma;
  const details = [];
  try {
    for (const { table, column } of TARGETS) {
      try {
        assertSafeIdentifier(table, 'table');
        assertSafeIdentifier(column, 'column');
        const sql = `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${column} IN (SELECT ${column} FROM ${table} GROUP BY ${column} HAVING COUNT(*) > 1)`;
        const rows = await client.$queryRawUnsafe(sql);
        const cnt = Number(rows[0]?.cnt !== undefined ? rows[0].cnt : (rows[0]?.CNT !== undefined ? rows[0].CNT : 0));
        if (cnt === 0) {
          details.push({ table, column, status: 'safe', reason: 'no duplicates', rowCount: 0 });
          logger.log(`[precheck] ✅ ${table}.${column}: 无重复（安全）`);
        } else {
          details.push({ table, column, status: 'needs_cleanup', reason: 'has duplicates', rowCount: cnt });
          logger.log(`[precheck] ❌ ${table}.${column}: 仍有 ${cnt} 组重复（需要清洗）`);
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          details.push({ table, column, status: 'safe', reason: 'table does not exist', rowCount: 0 });
          logger.log(`[precheck] ✅ ${table}.${column}: 表不存在（全新部署，安全）`);
        } else {
          details.push({ table, column, status: 'error', reason: err.message, rowCount: -1 });
          logger.log(`[precheck] ⚠️ ${table}.${column}: 检查失败: ${err.message}`);
        }
      }
    }
    const allSafe = details.every((d) => d.status === 'safe');
    return { allSafe, details };
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

/**
 * Backward-compatible wrapper：仅清洗 expedition_orders.order_no。
 * 新代码请使用 fixAllTargets()。
 */
async function fixDuplicateOrderNo({
  prisma,
  dryRun = false,
  sampleSize = 10,
  logger = console,
} = {}) {
  const client = prisma || new PrismaClient();
  const shouldDisconnect = !prisma;
  try {
    return await fixDuplicateForTarget({
      prisma: client,
      table: 'expedition_orders',
      column: 'order_no',
      dryRun,
      sampleSize,
      logger,
    });
  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  let sampleSize = 10;
  for (const arg of argv) {
    if (arg.startsWith('--sample=')) {
      const parsed = Number.parseInt(arg.slice('--sample='.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) sampleSize = parsed;
    }
  }
  return { dryRun, sampleSize };
}

if (require.main === module) {
  const { dryRun, sampleSize } = parseArgs(process.argv.slice(2));
  fixAllTargets({ dryRun, sampleSize })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('[fix-duplicate-unique-columns] 执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  TARGETS,
  FIND_DUPLICATE_ROWS_SQL,
  buildDuplicateRowsSql,
  fixDuplicateForTarget,
  fixAllTargets,
  fixDuplicateOrderNo,
  precheckUniqueConstraints,
};
