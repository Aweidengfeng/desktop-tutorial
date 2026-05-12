'use strict';

const Database = require('better-sqlite3');
const {
  fixDuplicateOrderNo,
  fixDuplicateForTarget,
  fixAllTargets,
  precheckUniqueConstraints,
} = require('../scripts/fix-duplicate-order-no');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createPrismaLike(db) {
  const txApi = {
    $queryRawUnsafe: async (sql) => db.prepare(sql).all(),
    $executeRawUnsafe: async (sql, ...params) => db.prepare(sql).run(...params).changes,
  };
  return {
    ...txApi,
    $transaction: async (callback) => {
      db.exec('BEGIN');
      try {
        const result = await callback(txApi);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** Creates an in-memory SQLite DB with expedition_orders only */
function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE expedition_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT,
      created_at TEXT
    );
  `);
  return db;
}

/** Creates an in-memory SQLite DB with BOTH tables */
function createMultiTableDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE expedition_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT,
      created_at TEXT
    );
    CREATE TABLE activity_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT,
      created_at TEXT
    );
  `);
  return db;
}

/** Creates a prisma-like mock that throws "no such table" for missing tables */
function createErrorPrismaLike(tableName) {
  return {
    $queryRawUnsafe: async (sql) => {
      throw new Error(`no such table: ${tableName}`);
    },
    $executeRawUnsafe: async () => 0,
    $transaction: async (cb) => cb(this),
  };
}

// ---------------------------------------------------------------------------
// Existing tests (backward-compat: fixDuplicateOrderNo / expedition_orders)
// ---------------------------------------------------------------------------

describe('fix-duplicate-order-no', () => {
  test('没有重复时应 no-op', async () => {
    const db = createTestDb();
    db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)').run('EX-1001', '2026-05-12T10:00:00Z');
    db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)').run('EX-1002', '2026-05-12T10:01:00Z');

    const result = await fixDuplicateOrderNo({
      prisma: createPrismaLike(db),
      logger: { log: jest.fn() },
    });

    expect(result.duplicateRows).toBe(0);
    expect(result.fixedRows).toBe(0);
    expect(result.preservedOriginalRows).toBe(0);
  });

  test('有 3 组重复时应保留 rn=1，其他追加 -dup-{id}', async () => {
    const db = createTestDb();
    const insert = db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)');

    insert.run('EX-A', '2026-05-12T10:00:00Z');
    insert.run('EX-A', '2026-05-12T10:00:01Z');

    insert.run('EX-B', '2026-05-12T10:01:00Z');
    insert.run('EX-B', '2026-05-12T10:01:01Z');
    insert.run('EX-B', '2026-05-12T10:01:02Z');

    insert.run('EX-C', '2026-05-12T10:02:00Z');
    insert.run('EX-C', '2026-05-12T10:02:01Z');

    const result = await fixDuplicateOrderNo({
      prisma: createPrismaLike(db),
      logger: { log: jest.fn() },
    });

    expect(result.duplicateRows).toBe(4);
    expect(result.fixedRows).toBe(4);
    expect(result.preservedOriginalRows).toBe(3);

    const rows = db
      .prepare('SELECT id, order_no FROM expedition_orders ORDER BY id ASC')
      .all();
    expect(rows).toEqual([
      { id: 1, order_no: 'EX-A' },
      { id: 2, order_no: 'EX-A-dup-2' },
      { id: 3, order_no: 'EX-B' },
      { id: 4, order_no: 'EX-B-dup-4' },
      { id: 5, order_no: 'EX-B-dup-5' },
      { id: 6, order_no: 'EX-C' },
      { id: 7, order_no: 'EX-C-dup-7' },
    ]);
  });

  test('已执行过一次后再次执行应 no-op（幂等）', async () => {
    const db = createTestDb();
    const insert = db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)');
    insert.run('EX-REPEAT', '2026-05-12T10:00:00Z');
    insert.run('EX-REPEAT', '2026-05-12T10:00:01Z');

    const prisma = createPrismaLike(db);
    const logger = { log: jest.fn() };

    const first = await fixDuplicateOrderNo({ prisma, logger });
    const second = await fixDuplicateOrderNo({ prisma, logger });

    expect(first.fixedRows).toBe(1);
    expect(second.fixedRows).toBe(0);
    expect(second.duplicateRows).toBe(0);

    const rows = db.prepare('SELECT order_no FROM expedition_orders ORDER BY id ASC').all();
    expect(rows).toEqual([{ order_no: 'EX-REPEAT' }, { order_no: 'EX-REPEAT-dup-2' }]);
  });
});

// ---------------------------------------------------------------------------
// Multi-table tests (fixAllTargets)
// ---------------------------------------------------------------------------

