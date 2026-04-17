const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/clubs
router.get('/', (req, res) => {
  try {
    const clubs = db.prepare(`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, created_at
      FROM clubs WHERE status = 'active' ORDER BY members_count DESC
    `).all();
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id
router.get('/:id', (req, res) => {
  try {
    const club = db.prepare(`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, creator_id, created_at
      FROM clubs WHERE id = ?
    `).get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, description, cover, specialty, region, type } = req.body;
    if (!name) return res.status(400).json({ error: '请填写俱乐部名称' });
    const result = db.prepare(`
      INSERT INTO clubs (name, description, cover, specialty, region, type, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || '', cover || '', specialty || '', region || '', type || '综合', req.user.id);
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'founder');
    db.prepare('UPDATE clubs SET members_count = 1 WHERE id = ?').run(result.lastInsertRowid);
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(result.lastInsertRowid);
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/join（需要JWT）
router.post('/:id/join', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const existing = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (existing) return res.status(400).json({ error: '您已是该俱乐部成员' });
    db.prepare('INSERT INTO club_members (club_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    db.prepare('UPDATE clubs SET members_count = members_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '成功加入俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id/join（退出俱乐部，需要JWT）
router.delete('/:id/join', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(404).json({ error: '您不是该俱乐部成员' });
    if (member.role === 'founder') return res.status(400).json({ error: '创始人不能退出俱乐部' });
    db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('UPDATE clubs SET members_count = MAX(0, members_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '已退出俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
