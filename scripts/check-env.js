/**
 * SummitLink Environment Variable Checker
 * 检查所有必需的环境变量是否已配置
 * 在 Railway 启动时自动运行
 */

const REQUIRED = [
  { key: 'DATABASE_URL', desc: 'PostgreSQL 连接字符串' },
  { key: 'JWT_SECRET', desc: 'JWT签名密钥（最少32字符）' },
  { key: 'ADMIN_PASSWORD', desc: '管理员登录密码（生产必需）' },
];

const RECOMMENDED = [
  { key: 'STRIPE_SECRET_KEY', desc: 'Stripe支付密钥（上架必需）' },
  { key: 'STRIPE_PUBLISHABLE_KEY', desc: 'Stripe公开密钥' },
  { key: 'SENTRY_DSN', desc: 'Sentry错误监控（强烈推荐）' },
  { key: 'MAPBOX_TOKEN', desc: 'Mapbox地图Token（海外用户必需）' },
  { key: 'PII_ENCRYPTION_KEY', desc: 'PII字段加密密钥（32字节hex）' },
  { key: 'CORS_ORIGINS', desc: '生产环境 CORS 白名单（逗号分隔）' },
  { key: 'API_BASE', desc: '服务对外 URL（用于前端注入）' },
];

const OPTIONAL = [
  { key: 'AMAP_KEY', desc: '高德地图Key（中国用户）' },
  { key: 'AMAP_SECURITY_CODE', desc: '高德安全码（AMap Web JS API 2.0 必需）' },
  { key: 'COS_BUCKET', desc: '腾讯云 COS 存储桶' },
  { key: 'APPLE_CLIENT_ID', desc: 'Apple Sign In（iOS上架需要）' },
  { key: 'GOOGLE_CLIENT_ID', desc: 'Google OAuth' },
  { key: 'NODE_ENV', desc: '运行环境（production/development）' },
  { key: 'PORT', desc: '服务端口（Railway自动设置）' },
  // FCM / APNs 原生推送（可选，未配置时推送功能降级）
  { key: 'FIREBASE_SERVICE_ACCOUNT_JSON', desc: 'FCM Android 推送（Firebase 服务账号 JSON）' },
  { key: 'FIREBASE_PROJECT_ID', desc: 'FCM 项目 ID（与 SERVICE_ACCOUNT_JSON 二选一）' },
  { key: 'FIREBASE_CLIENT_EMAIL', desc: 'FCM 服务账号邮箱' },
  { key: 'FIREBASE_PRIVATE_KEY', desc: 'FCM 服务账号私钥' },
  { key: 'APNS_KEY_P8', desc: 'APNs iOS 推送密钥（.p8 内容）' },
  { key: 'APNS_KEY_ID', desc: 'APNs 密钥 ID（10位）' },
  { key: 'APNS_TEAM_ID', desc: 'Apple Developer Team ID' },
  { key: 'APNS_BUNDLE_ID', desc: 'iOS App Bundle ID（如 com.summitlink.app）' },
  // 腾讯云短信（可选，未配置时自动 mock）
  { key: 'TENCENT_SMS_SECRET_ID', desc: '腾讯云短信 SecretId（未配则走 mock）' },
  { key: 'TENCENT_SMS_SECRET_KEY', desc: '腾讯云短信 SecretKey（未配则走 mock）' },
  { key: 'TENCENT_SMS_APP_ID', desc: '腾讯云短信 AppID（兼容 TENCENT_SMS_SDK_APP_ID）' },
  { key: 'TENCENT_SMS_SIGN_NAME', desc: '腾讯云短信签名（可选）' },
  { key: 'TENCENT_SMS_TEMPLATE_ID', desc: '腾讯云短信模板 ID（可选）' },
  // 上架费配置
  { key: 'GUIDE_LISTING_FEE_USD', desc: '向导上架费（美元，默认 299）' },
  { key: 'CLUB_LISTING_FEE_USD', desc: '俱乐部上架费（美元，默认 499）' },
  // 微信支付 / 分账（可选，未配置时自动 mock）
  { key: 'WECHAT_MCH_ID', desc: '微信商户号（未配则支付走 mock）' },
  { key: 'WECHAT_APP_ID', desc: '微信 AppID（未配则支付走 mock）' },
  { key: 'WECHAT_APPID', desc: '微信 OAuth AppID（登录）' },
  { key: 'WECHAT_SECRET', desc: '微信 OAuth Secret（登录）' },
  { key: 'WECHAT_API_V3_KEY', desc: '微信支付 API v3 Key（未配则支付走 mock）' },
  { key: 'WECHAT_CERT_SERIAL', desc: '微信商户证书序列号（未配则支付走 mock）' },
  { key: 'WECHAT_PRIVATE_KEY', desc: '微信商户私钥（base64 PEM，未配则支付走 mock）' },
  { key: 'WECHAT_PLATFORM_PUBLIC_KEY', desc: '微信平台公钥（回调验签可选）' },
  { key: 'WECHAT_SPLIT_ENABLED', desc: '微信分账开关（默认 false，false 时走 mock）' },
  // 支付宝（可选，未配置时自动 mock）
  { key: 'ALIPAY_APP_ID', desc: '支付宝 AppID（未配则支付走 mock）' },
  { key: 'ALIPAY_PRIVATE_KEY', desc: '支付宝私钥（base64 PKCS8，未配则支付走 mock）' },
  { key: 'ALIPAY_PUBLIC_KEY', desc: '支付宝公钥（base64，未配则支付走 mock）' },
  // 地图相关（PR-34 新增）
  { key: 'OPENWEATHER_API_KEY', desc: '天气 API Key（未配则天气功能降级）' },
  // 向导提现 / Stripe Connect（PR-39 新增）
  { key: 'STRIPE_CONNECT_CLIENT_ID', desc: 'Stripe Connect 平台 Client ID（向导提现转账）' },
  // 微信 H5 QR 码（PR-42 新增）
  { key: 'PAYMENT_NOTIFY_URL', desc: '支付回调通知 URL（完整 HTTPS 地址）' },
  // 部署区域
  { key: 'DEPLOY_REGION', desc: '部署区域（cn / us，影响支付提供商默认值）' },
  { key: 'DATABASE_PROVIDER', desc: '数据库驱动（sqlite / postgresql）' },
  { key: 'UPLOADS_DIR', desc: '上传目录路径（可选）' },
  { key: 'ENABLE_API_DOCS', desc: '是否开启 API 文档' },
  { key: 'ENABLE_SWAGGER', desc: '是否开启 Swagger 文档' },
  { key: 'ENABLE_ASSISTANT', desc: '是否启用 AI 助手接口' },
  { key: 'SENTRY_ENV', desc: 'Sentry 环境标识' },
  { key: 'SENTRY_RELEASE', desc: 'Sentry 发布版本' },
  { key: 'LOG_LEVEL', desc: '后端日志级别' },
  { key: 'STRIPE_DISABLED', desc: 'Stripe 降级开关' },
  { key: 'TENCENT_COS_SECRET_ID', desc: '腾讯云 COS SecretId（兼容变量）' },
  { key: 'COS_SECRET_ID', desc: 'COS SecretId（兼容变量）' },
];

