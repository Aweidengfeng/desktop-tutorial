# SummitLink 部署运维手册

本文档涵盖本地开发环境搭建、Railway 一键部署（当前生产）、Docker Compose 多节点部署、环境变量清单、PostgreSQL 备份策略、健康检查端点说明，以及回滚策略。

---

## 目录

1. [本地开发快速启动](#本地开发快速启动)
2. [环境变量清单](#环境变量清单)
3. [Railway 平台部署（当前生产）](#railway-平台部署当前生产)
4. [Docker Compose 多节点部署](#docker-compose-多节点部署)
5. [生产环境启动前自检](#生产环境启动前自检)
6. [健康检查端点](#健康检查端点)
7. [PostgreSQL 备份策略](#postgresql-备份策略)
8. [回滚策略](#回滚策略)
9. [监控与可观测性](#监控与可观测性)

---

## 本地开发快速启动

### 前置条件

- Node.js ≥ 20（推荐 LTS 版本）
- npm ≥ 10

```bash
# 验证版本
node -v
npm -v
```

### 步骤

```bash
# 1. 克隆仓库（如尚未克隆）
git clone https://github.com/gaoshanyindi/desktop-tutorial.git
cd desktop-tutorial

# 2. 安装后端依赖
cd backend && npm install && cd ..

# 3. 创建本地配置文件
cp backend/.env.example backend/.env
# 根据需要修改 backend/.env 中的各项配置

# 4. 启动服务（含 seed 数据填充）
npm start
```

服务启动后访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:8080/summitlink` | 主前端页面 |
| `http://localhost:8080/admin` | 后台管理面板 |
| `http://localhost:8080/api/health` | 健康检查接口 |

> **端口说明**：默认端口为 `8080`，可通过环境变量 `PORT` 修改。

---

## 环境变量清单

详细说明见 [ENVIRONMENT.md](./ENVIRONMENT.md)。以下为快速参考表：

| 变量名 | 是否必需 | 默认值 | 说明 |
|--------|----------|--------|------|
| `NODE_ENV` | 否 | `development` | 运行环境，生产设为 `production` |
| `PORT` | 否 | `8080` | HTTP 监听端口 |
| `JWT_SECRET` | **生产必需** | 开发默认值（不安全） | JWT 签名密钥，生产须用随机强密码 |
| `ADMIN_JWT_SECRET` | 否 | 同 `JWT_SECRET` | 管理后台专用 JWT 密钥（如需独立） |
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | **生产必需** | 开发默认值（不安全） | 管理员密码 |
| `DATABASE_PROVIDER` | **生产必需** | `sqlite` | 数据库类型，生产设为 `postgresql` |
| `DATABASE_URL` | **生产必需** | — | Prisma 连接字符串，如 `postgresql://user:pass@host:5432/db` |
| `UPLOADS_DIR` | 否 | `backend/uploads` | 上传文件目录 |
| `SEED_ON_START` | 否 | `false` | 设为 `true` 时启动时执行数据填充 |
| `CORS_ORIGINS` | **生产必需** | — | CORS 白名单，逗号分隔，例：`https://example.com` |
| `MAPBOX_TOKEN` | 否 | — | Mapbox GL JS Token（海外地图切换功能） |
| `ALIYUN_ACCESS_KEY_ID` | 否 | — | 阿里云 AccessKey ID（内容安全审核） |
| `ALIYUN_ACCESS_KEY_SECRET` | 否 | — | 阿里云 AccessKey Secret（内容安全审核） |
| `OPENWEATHER_API_KEY` | 天气功能必需 | — | OpenWeatherMap API Key |
| `AMAP_KEY` | 地图功能必需 | — | 高德地图 Web JS API Key |
| `AMAP_SECURITY_CODE` | 地图功能必需 | — | 高德 Web JS API 2.0 安全密钥 |
| `SENTRY_DSN` | 否 | — | Sentry DSN，未设置则不启用监控 |
| `COOKIE_SECRET` | 否 | — | Cookie 签名密钥（留作扩展） |
| `SMS_PROVIDER` | 否 | mock | 短信服务商（`aliyun` 切换阿里云）|

---

## Railway 平台部署（当前生产）

### 前置条件

- 已注册 [Railway](https://railway.app) 账号
- 仓库已推送至 GitHub

### 步骤一：创建 Railway 项目

1. 登录 Railway → **New Project** → **Deploy from GitHub repo**
2. 选择 `gaoshanyindi/desktop-tutorial`
3. Railway 会自动读取 `railway.toml`，使用如下配置：

```toml
# railway.toml（已存在，勿修改）
[build]
builder = "RAILPACK"
buildCommand = "cd backend && npm install"

[deploy]
startCommand = "node backend/db/seed.js && node backend/app.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### 步骤二：挂载 Volume（数据持久化）

Railway 容器重启后临时文件会丢失，**必须挂载 Volume** 持久化 SQLite 数据库和上传文件：

1. 进入 **Service → Volumes**，点击 **New Volume**
2. 挂载路径设为 `/data`

### 步骤三：配置环境变量

在 **Service → Variables** 面板添加以下变量：

```
NODE_ENV=production
PORT=8080
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>
UPLOADS_DIR=/app/uploads
JWT_SECRET=<用 openssl rand -hex 32 生成>
ADMIN_PASSWORD=<强随机密码>
CORS_ORIGINS=https://你的域名,https://www.你的域名
AMAP_KEY=<高德开放平台申请>
AMAP_SECURITY_CODE=<高德开放平台申请>
OPENWEATHER_API_KEY=<OpenWeatherMap 申请>
SEED_ON_START=false
SENTRY_DSN=<Sentry 项目 DSN（可选）>
```

### 步骤四：首次部署（含 Seed）

1. 临时将 `SEED_ON_START=true`，触发数据填充
2. 部署成功并验证数据后，**立即改回 `SEED_ON_START=false`**

### 步骤五：验证部署

```bash
# 检查健康状态
curl https://your-app.railway.app/api/health

# 检查首页
curl -I https://your-app.railway.app/
```

---

## Docker Compose 多节点部署

本方案使用 `docker-compose.prod.yml` 在单机或多机上运行 2 个后端副本 + Nginx 负载均衡。

### 前置条件

- Docker ≥ 24 及 Docker Compose V2（`docker compose` 命令）
- 已有 PostgreSQL 实例（Railway PostgreSQL / 阿里云 RDS / 自托管 PostgreSQL）
- SSL 证书（放在 `./ssl/` 目录，可用 Let's Encrypt）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/gaoshanyindi/desktop-tutorial.git
cd desktop-tutorial

# 2. 创建 .env 文件（参考下方环境变量清单）
cat > .env << 'EOF'
DATABASE_URL=postgresql://summitlink:<password>@<host>:5432/summitlink
JWT_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<强随机密码>
MAPBOX_TOKEN=<可选>
ALIYUN_ACCESS_KEY_ID=<可选>
ALIYUN_ACCESS_KEY_SECRET=<可选>
EOF

# 3. 构建镜像
docker compose -f docker-compose.prod.yml build

# 4. 推送 Prisma schema 并 seed（仅首次）
docker compose -f docker-compose.prod.yml run --rm \
  -e SEED_ON_START=true \
  backend node db/seed.js

# 5. 启动服务（后台运行）
docker compose -f docker-compose.prod.yml up -d

# 6. 验证健康状态
curl http://localhost/api/health
```

### 扩容 / 缩容

```bash
# 扩容到 3 个后端副本
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# 缩回 2 个副本
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

### 零停机更新（滚动发布）

`deploy.update_config.order: start-first` 已在 `docker-compose.prod.yml` 中配置，使用 Docker Swarm 时自动执行滚动更新：

```bash
# 构建新镜像
docker compose -f docker-compose.prod.yml build

# 使用 Swarm 滚动发布
docker stack deploy -c docker-compose.prod.yml summitlink
```

---

## 生产环境启动前自检

| 检查项 | 验证方法 | 备注 |
|--------|----------|------|
| `JWT_SECRET` 已设置且非默认值 | 服务启动时会自动校验，若为默认值则拒绝启动 | 必须 |
| `ADMIN_PASSWORD` 已设置且非默认值 | 同上 | 必须 |
| `CORS_ORIGINS` 已配置 | `curl -H "Origin: https://evil.com" /api/auth/me` 应返回 CORS 错误 | 生产必须 |
| `DATABASE_PROVIDER=postgresql` | 确认环境变量 | 生产必须 |
| `SEED_ON_START=false` | 确认环境变量值 | 防止每次重启重置数据 |
| `AMAP_KEY` / `AMAP_SECURITY_CODE` 已配置 | 打开前端页面，地图正常加载 | 地图功能必须 |
| `OPENWEATHER_API_KEY` 已配置 | `curl /api/weather?location=珠峰大本营` 返回正常数据 | 天气功能必须 |
| 健康检查接口可访问 | `curl /api/health` 返回 `{"status":"ok",...}` | 运维监控必须 |

生成一个强密钥的方法：

```bash
# 生成 JWT_SECRET
openssl rand -hex 32

# 生成 ADMIN_PASSWORD（可读性更强）
openssl rand -base64 24
```

---

## 健康检查端点

```
GET /api/health
```

返回示例：

```json
{
  "status": "ok",
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

- **Railway**：在 Service Settings 中将 healthcheck path 设为 `/api/health`
- **Docker Compose**：已在 `docker-compose.prod.yml` 的 `healthcheck.test` 中配置
- **外部监控**：UptimeRobot / BetterStack 可每 1 分钟轮询此端点并在宕机时发送告警

---

## PostgreSQL 备份策略

### 手动备份（pg_dump）

```bash
# 单次备份
pg_dump "$DATABASE_URL" --no-owner --no-acl \
  -f backup-$(date +%Y%m%d-%H%M%S).sql

# 压缩格式（推荐，便于恢复）
pg_dump "$DATABASE_URL" --no-owner --no-acl \
  -Fc -f backup-$(date +%Y%m%d).dump
```

### 恢复备份

```bash
# 恢复 SQL 文件
psql "$DATABASE_URL" < backup-20260429.sql

# 恢复压缩格式
pg_restore --no-owner --no-acl -d "$DATABASE_URL" backup-20260429.dump
```

### 自动备份（cron）

在部署服务器上配置 crontab，每日凌晨 2 点自动备份并保留 7 天：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（将 DATABASE_URL 替换为实际连接串）
0 2 * * * DATABASE_URL="postgresql://summitlink:<pass>@<host>:5432/summitlink" \
  pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc \
  -f /data/backups/summitlink-$(date +\%Y\%m\%d).dump \
  && find /data/backups -name "summitlink-*.dump" -mtime +7 -delete
```

### Railway PostgreSQL 自动备份

Railway PostgreSQL 插件提供每日自动备份（保留 7 天），在 **Database → Backups** 面板可查看和恢复。

---

## 回滚策略

### Railway 回滚

1. 进入 **Deployments** 面板，找到上一个成功的部署
2. 点击 **Redeploy** 回滚到该版本
3. 若数据库 schema 有变化，使用上面的 pg_dump 备份恢复

### Docker Compose 镜像回滚

```bash
# 查看已构建的镜像版本（建议使用 git commit hash 打 tag）
docker images summitlink-backend

# 回滚到指定版本
docker compose -f docker-compose.prod.yml stop backend
docker tag summitlink-backend:<old-tag> summitlink-backend:latest
docker compose -f docker-compose.prod.yml up -d backend
```

### 数据库回滚

```bash
# 1. 停止后端服务（避免写入新数据）
docker compose -f docker-compose.prod.yml stop backend

# 2. 恢复备份（确保已有 pg_dump 备份）
pg_restore --no-owner --no-acl -d "$DATABASE_URL" \
  /data/backups/summitlink-20260428.dump

# 3. 重新启动后端
docker compose -f docker-compose.prod.yml start backend
```

---

## 域名 / HTTPS / 反向代理

### Railway 内置域名

Railway 自动提供 `*.up.railway.app` 域名并配置 HTTPS，无需额外配置。

### 绑定自定义域名

1. 在 Railway **Service → Settings → Domains** 中添加自定义域名
2. 在域名 DNS 提供商处添加 CNAME 记录指向 Railway 提供的目标地址
3. Railway 会自动申请并续期 Let's Encrypt 证书

### Nginx 反向代理示例（自托管部署）

如需在自托管服务器前置 Nginx：

```nginx
server {
    listen 80;
    server_name summitlink.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name summitlink.example.com;

    ssl_certificate     /etc/letsencrypt/live/summitlink.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/summitlink.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 安全响应头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";

    # 上传文件大小限制（与后端保持一致）
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 静态上传文件缓存
    location /uploads/ {
        proxy_pass http://127.0.0.1:8080/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 监控与可观测性

### 健康检查接口

```
GET /api/health
```

返回示例：

```json
{
  "status": "ok",
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

可用于 Railway 健康检查探针或外部监控服务（如 UptimeRobot、Betterstack）。

### Sentry 错误监控

Sentry 通过 `SENTRY_DSN` 环境变量控制启用，**未设置时完全无副作用**。

**启用步骤：**

1. 在 [Sentry.io](https://sentry.io) 创建项目，选择 **Node.js** 平台
2. 复制项目 DSN（形如 `https://xxx@o0.ingest.sentry.io/0`）
3. 在 Railway 环境变量中添加：
   ```
   SENTRY_DSN=https://xxx@o0.ingest.sentry.io/0
   SENTRY_RELEASE=v1.0.0   # 可选，推荐用 git commit hash
   ```
4. 重新部署服务

**禁用 Sentry：**

删除或清空 `SENTRY_DSN` 环境变量后重新部署即可。

**采样率说明：**

- 生产环境默认 `tracesSampleRate: 0.1`（10% 请求采样），避免过度采样导致额度消耗
- 高流量时可降低至 `0.01`（1%）
- 调试阶段可临时设为 `1.0`（100%）

**前端 Sentry：**

前端通过后端注入的 `window.__SENTRY_DSN__` 变量控制，与后端同一 `SENTRY_DSN` 环境变量。未配置时前端不加载 Sentry SDK，同时通过 `window.onerror` 和 `unhandledrejection` 将错误轻量记录到 `console.warn`。

### 访问日志

服务默认将请求信息打印到 stdout，Railway 自动收集日志，可在 **Service → Logs** 面板查看。

如需结构化日志，建议后续集成 [pino](https://github.com/pinojs/pino) 或 [morgan](https://github.com/expressjs/morgan)。

### 错误告警渠道

在 Sentry 项目设置中配置 **Alert Rules**，建议：

- 新错误出现时发送邮件通知
- 错误发生频率超阈值时发送微信机器人 / 钉钉 Webhook 通知

---

## Phase 4.4 — 多地域健康检查与故障转移

### 健康检查端点

| 端点 | 用途 | 响应 |
|------|------|------|
| `GET /api/health` | 综合健康状态（含DB检查） | `{status, db, uptime, memory, latency}` |
| `GET /api/health/ready` | K8s readiness probe | `{ready: true/false}` |
| `GET /api/health/live` | K8s liveness probe | `{alive: true, pid, uptime}` |

### 自动健康检查 CI

`.github/workflows/health-check.yml` 每15分钟自动检查生产环境健康状态。

在 GitHub Repo Settings → Variables 中设置：
- `PRODUCTION_URL`: 生产环境 URL（如 `https://summitlink.up.railway.app`）

### 故障转移策略

1. **Railway 自动重启**：`restart: always` 策略，崩溃后5秒内自动重启
2. **Docker Swarm 滚动更新**：`docker-compose.prod.yml` 中配置 `order: start-first`，零宕机更新
3. **数据库连接池**：Prisma 自动重连，最大重试5次
4. **多副本**：`replicas: 2`，单副本故障不影响服务

### 阿里云多地域部署（HK + SG）

1. 在 HK/SG 各部署一套 Docker Compose 实例
2. 通过阿里云 DNS 智能解析（GeoDNS）分流：
   - 中国大陆 → 国内节点
   - 海外 → HK/SG 节点
3. 数据库使用 PostgreSQL 主从复制（主节点写，从节点读）

---

## Stripe 生产模式切换

### 前置条件

- Stripe 账号已完成身份验证（企业 / 个人信息 + 银行账户绑定）
- 税务信息已填写（[Stripe Tax 设置](https://dashboard.stripe.com/settings/tax)）

### 步骤

1. **获取正式密钥**  
   登录 [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)，切换页面右上角到 **Live mode**，复制：
   - `sk_live_...` → `STRIPE_SECRET_KEY`
   - `pk_live_...` → `STRIPE_PUBLISHABLE_KEY`

2. **在 Railway 更新环境变量**

   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

   > ⚠️ 生产服务器启动时如检测到 `STRIPE_SECRET_KEY` 以 `sk_test_` 开头，将**拒绝启动**并打印明确错误信息。

3. **配置 Webhook**  
   在 [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) 点击 **+ Add endpoint**：
   - 端点 URL：`https://your-app.railway.app/api/payment/stripe-webhook`
   - 监听事件：`payment_intent.succeeded`、`payment_intent.payment_failed`
   - 保存后复制 **Signing secret**（`whsec_...`）

4. **在 Railway 添加 Webhook 密钥**

   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **测试正式模式**  
   使用 Stripe CLI 或 Dashboard 的 **Test webhook** 功能向端点发送测试事件，验证签名校验通过。

---

## 阿里云 OSS Bucket CORS 配置

当使用阿里云 OSS 存储图片时，需配置 CORS 规则，否则浏览器会因跨域拒绝请求。

### 步骤

1. 登录 [aliyun.com](https://www.aliyun.com) → **对象存储 OSS** → 进入目标 Bucket
2. 左侧菜单 **数据安全 → 跨域设置** → **创建规则**
3. 填写如下规则：

| 字段 | 值 |
|------|----|
| 来源（Origins） | `https://summitlink.app` `https://www.summitlink.app` `https://*.railway.app` |
| 允许 Methods | `GET` `PUT` `POST` `DELETE` `HEAD` |
| 允许 Headers | `*` |
| 暴露 Headers | `ETag` `x-oss-request-id` |
| 缓存时间（Max Age） | `3600` |

4. 确认 Bucket 读写权限（ACL）已配置为**私有**，上传通过后端签名 URL 进行。

### Railway 侧环境变量

```
OSS_BUCKET=your-bucket-name
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=LTAIxxxxxxxxxxxx
OSS_ACCESS_KEY_SECRET=<AccessKeySecret>
OSS_CDN_HOST=https://cdn.summitlink.app   # 可选，CDN 加速域名
```

---

## iOS / Android 签名配置（简述）

> 详细步骤见 [MOBILE_BUILD_GUIDE.md](../MOBILE_BUILD_GUIDE.md)。

### iOS（Apple 开发者账号必需）

1. 在 Apple Developer Portal 创建 **App ID**、**Distribution Certificate**（`.p12`）和 **Provisioning Profile**
2. 将证书和 Profile 转为 Base64 后存入 GitHub Secrets：
   ```
   IOS_CERTIFICATE_P12_BASE64=<base64>
   IOS_CERTIFICATE_PASSWORD=<password>
   IOS_PROVISIONING_PROFILE_BASE64=<base64>
   ```
3. CI 流程（`.github/workflows/build-ios.yml`）会自动解码、安装证书并调用 `xcodebuild archive`

### Android（Google Play 必需）

1. 在 Android Studio 生成 **Keystore 文件**（`.jks`）
2. 转为 Base64 并存入 GitHub Secrets：
   ```
   ANDROID_KEYSTORE_BASE64=<base64>
   ANDROID_KEY_ALIAS=<alias>
   ANDROID_KEYSTORE_PASSWORD=<password>
   ANDROID_KEY_PASSWORD=<password>
   ```
3. CI 流程自动解码 Keystore 并通过 `./gradlew bundleRelease` 打包签名 AAB

---

## 生产冒烟测试清单（10 项）

部署完成后，按以下顺序逐项验证：

| # | 模块 | 测试步骤 | 预期结果 |
|---|------|----------|----------|
| 1 | **健康检查** | `curl https://your-app.railway.app/api/health` | `{"status":"ok"}` |
| 2 | **用户注册** | 使用新手机号 / 邮箱完成注册流程 | 注册成功，返回 JWT |
| 3 | **用户登录** | 使用已注册账号登录 | 登录成功，获取 Token |
| 4 | **地图加载** | 打开首页，等待地图渲染 | 地图瓦片正常显示（高德或 Mapbox） |
| 5 | **路线查看** | 点击任意探险路线查看详情 | 路线详情页面正常展示，无 500 错误 |
| 6 | **Stripe 支付** | 选择付费服务 → Stripe 支付页 | 显示支付表单，币种正确 |
| 7 | **GDPR 横幅** | 无痕浏览器访问首页 | 显示 Cookie 同意横幅 |
| 8 | **GDPR 数据导出** | 登录后请求 `GET /api/users/me/data-export` | 返回用户数据 JSON |
| 9 | **Push 通知权限** | iOS / Android 设备首次打开 App | 弹出推送权限请求对话框 |
| 10 | **错误监控** | 触发一个已知的 API 错误（如访问不存在的路由） | Sentry Dashboard 中出现新事件 |

运行自动化冒烟测试脚本：

```bash
API_BASE_URL=https://your-app.railway.app node scripts/smoke-test.js
```
