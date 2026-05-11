# Changelog

All notable changes to SummitLink are documented here.

## [Unreleased] — PR-19: Production Deployment Checklist & Stripe Live-Mode Switch

### Added
- **Stripe live-mode guard**: `backend/routes/payment.js` now throws a clear startup error when `STRIPE_SECRET_KEY` starts with `sk_test_` in a `NODE_ENV=production` environment, preventing accidental test-mode charges in production.
- **`scripts/validate-env.js`**: New startup validation script that parses `.env.example`, checks every declared key exists in `process.env`, and exits with a descriptive list of missing variables in production. Supports `DRY_RUN=1` mode for CI self-testing.
- **`docs/DEPLOYMENT.md`** additions:
  - Stripe live-mode activation steps (key rotation, Webhook endpoint setup, signature secret)
  - Aliyun OSS Bucket CORS configuration table and Railway env var list
  - iOS / Android release signing brief (referencing `MOBILE_BUILD_GUIDE.md`)
  - 10-item production smoke-test checklist covering auth, payment, map, GDPR, and push notifications

### Changed
- **`.env.example`**: Fixed header brand name (AlpineLink → SummitLink).
- **`.github/workflows/deploy-railway.yml`**: Added `env-check` job that runs `validate-env.js` with `DRY_RUN=1` and dummy required vars to verify the script itself is parseable on every push.

## [1.0.0] - 2026-04-29

### 🎉 Initial Production Release

#### Phase 0 — 基础清理与安全加固
- `0.1` 主入口重命名为 `index.html`
- `0.3` AMap 安全密钥后端动态注入
- `0.4` 前端图片上传预校验（5MB + 类型）
- `0.5` JWT 过期统一检测 + 自动跳转登录
- `0.6` GPS 坐标精度统一归一化（6位小数）

#### Phase 1 — 数据库迁移（SQLite → PostgreSQL）
- `1.1` 全量迁移至 Prisma Client，所有路由支持 PostgreSQL
- `1.2` tracks.points 字段类型迁移为 JSON
- `1.3` 独立 images 表，统一管理上传资源
- `1.5` 50并发压测 CI（load-test.yml + PostgreSQL service）

#### Phase 2 — 前端架构升级
- `2.1` Vite 构建配置（代码分割 + terser 压缩）
- `2.2` PWA Service Worker（离线缓存 + 安装提示）
- `2.3` IndexedDB 断点续传（pending-tracks store，online 事件自动同步）
- `2.4` i18n 多语言框架（zh/en，data-i18n 属性，localStorage 持久化）
- `2.5` 海外地图双引擎（高德 + Mapbox GL JS 懒加载，/api/config/map）
- `2.6` 深色模式（CSS 变量，系统主题跟随，localStorage 持久化）

#### Phase 3 — 安全与合规
- `3.3` GDPR 数据导出 + 账号删除（软删除）
- `3.4` 阿里云内容安全框架（图片审核，生产环境接入）
- `3.5` 统一限流中间件（全 API 覆盖，express-rate-limit）
- `3.6` 向导/俱乐部 rejected 后重新申请流程
- `3.7` 远征订单并发事务 + SELECT FOR UPDATE

#### Phase 4 — 生产部署扩展
- `4.1` Docker Compose 多节点（双副本，滚动更新，Nginx 负载均衡）
- `4.2` 阿里云 OSS 图片存储（可选，未配置降级本地）
- `4.3` CDN 加速配置（Gzip，静态资源长期缓存，CDN_SETUP.md）
- `4.4` 增强健康检查（/ready /live K8s 探针，15分钟定时巡检 CI）

#### Phase 5 — 测试体系完善
- `5.1` 并发超额下单 E2E 测试
- `5.2` 弱网轨迹上传模拟
- `5.3` JWT 过期全链路测试
- `5.4` 安全验收自动化测试（SQL注入、XSS、越权）
- `5.5` 性能基准测试（P50/P95/P99延迟）

#### Phase 6 — 监控与可观测性
- `6.1` Sentry 错误监控（后端 + 前端，可选，未配置静默跳过）
- `6.2` README 完整重写
- `6.3` CHANGELOG + v1.0.0 发布准备
