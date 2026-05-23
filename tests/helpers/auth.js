/**
 * 认证辅助工具
 * 提供快速创建测试用户、获取 JWT token 的函数
 */

const path = require('path');
const { createRequire } = require('module');

const requireFromBackend = createRequire(path.resolve(__dirname, '../../backend/package.json'));
const jwt = requireFromBackend('jsonwebtoken');
const bcrypt = requireFromBackend('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-summitlink';
let userSeq = 0;

/**
 * 在数据库中创建一个普通测试用户
 * @param {object} db - better-sqlite3 数据库实例
 * @param {object} [opts]
 * @returns {{ id, token }} 用户 ID 和 JWT token
 */
function createTestUser(db, opts = {}) {
  userSeq += 1;
  const uniqueSuffix = String(userSeq).padStart(8, '0');
  const phone = opts.phone || `138${uniqueSuffix}`;
  const name  = opts.name  || '测试用户_' + phone.slice(-4);
  // Include timestamp to avoid username conflicts across test runs on a shared DB file
  const tsComponent = String(Date.now()).slice(-6);
  const username = opts.username || `@testuser_${phone.slice(-4)}_${uniqueSuffix}_${tsComponent}`;
  const password = opts.password || 'test123456';
  const hash = bcrypt.hashSync(password, 1); // 低 cost，加快测试
  const policyVersion = '2026-04-20';

  try {
    const result = db.prepare(`
      INSERT INTO users (name, username, phone, password, avatar, policy_version, policy_agreed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, username, phone, hash, 'https://i.pravatar.cc/150?u=' + phone, policyVersion, new Date().toISOString());
    const id = result.lastInsertRowid;
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '1d' });
    return { id, token, phone, password };
  } catch (e) {
    // 可能重复插入，返回现有记录
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) throw e; // re-throw if user was never actually created
    const id = user.id;
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '1d' });
    return { id, token, phone, password };
  }
}

/**
 * 创建管理员 JWT token（isAdmin: true）
 * @returns {string} Bearer token
 */
function createAdminToken() {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-summitlink';
  return jwt.sign({ isAdmin: true, username: 'admin' }, secret, { expiresIn: '1d' });
}

/**
 * 生成带 Authorization 头部的 supertest agent 帮助方法
 * @param {import('supertest').SuperTest} agent
 * @param {string} token
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createTestUser, createAdminToken, authHeader };
