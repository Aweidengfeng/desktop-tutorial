# Changelog

All notable changes to SummitLink are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]
### Added - PR-322
- 新增 Lighthouse CI 配置（`lighthouserc.js`）与 `.github/workflows/lighthouse.yml`，在 PR 中自动采集 `/summitlink` 的性能/无障碍/SEO 指标
- 新增 `.github/workflows/bundle-size.yml`，输出前端构建产物与 `www/js/app-core.js` 体积报告
- 新增 `www/js/modules/perf.js`、`www/js/modules/api-client.js` 与 `docs/performance.md`，补齐 Core Web Vitals 采集、统一请求工具和性能手册

### Changed - PR-322
- `www/js/app-core.js` 增加全局错误处理与性能监控初始化，提升懒加载失败和网络异常时的韧性提示
- 后端新增 `/api/metrics/web-vitals` 路由，允许后续接入客户端性能指标收集

### Added - PR-42
- E2E 测试：支付/提现/GDPR/地图流程（`tests/e2e/payment.spec.js` / `withdrawal.spec.js` / `gdpr.spec.js` / `map.spec.js`）
- 管理员统计看板：`GET /api/admin/stats/revenue?period=7d|30d|90d`、`/users`、`/withdrawals`、`/sos` 时间序列接口
- 微信支付 H5 二维码（`POST /api/payment/wechat/qrcode`，含 mock 模式）+ 轮询状态（`GET /api/payment/wechat/query`）
- `backend/lib/payment/wechat-pay.js` 新增 `createNativeOrder` / `queryOrder` 函数
- `deploy/tencent/docker-compose.yml` 新增 `OPENWEATHER_API_KEY` / `AMAP_SECURITY_CODE` 环境变量透传
- `scripts/check-env.js` 新增 PR-42 可选变量，统一最终输出格式

### Fixed - PR-42
- 腾讯云 Dockerfile 构建时 Prisma generate 前增加占位 `DATABASE_URL` 避免 schema 校验失败
- 健康检查重试改为 12 × 10s = 120s，失败时输出 `docker compose logs backend`
- 腾讯云 docker-compose `start_period` 从 60s 提升至 90s，为 Prisma migration 预留更多时间
- `backend/utils/maskSensitive.js` 新增 `pk_...` Stripe 公钥脱敏及手机号检测

## [1.4.0] - 2026-05-17

