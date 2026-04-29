/**
 * load-test.js — 50并发压测脚本
 * 用法: node backend/scripts/load-test.js [BASE_URL]
 * 默认 BASE_URL: http://localhost:8080
 */
const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:8080';
const CONCURRENCY = 50;
const TOTAL_REQUESTS = 200;
const TIMEOUT_THRESHOLD_PERCENT = 0.05; // fail if >5% of requests time out

function request(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function runBatch(urls) {
  return Promise.allSettled(urls.map(url => request(url)));
}

async function main() {
  console.log(`\n🏔️  AlpineLink Load Test`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}, Total: ${TOTAL_REQUESTS}\n`);

  const endpoints = [
    '/api/health',
    '/api/peaks?limit=10',
    '/api/posts?limit=10',
    '/api/users/1',
    '/api/peaks/1',
  ];

  const allResults = { success: 0, error: 0, status500: 0, timeouts: 0 };
  const start = Date.now();

  // 分批执行，每批 CONCURRENCY 个请求
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENCY);
  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - b * CONCURRENCY);
    const urls = Array.from({ length: batchSize }, (_, i) =>
      BASE_URL + endpoints[(b * CONCURRENCY + i) % endpoints.length]
    );
    const results = await runBatch(urls);
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.status >= 500) { allResults.status500++; allResults.error++; }
        else allResults.success++;
      } else {
        if (r.reason?.message === 'timeout') allResults.timeouts++;
        else allResults.error++;
      }
    }
    process.stdout.write(`\r  Batch ${b+1}/${batches} done...`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n\n📊 Results:`);
  console.log(`  Total requests : ${TOTAL_REQUESTS}`);
  console.log(`  Success (2xx/3xx/4xx): ${allResults.success}`);
  console.log(`  5xx errors     : ${allResults.status500}`);
  console.log(`  Timeouts       : ${allResults.timeouts}`);
  console.log(`  Time elapsed   : ${elapsed}s`);
  console.log(`  RPS            : ${(TOTAL_REQUESTS / elapsed).toFixed(1)}\n`);

  if (allResults.status500 > 0) {
    console.error(`❌ FAIL: ${allResults.status500} requests returned 5xx`);
    process.exit(1);
  }
  if (allResults.timeouts > TOTAL_REQUESTS * TIMEOUT_THRESHOLD_PERCENT) {
    console.error(`❌ FAIL: Too many timeouts (${allResults.timeouts}/${TOTAL_REQUESTS})`);
    process.exit(1);
  }
  console.log(`✅ PASS: No 5xx errors under ${CONCURRENCY} concurrent requests`);
}

main().catch(e => { console.error(e); process.exit(1); });
