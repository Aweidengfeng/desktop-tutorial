jest.mock('../../backend/db/prisma', () => ({
  booking: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
}));

const prisma = require('../../backend/db/prisma');
const { requireOwnership } = require('../../backend/middleware/ownershipGuard');

describe('ownershipGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function runGuard({ req, ownerId = 1, admin = false }) {
    prisma.booking.findUnique.mockResolvedValue({ id: 99, userId: ownerId });
    prisma.user.findUnique.mockResolvedValue({ isAdmin: admin });

    const guard = requireOwnership('booking');
    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    const next = jest.fn();

    await guard(req, res, next);
    return { res, next };
  }

  test('非资源所有者访问返回 403', async () => {
    const { res, next } = await runGuard({
      req: { params: { id: '99' }, user: { id: 2 } },
      ownerId: 1,
      admin: false,
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  test('资源所有者访问通过（200 path）', async () => {
    const { res, next } = await runGuard({
      req: { params: { id: '99' }, user: { id: 1 } },
      ownerId: 1,
      admin: false,
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('管理员可访问任意资源（200 path）', async () => {
    const { res, next } = await runGuard({
      req: { params: { id: '99' }, user: { id: 9 } },
      ownerId: 1,
      admin: true,
    });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
