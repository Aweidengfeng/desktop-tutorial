/**
 * webPush.js — Web Push 推送服务（渐进增强）
 * 若未配置 VAPID_PUBLIC_KEY，则静默跳过。
 *
 * 生成 VAPID 密钥对：
 *   node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
 *
 * 环境变量：
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_MAILTO      如 mailto:hello@unsummit.cn
 */

const PUSH_ENABLED = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let webpush = null;

function getWebPush() {
  if (webpush) return webpush;
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO || 'mailto:hello@unsummit.cn',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    return webpush;
  } catch (e) {
    console.warn('[webPush] web-push 未安装或初始化失败:', e.message);
    return null;
  }
}

/**
 * 发送推送通知
 * @param {object} subscription  PushSubscription 对象（含 endpoint, keys）
 * @param {object} payload  { title, body, icon, url, badge }
 */
async function sendPushNotification(subscription, payload) {
  if (!PUSH_ENABLED) return { skipped: true };
  const wp = getWebPush();
  if (!wp) return { skipped: true };
  try {
    await wp.sendNotification(subscription, JSON.stringify({
      title: payload.title || 'SummitLink',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      url: payload.url || '/',
    }));
    return { sent: true };
  } catch (e) {
    if (e.statusCode === 410) return { expired: true }; // 订阅已失效
    console.error('[webPush] 发送失败:', e.message);
    return { error: e.message };
  }
}

module.exports = { PUSH_ENABLED, sendPushNotification };
