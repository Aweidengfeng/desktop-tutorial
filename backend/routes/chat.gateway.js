const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const db = require('../db/database');
const { checkText } = require('../utils/moderation');

const SOS_KEYWORDS = ['救命', 'SOS', 'sos', '遇难', '求救', '紧急', '危险', '失联'];

function initChatGateway(server) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 5000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('auth_required'));
    try {
      const secret = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.id;
      next();
    } catch (e) {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;

    socket.on('chat:join', ({ conv_id }) => {
      if (!conv_id) return;
      socket.join(`conv:${conv_id}`);
    });

    socket.on('chat:leave', ({ conv_id }) => {
      if (!conv_id) return;
      socket.leave(`conv:${conv_id}`);
    });

    socket.on('chat:message', ({ conv_id, content, type = 'text', reply_to_id, content_json }) => {
      if (!conv_id || !content) return;
      const check = checkText(content);
      if (!check.ok) {
        socket.emit('chat:error', { error: 'content_blocked', reason: check.reason });
        return;
      }
      const isSOS = SOS_KEYWORDS.some(kw => content.includes(kw));
      try {
        const result = db.prepare(`
          INSERT INTO messages (conversation_id, sender_id, content, type, reply_to_id, content_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(conv_id, uid, content, type, reply_to_id || null, content_json ? JSON.stringify(content_json) : null);
        const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, last_msg_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv_id);
        io.to(`conv:${conv_id}`).emit('chat:message', msg);
        if (isSOS) {
          io.emit('sos:alert', { userId: uid, conv_id, content, msg_id: msg.id });
        }
      } catch (e) {
        socket.emit('chat:error', { error: 'db_error' });
      }
    });

    socket.on('chat:typing', ({ conv_id, is_typing }) => {
      if (!conv_id) return;
      socket.to(`conv:${conv_id}`).emit('chat:typing', { userId: uid, is_typing });
    });

    socket.on('chat:read', ({ conv_id, msg_id }) => {
      if (!conv_id || !msg_id) return;
      try {
        db.prepare('INSERT OR IGNORE INTO message_reads (msg_id, user_id) VALUES (?, ?)').run(msg_id, uid);
        try {
          db.prepare('UPDATE conversation_members SET last_read_msg_id = ? WHERE conv_id = ? AND user_id = ?').run(msg_id, conv_id, uid);
        } catch(e) {}
        socket.to(`conv:${conv_id}`).emit('chat:read', { userId: uid, msg_id });
      } catch (e) {}
    });

    socket.on('chat:recall', ({ msg_id }) => {
      if (!msg_id) return;
      try {
        const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(msg_id, uid);
        if (!msg) { socket.emit('chat:error', { error: 'not_found' }); return; }
        db.prepare('UPDATE messages SET recalled_at = CURRENT_TIMESTAMP WHERE id = ?').run(msg_id);
        io.to(`conv:${msg.conversation_id}`).emit('chat:recall', { msg_id });
      } catch (e) {
        socket.emit('chat:error', { error: 'db_error' });
      }
    });

    // ── 群聊 ──────────────────────────────────────────────────────────────

    socket.on('group:join', ({ chat_id }) => {
      if (!chat_id) return;
      // 验证成员身份
      const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(chat_id, uid);
      if (!member) { socket.emit('chat:error', { error: 'not_member' }); return; }
      socket.join(`group:${chat_id}`);
    });

    socket.on('group:leave', ({ chat_id }) => {
      if (!chat_id) return;
      socket.leave(`group:${chat_id}`);
    });

    socket.on('group:message', ({ chat_id, content, type = 'text', images }) => {
      if (!chat_id || (!content && (!images || images.length === 0))) {
        socket.emit('chat:error', { error: 'empty_message' });
        return;
      }
      const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(chat_id, uid);
      if (!member) { socket.emit('chat:error', { error: 'not_member' }); return; }
      if (content) {
        const check = checkText(content);
        if (!check.ok) { socket.emit('chat:error', { error: 'content_blocked', reason: check.reason }); return; }
      }
      try {
        const imagesArr = Array.isArray(images) ? images : [];
        const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
        const msgType = type || (imagesArr.length > 0 && content ? 'mixed' : imagesArr.length > 0 ? 'image' : 'text');
        const result = db.prepare(
          'INSERT INTO group_messages (chat_id, sender_id, content, type, images) VALUES (?, ?, ?, ?, ?)'
        ).run(chat_id, uid, content || '', msgType, imagesStr);
        const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(uid);
        const msg = db.prepare('SELECT id, sender_id, content, type, images, created_at FROM group_messages WHERE id = ?').get(result.lastInsertRowid);
        msg.images = msg.images ? JSON.parse(msg.images) : [];
        msg.senderName = user ? user.name : '';
        msg.senderAvatar = user ? user.avatar : '';
        io.to(`group:${chat_id}`).emit('group:message', msg);
      } catch (e) {
        socket.emit('chat:error', { error: 'db_error' });
      }
    });

    socket.on('group:typing', ({ chat_id, is_typing }) => {
      if (!chat_id) return;
      socket.to(`group:${chat_id}`).emit('group:typing', { userId: uid, is_typing });
    });
  });

  return io;
}

module.exports = { initChatGateway };
