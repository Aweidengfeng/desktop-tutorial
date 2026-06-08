// 全局类型声明：后端通过 HTML 注入（旧版）或 /api/config 提供的运行时变量
interface Window {
  __API_BASE__?: string;
  __ENV__?: string;
  __MAP_PROVIDER__?: string;
  __MAPBOX_TOKEN__?: string;
  __AMAP_KEY__?: string;
  __AMAP_SECURITY_CODE__?: string;
  __STRIPE_PUBLISHABLE_KEY__?: string;
  __GOOGLE_CLIENT_ID__?: string;
  __APPLE_CLIENT_ID__?: string;
  __SENTRY_DSN__?: string;
}
