# SummitLink 阿里云 ECS 部署指南

本文档介绍如何将 SummitLink 从 Railway 迁移到阿里云 ECS 服务器，并接入阿里云短信服务与 SMTP 邮件服务。

---

## 目录

1. [服务器购买与初始化](#1-服务器购买与初始化)
2. [安装运行环境](#2-安装运行环境)
3. [部署应用](#3-部署应用)
4. [配置环境变量](#4-配置环境变量)
5. [Nginx 反向代理 + HTTPS](#5-nginx-反向代理--https)
6. [PM2 进程管理](#6-pm2-进程管理)
7. [接入阿里云短信服务](#7-接入阿里云短信服务)
8. [接入邮件服务（SMTP）](#8-接入邮件服务smtp)
9. [更新前端 API_BASE](#9-更新前端-api_base)
10. [数据迁移（Railway → 阿里云）](#10-数据迁移railway--阿里云)
11. [生产检查清单](#11-生产检查清单)

---

## 1. 服务器购买与初始化

### 推荐配置

| 参数 | 推荐值 |
|------|--------|
| 机型 | ECS 通用型 g7（ecs.g7.large）|
| vCPU | 2 核 |
| 内存 | 4 GB |
| 操作系统 | Ubuntu 22.04 LTS |
| 系统盘 | 40 GB SSD |
| 数据盘 | 50 GB 高效云盘（挂载为 `/data`）|
| 带宽 | 5 Mbps 按量付费 |
| 地域 | 华东2（上海）|

### 安全组规则

在 ECS 控制台 → 安全组 中添加以下入方向规则：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH 管理（建议限制为跳板机 IP）|
| 80 | TCP | 0.0.0.0/0 | HTTP（自动跳转 HTTPS）|
| 443 | TCP | 0.0.0.0/0 | HTTPS |

### 初始化服务器

```bash
# SSH 登录
ssh root@<服务器公网IP>

# 更新系统
apt update && apt upgrade -y

# 创建数据目录（对应数据盘挂载点）
mkdir -p /data/summitlink.db /data/uploads /data/backups

# 挂载数据盘（假设数据盘设备为 /dev/vdb）
mkfs.ext4 /dev/vdb
mount /dev/vdb /data
echo '/dev/vdb /data ext4 defaults 0 2' >> /etc/fstab
```

---

## 2. 安装运行环境

```bash
# 安装 Node.js 20 LTS（使用 NodeSource）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证版本
node -v   # 应输出 v20.x.x
npm -v    # 应输出 10.x.x

# 安装 PM2（全局）
npm install -g pm2

# 安装 Nginx
apt install -y nginx

# 安装 Git
apt install -y git
```

---

## 3. 部署应用

```bash
# 克隆代码到服务器
cd /opt
git clone https://github.com/gaoshanyindi/desktop-tutorial.git summitlink
cd summitlink

# 安装后端依赖
cd backend
npm install

# 生成 Prisma 客户端
DATABASE_URL="file:/data/summitlink.db" npx prisma generate --schema=prisma/schema.prisma

# 推送数据库 schema（首次部署时）
DATABASE_URL="file:/data/summitlink.db" npx prisma db push --schema=prisma/schema.prisma

cd /opt/summitlink
```

---

## 4. 配置环境变量

```bash
# 复制示例配置文件
cp backend/.env.example backend/.env

# 编辑配置
nano backend/.env
```

**最小必填项（生产环境）：**

```dotenv
# 安全密钥（用随机字符串替换）
JWT_SECRET=<使用 openssl rand -base64 48 生成>

# 端口
PORT=3000

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<强密码>

# 数据库（SQLite，指向数据盘）
DATABASE_URL="file:/data/summitlink.db"
DATABASE_PATH=/data/summitlink.db

# 文件上传目录
UPLOADS_DIR=/data/uploads
BACKUPS_DIR=/data/backups

# CORS 白名单（替换为你的真实域名）
CORS_ORIGINS=https://api.your-domain.com,https://www.your-domain.com

# 阿里云短信（见第 7 步）
SMS_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY_ID=<你的AccessKeyId>
ALIYUN_SMS_ACCESS_KEY_SECRET=<你的AccessKeySecret>
ALIYUN_SMS_SIGN_NAME=SummitLink
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxxxx

# 邮件服务（见第 8 步）
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.qiye.aliyun.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=noreply@your-domain.com
EMAIL_PASS=<SMTP密码>
EMAIL_FROM=SummitLink <noreply@your-domain.com>

# 首次部署填充测试数据（之后改为 false）
SEED_ON_START=true
```

---

## 5. Nginx 反向代理 + HTTPS

### 申请 SSL 证书

**方式一（推荐）：阿里云免费 SSL 证书**

1. 登录阿里云控制台 → 数字证书管理服务 → SSL/TLS 证书
2. 购买免费版 DV 证书（每年 20 张）
3. 下载证书（选 Nginx 格式），上传到服务器：
   ```bash
   mkdir -p /etc/nginx/ssl
   # 将下载的 .pem 和 .key 文件上传到 /etc/nginx/ssl/
   ```

**方式二：Let's Encrypt（Certbot）**

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.your-domain.com
```

### Nginx 配置

```bash
nano /etc/nginx/sites-available/summitlink
```

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    # SSL 证书（阿里云方式）
    ssl_certificate     /etc/nginx/ssl/your-domain.pem;
    ssl_certificate_key /etc/nginx/ssl/your-domain.key;

    # 现代 SSL 设置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 安全头
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # 文件上传大小限制
    client_max_body_size 50M;

    # 反向代理到 Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

```bash
# 启用站点
ln -s /etc/nginx/sites-available/summitlink /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## 6. PM2 进程管理

```bash
# 创建 PM2 配置文件
cat > /opt/summitlink/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'summitlink',
    script: 'backend/app.js',
    cwd: '/opt/summitlink',
    env: {
      NODE_ENV: 'production',
    },
    env_file: 'backend/.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/data/logs/summitlink-error.log',
    out_file: '/data/logs/summitlink-out.log',
  }],
};
EOF

# 创建日志目录
mkdir -p /data/logs

# 首次启动（会运行 seed.js）
cd /opt/summitlink
pm2 start ecosystem.config.js

# 保存 PM2 配置，设置开机自启
pm2 save
pm2 startup systemd
# 按提示执行输出的命令

# 常用命令
pm2 status          # 查看状态
pm2 logs summitlink # 查看日志
pm2 restart summitlink # 重启
pm2 reload summitlink  # 热重载（零停机）
```

---

## 7. 接入阿里云短信服务

### 开通步骤

1. 登录 [阿里云控制台](https://console.aliyun.com) → 搜索"短信服务"
2. 开通短信服务（首次免费）
3. **申请签名**：
   - 签名来源：选"企业"
   - 签名内容：`SummitLink`（需与应用名一致）
   - 上传营业执照等材料
   - 审核时间：约 1 个工作日
4. **创建模板**：
   - 模板类型：验证码
   - 模板内容：`您的SummitLink验证码为：${code}，5分钟内有效，请勿泄露给他人。`
   - 审核后获得模板 Code（如 `SMS_123456789`）
5. **创建 AccessKey**：
   - 控制台右上角头像 → AccessKey 管理
   - 创建 AccessKey，复制 ID 和 Secret

### 配置环境变量

```dotenv
SMS_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY_ID=LTAI5t...
ALIYUN_SMS_ACCESS_KEY_SECRET=xxx...
ALIYUN_SMS_SIGN_NAME=SummitLink
ALIYUN_SMS_TEMPLATE_CODE=SMS_123456789
```

### 测试

```bash
# 重启服务使配置生效
pm2 restart summitlink

# 通过接口测试
curl -X POST https://api.your-domain.com/api/auth/sms/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000"}'
```

---

## 8. 接入邮件服务（SMTP）

### 方式一：阿里云企业邮箱（推荐）

1. 开通 [阿里云企业邮箱](https://qiye.aliyun.com/)
2. 创建发件账号 `noreply@your-domain.com`
3. 获取 SMTP 密码（在邮箱设置中生成）

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.qiye.aliyun.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=noreply@your-domain.com
EMAIL_PASS=<SMTP密码>
EMAIL_FROM=SummitLink <noreply@your-domain.com>
```

### 方式二：163/QQ 邮箱

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.163.com   # 或 smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-account@163.com
EMAIL_PASS=<授权码（非登录密码）>
EMAIL_FROM=SummitLink <your-account@163.com>
```

---

## 9. 更新前端 API_BASE

在 `www/index.html` 第 5910 行，将 Railway URL 改为你的阿里云域名：

```javascript
// 改前
const API_BASE = window.__API_BASE__ || 'https://precious-miracle-production.up.railway.app';

// 改后
const API_BASE = window.__API_BASE__ || 'https://api.your-domain.com';
```

然后提交代码并重新部署，或在 Nginx 中注入变量：

```nginx
# 在 Nginx location / 中添加（服务端注入方式）
sub_filter 'window.__API_BASE__' '"https://api.your-domain.com"';
```

---

## 10. 数据迁移（Railway → 阿里云）

### SQLite 数据库迁移

```bash
# 在 Railway 服务器上（或通过 Railway CLI）下载数据库文件
railway run -- sqlite3 /data/summitlink.db .dump > summitlink_backup.sql

# 将备份文件传输到阿里云服务器
scp summitlink_backup.sql root@<阿里云IP>:/data/

# 在阿里云服务器上恢复数据
cd /data
sqlite3 summitlink.db < summitlink_backup.sql
```

### 上传文件迁移

```bash
# 将 Railway Volume 中的 uploads 目录同步到阿里云
rsync -avz --progress /data/uploads/ root@<阿里云IP>:/data/uploads/
```

---

## 11. 生产检查清单

部署完成后，逐项确认：

- [ ] `https://api.your-domain.com/api/health` 返回 `{"status":"ok"}`
- [ ] 密码登录（手机号 + 密码）正常
- [ ] 短信验证码登录：收到真实短信
- [ ] 邮箱验证码登录：收到验证邮件
- [ ] 管理员后台 `/admin` 可访问
- [ ] 文件上传（图片）正常
- [ ] HTTPS 证书有效（浏览器显示锁图标）
- [ ] 所有请求自动从 HTTP 重定向到 HTTPS
- [ ] PM2 开机自启配置完成（`pm2 startup`）
- [ ] `SEED_ON_START` 已改回 `false`（避免重复填充数据）
- [ ] `JWT_SECRET` 已设置为随机强密码
- [ ] `ADMIN_PASSWORD` 已修改
- [ ] SQLite 数据库文件在数据盘（`/data/`），不在系统盘

---

## 附：常见问题

**Q: 短信发送失败，返回 `SignatureDoesNotMatch`**
A: 检查 `ALIYUN_SMS_ACCESS_KEY_ID` 和 `ALIYUN_SMS_ACCESS_KEY_SECRET` 是否正确。

**Q: 短信返回 `isv.SMS_SIGNATURE_ILLEGAL`**
A: 签名名称与控制台申请的不一致，检查 `ALIYUN_SMS_SIGN_NAME`。

**Q: 邮件发送失败，返回 `ECONNREFUSED`**
A: 检查 `EMAIL_HOST` 和 `EMAIL_PORT`，确认服务器安全组已开放出方向 465/587 端口。

**Q: 数据库写入失败（SQLITE_READONLY）**
A: 检查 `/data` 目录权限：`chown -R $(whoami):$(whoami) /data`

**Q: Nginx 返回 502 Bad Gateway**
A: Node.js 服务未运行，执行 `pm2 status` 和 `pm2 logs summitlink` 排查。
