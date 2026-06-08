'use strict';

// Startup migration: ensure columns exist (idempotent)
async function runStartupMigrations(prisma) {
  try {
    if (process.env.DATABASE_PROVIDER === 'postgresql') {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "coupons" (
          "id" SERIAL PRIMARY KEY,
          "code" TEXT UNIQUE NOT NULL,
          "type" TEXT NOT NULL,
          "value" DOUBLE PRECISION NOT NULL,
          "min_order_amount" DOUBLE PRECISION DEFAULT 0,
          "max_discount" DOUBLE PRECISION DEFAULT NULL,
          "total_quota" INTEGER DEFAULT NULL,
          "used_count" INTEGER DEFAULT 0,
          "per_user_limit" INTEGER DEFAULT 1,
          "applicable_types" TEXT DEFAULT 'all',
          "expires_at" TIMESTAMPTZ DEFAULT NULL,
          "created_by" INTEGER,
          "created_at" TIMESTAMPTZ DEFAULT NOW(),
          "status" TEXT DEFAULT 'active'
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "user_coupons" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "coupon_id" INTEGER NOT NULL,
          "status" TEXT DEFAULT 'unused',
          "order_type" TEXT,
          "order_id" INTEGER,
          "used_at" TIMESTAMPTZ,
          "claimed_at" TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE("user_id", "coupon_id")
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_code" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_by" INTEGER`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_reward_points" INTEGER DEFAULT 0`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_invite_code_unique" ON "users"("invite_code")`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "images" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "video_url" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tags" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "emojis" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "policy_no" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMPTZ`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "policy_pdf_url" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "provider_ref" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "claim_status" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "claim_updated_at" TIMESTAMPTZ`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "insurance_inquiries" ADD COLUMN IF NOT EXISTS "claim_note" TEXT`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "invite_records" (
          "id" SERIAL PRIMARY KEY,
          "inviter_id" INTEGER NOT NULL,
          "invitee_id" INTEGER NOT NULL,
          "invite_code" TEXT NOT NULL,
          "reward_type" TEXT DEFAULT 'points',
          "reward_value" INTEGER DEFAULT 50,
          "rewarded_at" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "content_reports" (
          "id" SERIAL PRIMARY KEY,
          "reporter_id" INTEGER,
          "target_type" TEXT NOT NULL,
          "target_id" INTEGER NOT NULL,
          "reason" TEXT NOT NULL,
          "detail" TEXT,
          "status" TEXT DEFAULT 'pending',
          "handled_by" INTEGER,
          "handled_at" TIMESTAMPTZ,
          "resolution" TEXT,
          "created_at" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_content_reports_status" ON "content_reports"("status")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_content_reports_target" ON "content_reports"("target_type", "target_id")`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "leads" (
          "id" SERIAL PRIMARY KEY,
          "type" TEXT NOT NULL,
          "name" TEXT,
          "email" TEXT,
          "payload" TEXT,
          "status" TEXT DEFAULT 'new',
          "ip_hash" TEXT,
          "created_at" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_leads_type" ON "leads"("type")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "leads"("status")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_leads_created_at" ON "leads"("created_at")`);
    } else {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS coupons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          value REAL NOT NULL,
          min_order_amount REAL DEFAULT 0,
          max_discount REAL DEFAULT NULL,
          total_quota INTEGER DEFAULT NULL,
          used_count INTEGER DEFAULT 0,
          per_user_limit INTEGER DEFAULT 1,
          applicable_types TEXT DEFAULT 'all',
          expires_at TEXT DEFAULT NULL,
          created_by INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active'
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_coupons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          coupon_id INTEGER NOT NULL,
          status TEXT DEFAULT 'unused',
          order_type TEXT,
          order_id INTEGER,
          used_at TEXT,
          claimed_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, coupon_id)
        )
      `);
      // SQLite does not support IF NOT EXISTS on ALTER TABLE; use individual try/catch
      for (const sql of [
        'ALTER TABLE "users" ADD COLUMN "bio" TEXT',
        'ALTER TABLE "users" ADD COLUMN "invite_code" TEXT',
        'ALTER TABLE "users" ADD COLUMN "invited_by" INTEGER',
        'ALTER TABLE "users" ADD COLUMN "invite_reward_points" INTEGER DEFAULT 0',
        'ALTER TABLE "posts" ADD COLUMN "images" TEXT',
        'ALTER TABLE "posts" ADD COLUMN "video_url" TEXT',
        'ALTER TABLE "posts" ADD COLUMN "tags" TEXT',
        'ALTER TABLE "posts" ADD COLUMN "emojis" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "policy_no" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "status" TEXT DEFAULT \'pending\'',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "issued_at" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "policy_pdf_url" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "provider_ref" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "claim_status" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "claim_updated_at" TEXT',
        'ALTER TABLE "insurance_inquiries" ADD COLUMN "claim_note" TEXT',
      ]) {
        try { await prisma.$executeRawUnsafe(sql); } catch (err) {
          // Ignore "duplicate column" errors; warn on anything unexpected
          const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
          if (!msg || (!msg.includes('already') && !msg.includes('duplicate column'))) {
            console.warn('[startup] migration warning:', err.message);
          }
        }
      }
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code_unique ON users(invite_code)');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS invite_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inviter_id INTEGER NOT NULL,
          invitee_id INTEGER NOT NULL,
          invite_code TEXT NOT NULL,
          reward_type TEXT DEFAULT 'points',
          reward_value INTEGER DEFAULT 50,
          rewarded_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS content_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_id INTEGER,
          target_type TEXT NOT NULL,
          target_id INTEGER NOT NULL,
          reason TEXT NOT NULL,
          detail TEXT,
          status TEXT DEFAULT 'pending',
          handled_by INTEGER,
          handled_at DATETIME,
          resolution TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status)');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id)');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          name TEXT,
          email TEXT,
          payload TEXT,
          status TEXT DEFAULT 'new',
          ip_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(type)');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)');
    }
    console.log('[startup] schema patch applied');
  } catch (e) {
    console.warn('[startup] schema patch warning:', e.message);
  }
}

module.exports = { runStartupMigrations };
