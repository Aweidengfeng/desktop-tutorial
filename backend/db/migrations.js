'use strict';

// Startup migration: ensure columns exist (idempotent)
async function runStartupMigrations(prisma) {
  try {
    if (process.env.DATABASE_PROVIDER === 'postgresql') {
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
    } else {
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
    }
    console.log('[startup] schema patch applied');
  } catch (e) {
    console.warn('[startup] schema patch warning:', e.message);
  }
}

module.exports = { runStartupMigrations };
