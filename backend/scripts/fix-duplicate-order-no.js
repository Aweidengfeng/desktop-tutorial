#!/usr/bin/env node
'use strict';

const { PrismaClient } = require('@prisma/client');

const FIND_DUPLICATE_ROWS_SQL = `
WITH ranked AS (
  SELECT
    id,
    order_no,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY order_no ORDER BY created_at ASC, id ASC) AS rn
  FROM expedition_orders
  WHERE order_no IS NOT NULL AND order_no <> ''
)
SELECT id, order_no AS orderNo, created_at AS createdAt, rn
FROM ranked
WHERE rn > 1
ORDER BY order_no ASC, rn ASC, id ASC
`;

function isMissingTableError(error) {
  const message = String(error && error.message ? error.message : error || '');
  return (
    message.includes('does not exist') ||
    message.includes('no such table') ||
    message.includes('relation "expedition_orders"')
  );
}

function summarizeDuplicateRows(rows) {
  const groupCount = new Set(rows.map((row) => row.orderNo)).size;
  return {
    duplicateRows: rows.length,
    preservedOriginalRows: groupCount,
  };
}

async function fixDuplicateOrderNo({
  prisma,
  dryRun = false,
  sampleSize = 10,
  logger = console,
} = {}) {
  const client = prisma || new PrismaClient();
  const shouldDisconnect = !prisma;
  try {
    let duplicateRows;
    try {
      duplicateRows = await client.$queryRawUnsafe(FIND_DUPLICATE_ROWS_SQL);
    } catch (error) {
      if (isMissingTableError(error)) {
        logger.log('[fix-duplicate-order-no] 未找到 expedition_orders 表，跳过修复。');
        return {
          skipped: true,
          duplicateRows: 0,
          fixedRows: 0,
          preservedOriginalRows: 0,
        };
      }
      throw error;
    }

    const summary = summarizeDuplicateRows(duplicateRows);
    const sample = duplicateRows.slice(0, sampleSize);
    logger.log(
      `[fix-duplicate-order-no] dry-run：发现 ${summary.duplicateRows} 行重复 order_no，涉及 ${summary.preservedOriginalRows} 组。`
    );
    if (sample.length > 0) {
      logger.log(`[fix-duplicate-order-no] dry-run 样本（最多前 ${sampleSize} 行）:`);
      logger.log(sample);
    }

    if (summary.duplicateRows === 0) {
      logger.log('[fix-duplicate-order-no] 已检查 expedition_orders.order_no：未发现重复，跳过修复。');
      return {
        skipped: false,
        duplicateRows: 0,
        fixedRows: 0,
        preservedOriginalRows: 0,
      };
    }

    if (dryRun) {
      logger.log('[fix-duplicate-order-no] dry-run 模式，不写入数据库。');
      return {
        skipped: false,
        duplicateRows: summary.duplicateRows,
        fixedRows: 0,
        preservedOriginalRows: summary.preservedOriginalRows,
      };
    }

    const fixedRows = await client.$transaction(async (tx) => {
      let changes = 0;
      const rowsToFix = await tx.$queryRawUnsafe(FIND_DUPLICATE_ROWS_SQL);
      for (const row of rowsToFix) {
        const nextOrderNo = `${row.orderNo}-dup-${row.id}`;
        changes += await tx.$executeRawUnsafe(
          'UPDATE expedition_orders SET order_no = ? WHERE id = ? AND order_no = ?',
          nextOrderNo,
          row.id,
          row.orderNo
        );
      }
      return changes;
    });

    logger.log(
      `[fix-duplicate-order-no] 已修复 ${fixedRows} 行重复 order_no，保留最早的 ${summary.preservedOriginalRows} 个原值。`
    );

    return {
      skipped: false,
      duplicateRows: summary.duplicateRows,
      fixedRows,
      preservedOriginalRows: summary.preservedOriginalRows,
    };
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
  fixDuplicateOrderNo({ dryRun, sampleSize })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('[fix-duplicate-order-no] 执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  FIND_DUPLICATE_ROWS_SQL,
  fixDuplicateOrderNo,
};
