const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const prisma = require('../db/prisma');
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

    socket.on('chat:message', async ({ conv_id, content, type = 'text', reply_to_id, content_json }) => {
      if (!conv_id || !content) return;
      const check = checkText(content);
      if (!check.ok) {
        socket.emit('chat:error', { error: 'content_blocked', reason: check.reason });
        return;
      }
      const isSOS = SOS_KEYWORDS.some(kw => content.includes(kw));
      try {
        await prisma.$executeRaw`INSERT INTO messages (conversation_id, sender_id, content, type, reply_to_id, content_json) VALUES (${conv_id}, ${uid}, ${content}, ${type}, ${reply_to_id || null}, ${content_json ? JSON.stringify(content_json) : null})`;
        // TODO(Phase1-PG): PostgreSQL迁移时替换为 RETURNING id 语法
        // 参考：INSERT INTO messages (...) VALUES (...) RETURNING id
        const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
        const msg = (await prisma.$queryRaw`SELECT * FROM messages WHERE id = ${Number(idRow.id)}`)[0];
        await prisma.$executeRaw`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, last_msg_at = CURRENT_TIMESTAMP WHERE id = ${conv_id}`;
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

    socket.on('chat:read', async ({ conv_id, msg_id }) => {
      if (!conv_id || !msg_id) return;
      try {
        await prisma.$executeRaw`INSERT OR IGNORE INTO message_reads (msg_id, user_id) VALUES (${msg_id}, ${uid})`;
        try {
          await prisma.$executeRaw`UPDATE conversation_members SET last_read_msg_id = ${msg_id} WHERE conv_id = ${conv_id} AND user_id = ${uid}`;
        } catch(e) {}
        socket.to(`conv:${conv_id}`).emit('chat:read', { userId: uid, msg_id });
      } catch (e) {}
    });

    socket.on('chat:recall', async ({ msg_id }) => {
      if (!msg_id) return;
      try {
        const msg = (await prisma.$queryRaw`SELECT * FROM messages WHERE id = ${msg_id} AND sender_id = ${uid}`)[0];
        if (!msg) { socket.emit('chat:error', { error: 'not_found' }); return; }
        await prisma.$executeRaw`UPDATE messages SET recalled_at = CURRENT_TIMESTAMP WHERE id = ${msg_id}`;
        io.to(`conv:${msg.conversation_id}`).emit('chat:recall', { msg_id });
      } catch (e) {
        socket.emit('chat:error', { error: 'db_error' });
      }
    });

    socket.on('group:join', async ({ chat_id }) => {
      if (!chat_id) return;
      const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${chat_id} AND user_id = ${uid}`)[0];
      if (!member) { socket.emit('chat:error', { error: 'not_member' }); return; }
      socket.join(`group:${chat_id}`);
    });

    socket.on('group:leave', ({ chat_id }) => {
      if (!chat_id) return;
      socket.leave(`group:${chat_id}`);
    });

    socket.on('group:message', async ({ chat_id, content, type = 'text', images }) => {
      if (!chat_id || (!content && (!images || images.length === 0))) {
        socket.emit('chat:error', { error: 'empty_message' });
        return;
      }
      const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${chat_id} AND user_id = ${uid}`)[0];
      if (!member) { socket.emit('chat:error', { error: 'not_member' }); return; }
      if (content) {
        const check = checkText(content);
        if (!check.ok) { socket.emit('chat:error', { error: 'content_blocked', reason: check.reason }); return; }
      }
      try {
        const imagesArr = Array.isArray(images) ? images : [];
        const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
        const msgType = type || (imagesArr.length > 0 && content ? 'mixed' : imagesArr.length > 0 ? 'image' : 'text');
        await prisma.$executeRaw`INSERT INTO group_messages (chat_id, sender_id, content, type, images) VALUES (${chat_id}, ${uid}, ${content || ''}, ${msgType}, ${imagesStr})`;
        // TODO(Phase1-PG): PostgreSQL迁移时替换为 RETURNING id 语法
        // 参考：INSERT INTO group_messages (...) VALUES (...) RETURNING id
        const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
        const user = (await prisma.$queryRaw`SELECT name, avatar FROM users WHERE id = ${uid}`)[0];
        const msg = (await prisma.$queryRaw`SELECT id, sender_id, content, type, images, created_at FROM group_messages WHERE id = ${Number(idRow.id)}`)[0];
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
