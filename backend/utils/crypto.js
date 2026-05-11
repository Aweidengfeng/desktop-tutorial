/**
 * SummitLink PII 字段加密工具
 * 使用 AES-256-GCM 对称加密，密钥来自环境变量 PII_ENCRYPTION_KEY
 * 格式：iv(24 hex):authTag(32 hex):encryptedData(hex)
 *
 * 注意：PII 字段（手机号、邮箱等）需要支持等值查找（如登录、唯一性校验），
 * 因此采用**确定性加密**——IV 由 HMAC(key, plaintext) 派生而非随机生成。
 * 这样同一明文每次产出相同密文，便于以密文直接 WHERE 等值匹配。
 * 该模式（类似 AES-GCM-SIV 思路）会泄露"两条记录是否相同"的信息，
 * 但对 `@unique` 的手机号/邮箱字段而言这本就是公开属性，
 * 仍可在数据库泄漏场景下保障明文机密性与完整性。
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.PII_ENCRYPTION_KEY;

function getKey() {
  if (!KEY_HEX) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: PII_ENCRYPTION_KEY is not set in production');
    }
    // 开发环境使用固定测试密钥（32字节）
    return Buffer.from('summitlink_dev_pii_key_32bytes!!', 'utf8');
  }
  const buf = Buffer.from(KEY_HEX, 'hex');
  if (buf.length !== 32) throw new Error('PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return buf;
}

// 从明文派生确定性 IV（96 位，HMAC-SHA256 截断）
function deriveIv(key, plaintext) {
  return crypto.createHmac('sha256', key).update(plaintext, 'utf8').digest().subarray(0, 12);
}

/**
 * 加密 PII 字段（确定性）
 * @param {string} plaintext
 * @returns {string} "iv:authTag:encrypted" 格式的密文
 */
function encryptPII(plaintext) {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = deriveIv(key, String(plaintext));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 解密 PII 字段
 * @param {string} ciphertext "iv:authTag:encrypted" 格式
 * @returns {string} 明文
 */
function decryptPII(ciphertext) {
  if (!ciphertext) return ciphertext;
  // 如果不包含冒号，说明是旧的明文数据，直接返回（向后兼容）
  if (!ciphertext.includes(':')) return ciphertext;
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // 格式异常，降级返回
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * 判断字符串是否已加密（检查格式）
 */
function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

module.exports = { encryptPII, decryptPII, isEncrypted };
