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

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SENTRY_ENABLED = !!process.env.SENTRY_DSN;
let Sentry = null;
const REDACTED = '[REDACTED]';

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
const PII_PATTERNS = [
  /\b1[3-9]\d{9}\b/g, // 中国手机号
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, // 邮箱
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
  /sk_(live|test)_[a-z0-9]+/gi, // Stripe secret
];
const KNOWN_NOISE_PATTERNS = [
  /favicon\.ico/i,
  /chrome-extension:\/\//i,
  /networkerror when attempting to fetch resource/i,
];

function hashUserId(userId) {
  if (userId === undefined || userId === null) return undefined;
  return crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 12);
}

function scrubString(value) {
  if (typeof value !== 'string') return value;
  return PII_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), value);
}

function defaultSampleRate(env) {
  if (env === 'staging') return 1.0;
  return 0.1;
}

function resolveSampleRate(envName, env) {
  const override = process.env[envName];
  if (override !== undefined) {
    const parsed = Number.parseFloat(override);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  }
  return defaultSampleRate(env);
}

function readVersionFromFile() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();
  } catch (_) {
    return undefined;
  }
}

function resolveRelease() {
  const version = process.env.npm_package_version || readVersionFromFile();
  const releaseFromVersion = version ? `summitlink-backend@${version}` : undefined;
  return process.env.SENTRY_RELEASE || releaseFromVersion || process.env.RAILWAY_GIT_COMMIT_SHA || undefined;
}

function scrub(obj) {
  if (typeof obj === 'string') return scrubString(obj);
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (SENSITIVE_BODY_KEYS.has(lk)) {
      out[k] = REDACTED;
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
}

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase()) ? REDACTED : v;
  }
  return out;
}

function sentryBeforeSend(event) {
  try {
    const eventText = [event?.message, ...(event?.exception?.values || []).map(v => v?.value)]
      .filter(Boolean)
      .join(' ');
    if (KNOWN_NOISE_PATTERNS.some(pattern => pattern.test(eventText))) {
      return null;
    }

    if (event.message) event.message = scrubString(event.message);
    if (event.request) {
      if (event.request.headers) event.request.headers = scrubHeaders(event.request.headers);
      if (event.request.cookies) event.request.cookies = REDACTED;
      if (event.request.data) event.request.data = scrub(event.request.data);
      if (event.request.url) event.request.url = scrubString(String(event.request.url));
      if (event.request.query_string) {
        event.request.query_string = scrubString(String(event.request.query_string))
          .replace(/(token|password|jwt|key)=[^&]*/gi, `$1=${REDACTED}`);
      }
    }
    if (event.exception?.values) {
      event.exception.values.forEach((value) => {
        if (value?.value) value.value = scrubString(value.value);
      });
    }
    if (event.user) {
      // 仅保留 id；删除 email/ip_address/username 等可识别字段
      const id = hashUserId(event.user.id);
      event.user = id ? { id } : undefined;
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
    const sentryEnvironment = process.env.NODE_ENV || 'development';
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: sentryEnvironment,
      release: resolveRelease(),
      tracesSampleRate: resolveSampleRate('SENTRY_TRACES_RATE', sentryEnvironment),
      profilesSampleRate: resolveSampleRate('SENTRY_PROFILES_RATE', sentryEnvironment),
      // 关闭默认 PII 收集
      sendDefaultPii: false,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration({ app }),
      ],
      beforeSend: sentryBeforeSend,
    });
    console.log('[Sentry] 已初始化，环境:', sentryEnvironment);
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
    const userId = context && (context.userId || context.user_id);
    if (userId && typeof Sentry.withScope === 'function') {
      Sentry.withScope((scope) => {
        scope.setUser({ id: hashUserId(userId) });
        Sentry.captureException(err, context);
      });
      return;
    }
    Sentry.captureException(err, context);
  } catch (e) {}
}

function captureEvent(event, context = {}) {
  if (!SENTRY_ENABLED || !Sentry) return;
  try {
    const userId = context.userId || context.user_id;
    if (userId && typeof Sentry.withScope === 'function') {
      Sentry.withScope((scope) => {
        scope.setUser({ id: hashUserId(userId) });
        if (context.tags && typeof context.tags === 'object') {
          Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, String(v)));
        }
        if (context.extra && typeof context.extra === 'object') {
          Object.entries(scrub(context.extra)).forEach(([k, v]) => scope.setExtra(k, v));
        }
        Sentry.captureEvent(event);
      });
      return;
    }
    Sentry.captureEvent(event);
  } catch (_) {}
}

function setSentryUser(user) {
  if (!SENTRY_ENABLED || !Sentry) return;
  const id = hashUserId(user && user.id);
  if (!id) return;
  try {
    Sentry.setUser({ id });
  } catch (_) {}
}

module.exports = {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
  captureException,
  captureEvent,
  setSentryUser,
  sentryBeforeSend,
  SENTRY_ENABLED,
};
