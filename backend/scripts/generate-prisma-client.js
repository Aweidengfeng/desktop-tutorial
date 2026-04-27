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
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const original = fs.readFileSync(schemaPath, 'utf8');

// 将 datasource db 块中的 provider 替换为当前环境指定的值
// 使用跨行正则，精确定位 datasource db 块，避免误替换 generator 的 provider
const patched = original.replace(
  /(datasource\s+\w+\s*\{[^}]*\bprovider\s*=\s*)"[^"]+"/s,
  `$1"${provider}"`
);

if (patched === original && !original.includes(`"${provider}"`)) {
  console.error(`[generate-prisma-client] 无法在 schema.prisma 中定位 provider 字段`);
  process.exit(1);
}

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
    console.log('[generate-prisma-client] 正在推送 schema 到数据库...');
    execSync('npx prisma db push --schema=prisma/schema.prisma', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  }
} finally {
  // 无论成功或失败，始终还原原始 schema
  fs.writeFileSync(schemaPath, original, 'utf8');
  if (!generated) {
    process.exit(1);
  }
}
