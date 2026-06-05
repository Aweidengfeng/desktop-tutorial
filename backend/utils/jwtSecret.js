/**
 * 集中管理 JWT 签名密钥。
 *
 * 目的：消除散落在各路由 / 中间件中的硬编码默认密钥
 *      （历史上为 `summitlink_dev_secret_do_not_use_in_production`）。
 *
 * 行为：
 *  - 已配置安全的 `JWT_SECRET` → 直接返回。
 *  - 生产环境未配置（或仍为开发占位）→ 抛错（fail-closed），
 *    绝不使用任何可预测的默认密钥签发/校验 Token。
 *  - 非生产环境未配置 → 返回带明显标识的开发占位密钥，便于本地/CI 运行。
 */
'use strict';

// 仅供开发 / 测试环境兜底的占位密钥，生产环境永不使用。
const DEV_ONLY_FALLBACK_SECRET = 'summitlink_dev_secret_do_not_use_in_production';

/**
 * 获取当前用于 JWT 的密钥。
 * @returns {string}
 * @throws {Error} 生产环境未正确配置 JWT_SECRET 时抛出
 */
function getJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured !== DEV_ONLY_FALLBACK_SECRET) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET 未配置安全值，生产环境拒绝使用默认密钥');
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

module.exports = { getJwtSecret, DEV_ONLY_FALLBACK_SECRET };
