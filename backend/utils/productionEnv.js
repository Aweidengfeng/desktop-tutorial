'use strict';

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function validateCorsOrigins(value) {
  if (!value) return ['CORS_ORIGINS 未设置'];

  const origins = value.split(',').map(origin => origin.trim());
  if (origins.some(origin => origin === '')) {
    return ['CORS_ORIGINS 包含空白项，请使用英文逗号分隔且不要留空'];
  }

  const errors = [];
  for (const origin of origins) {
    const parsed = parseOrigin(origin);
    if (!parsed || parsed.origin !== origin) {
      errors.push(`CORS_ORIGINS 中的 ${origin} 必须是完整 origin，不能包含路径、查询或片段`);
      continue;
    }
    if (parsed.protocol !== 'https:') {
      errors.push(`CORS_ORIGINS 中的 ${origin} 必须使用 HTTPS`);
    }
  }

  return errors;
}

function validateProductionEnv(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const errors = [];

  if (env.DATABASE_PROVIDER !== 'postgresql') {
    errors.push(
      'DATABASE_PROVIDER 必须设置为 postgresql（当前为 ' +
        (env.DATABASE_PROVIDER || '未设置') +
        '），禁止在生产使用 SQLite'
    );
  }

  errors.push(...validateCorsOrigins(env.CORS_ORIGINS));

  if (!env.RESEND_API_KEY) {
    errors.push('RESEND_API_KEY 未设置，官网线索邮件不会真实发送');
  }
  if (!env.RESEND_FROM) {
    errors.push('RESEND_FROM 未设置，必须使用 Resend 已验证域名下的发件邮箱');
  }
  if (!env.LEADS_NOTIFY_EMAIL && !env.ADMIN_EMAIL) {
    errors.push('LEADS_NOTIFY_EMAIL 或 ADMIN_EMAIL 至少设置一个，用于接收官网线索通知');
  }

  return errors;
}

function assertProductionEnvReady(env = process.env) {
  const errors = validateProductionEnv(env);
  if (errors.length === 0) return;

  console.error('❌ 生产环境变量未就绪：');
  errors.forEach(error => console.error(`   • ${error}`));
  console.error('请补齐 Railway / 部署平台 Variables 后重新部署。');
  process.exit(1);
}

module.exports = {
  assertProductionEnvReady,
  validateProductionEnv,
  validateCorsOrigins,
};
