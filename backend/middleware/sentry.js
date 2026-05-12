/**
 * sentry.js — Sentry 错误监控（渐进增强）
 * 若未配置 SENTRY_DSN，则静默跳过。
 *
 * 环境变量：
 *   SENTRY_DSN         Sentry DSN URL
 *   SENTRY_ENV         环境标识（production/staging），默认 NODE_ENV
 *   SENTRY_TRACES_RATE 采样率 0~1，默认 0.1
 *   SENTRY_RELEASE     发布版本号（git sha / tag），用于 release health
 */

const SENTRY_ENABLED = !!process.env.SENTRY_DSN;
let Sentry = null;

// 上送 Sentry 前删除敏感字段，避免把 PII / 凭证泄露给第三方
const SENSITIVE_HEADER_KEYS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-investor-token',
  'x-admin-token', 'x-api-key', 'stripe-signature',
]);
const SENSITIVE_BODY_KEYS = new Set([
  'password', 'token', 'refreshToken', 'refresh_token', 'accessToken',
  'access_token', 'jwt', 'secret', 'apiKey', 'api_key',
  'phone', 'email', 'mobile', 'idCard', 'id_card', 'cardNumber', 'card_number',
  'cvc', 'cvv', 'pin',
]);

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (SENSITIVE_BODY_KEYS.has(lk)) {
      out[k] = '[Filtered]';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = scrub(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase()) ? '[Filtered]' : v;
  }
  return out;
}

function sentryBeforeSend(event) {
  try {
    if (event.request) {
      if (event.request.headers) event.request.headers = scrubHeaders(event.request.headers);
      if (event.request.cookies) event.request.cookies = '[Filtered]';
      if (event.request.data) event.request.data = scrub(event.request.data);
      if (event.request.query_string) {
        event.request.query_string = String(event.request.query_string)
          .replace(/(token|password|jwt|key)=[^&]*/gi, '$1=[Filtered]');
      }
    }
    if (event.user) {
      // 仅保留 id；删除 email/ip_address/username 等可识别字段
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }
    if (event.extra) event.extra = scrub(event.extra);
    if (event.contexts) event.contexts = scrub(event.contexts);
  } catch (_) { /* 永不阻塞上送 */ }
  return event;
}

function initSentry(app) {
  if (!SENTRY_ENABLED) return;
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'production',
      release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
      // 关闭默认 PII 收集
      sendDefaultPii: false,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration({ app }),
      ],
      beforeSend: sentryBeforeSend,
    });
    console.log('[Sentry] 已初始化，环境:', process.env.SENTRY_ENV || process.env.NODE_ENV);
  } catch (e) {
    console.warn('[Sentry] 初始化失败（@sentry/node 未安装？）:', e.message);
  }
}

function sentryRequestHandler() {
  if (!SENTRY_ENABLED || !Sentry) return (req, res, next) => next();
  return Sentry.Handlers?.requestHandler?.() || ((req, res, next) => next());
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
