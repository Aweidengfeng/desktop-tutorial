# 环境变量详细说明

本文档列出 SummitLink 后端所有环境变量的完整说明、默认值、是否必需及示例值。

配置文件位置：`backend/.env`（从 `backend/.env.example` 复制后修改）。

---

## 完整环境变量表

### 基础配置

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `NODE_ENV` | 否 | `development` | `production` | 运行环境。生产部署时**必须**设为 `production`，否则 CORS 白名单校验和启动安全检查不会启用 |
| `PORT` | 否 | `8080` | `3000` | HTTP 服务监听端口。Railway 平台会自动注入此变量，无需手动设置 |

### 鉴权与安全

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `JWT_SECRET` | **生产必需** | `summitlink_secret_change_this_in_production` | `a3f9b2...`（32 字节随机 hex）| 用于签发用户 JWT token 的密钥。生产环境若仍为默认值，服务将**拒绝启动**。生成命令：`openssl rand -hex 32` |
| `ADMIN_JWT_SECRET` | 否 | 同 `JWT_SECRET` | `c8d1e5...`（32 字节随机 hex）| 管理后台专用 JWT 密钥（当前版本与 `JWT_SECRET` 共用，预留独立配置）|
| `COOKIE_SECRET` | 否 | — | `x7k2m9...` | Cookie 签名密钥（预留，用于未来 httpOnly session cookie）|
| `ADMIN_USERNAME` | 否 | `admin` | `summitlink_admin` | 后台管理员登录用户名 |
| `ADMIN_PASSWORD` | **生产必需** | `change_this_password` | `Str0ng!P@ssw0rd` | 后台管理员密码。生产环境若仍为默认值，服务将**拒绝启动** |

