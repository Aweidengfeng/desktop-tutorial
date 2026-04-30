/**
 * sentry.js — Sentry 错误监控（渐进增强）
 * 若未配置 SENTRY_DSN，则静默跳过。
 *
 * 环境变量：
 *   SENTRY_DSN         Sentry DSN URL
 *   SENTRY_ENV         环境标识（production/staging），默认 NODE_ENV
 *   SENTRY_TRACES_RATE 采样率 0~1，默认 0.1
 */

const SENTRY_ENABLED = !!process.env.SENTRY_DSN;
let Sentry = null;

function initSentry(app) {
  if (!SENTRY_ENABLED) return;
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'production',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration({ app }),
      ],
    });
    console.log('[Sentry] 已初始化，环境:', process.env.SENTRY_ENV || process.env.NODE_ENV);
  } catch (e) {
    console.warn('[Sentry] 初始化失败（@sentry/node 未安装？）:', e.message);
  }
}

function sentryRequestHandler() {
  if (!SENTRY_ENABLED || !Sentry) return (req, res, next) => next();
  return Sentry.expressErrorHandler ? Sentry.Handlers?.requestHandler?.() || ((req, res, next) => next()) : (req, res, next) => next();
}

function sentryErrorHandler() {
  if (!SENTRY_ENABLED || !Sentry) return (err, req, res, next) => next(err);
  try {
    return Sentry.expressErrorHandler();
  } catch (e) {
    return (err, req, res, next) => next(err);
  }
}

function captureException(err, context) {
  if (!SENTRY_ENABLED || !Sentry) return;
  try {
    Sentry.captureException(err, context);
  } catch (e) {}
}

module.exports = { initSentry, sentryRequestHandler, sentryErrorHandler, captureException, SENTRY_ENABLED };
