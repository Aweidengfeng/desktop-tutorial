# 🚦 SummitLink 上线前最终 Go / No-Go Checklist

> 适用范围：Web 正式上线（目标 7 月 1 日）+ iOS / Android 进入提审状态
> 维护：本清单随发布迭代更新；每项需有明确 Owner 与状态（✅ Go / ⚠️ 风险 / ⛔ Blocker）

## 1. 后端 / Web（P0 上线必备）

- [x] `npm run build` 通过（Prisma Client 生成成功）
- [x] `npm run test:api:unit` 通过（除 3 项已知历史失败外全绿）
- [x] UGC 举报闭环（Apple Guideline 1.2）：API + 数据模型 + 后台入口 + 状态管理
- [x] 举报表 `content_reports` 启动期幂等迁移（SQLite + PostgreSQL 双分支）
- [ ] 生产 PostgreSQL `DATABASE_URL` / `DATABASE_PROVIDER=postgresql` 已配置
- [ ] JWT_SECRET、ADMIN_PASSWORD 等生产密钥已通过 Secrets 注入（非默认值）
- [ ] 对象存储（腾讯 COS）配置就绪（生产 Fail-Closed，不回退本地磁盘）
- [ ] 健康检查 `/api/health` 在生产环境返回 200
- [ ] 速率限制 / CSRF / 鉴权中间件在生产配置下验证通过

## 2. 移动端（P0 提审必备）

- [x] `capacitor.config.json` 存在且 appId/appName/webDir 正确
- [x] Android 构建工作流 Capacitor 版本与 `package.json`（8.3.4）对齐
- [x] iOS 构建工作流 Capacitor 版本（8.3.4）一致
- [ ] ⛔ 真机运行验证（iOS 真机 + Android 真机）— 需 macOS/Xcode + 真机，沙箱内无法执行
- [ ] ⛔ 产出 TestFlight 包（需 Apple 开发者账号 + 签名证书 Secrets）
- [ ] ⛔ 产出 Google Play AAB 签名包（需 `ANDROID_KEYSTORE_BASE64` 等 Secrets）
- [ ] App 隐私清单 / 权限说明（相机、推送、定位）文案齐备
- [ ] App Store / Play 商店素材（截图、描述）就绪（见 `APP_STORE_COPY.md`）

## 3. 合规（Apple Guideline 1.2 — UGC）

- [x] 用户可对 UGC 发起举报（`POST /api/reports`，需登录）
- [x] 举报对象类型 / 原因白名单校验，防止脏数据
- [x] 用户可查看本人举报及处理状态（`GET /api/reports/mine`）
- [x] 管理后台可查看 / 过滤 / 流转举报状态（pending → reviewing → resolved/dismissed）
- [ ] 用户屏蔽（block）与内容拉黑机制（如审核要求，需补充）
- [ ] 举报响应 SLA（24h 内处理）流程文档化

## 4. 数据与回滚

- [x] 最小数据库变更：仅新增 1 张表 `content_reports`，未改动既有表
- [x] 迁移幂等（`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`）
- [ ] 生产数据库备份策略已验证（见 `.github/workflows/backup.yml`）
- [ ] 回滚预案：新功能均为增量，可通过下线路由快速回退

## 5. 可观测性

- [ ] Sentry DSN 配置且发布关联（`sentry-release.yml`）
- [ ] 关键接口监控 / 告警阈值设置
- [ ] 健康检查定时任务（`health-check.yml`）启用

---

## 决策矩阵

| 范围 | 结论 | 说明 |
|------|------|------|
| Web 后端（含举报合规） | **Go（条件性）** | 代码就绪并测试通过；待生产密钥/COS/DB 配置核验 |
| iOS 提审 | **No-Go（沙箱）** | 需 macOS/Xcode + Apple 账号签名产出 TestFlight，沙箱外执行 |
| Android 提审 | **No-Go（沙箱）** | 需签名 Secrets 产出 AAB，沙箱外执行 |

> 说明：标记 ⛔ 的移动端打包/真机项目依赖密钥与构建主机，无法在当前环境完成，需在配齐
> Apple/Google 账号与签名 Secrets 的 CI 主机上执行既有 `build-ios.yml` / `build-android.yml`。
