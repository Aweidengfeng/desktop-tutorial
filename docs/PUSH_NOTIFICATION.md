# FCM / APNs 推送通知配置指南

SummitLink 支持通过 **Firebase Cloud Messaging（FCM）** 向 Android 设备发送原生推送，通过 **Apple Push Notification service（APNs）** 向 iOS 设备发送原生推送。

推送发送逻辑实现在 `backend/lib/pushSender.js`，在以下场景自动触发：

| 场景 | 接收方 | 推送内容 |
|------|--------|---------|
| `POST /api/sos/alert` — SOS 告警 | 所有管理员和向导 | 🆘 SOS 紧急告警 + 位置 |
| `POST /api/bookings` — 创建预约 | 目标向导/俱乐部管理员 | 📅 新预约通知 |
| `POST /api/messages/conversations/:id/messages` — 发送消息 | 消息接收方 | 💬 新消息通知 |

---

## Android（FCM）配置

### 步骤一：创建 Firebase 项目

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 点击「Add project」或选择现有项目
3. 在项目设置中，确认 Android 应用已注册（Package Name 与 `capacitor.config.json` 中的 `appId` 一致）

### 步骤二：获取服务账号密钥

1. Firebase Console → 项目设置 → 服务账号
2. 点击「生成新的私钥」→ 下载 `.json` 文件
3. 将 `.json` 文件内容压缩为单行，设置为环境变量 `FIREBASE_SERVICE_ACCOUNT_JSON`

```bash
# 将 JSON 文件压缩为单行（macOS/Linux）
cat firebase-service-account.json | jq -c . | pbcopy
```

或者使用三个独立变量：

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

### 步骤三：配置 Capacitor（移动端）

在 `capacitor.config.json` 中确认 Android 应用已配置：

```json
{
  "appId": "com.summitlink.app",
  "plugins": {
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }
  }
}
```

---

## iOS（APNs）配置

### 步骤一：创建 APNs Key

1. 前往 [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles → Keys
2. 点击 `+` 创建新 Key
3. 勾选「Apple Push Notifications service (APNs)」
4. 下载 `.p8` 文件（**每个 key 只能下载一次！**）

### 步骤二：设置环境变量

```env
# .p8 文件完整内容（包含 BEGIN/END 行，换行符用 \n）
APNS_KEY_P8="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMG...AQEFAAOCAQ8A\n-----END PRIVATE KEY-----\n"

# 密钥 ID（.p8 文件名中的 10 位字母数字，如 ABC123DEF4）
APNS_KEY_ID=ABC123DEF4

# Apple Developer Team ID（developer.apple.com → Membership → Team ID）
APNS_TEAM_ID=ABCDE12345

# iOS App Bundle ID
APNS_BUNDLE_ID=com.summitlink.app
```

### 步骤三：配置 Xcode

1. 在 Xcode 中打开 iOS 项目 → Signing & Capabilities
2. 点击 `+` → 添加「Push Notifications」能力
3. 确认 Provisioning Profile 包含 APNs 权限

---

## 优雅降级说明

- **未安装 `firebase-admin` 或 `node-apn`**：服务启动时 console.warn，推送跳过，不 crash
- **未配置 FCM 变量**：仅 Android 推送跳过，iOS 不受影响
- **未配置 APNs 变量**：仅 iOS 推送跳过，Android 不受影响
- **推送发送失败**：console.warn，不影响主业务流程（HTTP 响应已在推送前返回）

---

## 测试推送

### 方式一：使用测试接口（非生产环境）

```bash
curl -X POST https://your-api.com/api/push/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 方式二：Firebase Console 直接发送测试消息

1. Firebase Console → Messaging → 发送测试消息
2. 输入设备 token（可从 `/api/push/register-token` 日志中获取）

---

## 数据库字段

用户设备 token 存储在 `users` 表的以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `push_token` | TEXT | FCM / APNs 设备 token |
| `push_platform` | TEXT | `android` 或 `ios` |

客户端通过 `POST /api/push/register-token` 注册 token（在 Capacitor 原生应用获取到 token 后自动调用）。
