const prisma = require('../db/prisma');

function toId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

async function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.isAdmin || user.is_admin) return true;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: Number(user.id) },
      select: { isAdmin: true },
    });
    return !!dbUser?.isAdmin;
  } catch (_) {
    return false;
  }
}

function requireOwnership(model, idParam = 'id', ownerField = 'userId') {
  return async (req, res, next) => {
    try {
      const id = toId(req.params[idParam]);
      const record = await prisma[model].findUnique({ where: { id } });
      if (!record) return res.status(404).json({ error: 'Not found' });
      const admin = await isAdminUser(req.user);
      if (!admin && record[ownerField] !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.resource = record;
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requireOwnership };
