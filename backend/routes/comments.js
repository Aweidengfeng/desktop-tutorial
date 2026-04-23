const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const rateLimit = require('express-rate-limit');

const commentWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: '评论过于频繁，请稍后再试' }, standardHeaders: true, legacyHeaders: false });
const commentPollLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, message: { error: '请求过于频繁，请稍后再试' }, standardHeaders: true, legacyHeaders: false });
const commentLikeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '操作过于频繁' }, standardHeaders: true, legacyHeaders: false });

// GET /api/comments?post_id=X
router.get('/', commentPollLimiter, async (req, res) => {
  try {
    const post_id = parseInt(req.query.post_id);
    if (!post_id) return res.status(400).json({ error: '请提供帖子ID' });
    const comments = await prisma.$queryRaw`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, images, parent_comment_id as parentCommentId, reply_to_user_id as replyToUserId,
             reply_to_user_name as replyToUserName, likes, created_at as createdAt
      FROM comments WHERE post_id = ${post_id} ORDER BY created_at ASC
    `;
    const parsed = comments.map(c => ({ ...c, images: c.images ? JSON.parse(c.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/comments/poll?post_id=X&after=<lastCommentId> — 增量拉取新评论（前端轮询用，每分钟最多 120 次）
router.get('/poll', commentPollLimiter, async (req, res) => {
  try {
    const post_id = parseInt(req.query.post_id);
    const after = parseInt(req.query.after) || 0;
    if (!post_id) return res.status(400).json({ error: '请提供帖子ID' });
    const comments = await prisma.$queryRaw`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, images, parent_comment_id as parentCommentId, reply_to_user_id as replyToUserId,
             reply_to_user_name as replyToUserName, likes, created_at as createdAt
      FROM comments WHERE post_id = ${post_id} AND id > ${after} ORDER BY created_at ASC LIMIT 50
    `;
    const parsed = comments.map(c => ({ ...c, images: c.images ? JSON.parse(c.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/comments（需要JWT）
router.post('/', commentWriteLimiter, auth, async (req, res) => {
  try {
    const { post_id, content, images, parent_comment_id, reply_to_user_id } = req.body;
    const postId = parseInt(post_id);
    const imagesArr = Array.isArray(images) ? images : [];
    if (!postId) return res.status(400).json({ error: '请提供帖子ID' });
    if (!content && imagesArr.length === 0) return res.status(400).json({ error: '评论内容或图片不能为空' });
    if (content) {
      const check = moderation.checkText(content);
      if (!check.ok) {
        try {
          await prisma.$executeRaw`
            INSERT INTO moderation_logs (content_type, content_snippet, reason, user_id)
            VALUES ('comment', ${content.substring(0, 100)}, ${check.reason}, ${req.user.id})
          `;
        } catch(e) {}
        return res.status(422).json({ error: 'content_blocked', reason: check.reason });
      }
    }
    const [user] = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${req.user.id}`;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    let replyToUserName = null;
    if (parent_comment_id) {
      const [parentComment] = await prisma.$queryRaw`SELECT author_name FROM comments WHERE id = ${parseInt(parent_comment_id)}`;
      if (parentComment) replyToUserName = parentComment.author_name;
    }
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const parentId = parent_comment_id ? parseInt(parent_comment_id) : null;
    const replyToId = reply_to_user_id ? parseInt(reply_to_user_id) : null;
    await prisma.$executeRaw`
      INSERT INTO comments (post_id, user_id, author_name, author_avatar, content, images, parent_comment_id, reply_to_user_id, reply_to_user_name)
      VALUES (${postId}, ${req.user.id}, ${user.name}, ${user.avatar}, ${content || ''}, ${imagesStr}, ${parentId}, ${replyToId}, ${replyToUserName})
    `;
    await prisma.$executeRaw`UPDATE posts SET comments = comments + 1 WHERE id = ${postId}`;
    const [comment] = await prisma.$queryRaw`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, images, parent_comment_id as parentCommentId, reply_to_user_id as replyToUserId,
             reply_to_user_name as replyToUserName, likes, created_at as createdAt
      FROM comments WHERE user_id = ${req.user.id} AND post_id = ${postId} ORDER BY id DESC LIMIT 1
    `;
    comment.images = comment.images ? JSON.parse(comment.images) : [];
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/comments/:id/like — 评论点赞/取消点赞（需要JWT）
router.post('/:id/like', commentLikeLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [comment] = await prisma.$queryRaw`SELECT * FROM comments WHERE id = ${id}`;
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM comment_likes WHERE user_id = ${req.user.id} AND comment_id = ${id}
    `;
    if (existing) {
      await prisma.$executeRaw`DELETE FROM comment_likes WHERE user_id = ${req.user.id} AND comment_id = ${id}`;
      await prisma.$executeRaw`UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ${id}`;
      const [updated] = await prisma.$queryRaw`SELECT likes FROM comments WHERE id = ${id}`;
      res.json({ success: true, liked: false, likes: updated.likes });
    } else {
      await prisma.$executeRaw`INSERT INTO comment_likes (user_id, comment_id) VALUES (${req.user.id}, ${id})`;
      await prisma.$executeRaw`UPDATE comments SET likes = likes + 1 WHERE id = ${id}`;
      const [updated] = await prisma.$queryRaw`SELECT likes FROM comments WHERE id = ${id}`;
      res.json({ success: true, liked: true, likes: updated.likes });
    }
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
