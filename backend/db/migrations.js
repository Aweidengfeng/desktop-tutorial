'use strict';

// Startup migration: ensure columns exist (idempotent)
async function runStartupMigrations(prisma) {
  try {
    if (process.env.DATABASE_PROVIDER === 'postgresql') {
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT`);
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
    } else {
      // SQLite does not support IF NOT EXISTS on ALTER TABLE; use individual try/catch
      for (const sql of [
        'ALTER TABLE "users" ADD COLUMN "bio" TEXT',
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
    }
    console.log('[startup] schema patch applied');
  } catch (e) {
    console.warn('[startup] schema patch warning:', e.message);
  }
}

module.exports = { runStartupMigrations };