### Added
- SOS 按钮真实化：5 秒倒计时防误触 overlay、真实 GPS 定位、后端 sos_alerts 入库、管理员 console.warn 告警、tel:112 拨号（[#160](https://github.com/Aweidengfeng/desktop-tutorial/pull/160))

## [1.3.0] - 2026-05-11

### Added
- 补齐 HTTP 缓存策略、Capacitor 配置和 GDPR 地区检测接口，为移动端与合规体验打下统一基础（[#116](https://github.com/gaoshanyindi/desktop-tutorial/pull/116))
- 上线 GDPR 横幅、按地区自动切换地图引擎，并补充英文兜底体验（[#117](https://github.com/gaoshanyindi/desktop-tutorial/pull/117))
- 发布完整法律页面与 App Store 文案，方便用户、审核员和投资人快速理解产品边界（[#119](https://github.com/gaoshanyindi/desktop-tutorial/pull/119))
- 新增 Stripe 支付、投资人看板真实数据和多货币显示（[#121](https://github.com/gaoshanyindi/desktop-tutorial/pull/121))
- 补齐 App 图标、启动屏和 iOS / Android 权限说明等上架硬需求（[#122](https://github.com/gaoshanyindi/desktop-tutorial/pull/122))
- 增加 iOS / Android CI 打包流水线与移动端打包指南（[#124](https://github.com/gaoshanyindi/desktop-tutorial/pull/124))
- 提供 App Store / Google Play 截图模板与自动导出素材（[#125](https://github.com/gaoshanyindi/desktop-tutorial/pull/125))
- 增加 Railway 生产部署流水线、冒烟测试与发布前自检脚本（[#126](https://github.com/gaoshanyindi/desktop-tutorial/pull/126))
- 新增 App Store Connect 与 Google Play Console 提交操作手册（[#127](https://github.com/gaoshanyindi/desktop-tutorial/pull/127))
- 支持一条命令生成 iOS、Android 与 PWA 全平台图标（[#128](https://github.com/gaoshanyindi/desktop-tutorial/pull/128))
- 增加 Universal Links、Fastlane 发布流程和中英双语商店元数据（[#130](https://github.com/gaoshanyindi/desktop-tutorial/pull/130))

### Changed
- 完成 AlpineLink→SummitLink 品牌统一，并升级 Service Worker 缓存版本与移动端基础配置（[#115](https://github.com/gaoshanyindi/desktop-tutorial/pull/115))
- 增加生产部署清单与 Stripe Live Mode 切换守卫，便于正式上线收口（[#129](https://github.com/gaoshanyindi/desktop-tutorial/pull/129))

### Fixed
- 修复地图路由冲突、Capacitor 版本缺失 GDPR 横幅、法律页 API 错链和环境变量文档缺项（[#123](https://github.com/gaoshanyindi/desktop-tutorial/pull/123))
- 修复前端脚本映射、Stripe webhook、Universal Links、PII 日志和 GDPR 横幅的完整性问题（[#131](https://github.com/gaoshanyindi/desktop-tutorial/pull/131))
- 修复随机 IV PII 加密导致的登录失败及连锁 API 500 错误（[#132](https://github.com/gaoshanyindi/desktop-tutorial/pull/132))

### Security
- 为手机号与邮箱引入 AES-256-GCM PII 加密，并把超大内联脚本拆分到独立文件以降低首屏负担（[#118](https://github.com/gaoshanyindi/desktop-tutorial/pull/118))

## [1.2.0] - 2026-05-02

### Added
- 新增 AI Coach、支付网关抽象层和管理后台统计接口（[#113](https://github.com/gaoshanyindi/desktop-tutorial/pull/113))

### Fixed
- 修复 17 个 CI 失败用例，补齐测试环境缺失路由并增强统计/教练查询容错（[#114](https://github.com/gaoshanyindi/desktop-tutorial/pull/114))

## [1.1.0] - 2026-05-02

### Added
- 新增 PostgreSQL 全文搜索、邮件通知系统与 Web Push 推送能力（[#112](https://github.com/gaoshanyindi/desktop-tutorial/pull/112))

## [1.0.0] - 2026-04-30

### Added
- 新增向导/俱乐部重新申请流程、独立图片资产管理和安全验收自动化（[#103](https://github.com/gaoshanyindi/desktop-tutorial/pull/103))
- 新增弱网轨迹上传测试、PWA Service Worker 和图片内容安全接入框架（[#105](https://github.com/gaoshanyindi/desktop-tutorial/pull/105))
- 新增 GDPR 数据导出、账号删除能力与内容审核实现（[#106](https://github.com/gaoshanyindi/desktop-tutorial/pull/106))
- 新增 IndexedDB 断点续传与高德 / Mapbox 双地图引擎体验（[#107](https://github.com/gaoshanyindi/desktop-tutorial/pull/107))
- 新增 Vite 构建层、轻量 i18n 与深色模式（[#108](https://github.com/gaoshanyindi/desktop-tutorial/pull/108))
- 新增 PostgreSQL 压测、多节点部署脚手架和运维手册（[#109](https://github.com/gaoshanyindi/desktop-tutorial/pull/109))
- 新增 OSS 图片存储、CDN 加速、健康检查与故障转移能力（[#110](https://github.com/gaoshanyindi/desktop-tutorial/pull/110))
- 新增 Sentry 监控、README 重写与 v1.0.0 发布准备内容（[#111](https://github.com/gaoshanyindi/desktop-tutorial/pull/111))

### Changed
- 完善并发超额下单、JWT 全链路与性能基准测试，补强首发前质量基线（[#104](https://github.com/gaoshanyindi/desktop-tutorial/pull/104))

### Security
- 补齐安全验收自动化、GDPR 用户权利支持与内容安全能力，强化首发合规基线（[#106](https://github.com/gaoshanyindi/desktop-tutorial/pull/106))

---

## 📚 历史档案 / Legacy Archive

采用 SemVer 之前、使用旧版日历版本号体系（`2026.0.4` ~ `2026.2.0`）的变更记录已归档至 **[docs/CHANGELOG.md](docs/CHANGELOG.md)**，仅作历史参考，不再更新。