### 第三方服务

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `OPENWEATHER_API_KEY` | 天气功能必需 | — | `abc123def456...` | OpenWeatherMap API Key。获取地址：[openweathermap.org/api](https://openweathermap.org/api)。免费套餐每分钟 60 次调用 |
| `AMAP_KEY` | 地图功能必需 | — | `your_amap_key` | 高德地图 Web JS API Key。获取地址：[console.amap.com](https://console.amap.com/dev/key/app)。需申请 **Web端（JS API）** 类型 |
| `AMAP_SECURITY_CODE` | 地图功能必需 | — | `your_security_code` | 高德 Web JS API 2.0 安全密钥（与 Key 配套）。未配置时地图无法初始化 |
| `MAPBOX_TOKEN` | 否 | — | `pk.eyJ1IjoiZXhhbXBsZSIsImEi...` | Mapbox GL JS 访问令牌（[account.mapbox.com](https://account.mapbox.com/access-tokens/)）。中国大陆（CN）IP 或无法判断时使用高德；非中国地区在 token 缺失/占位值（如 `pk.xxx`）时自动降级到 OSM，避免地图黑屏。 |

### Stripe 支付（国际支付）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `STRIPE_SECRET_KEY` | Stripe 支付必需 | — | `sk_live_...` 或 `sk_test_...` | Stripe 后端密钥（[dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)）。未设置时 `/api/payment/*` 路由返回未启用提示 |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 支付必需 | — | `pk_live_...` 或 `pk_test_...` | Stripe 可公开密钥，通过 `/api/payment/config` 返回前端使用 |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 必需 | — | `whsec_...` | Webhook 签名验证密钥（Stripe Dashboard → Webhooks → 端点 → 签名密钥）。用于验证 `POST /api/payment/stripe-webhook` 请求的真实性 |
| `STRIPE_DISABLED` | 否 | — | `true` | Stripe 优雅降级开关。设为 `true` 时跳过 Stripe SDK 初始化，所有 `/api/payment/*` 返回 `503`。用于 Stripe Live 密钥未就绪时临时恢复生产；拿到 `sk_live_*` 后应删除该变量（或设为 `false`） |
| `PAYMENTS_ENABLED` | 否 | `false` | `true` | 支付总开关。仅当为 `true` 时开放前端付费入口与后端支付相关接口；为 `false` 时接口返回 `503 payments_disabled`，用于免费版提审阶段。 |

### 微信支付 v3（CN）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `WECHAT_MCH_ID` | 微信支付必需 | — | `1900000109` | 微信商户号 |
| `WECHAT_APP_ID` | 微信支付必需 | — | `wx8888888888888888` | 微信 AppID |
| `WECHAT_API_V3_KEY` | 微信支付必需 | — | `your_api_v3_key` | 微信支付 API v3 Key |
| `WECHAT_CERT_SERIAL` | 微信支付必需 | — | `444F4864EA...` | 商户证书序列号 |
| `WECHAT_PRIVATE_KEY` | 微信支付必需 | — | `LS0tLS1CRUdJTi...` | Base64 编码 PEM 私钥（商户私钥） |
| `WECHAT_PLATFORM_PUBLIC_KEY` | 否 | — | `LS0tLS1CRUdJTi...` | Base64 编码微信平台公钥（用于回调验签） |
| `WECHAT_SPLIT_ENABLED` | 否 | `false` | `true` | 微信分账开关。`false` 时分账接口返回 mock，`true` 时调用真实微信分账 API |

### 支付宝（CN）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `ALIPAY_APP_ID` | 支付宝必需 | — | `2021000118630000` | 支付宝应用 ID |
| `ALIPAY_PRIVATE_KEY` | 支付宝必需 | — | `LS0tLS1CRUdJTi...` | Base64 编码 PKCS8 私钥 |
| `ALIPAY_PUBLIC_KEY` | 支付宝必需 | — | `LS0tLS1CRUdJTi...` | Base64 编码支付宝公钥 |

### 数据库与存储

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `DATABASE_PATH` | 否 | `backend/db/summitlink.db` | `/data/summitlink.db` | SQLite 数据库文件路径。Railway 部署时建议设为 `/data/summitlink.db`（需挂载 Volume 到 `/data`）|
| `UPLOADS_DIR` | 否 | `backend/uploads` | `/data/uploads` | 用户上传文件目录。Railway 部署时建议设为 `/data/uploads`（需挂载 Volume 到 `/data`）|

### 网络与跨域

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `CORS_ORIGINS` | **生产必需** | — | `https://unsummit.cn,https://www.unsummit.cn` | 生产环境 CORS 白名单，多个域名用英文逗号分隔（不含空格）。开发环境（`NODE_ENV !== production`）下自动允许所有来源。官网表单由 GitHub Pages 静态站发起跨域请求，上线前必须包含官网域名 |

### 官网线索与邮件闭环

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `RESEND_API_KEY` | 官网线索邮件必需 | — | `re_...` | Resend API Key。未配置时邮件功能降级为日志，线索仍写库，但管理员通知和用户确认邮件不会真实发送 |
| `RESEND_FROM` | 官网线索邮件必需 | `noreply@mail.ussummit.cn` | `SummitLink <noreply@mail.ussummit.cn>` | 发件人地址。需在 Resend 完成域名验证 |
| `LEADS_NOTIFY_EMAIL` | 官网线索管理员通知必需 | — | `ops@summitlink.com` | 官网 4 个公开表单写库后通知的运营收件人。未配置时使用 `ADMIN_EMAIL` 兜底 |
| `ADMIN_EMAIL` | 兜底 | — | `admin@summitlink.com` | `LEADS_NOTIFY_EMAIL` 未配置时的线索通知收件人 |

上线前必须同时确认静态官网 `website/js/config.js` 中的 `window.SUMMITLINK_API_BASE` 指向真实 API 域名（当前为 `https://api.unsummit.cn`），并通过 `GET /api/health` 检查 `lead_notifications.ready=true`。

### 数据初始化

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SEED_ON_START` | 否 | `false` | `true` | 设为 `true` 时启动时执行示例数据填充（seed）。**仅首次部署前临时设为 true**，填充完成后立即改回 `false`，防止每次重启重置数据 |

### 监控与可观测性

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SENTRY_DSN` | 否 | — | `https://example@o0.ingest.sentry.io/0` | Sentry 项目 DSN。**未设置时 Sentry 完全静默不启用**。设置后后端启用并在启动时输出 `[sentry] enabled...`，前端按需加载 Sentry SDK。 |
| `SENTRY_RELEASE` | 否 | — | `v1.0.0` 或 git commit hash | Sentry 发布版本标识，用于关联代码版本与错误。推荐使用 CI 中的 git commit hash |

### 短信服务（B2 阶段）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SMS_PROVIDER` | 否 | mock | `mock` | 短信服务商。不设置时为 mock 模式（验证码打印到控制台）；后续可切换到腾讯云等云短信服务。|
| `TENCENT_SMS_SECRET_ID` | 腾讯云短信必需 | — | `AKID...` | 腾讯云短信 SecretId |
| `TENCENT_SMS_SECRET_KEY` | 腾讯云短信必需 | — | `abcd1234...` | 腾讯云短信 SecretKey |
| `TENCENT_SMS_APP_ID` | 腾讯云短信必需 | — | `1400xxxxxx` | 腾讯云短信应用 AppID（兼容 `TENCENT_SMS_SDK_APP_ID`） |
| `TENCENT_SMS_SIGN_NAME` | 腾讯云短信建议配置 | `SummitLink` | `SummitLink` | 腾讯云短信签名 |
| `TENCENT_SMS_TEMPLATE_ID` | 腾讯云短信建议配置 | — | `1234567` | 腾讯云短信模板 ID（验证码模板） |

### 原生推送通知（FCM / APNs）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM 推送必需（二选一） | — | `{"type":"service_account",...}` | Firebase 服务账号完整 JSON 字符串（Firebase Console → 项目设置 → 服务账号 → 生成私钥）。与下面三个字段二选一 |
| `FIREBASE_PROJECT_ID` | FCM 推送必需（二选一） | — | `summitlink-app` | Firebase 项目 ID |
| `FIREBASE_CLIENT_EMAIL` | FCM 推送必需（二选一） | — | `firebase-adminsdk-xxx@project.iam.gserviceaccount.com` | Firebase 服务账号邮箱 |
| `FIREBASE_PRIVATE_KEY` | FCM 推送必需（二选一） | — | `-----BEGIN RSA PRIVATE KEY-----...` | Firebase 服务账号私钥（换行符用 `\n` 表示）|
| `APNS_KEY_P8` | APNs iOS 推送必需 | — | `-----BEGIN PRIVATE KEY-----\n...` | APNs .p8 密钥文件完整内容（Apple Developer → Keys）|
| `APNS_KEY_ID` | APNs iOS 推送必需 | — | `ABC123DEF4` | APNs 密钥 ID（10 位字母数字）|
| `APNS_TEAM_ID` | APNs iOS 推送必需 | — | `ABCDE12345` | Apple Developer Team ID |
| `APNS_BUNDLE_ID` | APNs iOS 推送必需 | — | `com.summitlink.app` | iOS App Bundle ID |

> **注意**：以上变量均为可选。未配置时推送功能优雅降级（console.warn + 跳过），不影响主业务流程。

### 向导/俱乐部上架费（Stripe 真实支付）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `GUIDE_LISTING_FEE_USD` | 否 | `299` | `299` | 向导上架费（美元）。`PAYMENTS_ENABLED=true` 且 Stripe 已配置时生效 |
| `CLUB_LISTING_FEE_USD` | 否 | `499` | `499` | 俱乐部上架费（美元）。`PAYMENTS_ENABLED=true` 且 Stripe 已配置时生效 |

### 社会化登录（预留）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `WECHAT_APPID` | 否 | — | `wx1234567890abcdef` | 微信小程序 AppID（预留，B2 阶段接入）|
| `WECHAT_SECRET` | 否 | — | `abc123...` | 微信小程序 Secret（预留）|
| `APPLE_CLIENT_ID` | 否 | — | `com.example.summitlink` | Apple Sign In Client ID（预留）|
| `APPLE_TEAM_ID` | 否 | — | `ABCDE12345` | Apple Developer Team ID（预留）|
| `APPLE_KEY_ID` | 否 | — | `ABC123DEF4` | Apple Sign In Key ID（预留）|

---

## 最小配置示例

### 本地开发（`backend/.env`）

```dotenv
NODE_ENV=development
PORT=8080
JWT_SECRET=local_dev_secret_not_for_production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
OPENWEATHER_API_KEY=your_openweather_key_here
AMAP_KEY=your_amap_key_here
AMAP_SECURITY_CODE=your_amap_security_code_here
SEED_ON_START=true
```

### Railway 生产环境（最小必填项）

```dotenv
NODE_ENV=production
DATABASE_PROVIDER=postgresql
DATABASE_URL=******host:5432/dbname
JWT_SECRET=<openssl rand -hex 32 输出>
ADMIN_PASSWORD=<强密码>
CORS_ORIGINS=https://unsummit.cn,https://www.unsummit.cn
RESEND_API_KEY=<Resend API Key>
RESEND_FROM=SummitLink <noreply@mail.ussummit.cn>
LEADS_NOTIFY_EMAIL=ops@summitlink.com
AMAP_KEY=<高德 Key>
AMAP_SECURITY_CODE=<高德安全密钥>
OPENWEATHER_API_KEY=<OpenWeatherMap Key>
SEED_ON_START=false
```

---

## 安全注意事项

1. **绝对不要**将 `.env` 文件提交到版本控制系统（已在 `.gitignore` 中排除）
2. `JWT_SECRET` 和 `ADMIN_PASSWORD` 在生产环境若为默认值，后端会**直接拒绝启动**并打印错误
3. `CORS_ORIGINS` 在生产环境若未配置，所有跨域请求均会被拒绝
4. Sentry DSN 是半公开信息（前端 JS 中可见），但仅用于错误上报，不涉及权限操作
5. 所有含密钥的环境变量应通过 Railway Variables 面板配置，**不要**写入 `railway.toml` 或代码中
