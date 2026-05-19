/**
 * pushSender.js — 服务端原生推送发送（FCM / APNs）
 *
 * FCM (Android): 需要设置 FIREBASE_SERVICE_ACCOUNT_JSON 或
 *   FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * APNs (iOS): 需要设置 APNS_KEY_P8 + APNS_KEY_ID + APNS_TEAM_ID + APNS_BUNDLE_ID
 *
 * 任意一组未配置时优雅降级（console.warn + 跳过，不 crash）
 * 推送必须异步调用，失败不影响主业务流程。
 */

let firebaseApp = null;
let fcmEnabled = false;
let apnProvider = null;
let apnsEnabled = false;

// ── FCM 初始化 ─────────────────────────────────────────────────────────────

function initFCM() {
  if (fcmEnabled) return;
  try {
    const admin = require('firebase-admin');

    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(sa);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      console.warn('[Push] FCM 未配置：请设置 FIREBASE_SERVICE_ACCOUNT_JSON 或 FIREBASE_PROJECT_ID+FIREBASE_CLIENT_EMAIL+FIREBASE_PRIVATE_KEY');
      return;
    }

    if (!admin.apps.length) {
      firebaseApp = admin.initializeApp({ credential });
    } else {
      firebaseApp = admin.app();
    }
    fcmEnabled = true;
    console.log('[Push] FCM 初始化成功');
  } catch (e) {
    console.warn('[Push] FCM 初始化失败（firebase-admin 未安装或配置有误）:', e.message);
  }
}

// ── APNs 初始化 ────────────────────────────────────────────────────────────

function initAPNs() {
  if (apnsEnabled) return;
  try {
    const apn = require('node-apn');

    if (
      !process.env.APNS_KEY_P8 ||
      !process.env.APNS_KEY_ID ||
      !process.env.APNS_TEAM_ID ||
      !process.env.APNS_BUNDLE_ID
    ) {
      console.warn('[Push] APNs 未配置：请设置 APNS_KEY_P8 + APNS_KEY_ID + APNS_TEAM_ID + APNS_BUNDLE_ID');
      return;
    }

    apnProvider = new apn.Provider({
      token: {
        key: Buffer.from(process.env.APNS_KEY_P8),
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID,
      },
      production: process.env.NODE_ENV === 'production',
    });
    apnsEnabled = true;
    console.log('[Push] APNs 初始化成功');
  } catch (e) {
    console.warn('[Push] APNs 初始化失败（node-apn 未安装或配置有误）:', e.message);
  }
}

// 延迟初始化（仅在首次调用 sendPush 时初始化，不影响启动）
let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  initFCM();
  initAPNs();
}

/**
 * 向一组设备 token 发送推送通知。
 * 异步调用，失败不抛出（仅 console.warn）。
 *
 * @param {Array<{token: string, platform: string}>} tokens  - 设备 token 列表
 * @param {{title: string, body: string, data?: object}} payload - 推送内容
 */
async function sendPush(tokens, { title, body, data = {} }) {
  ensureInit();

  if (!tokens || tokens.length === 0) return;

  const androidTokens = tokens
    .filter(t => t.platform === 'android' && t.token)
    .map(t => t.token);
  const iosTokens = tokens
    .filter(t => t.platform === 'ios' && t.token)
    .map(t => t.token);

  // FCM — Android
  if (androidTokens.length > 0) {
    if (!fcmEnabled) {
      console.warn('[Push] FCM 未启用，跳过 Android 推送');
    } else {
      try {
        const admin = require('firebase-admin');
        const messaging = admin.messaging(firebaseApp);
        // 批量发送（Firebase Admin 最多 500 个/批）
        const chunkSize = 500;
        for (let i = 0; i < androidTokens.length; i += chunkSize) {
          const chunk = androidTokens.slice(i, i + chunkSize);
          const messages = chunk.map(token => ({
            token,
            notification: { title, body },
            data: Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
          }));
          const result = await messaging.sendEach(messages);
          const failCount = result.responses.filter(r => !r.success).length;
          if (failCount > 0) {
            console.warn(`[Push] FCM 批量发送：${result.successCount} 成功 / ${failCount} 失败`);
          }
        }
      } catch (e) {
        console.warn('[Push] FCM 发送失败:', e.message);
      }
    }
  }

  // APNs — iOS
  if (iosTokens.length > 0) {
    if (!apnsEnabled) {
      console.warn('[Push] APNs 未启用，跳过 iOS 推送');
    } else {
      try {
        const apn = require('node-apn');
        const note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600;
        note.badge = 1;
        note.sound = 'default';
        note.alert = { title, body };
        note.topic = process.env.APNS_BUNDLE_ID;
        if (data && Object.keys(data).length > 0) {
          note.payload = data;
        }
        const result = await apnProvider.send(note, iosTokens);
        if (result.failed && result.failed.length > 0) {
          console.warn('[Push] APNs 发送失败设备数:', result.failed.length, result.failed[0]);
        }
      } catch (e) {
        console.warn('[Push] APNs 发送失败:', e.message);
      }
    }
  }
}

module.exports = { sendPush };