let hasError = false;

console.log('\n🔧 SummitLink Environment Variable Check\n');

console.log('── Required ──');
REQUIRED.forEach(({ key, desc }) => {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ ${key} 未设置 — ${desc}`);
    hasError = true;
  } else {
    const preview = val.length > 20 ? `${val.substring(0, 8)}...` : '***';
    console.log(`✅ ${key} = ${preview}`);
    if (key === 'JWT_SECRET' && val.length < 32) {
      console.warn(`⚠️  JWT_SECRET 过短（当前${val.length}字符，建议≥32）`);
    }
  }
});

console.log('\n── Recommended ──');
RECOMMENDED.forEach(({ key, desc }) => {
  const val = process.env[key];
  if (!val) {
    console.warn(`⚠️  ${key} 未设置 — ${desc}`);
  } else {
    console.log(`✅ ${key} 已配置`);
  }
});

console.log('\n── Optional ──');
OPTIONAL.forEach(({ key, desc }) => {
  const val = process.env[key];
  console.log(`${val ? '✅' : '⬜'} ${key}${val ? ' 已配置' : ` (未设置) — ${desc}`}`);
});

console.log('');

if (hasError && process.env.NODE_ENV === 'production') {
  const count = REQUIRED.filter(({ key }) => !process.env[key]).length;
  console.error(`\n❌ 发现 ${count} 个必须变量未配置，服务可能无法正常启动！\n`);
  process.exit(1);
} else if (hasError) {
  const count = REQUIRED.filter(({ key }) => !process.env[key]).length;
  console.warn(`\n⚠️  开发模式：发现 ${count} 个必须变量未配置（允许继续）\n`);
} else {
  console.log('\n✅ 环境变量检查完毕\n');
}
