# SummitLink 🏔️

> 专为户外探险设计的全栈平台 — 连接探险者、专业向导与俱乐部

## 功能亮点
- 🗺️ 实时轨迹追踪（AMap/OSM 双引擎，离线缓存）
- 🆘 一键 SOS 告警（GPS 坐标 + 区域感知拨号）
- 💳 区域感知支付（微信/支付宝/Stripe）
- 📱 iOS + Android 原生 App（Capacitor）
- 🔔 FCM/APNs 实时推送
- 🌐 多语言支持（中/英）

## 技术栈
| 层次 | 技术 |
|------|------|
| 前端 | Alpine.js + Tailwind CSS + Capacitor |
| 后端 | Node.js + Express + Prisma ORM |
| 数据库 | PostgreSQL（生产）/ SQLite（开发）|
| 部署 | 腾讯云（CN）+ Railway（国际）|
| CI/CD | GitHub Actions |

## 5 分钟快速启动

### 开发环境
```bash
cd backend
cp .env.example .env     # 编辑最小配置
npm install
npx prisma migrate dev
npm run dev              # 启动 http://localhost:8080
```

### 最小必需环境变量
```env
DATABASE_URL=file:./dev.db
JWT_SECRET=your-secret-here
PII_ENCRYPTION_KEY=32-char-key-here
```

### 生产部署（腾讯云）
```bash
# 配置 GitHub Secrets 后推送到 main 分支即自动部署
# 详见 docs/DEPLOY_GUIDE.md
```

## 项目结构
```
summitlink/
├── backend/          # Express API 服务
│   ├── routes/       # 路由（auth/expeditions/guides/clubs/payment/...）
│   ├── lib/          # 工具库（push/payment/sms/...）
│   ├── prisma/       # Schema + 迁移
│   └── middleware/   # JWT/限流/权限
├── www/              # 前端（无构建，纯 CDN）
│   ├── js/           # Alpine.js 应用逻辑
│   ├── i18n/         # 多语言包
│   └── sw.js         # Service Worker（PWA）
├── website/          # 官网（纯静态）
├── deploy/tencent/   # 腾讯云部署配置
└── docs/             # 文档
```

## 文档索引
- [环境变量说明](docs/ENVIRONMENT.md)
- [部署指南](docs/DEPLOY_GUIDE.md)
- [推送通知配置](docs/PUSH_NOTIFICATION.md)
- [API 参考](docs/API_REFERENCE.md)
- [隐私政策](docs/PRIVACY.md)
- [上线检查清单](docs/LAUNCH_CHECKLIST_FINAL.md)
- [审计基线](docs/AUDIT_2026-05-18.md)

## 贡献
PRs welcome. 请先阅读 `docs/DEPLOY_GUIDE.md` 启动本地开发环境。

## License
MIT
