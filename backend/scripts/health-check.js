#!/usr/bin/env node
'use strict';

/**
 * 自检脚本：
 * - 检查所有路由是否已挂载
 * - 检查所有 prisma model 是否可访问
 * - 检查所有环境变量 mock 降级是否正常
 * - 输出检查报告
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'routes');
const APP_FILE = path.join(ROOT, 'app.js');
const SCHEMA_FILE = path.join(ROOT, 'prisma', 'schema.prisma');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function getRouteFiles() {
  return fs.readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => f !== 'chat.gateway.js')
    .filter((f) => {
      const source = read(path.join(ROUTES_DIR, f));
      return source.includes('express.Router(') || source.includes('router = express.Router()');
    })
    .sort();
}

function extractMountedRouteFiles(appSource) {
  const mounted = new Set();
  const re = /require\('\.\/routes\/([^']+)'\)/g;
  let m;
  while ((m = re.exec(appSource))) {
    mounted.add(`${m[1]}.js`);
  }
  return mounted;
}

function extractPrismaModels(schemaSource) {
  const modelNames = [];
  const re = /^model\s+([A-Za-z0-9_]+)/gm;
  let m;
  while ((m = re.exec(schemaSource))) modelNames.push(m[1]);
  return modelNames;
}

function extractPrismaDelegatesFromRoutes() {
  const delegates = new Set();
  const files = getRouteFiles();
  const re = /\bprisma\.([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const file of files) {
    const source = read(path.join(ROUTES_DIR, file));
    let m;
    while ((m = re.exec(source))) delegates.add(m[1]);
  }
  return [...delegates];
}

async function checkMockDegrade() {
  const report = [];
  try {
    const sms = require('../lib/smsSender');
    const smsResult = await sms.sendSms('13800000000', 'mock-template', ['1234']);
    report.push({ module: 'smsSender', ok: !!smsResult?.success, detail: smsResult });
  } catch (e) {
    report.push({ module: 'smsSender', ok: false, detail: e.message });
  }

  try {
    const wechatPay = require('../lib/payment/wechat-pay');
    report.push({ module: 'wechat-pay', ok: wechatPay.isMockMode(), detail: { mock: wechatPay.isMockMode() } });
  } catch (e) {
    report.push({ module: 'wechat-pay', ok: false, detail: e.message });
  }

  try {
    const stripeConnect = require('../lib/payment/stripe-connect');
    report.push({ module: 'stripe-connect', ok: stripeConnect.isMock(), detail: { mock: stripeConnect.isMock() } });
  } catch (e) {
    report.push({ module: 'stripe-connect', ok: false, detail: e.message });
  }

  return report;
}

async function main() {
  const appSource = read(APP_FILE);
  const schemaSource = read(SCHEMA_FILE);
  const routeFiles = getRouteFiles();
  const mounted = extractMountedRouteFiles(appSource);

  const unmountedRoutes = routeFiles.filter((f) => !mounted.has(f));
  const schemaModels = extractPrismaModels(schemaSource);
  const validDelegates = new Set(schemaModels.map((m) => m[0].toLowerCase() + m.slice(1)));
  const internalDelegates = new Set(['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$transaction', '$connect', '$disconnect']);
  const routeDelegates = extractPrismaDelegatesFromRoutes();
  const unknownDelegates = routeDelegates.filter((d) => !validDelegates.has(d) && !internalDelegates.has(d));

  const mockChecks = await checkMockDegrade();

  const result = {
    timestamp: new Date().toISOString(),
    routes: {
      total: routeFiles.length,
      mounted: routeFiles.length - unmountedRoutes.length,
      unmountedRoutes,
    },
    prisma: {
      models: schemaModels.length,
      unknownDelegates,
    },
    mock: mockChecks,
  };

  console.log(JSON.stringify(result, null, 2));

  const hasError = unmountedRoutes.length > 0 || unknownDelegates.length > 0 || mockChecks.some((m) => !m.ok);
  process.exitCode = hasError ? 1 : 0;
}

main().catch((e) => {
  console.error('[health-check] failed:', e);
  process.exit(1);
});
