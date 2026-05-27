const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_REWARD_POINTS = 50;

function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase();
}

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function ensureUserInviteCode(prisma, userId, maxAttempts = 12) {
  const existingRows = await prisma.$queryRaw`SELECT invite_code FROM users WHERE id = ${userId} LIMIT 1`;
  const existingCode = existingRows?.[0]?.invite_code;
  if (existingCode) return existingCode;

  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateInviteCode();
    const conflictRows = await prisma.$queryRaw`SELECT id FROM users WHERE invite_code = ${code} LIMIT 1`;
    if (Array.isArray(conflictRows) && conflictRows.length) continue;
    try {
      await prisma.$executeRaw`UPDATE users SET invite_code = ${code} WHERE id = ${userId}`;
      return code;
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('unique') && e?.code !== 'P2002') throw e;
    }
  }
  return null;
}

module.exports = {
  INVITE_REWARD_POINTS,
  normalizeInviteCode,
  generateInviteCode,
  ensureUserInviteCode,
};
