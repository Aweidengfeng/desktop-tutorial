#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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

function getByPath(obj, p) {
  if (!p) return undefined;
  return p.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function applyTemplate(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const v = getByPath(context, key.trim());
      return v == null ? '' : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((item) => applyTemplate(item, context));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) result[k] = applyTemplate(v, context);
    return result;
  }
  return value;
}

function checkExpected(expected, actual) {
  if (!expected || typeof expected !== 'object') return { ok: true, issues: [] };
  const issues = [];
  for (const [k, v] of Object.entries(expected)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = checkExpected(v, actual ? actual[k] : undefined);
      if (!nested.ok) issues.push(...nested.issues.map((i) => `${k}.${i}`));
    } else if (!actual || actual[k] !== v) {
      issues.push(`Expected ${k}=${JSON.stringify(v)}, got ${JSON.stringify(actual ? actual[k] : undefined)}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

async function runSqlStepsPg(config, context, steps, result) {
  const { Client } = require('pg');
  const client = new Client(config);
  await client.connect();

  try {
    for (const rawStep of steps) {
      const step = applyTemplate(rawStep, context);
      const item = { name: step.name || step.query, optional: !!step.optional, success: false };

      try {
        const queryResult = await client.query(step.query, step.params || []);
        item.result = {
          rowCount: queryResult.rowCount,
          firstRow: queryResult.rows && queryResult.rows.length ? queryResult.rows[0] : null,
        };

        const expected = step.expected || {};
        if (typeof expected.rowCount === 'number' && expected.rowCount !== item.result.rowCount) {
          throw new Error(`Expected rowCount ${expected.rowCount}, got ${item.result.rowCount}`);
        }

        const expectedFirstRowCheck = checkExpected(expected.firstRow || null, item.result.firstRow || {});
        if (!expectedFirstRowCheck.ok) {
          throw new Error(`firstRow validation failed: ${expectedFirstRowCheck.issues.join('; ')}`);
        }

        item.success = true;
      } catch (err) {
        item.error = err.message;
        if (!item.optional) result.errors.push({ step: item.name, message: err.message });
        else result.warnings.push(`Optional SQL step failed [${item.name}]: ${err.message}`);
      } finally {
        result.steps.push(item);
      }
    }
  } finally {
    await client.end();
  }
}

async function runSqlStepsMysql(config, context, steps, result) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection(config);

  try {
    for (const rawStep of steps) {
      const step = applyTemplate(rawStep, context);
      const item = { name: step.name || step.query, optional: !!step.optional, success: false };

      try {
        const mysqlQuery = (step.query || '').replace(/\$\d+/g, '?');
        const [rows, meta] = await connection.execute(mysqlQuery, step.params || []);
        const rowCount = Array.isArray(rows) ? rows.length : (meta && meta.affectedRows) || 0;
        const firstRow = Array.isArray(rows) && rows.length ? rows[0] : null;

        item.result = {
          rowCount,
          firstRow,
          affectedRows: meta && meta.affectedRows,
          insertId: meta && meta.insertId,
        };

        const expected = step.expected || {};
        if (typeof expected.rowCount === 'number' && expected.rowCount !== item.result.rowCount) {
          throw new Error(`Expected rowCount ${expected.rowCount}, got ${item.result.rowCount}`);
        }

        if (typeof expected.affectedRows === 'number' && expected.affectedRows !== item.result.affectedRows) {
          throw new Error(`Expected affectedRows ${expected.affectedRows}, got ${item.result.affectedRows}`);
        }

        const expectedFirstRowCheck = checkExpected(expected.firstRow || null, item.result.firstRow || {});
        if (!expectedFirstRowCheck.ok) {
          throw new Error(`firstRow validation failed: ${expectedFirstRowCheck.issues.join('; ')}`);
        }

        item.success = true;
      } catch (err) {
        item.error = err.message;
        if (!item.optional) result.errors.push({ step: item.name, message: err.message });
        else result.warnings.push(`Optional SQL step failed [${item.name}]: ${err.message}`);
      } finally {
        result.steps.push(item);
      }
    }
  } finally {
    await connection.end();
  }
}

async function runMongoSteps(config, context, steps, result) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(config.uri);
  await client.connect();
  const db = client.db(config.dbName);

  try {
    for (const rawStep of steps) {
      const step = applyTemplate(rawStep, context);
      const item = { name: step.name || step.operation, optional: !!step.optional, success: false };

      try {
        const collection = db.collection(step.collection);
        let opResult;

        switch (step.operation) {
          case 'deleteMany':
            opResult = await collection.deleteMany(step.filter || {});
            item.result = { deletedCount: opResult.deletedCount };
            break;
          case 'insertOne':
            opResult = await collection.insertOne(step.document || {});
            item.result = { insertedCount: opResult.insertedCount, insertedId: String(opResult.insertedId) };
            break;
          case 'findOne': {
            const doc = await collection.findOne(step.filter || {});
            item.result = { document: doc };
            break;
          }
          case 'updateOne':
            opResult = await collection.updateOne(step.filter || {}, step.update || {});
            item.result = { matchedCount: opResult.matchedCount, modifiedCount: opResult.modifiedCount };
            break;
          case 'deleteOne':
            opResult = await collection.deleteOne(step.filter || {});
            item.result = { deletedCount: opResult.deletedCount };
            break;
          default:
            throw new Error(`Unsupported Mongo operation: ${step.operation}`);
        }

        const expectedCheck = checkExpected(step.expected || null, item.result || {});
        if (!expectedCheck.ok) {
          throw new Error(expectedCheck.issues.join('; '));
        }

        item.success = true;
      } catch (err) {
        item.error = err.message;
        if (!item.optional) result.errors.push({ step: item.name, message: err.message });
        else result.warnings.push(`Optional Mongo step failed [${item.name}]: ${err.message}`);
      } finally {
        result.steps.push(item);
      }
    }
  } finally {
    await client.close();
  }
}

async function main() {
  const config = loadConfig();
  const logDir = path.resolve(__dirname, config.logging?.dir || 'logs');
  ensureDir(logDir);

  const result = {
    script: 'db_test.js',
    startedAt: new Date().toISOString(),
    success: false,
    skipped: false,
    warnings: [],
    errors: [],
    steps: [],
  };

  const printToConsole = !!config.logging?.printToConsole;

  try {
    const database = config.database || {};
    const context = {
      testUser: config.testUser || {},
      token: config.auth?.token || '',
    };

    if (!database.enabled) {
      result.success = true;
      result.skipped = true;
      result.warnings.push('Database tests are disabled by config.database.enabled=false');
    } else if (database.type === 'postgresql') {
      await runSqlStepsPg(
        database.postgresql || {},
        context,
        database.sqlStepsPostgresql || database.sqlSteps || [],
        result
      );
    } else if (database.type === 'mysql') {
      await runSqlStepsMysql(
        database.mysql || {},
        context,
        database.sqlStepsMysql || database.sqlSteps || [],
        result
      );
    } else if (database.type === 'mongodb') {
      await runMongoSteps(database.mongodb || {}, context, database.mongoSteps || [], result);
    } else {
      throw new Error(`Unsupported database.type: ${database.type}`);
    }

    if (!result.skipped) {
      const requiredFailures = result.steps.filter((s) => !s.success && !s.optional);
      result.success = requiredFailures.length === 0;
    }
  } catch (err) {
    result.success = false;
    result.errors.push({ message: err.message, stack: err.stack });
  } finally {
    result.finishedAt = new Date().toISOString();
    const logFile = path.join(logDir, `db_test_${timestamp()}.json`);
    writeJson(logFile, result);

    if (printToConsole) {
      console.log(`[db_test] success=${result.success} skipped=${result.skipped} log=${logFile}`);
      if (result.errors.length) console.error('[db_test] errors:', result.errors);
      if (result.warnings.length) console.warn('[db_test] warnings:', result.warnings);
    }

    process.exit(result.success ? 0 : 1);
  }
}

main().catch((e) => {
  console.error('[db_test] fatal error:', e);
  process.exit(1);
});
