#!/usr/bin/env node
/**
 * Prisma Client 生成脚本（支持 SQLite / PostgreSQL 双模式）
 *
 * 用法：
 *   node scripts/generate-prisma-client.js          # 仅 generate
 *   node scripts/generate-prisma-client.js --push   # generate + db push
 *
 * 环境变量：
 *   DATABASE_PROVIDER — sqlite（默认）或 postgresql
 *   DATABASE_URL      — Prisma 连接字符串
 *
 * 原理：
 *   Prisma 不支持在 provider 字段使用 env()，本脚本通过临时
 *   替换 schema.prisma 中的 provider 值来实现双模式支持，操作
 *   完成后自动还原原始文件内容。
 *
 *   同时修正 generator output 路径：schema.prisma 中写的是
 *   "../../node_modules/.prisma/client"（相对于 backend/prisma/，
 *   指向项目根目录），但 @prisma/client 安装在 backend/node_modules/
 *   下，它期望引擎在 backend/node_modules/.prisma/client/。
 *   生成时将 output 临时改为 "../node_modules/.prisma/client"
 *   以确保文件写入正确位置。
 *
 * --push 流程：
 *   1. 执行 fix-duplicate-order-no.js（清洗所有目标表的重复 order_no）
 *   2. 执行 precheckUniqueConstraints()（检查所有目标表是否还有重复）
 *   3. 若 allSafe=true  → prisma db push --accept-data-loss（安全执行）
 *      若 allSafe=false → 打印明细并 exit 1（保留 fail-fast 保护）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const original = fs.readFileSync(schemaPath, 'utf8');

// 将 datasource db 块中的 provider 替换为当前环境指定的值
// 使用跨行正则，精确定位 datasource db 块，避免误替换 generator 的 provider
let patched = original.replace(
  /(datasource\s+\w+\s*\{[^}]*\bprovider\s*=\s*)"[^"]+"/s,
  `$1"${provider}"`
);

if (patched === original && !original.includes(`"${provider}"`)) {
  console.error(`[generate-prisma-client] 无法在 schema.prisma 中定位 provider 字段`);
  process.exit(1);
}

// 修正 generator output 路径：将任意 node_modules/.prisma/client 路径
// 统一替换为相对于 backend/prisma/ 的正确路径，确保生成的客户端
// 写入 backend/node_modules/.prisma/client/（@prisma/client 期望的位置）
patched = patched.replace(
  /(generator\s+\w+\s*\{[^}]*\boutput\s*=\s*)"[^"]*node_modules\/\.prisma\/client"/s,
  `$1"../node_modules/.prisma/client"`
);

async function main() {
  let generated = false;
  try {
    fs.writeFileSync(schemaPath, patched, 'utf8');
    console.log(`[generate-prisma-client] provider=${provider}，正在生成 Prisma Client...`);

    execSync('npx prisma generate --schema=prisma/schema.prisma', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    generated = true;

    if (process.argv.includes('--push')) {
      console.log('[generate-prisma-client] 正在执行 order_no 重复数据预清洗...');
      const fixScriptPath = path.join(__dirname, 'fix-duplicate-order-no.js');
      execSync(`node "${fixScriptPath}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      console.log('[generate-prisma-client] 正在执行前置安全检查...');
      // 懒加载：prisma generate 完成后才能实例化 PrismaClient
      // eslint-disable-next-line global-require
      const { PrismaClient } = require('@prisma/client');
      // eslint-disable-next-line global-require
      const { precheckUniqueConstraints, TARGETS } = require('./fix-duplicate-order-no');

      const prismaClient = new PrismaClient();
      let precheckResult;
      try {
        precheckResult = await precheckUniqueConstraints({ prisma: prismaClient });
      } finally {
        await prismaClient.$disconnect();
      }

      const { allSafe, details } = precheckResult;
      const needsCleanupDetails = details.filter((d) => d.status === 'needs_cleanup');
      const noExistCount = details.filter((d) => d.reason === 'table does not exist').length;
      const noDupCount = details.filter((d) => d.reason === 'no duplicates').length;

      if (allSafe) {
        console.log(
          `[generate-prisma-client] 前置安全检查通过：${TARGETS.length} 张目标表` +
          `（${noExistCount} 张不存在/未创建，${noDupCount} 张无重复）`
        );
        console.log('[generate-prisma-client] 安全执行 prisma db push --accept-data-loss');
        execSync('npx prisma db push --schema=prisma/schema.prisma --accept-data-loss', {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..'),
        });
      } else {
        for (const d of needsCleanupDetails) {
          console.error(
            `[generate-prisma-client] ❌ ${d.table}.${d.column} 仍有 ${d.rowCount} 组重复（已清洗失败/未尝试清洗）`
          );
        }
        console.error(
          '[generate-prisma-client] 前置安全检查未通过，跳过 db push。' +
          '请手动执行：node scripts/fix-duplicate-order-no.js --dry-run（确认）后再执行 node scripts/fix-duplicate-order-no.js'
        );
        throw new Error(`前置安全检查未通过：${needsCleanupDetails.length} 张表仍有重复数据`);
      }
    }
  } finally {
    // 无论成功或失败，始终还原原始 schema
    fs.writeFileSync(schemaPath, original, 'utf8');
    if (!generated) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[generate-prisma-client] 执行失败:', err.message || err);
  process.exit(1);
});
