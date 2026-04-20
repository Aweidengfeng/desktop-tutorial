# SummitLink 部署指南

本文档涵盖本地开发环境搭建、生产环境部署（Railway 平台）、自检清单、数据库备份，以及监控与可观测性说明。

---

## 目录

1. [本地开发快速启动](#本地开发快速启动)
2. [环境变量清单](#环境变量清单)
3. [Railway 平台部署](#railway-平台部署)
4. [生产环境启动前自检](#生产环境启动前自检)
5. [数据库备份与恢复](#数据库备份与恢复)
6. [域名 / HTTPS / 反向代理](#域名--https--反向代理)
7. [监控与可观测性](#监控与可观测性)

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
| `COOKIE_SECRET` | 否 | — | Cookie 签名密钥（留作扩展） |
| `OPENWEATHER_API_KEY` | 天气功能必需 | — | OpenWeatherMap API Key |
| `AMAP_KEY` | 地图功能必需 | — | 高德地图 Web JS API Key |
| `AMAP_SECURITY_CODE` | 地图功能必需 | — | 高德 Web JS API 2.0 安全密钥 |
| `CORS_ORIGINS` | **生产必需** | — | CORS 白名单，逗号分隔，例：`https://example.com` |
| `DATABASE_PATH` | 否 | `backend/db/summitlink.db` | SQLite 数据库文件路径 |
| `UPLOADS_DIR` | 否 | `backend/uploads` | 上传文件目录 |
| `SEED_ON_START` | 否 | `false` | 设为 `true` 时启动时执行数据填充 |
| `SENTRY_DSN` | 否 | — | Sentry DSN，未设置则不启用监控 |
| `SENTRY_RELEASE` | 否 | — | Sentry 发布版本标识（可用 git commit hash）|
| `SMS_PROVIDER` | 否 | mock | 短信服务商（`aliyun` 切换阿里云）|
| `WECHAT_APPID` | 否 | — | 微信小程序 AppID（预留） |
| `WECHAT_SECRET` | 否 | — | 微信小程序 Secret（预留） |

---

## Railway 平台部署

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
DATABASE_PATH=/data/summitlink.db
UPLOADS_DIR=/data/uploads
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

## 生产环境启动前自检

| 检查项 | 验证方法 | 备注 |
|--------|----------|------|
| `JWT_SECRET` 已设置且非默认值 | 服务启动时会自动校验，若为默认值则拒绝启动 | 必须 |
| `ADMIN_PASSWORD` 已设置且非默认值 | 同上 | 必须 |
| `CORS_ORIGINS` 已配置 | `curl -H "Origin: https://evil.com" /api/auth/me` 应返回 CORS 错误 | 生产必须 |
| SQLite 数据库路径可写 | 检查 Volume 挂载是否成功 | Railway 部署必须 |
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

## 数据库备份与恢复

### 手动备份（Railway Volume）

Railway Volume 数据存储在 `/data/summitlink.db`，可通过 Railway CLI 导出：

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录并进入项目
railway login
railway link

# 进入容器 shell
railway shell

# 在容器内备份数据库
cp /data/summitlink.db /data/summitlink-backup-$(date +%Y%m%d).db
```

### SQLite 热备份（在线备份，不锁定）

```bash
# 使用 SQLite .backup 命令（不影响在线读写）
sqlite3 /data/summitlink.db ".backup /data/summitlink-backup.db"
```

### 恢复备份

```bash
# 停止服务（Railway → Service → Pause）
# 通过 Railway CLI 替换数据库文件
cp /data/summitlink-backup-20260101.db /data/summitlink.db
# 重新启动服务
```

### 自动备份建议

生产环境建议配置定期备份脚本，可参考以下方案：

1. **Railway Cron Service**：创建一个独立的 Railway 服务，每日凌晨 2 点执行备份并上传至对象存储（阿里云 OSS / 腾讯云 COS）
2. **GitHub Actions 定时任务**：每日拉取备份文件并存储至 GitHub Artifact（适合小数据量）

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
