#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function runScript(scriptName) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [path.resolve(__dirname, scriptName)], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[${scriptName}] ${text}`);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[${scriptName}] ${text}`);
    });

    child.on('close', (code) => {
      resolve({
        script: scriptName,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      resolve({
        script: scriptName,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${error.message}`,
      });
    });
  });
}

async function main() {
  const config = loadConfig();
  const logDir = path.resolve(__dirname, config.logging?.dir || 'logs');
  ensureDir(logDir);

  const scripts = ['frontend_test.js', 'api_test.js', 'db_test.js'];
  const summary = {
    script: 'run_all_tests.js',
    startedAt: new Date().toISOString(),
    results: [],
  };

  for (const scriptName of scripts) {
    const result = await runScript(scriptName);
    summary.results.push(result);
  }

  summary.finishedAt = new Date().toISOString();
  summary.success = summary.results.every((r) => r.exitCode === 0);

  const summaryFile = path.join(logDir, `run_all_summary_${timestamp()}.json`);
  writeJson(summaryFile, summary);

  console.log('\n=== Test Summary ===');
  for (const item of summary.results) {
    console.log(`${item.script}: exit=${item.exitCode} durationMs=${item.durationMs}`);
  }
  console.log(`Summary file: ${summaryFile}`);

  process.exit(summary.success ? 0 : 1);
}

main().catch((e) => {
  console.error('[run_all_tests] fatal error:', e);
  process.exit(1);
});
