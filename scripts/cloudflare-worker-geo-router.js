/**
 * scripts/cloudflare-worker-geo-router.js
 *
 * Cloudflare Worker：按用户地理位置智能分流
 *
 * 逻辑：
 *   - 请求来自中国大陆 (CF-IPCountry = CN) → 转发到腾讯云上海节点
 *   - 其他所有地区 → 转发到 Railway 海外节点
 *
 * 部署方法：
 *   1. 登录 Cloudflare Dashboard → Workers & Pages → Create Worker
 *   2. 粘贴本文件内容并保存部署
 *   3. 在 Worker 设置页面添加环境变量（推荐）或直接修改下方默认值：
 *      - CN_BACKEND  : 腾讯云后端 URL（如 http://49.234.163.103）
 *      - RAILWAY_BACKEND : Railway 生产 URL（如 https://xxx.railway.app）
 *   4. 配置 Worker 路由：summitlink.app/* → 此 Worker
 *
 * 注意事项：
 *   - CF-IPCountry 头由 Cloudflare 自动注入，无法被伪造
 *   - 免费计划每天 100k 请求，付费计划 10M/月起
 *   - 备案期间若需关闭 CN 分流，将 CN_BYPASS=true 设为环境变量即可
 */

const DEFAULT_CN_BACKEND = 'http://49.234.163.103';
// Set RAILWAY_BACKEND env var in Worker settings (Workers & Pages → Settings → Variables)
const DEFAULT_RAILWAY_BACKEND = 'https://your-app.railway.app';

export default {
  async fetch(request, env) {
    const cnBackend = env.CN_BACKEND || DEFAULT_CN_BACKEND;
    const railwayBackend = env.RAILWAY_BACKEND || DEFAULT_RAILWAY_BACKEND;
    const cnBypass = env.CN_BYPASS === 'true';

    const country = request.headers.get('CF-IPCountry') || '';
    const url = new URL(request.url);

    // 选择后端节点
    let backendBase;
    if (!cnBypass && country === 'CN') {
      backendBase = cnBackend;
    } else {
      backendBase = railwayBackend;
    }

    // 构建转发 URL
    const targetUrl = `${backendBase}${url.pathname}${url.search}`;

    // 复制原始请求头，注入地区标识
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', url.hostname);
    headers.set('X-Origin-Country', country);
    headers.set('X-Routed-To', country === 'CN' && !cnBypass ? 'cn' : 'global');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        redirect: 'follow',
      });

      // 复制响应，追加分流标识头
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-SummitLink-Region', country === 'CN' && !cnBypass ? 'cn' : 'global');
      newHeaders.set('X-SummitLink-Backend', backendBase);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      // 主节点失败时，尝试 Railway 作为兜底
      if (backendBase !== railwayBackend) {
        console.error(`CN backend failed (${err.message}), falling back to Railway`);
        const fallbackUrl = `${railwayBackend}${url.pathname}${url.search}`;
        const fallbackHeaders = new Headers(request.headers);
        fallbackHeaders.set('X-Fallback', 'true');
        fallbackHeaders.set('X-Fallback-Reason', err.message);

        return fetch(fallbackUrl, {
          method: request.method,
          headers: fallbackHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
          redirect: 'follow',
        });
      }

      return new Response(JSON.stringify({ error: 'Service unavailable', detail: err.message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
