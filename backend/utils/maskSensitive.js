'use strict';

/**
 * @file maskSensitive.js
 * @description 敏感信息脱敏工具
 *
 * 用于日志输出时脱敏 JWT token、银行卡号、手机号等敏感字段。
 */

const MASK_CHAR = '*';

/**
 * 脱敏字符串：保留前后 n 位，中间替换为 ***
 * @param {string} str  原始字符串
 * @param {number} keepStart  保留开头字符数（默认 4）
 * @param {number} keepEnd    保留结尾字符数（默认 4）
 * @returns {string}
 */
function maskString(str, keepStart = 4, keepEnd = 4) {
  if (!str || typeof str !== 'string') return str;
  const len = str.length;
  if (len <= keepStart + keepEnd) {
    return MASK_CHAR.repeat(Math.min(len, 6));
  }
  return str.slice(0, keepStart) + '***' + str.slice(len - keepEnd);
}

/**
 * 脱敏 JWT token（保留头部，隐藏 payload/signature）
 * @param {string} token
 * @returns {string}
 */
function maskJwt(token) {
  if (!token || typeof token !== 'string') return token;
  const parts = token.split('.');
  if (parts.length === 3) {
    return parts[0] + '.***.' + '***';
  }
  return maskString(token, 6, 0);
}

/**
 * 脱敏银行卡号（保留后 4 位）
 * @param {string} cardNo
 * @returns {string}
 */
function maskCardNumber(cardNo) {
  if (!cardNo || typeof cardNo !== 'string') return cardNo;
  const digits = cardNo.replace(/\D/g, '');
  if (digits.length < 4) return MASK_CHAR.repeat(digits.length);
  return MASK_CHAR.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * 脱敏手机号（保留前 3 位和后 4 位）
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return MASK_CHAR.repeat(digits.length);
  return digits.slice(0, 3) + MASK_CHAR.repeat(digits.length - 7) + digits.slice(-4);
}

/**
 * 通用敏感字符串脱敏（适用于 API key、密钥等）
 * @param {string} str
 * @returns {string}
 */
function maskSensitive(str) {
  if (!str || typeof str !== 'string') return str;
  // JWT token 格式（三段 base64 以点分隔，eyJ 开头）
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(str.trim())) {
    return maskJwt(str.trim());
  }
  // Stripe secret key 格式（sk_test_ / sk_live_）
  if (/^sk_(test|live)_/.test(str)) {
    return str.slice(0, 10) + '***';
  }
  // Stripe publishable key 格式（pk_test_ / pk_live_）
  if (/^pk_(test|live)_/.test(str)) {
    return str.slice(0, 10) + '***';
  }
  // 中国大陆手机号（11位，以1开头）
  if (/^1[3-9]\d{9}$/.test(str.replace(/\D/g, ''))) {
    return maskPhone(str);
  }
  // 通用：保留前4后4
  return maskString(str);
}

module.exports = { maskSensitive, maskJwt, maskCardNumber, maskPhone, maskString };
