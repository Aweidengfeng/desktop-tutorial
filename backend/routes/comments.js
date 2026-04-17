const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/comments?post_id=X
router.get('/', (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ error: '请提供帖子ID' });
    const comments = db.prepare(`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, images, parent_comment_id as parentCommentId, reply_to_user_id as replyToUserId,
             reply_to_user_name as replyToUserName, likes, created_at as createdAt
      FROM comments WHERE post_id = ? ORDER BY created_at ASC
    `).all(post_id);
    const parsed = comments.map(c => ({ ...c, images: c.images ? JSON.parse(c.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/comments（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { post_id, content, images, parent_comment_id, reply_to_user_id } = req.body;
    const imagesArr = Array.isArray(images) ? images : [];
    if (!post_id) return res.status(400).json({ error: '请提供帖子ID' });
    if (!content && imagesArr.length === 0) return res.status(400).json({ error: '评论内容或图片不能为空' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    let replyToUserName = null;
    if (parent_comment_id) {
      const parentComment = db.prepare('SELECT author_name FROM comments WHERE id = ?').get(parent_comment_id);
      if (parentComment) replyToUserName = parentComment.author_name;
    }
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, author_name, author_avatar, content, images, parent_comment_id, reply_to_user_id, reply_to_user_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(post_id, req.user.id, user.name, user.avatar, content || '',
           imagesStr, parent_comment_id || null, reply_to_user_id || null, replyToUserName);
    db.prepare('UPDATE posts SET comments = comments + 1 WHERE id = ?').run(post_id);
    const comment = db.prepare(`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, images, parent_comment_id as parentCommentId, reply_to_user_id as replyToUserId,
             reply_to_user_name as replyToUserName, likes, created_at as createdAt
      FROM comments WHERE id = ?
    `).get(result.lastInsertRowid);
    comment.images = comment.images ? JSON.parse(comment.images) : [];
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/comments/:id/like — 评论点赞/取消点赞（需要JWT）
router.post('/:id/like', auth, (req, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    const existing = db.prepare('SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, req.params.id);
    if (existing) {
      db.prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?').run(req.user.id, req.params.id);
      db.prepare('UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?').run(req.params.id);
      const updated = db.prepare('SELECT likes FROM comments WHERE id = ?').get(req.params.id);
      res.json({ success: true, liked: false, likes: updated.likes });
    } else {
      db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, req.params.id);
      db.prepare('UPDATE comments SET likes = likes + 1 WHERE id = ?').run(req.params.id);
      const updated = db.prepare('SELECT likes FROM comments WHERE id = ?').get(req.params.id);
      res.json({ success: true, liked: true, likes: updated.likes });
    }
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
