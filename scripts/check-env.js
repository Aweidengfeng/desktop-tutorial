/**
 * SummitLink Environment Variable Checker
 * 检查所有必需的环境变量是否已配置
 * 在 Railway 启动时自动运行
 */

const REQUIRED = [
  { key: 'DATABASE_URL', desc: 'PostgreSQL 连接字符串' },
  { key: 'JWT_SECRET', desc: 'JWT签名密钥（最少32字符）' },
];

const RECOMMENDED = [
  { key: 'STRIPE_SECRET_KEY', desc: 'Stripe支付密钥（上架必需）' },
  { key: 'STRIPE_PUBLISHABLE_KEY', desc: 'Stripe公开密钥' },
  { key: 'SENTRY_DSN', desc: 'Sentry错误监控（强烈推荐）' },
  { key: 'MAPBOX_TOKEN', desc: 'Mapbox地图Token（海外用户必需）' },
  { key: 'ENCRYPTION_KEY', desc: 'PII字段加密密钥（32字节hex）' },
];

const OPTIONAL = [
  { key: 'AMAP_KEY', desc: '高德地图Key（中国用户）' },
  { key: 'AMAP_SECURITY_KEY', desc: '高德安全码' },
  { key: 'COS_BUCKET', desc: '腾讯云 COS 存储桶' },
  { key: 'APPLE_CLIENT_ID', desc: 'Apple Sign In（iOS上架需要）' },
  { key: 'GOOGLE_CLIENT_ID', desc: 'Google OAuth' },
  { key: 'NODE_ENV', desc: '运行环境（production/development）' },
  { key: 'PORT', desc: '服务端口（Railway自动设置）' },
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
  console.error('💥 必需环境变量缺失，生产环境禁止启动！\n');
  process.exit(1);
} else if (hasError) {
  console.warn('⚠️  开发模式：跳过必需变量检查\n');
} else {
  console.log('✅ 环境变量检查通过，启动服务...\n');
}
