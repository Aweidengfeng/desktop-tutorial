#!/usr/bin/env node
/**
 * scripts/validate-env.js — SummitLink 生产环境变量启动校验
 *
 * 用法：
 *   node scripts/validate-env.js            # 正常启动前校验
 *   DRY_RUN=1 node scripts/validate-env.js  # CI 中仅验证脚本可解析（始终退出 0）
 *
 * 原理：读取 .env.example 中定义的所有 KEY，逐一检查 process.env 中是否存在，
 * 如有缺失则在生产环境（NODE_ENV=production）下以非零退出码终止进程。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── 定位 .env.example ─────────────────────────────────────────────────────────
// 脚本可能从仓库根或 backend/ 子目录调用，依次尝试两个路径
const candidates = [
  path.resolve(__dirname, '..', '.env.example'),
  path.resolve(process.cwd(), '.env.example'),
];
const envExamplePath = candidates.find(p => fs.existsSync(p));

if (!envExamplePath) {
  console.error('❌ 找不到 .env.example 文件（查找路径：', candidates.join(', '), '）');
  process.exit(1);
}

// ── 解析 .env.example，提取所有 KEY ──────────────────────────────────────────
const lines = fs.readFileSync(envExamplePath, 'utf8').split('\n');

/** @type {{ key: string, comment: string }[]} */
const entries = [];
let lastComment = '';

for (const raw of lines) {
  const line = raw.trim();

  // 纯注释行：保留为下一个变量的说明
  if (line.startsWith('#')) {
    lastComment = line.replace(/^#+\s*/, '');
    continue;
  }

  // 空行：重置注释
  if (line === '') {
    lastComment = '';
    continue;
  }

  // KEY=VALUE 行（值可为空）
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim();
    // Only match conventional ALL_CAPS env var names (as used in .env.example)
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
      entries.push({ key, comment: lastComment });
    }
    lastComment = '';
  }
}

if (entries.length === 0) {
  console.error('❌ .env.example 中没有找到任何环境变量定义，请检查文件格式');
  process.exit(1);
}

// ── 校验每个 KEY 是否在 process.env 中存在（非空）─────────────────────────────
const missing = [];

console.log('\n🔧 SummitLink Env Validation (from .env.example)\n');
console.log(`📄 配置文件：${envExamplePath}`);
console.log(`📦 共发现 ${entries.length} 个环境变量\n`);

for (const { key, comment } of entries) {
  const val = process.env[key];
  if (val === undefined || val === '') {
    missing.push({ key, comment });
    console.warn(`⚠️  MISSING  ${key}${comment ? `  — ${comment}` : ''}`);
  } else {
    console.log(`✅  OK       ${key} = ***`);
  }
}

console.log('');

// DRY_RUN：仅测试脚本本身可正常解析，不因缺失变量退出
if (process.env.DRY_RUN === '1') {
  console.log('ℹ️  DRY_RUN 模式，跳过缺失变量错误。\n');
  process.exit(0);
}

if (missing.length > 0) {
  const isProduction = process.env.NODE_ENV === 'production';
  const label = isProduction ? '💥 生产环境' : '⚠️  开发环境';
  console.error(`${label}：以下 ${missing.length} 个环境变量未设置：`);
  missing.forEach(({ key, comment }) =>
    console.error(`   • ${key}${comment ? `  （${comment}）` : ''}`)
  );
  console.error('');
  if (isProduction) {
    console.error('请在 Railway → Variables 面板补全上述变量后重新部署。\n');
    process.exit(1);
  }
} else {
  console.log(`✅ 全部 ${entries.length} 个环境变量校验通过，服务即将启动。\n`);
}