describe('fixAllTargets — 多表场景', () => {
  test('expedition_orders 和 activity_orders 同时有重复 → 都被清洗', async () => {
    const db = createMultiTableDb();
    const insEx = db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)');
    const insAct = db.prepare('INSERT INTO activity_orders (order_no, created_at) VALUES (?, ?)');

    insEx.run('EX-1', '2026-05-12T10:00:00Z');
    insEx.run('EX-1', '2026-05-12T10:00:01Z');

    insAct.run('ACT-1', '2026-05-12T10:00:00Z');
    insAct.run('ACT-1', '2026-05-12T10:00:01Z');

    const results = await fixAllTargets({
      prisma: createPrismaLike(db),
      logger: { log: jest.fn(), warn: jest.fn() },
    });

    expect(results['expedition_orders'].fixedRows).toBe(1);
    expect(results['activity_orders'].fixedRows).toBe(1);

    const exRows = db.prepare('SELECT order_no FROM expedition_orders ORDER BY id').all();
    expect(exRows).toEqual([{ order_no: 'EX-1' }, { order_no: 'EX-1-dup-2' }]);

    const actRows = db.prepare('SELECT order_no FROM activity_orders ORDER BY id').all();
    expect(actRows).toEqual([{ order_no: 'ACT-1' }, { order_no: 'ACT-1-dup-2' }]);
  });

  test('只有 activity_orders 有重复 → 只清洗 activity_orders', async () => {
    const db = createMultiTableDb();
    const insEx = db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)');
    const insAct = db.prepare('INSERT INTO activity_orders (order_no, created_at) VALUES (?, ?)');

    insEx.run('EX-UNIQUE', '2026-05-12T10:00:00Z');

    insAct.run('ACT-DUP', '2026-05-12T10:00:00Z');
    insAct.run('ACT-DUP', '2026-05-12T10:00:01Z');

    const results = await fixAllTargets({
      prisma: createPrismaLike(db),
      logger: { log: jest.fn(), warn: jest.fn() },
    });

    expect(results['expedition_orders'].fixedRows).toBe(0);
    expect(results['expedition_orders'].duplicateRows).toBe(0);
    expect(results['activity_orders'].fixedRows).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// precheckUniqueConstraints tests
// ---------------------------------------------------------------------------

describe('precheckUniqueConstraints', () => {
  test('表不存在 → 报告 safe (table does not exist)', async () => {
    // DB with neither table
    const db = new Database(':memory:');
    const prisma = createPrismaLike(db);
    const logger = { log: jest.fn() };

    const { allSafe, details } = await precheckUniqueConstraints({ prisma, logger });

    expect(allSafe).toBe(true);
    expect(details).toHaveLength(2);
    expect(details.every((d) => d.status === 'safe')).toBe(true);
    expect(details.every((d) => d.reason === 'table does not exist')).toBe(true);
  });

  test('表存在且为空 → 报告 safe (no duplicates)', async () => {
    const db = createMultiTableDb();
    const prisma = createPrismaLike(db);
    const logger = { log: jest.fn() };

    const { allSafe, details } = await precheckUniqueConstraints({ prisma, logger });

    expect(allSafe).toBe(true);
    expect(details.every((d) => d.status === 'safe')).toBe(true);
    expect(details.every((d) => d.rowCount === 0)).toBe(true);
  });

  test('表存在且有重复 → 报告 needs_cleanup', async () => {
    const db = createMultiTableDb();
    db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)').run('EX-DUP', '2026-05-12T10:00:00Z');
    db.prepare('INSERT INTO expedition_orders (order_no, created_at) VALUES (?, ?)').run('EX-DUP', '2026-05-12T10:00:01Z');

    const prisma = createPrismaLike(db);
    const logger = { log: jest.fn() };

    const { allSafe, details } = await precheckUniqueConstraints({ prisma, logger });

    expect(allSafe).toBe(false);
    const exDetail = details.find((d) => d.table === 'expedition_orders');
    expect(exDetail.status).toBe('needs_cleanup');
    expect(exDetail.rowCount).toBeGreaterThan(0);
  });

  test('allSafe 决策：所有表 safe → true；任一 needs_cleanup → false', async () => {
    // All safe (tables don't exist)
    const db1 = new Database(':memory:');
    const r1 = await precheckUniqueConstraints({ prisma: createPrismaLike(db1), logger: { log: jest.fn() } });
    expect(r1.allSafe).toBe(true);

    // One table has duplicates
    const db2 = createMultiTableDb();
    db2.prepare('INSERT INTO activity_orders (order_no, created_at) VALUES (?, ?)').run('ACT-X', '2026-05-12T10:00:00Z');
    db2.prepare('INSERT INTO activity_orders (order_no, created_at) VALUES (?, ?)').run('ACT-X', '2026-05-12T10:00:01Z');
    const r2 = await precheckUniqueConstraints({ prisma: createPrismaLike(db2), logger: { log: jest.fn() } });
    expect(r2.allSafe).toBe(false);
  });
});
