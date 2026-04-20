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

### 数据库与存储

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `DATABASE_PATH` | 否 | `backend/db/summitlink.db` | `/data/summitlink.db` | SQLite 数据库文件路径。Railway 部署时建议设为 `/data/summitlink.db`（需挂载 Volume 到 `/data`）|
| `UPLOADS_DIR` | 否 | `backend/uploads` | `/data/uploads` | 用户上传文件目录。Railway 部署时建议设为 `/data/uploads`（需挂载 Volume 到 `/data`）|

### 网络与跨域

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `CORS_ORIGINS` | **生产必需** | — | `https://example.com,https://www.example.com` | 生产环境 CORS 白名单，多个域名用英文逗号分隔（不含空格）。开发环境（`NODE_ENV !== production`）下自动允许所有来源 |

### 数据初始化

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SEED_ON_START` | 否 | `false` | `true` | 设为 `true` 时启动时执行示例数据填充（seed）。**仅首次部署前临时设为 true**，填充完成后立即改回 `false`，防止每次重启重置数据 |

### 监控与可观测性

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SENTRY_DSN` | 否 | — | `https://example@o0.ingest.sentry.io/0` | Sentry 项目 DSN。**未设置时 Sentry 完全不启用**，无任何副作用。设置后后端自动接入错误追踪，前端也会通过模板注入加载 Sentry Browser SDK |
| `SENTRY_RELEASE` | 否 | — | `v1.0.0` 或 git commit hash | Sentry 发布版本标识，用于关联代码版本与错误。推荐使用 CI 中的 git commit hash |

### 短信服务（B2 阶段）

| 变量名 | 是否必需 | 默认值 | 示例值 | 说明 |
|--------|----------|--------|--------|------|
| `SMS_PROVIDER` | 否 | mock | `aliyun` | 短信服务商。不设置时为 mock 模式（验证码打印到控制台）。设为 `aliyun` 切换阿里云短信 SDK（B2 阶段实现）|

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
DATABASE_PATH=/data/summitlink.db
UPLOADS_DIR=/data/uploads
JWT_SECRET=<openssl rand -hex 32 输出>
ADMIN_PASSWORD=<强密码>
CORS_ORIGINS=https://your-domain.com
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
