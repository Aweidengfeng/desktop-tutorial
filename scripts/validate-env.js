#!/usr/bin/env node
/**
 * scripts/validate-env.js — SummitLink 生产环境变量启动校验
 *
 * 用法：
 *   node scripts/validate-env.js            # 正常启动前校验（由 backend prestart 调用）
 *   DRY_RUN=1 node scripts/validate-env.js  # CI 中仅验证脚本可解析（始终退出 0）
 *
 * 原理：读取 .env.example 中定义的所有 KEY，按 "必填" / "可选" 章节分类，
 * 生产环境（NODE_ENV=production）下缺少必填变量时以非零退出码终止进程；
 * 缺少可选变量仅打印警告，不影响启动。
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

// ── 解析 .env.example，提取 KEY 并按必填/可选分类 ─────────────────────────────
// 章节标记：
//   含 "必填" 的注释行 → 接下来的变量为必填
//   含 "可选" 的注释行 → 接下来的变量为可选
const lines = fs.readFileSync(envExamplePath, 'utf8').split('\n');

/** @type {{ key: string, comment: string, required: boolean }[]} */
const entries = [];
let lastComment = '';
let currentRequired = false; // 默认可选，遇到"必填"章节标题后切换

for (const raw of lines) {
  const line = raw.trim();

  // 纯注释行：检查章节标记，并保留为下一个变量的说明
  if (line.startsWith('#')) {
    const commentText = line.replace(/^#+\s*/, '');
    if (commentText.includes('必填')) currentRequired = true;
    if (commentText.includes('可选')) currentRequired = false;
    lastComment = commentText;
    continue;
  }

  // 空行：重置行注释（章节状态保持不变）
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
      entries.push({ key, comment: lastComment, required: currentRequired });
    }
    lastComment = '';
  }
}

if (entries.length === 0) {
  console.error('❌ .env.example 中没有找到任何环境变量定义，请检查文件格式');
  process.exit(1);
}

const required = entries.filter(e => e.required);
const optional = entries.filter(e => !e.required);

// ── 校验每个 KEY 是否在 process.env 中存在（非空）─────────────────────────────
const missingRequired = [];
const missingOptional = [];

console.log('\n🔧 SummitLink Env Validation (from .env.example)\n');
console.log(`📄 配置文件：${envExamplePath}`);
console.log(`📦 必填变量 ${required.length} 个，可选变量 ${optional.length} 个\n`);

console.log('── 必填变量 ──');
for (const { key, comment } of required) {
  const val = process.env[key];
  if (val === undefined || val === '') {
    missingRequired.push({ key, comment });
    console.error(`❌  MISSING  ${key}${comment ? `  — ${comment}` : ''}`);
  } else {
    console.log(`✅  OK       ${key} = ***`);
  }
}

console.log('\n── 可选变量 ──');
for (const { key, comment } of optional) {
  const val = process.env[key];
  if (val === undefined || val === '') {
    missingOptional.push({ key, comment });
    console.warn(`⚠️   UNSET    ${key}${comment ? `  — ${comment}` : ''}`);
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

if (missingRequired.length > 0) {
  const isProduction = process.env.NODE_ENV === 'production';
  console.error(`💥 以下 ${missingRequired.length} 个必填变量未设置：`);
  missingRequired.forEach(({ key, comment }) =>
    console.error(`   • ${key}${comment ? `  （${comment}）` : ''}`)
  );
  console.error('');
  if (isProduction) {
    console.error('请在 Railway → Variables 面板补全上述变量后重新部署。\n');
    process.exit(1);
  } else {
    console.warn('⚠️  开发模式：跳过必填变量强制退出。\n');
  }
} else {
  const warnCount = missingOptional.length;
  const warnNote = warnCount > 0 ? `（${warnCount} 个可选变量未配置，对应功能不可用）` : '';
  console.log(`✅ 必填变量全部就绪，服务即将启动。${warnNote}\n`);
}

