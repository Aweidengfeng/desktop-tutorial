# 🏔️ SummitLink — 高山探险社交平台

> 连接攀登者、向导与俱乐部的一站式户外运动平台

[![CI](https://github.com/gaoshanyindi/desktop-tutorial/actions/workflows/test.yml/badge.svg)](https://github.com/gaoshanyindi/desktop-tutorial/actions/workflows/test.yml)
[![Load Test](https://github.com/gaoshanyindi/desktop-tutorial/actions/workflows/load-test.yml/badge.svg)](https://github.com/gaoshanyindi/desktop-tutorial/actions/workflows/load-test.yml)

## ✨ 核心功能

| 模块 | 功能 |
|------|------|
| 👤 用户体系 | 手机/邮箱注册，JWT鉴权，会员等级（探索者→传奇攀登者） |
| 🏔️ 山峰数据库 | 全球山峰数据，路线攻略，成功率统计，峰会记录 |
| 🗺️ 轨迹系统 | GPS轨迹录制，GPX上传解析，IndexedDB断点续传，高德/Mapbox双引擎 |
| 👥 社区动态 | 图文发布，点赞评论，关注关系，实时群聊（Socket.IO） |
| 🧭 向导认证 | 申请→审核→支付→认证全流程，rejected可重申请 |
| 🏢 俱乐部 | 俱乐部认证，成员管理，路线定价 |
| 📦 装备市场 | 二手装备发布，智能装备清单推荐 |
| 🎫 预约系统 | 远征订单，SELECT FOR UPDATE防超额，事务保证一致性 |
| 💬 AI教练 | 高山训练建议，装备推荐（Claude/GPT接入框架） |
| 🛡️ 管理后台 | 用户/内容/订单管理，数据大屏 |

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/gaoshanyindi/desktop-tutorial.git
cd desktop-tutorial

# 安装依赖
npm install
cd backend && npm install

# 生成 Prisma Client（SQLite，本地开发）
DATABASE_PROVIDER=sqlite DATABASE_URL="file:./dev.db" node scripts/generate-prisma-client.js

# 初始化种子数据
SEED_ON_START=true node db/seed.js

# 启动后端
PORT=8080 JWT_SECRET=dev-secret node app.js
```

访问 http://localhost:8080

### Docker 生产部署

```bash
# 复制环境变量配置
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL、JWT_SECRET 等

# 启动多节点
docker-compose -f docker-compose.prod.yml up -d
```

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js 24 + Express 4 |
| ORM | Prisma 5（SQLite 开发 / PostgreSQL 生产）|
| 实时通信 | Socket.IO 4 |
| 认证 | JWT（jsonwebtoken） |
| 文件存储 | 本地磁盘 / 阿里云 OSS（可选）|
| 地图 | 高德地图 JS API / Mapbox GL JS（海外）|
| 前端 | 原生 HTML5 + Tailwind CSS（CDN）|
| PWA | Service Worker + IndexedDB 断点续传 |
| 国际化 | 轻量级 i18n（zh/en）|
| 部署 | Railway（主）/ Docker Compose（多节点）|
| CI/CD | GitHub Actions（E2E + 压测 + 健康巡检）|
| 监控 | Sentry（可选）/ 自定义健康检查 |

## ⚙️ 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `DATABASE_PROVIDER` | ✅ | `postgresql` 或 `sqlite` |
| `JWT_SECRET` | ✅ | JWT 签名密钥（≥32字符）|
| `ADMIN_PASSWORD` | ✅ | 管理员初始密码 |
| `PORT` | - | 监听端口，默认 8080 |
| `MAPBOX_TOKEN` | - | Mapbox GL JS Token（海外地图）|
| `OSS_BUCKET` | - | 阿里云 OSS Bucket（图片存储）|
| `OSS_REGION` | - | OSS Region，如 `oss-cn-hangzhou` |
| `OSS_ACCESS_KEY_ID` | - | 阿里云 AccessKeyId |
| `OSS_ACCESS_KEY_SECRET` | - | 阿里云 AccessKeySecret |
| `OSS_CDN_HOST` | - | CDN 域名，如 `https://cdn.summitlink.app` |
| `SENTRY_DSN` | - | Sentry DSN（错误监控）|
| `ALIYUN_ACCESS_KEY_ID` | - | 阿里云内容安全 AK |
| `ALIYUN_ACCESS_KEY_SECRET` | - | 阿里云内容安全 SK |

## 📡 API 文档

完整 OpenAPI 3.0 文档见 [`docs/swagger.yaml`](docs/swagger.yaml)。

主要端点：

```
GET  /api/health          综合健康检查
GET  /api/health/ready    K8s readiness probe
GET  /api/health/live     K8s liveness probe

POST /api/auth/send-code  发送验证码
POST /api/auth/login      登录（手机/邮箱/密码）

GET  /api/peaks           山峰列表
GET  /api/peaks/:id       山峰详情

GET  /api/posts           社区动态
POST /api/posts           发布动态

POST /api/tracks          上传轨迹
POST /api/upload          上传图片

POST /api/bookings        创建预约
POST /api/expedition-orders  远征下单（防超额）

GET  /api/users/:id       用户资料
POST /api/users/follow    关注用户
```

## 🧪 测试

```bash
# API 集成测试
npm run test:api

# E2E 测试（Playwright）
npm run test:e2e

# 50 并发压测
npm run test:load
```

## 📦 部署文档

详见 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## 📄 许可证

MIT © 2026 SummitLink

