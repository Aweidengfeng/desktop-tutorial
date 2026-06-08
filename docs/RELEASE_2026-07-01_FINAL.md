# 🚀 SummitLink 2026-07-01 上线最终发布包（Release Package）

> **状态**：Release 模式（冻结新功能）｜**目标日**：2026-07-01
> **范围约束**：不新增任何业务功能，不做 Account Manager / CRM / KPI / 屏蔽拉黑 / `moderation_logs` 扩展。
> **本文件用途**：作为本次上线的单一权威发布文档，汇总 A–F 全部交付物与 P0/P1/P2 清单。
>
> **配套文档**：
> - 7·1 冲刺执行：[`GO_LIVE_2026-07-01.md`](./GO_LIVE_2026-07-01.md)
> - Go/No-Go：[`../GO_NOGO_CHECKLIST.md`](../GO_NOGO_CHECKLIST.md)、[`./RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md)
> - 部署：[`./DEPLOYMENT.md`](./DEPLOYMENT.md)、[`./DEPLOY_GUIDE.md`](./DEPLOY_GUIDE.md)、[`./POSTGRESQL_MIGRATION.md`](./POSTGRESQL_MIGRATION.md)、[`./CN_DEPLOYMENT.md`](./CN_DEPLOYMENT.md)
> - 环境变量：[`./ENVIRONMENT.md`](./ENVIRONMENT.md)、[`../.env.example`](../.env.example)
> - 灰度/回滚：[`./GRADUAL_ROLLOUT.md`](./GRADUAL_ROLLOUT.md)、[`./RUNBOOK.md`](./RUNBOOK.md)
> - 上架：[`./appstore-submit-guide.md`](./appstore-submit-guide.md)、[`./googleplay-submit-guide.md`](./googleplay-submit-guide.md)、[`../MOBILE_BUILD_GUIDE.md`](../MOBILE_BUILD_GUIDE.md)

---

## 0. 本轮上线范围（Scope）

**纳入上线（Web + Backend）**：
1. 支付安全修复（Stripe Live 守卫 + Webhook 签名校验 + PII 脱敏日志）。
2. PostgreSQL 迁移（`DATABASE_PROVIDER=postgresql`，启动期幂等 schema patch）。
3. 腾讯云 COS 永久存储（生产 Fail-Closed，禁止回退本地磁盘）。
4. 管理后台 CSRF 修复（cookie 会话双提交 CSRF Token）。
5. GDPR 能力（数据导出、账号删除、注销冷静期、注册同意留痕）。
6. UGC 举报能力（Apple Guideline 1.2：`content_reports` + 用户举报 API + 后台流转）。
7. 自动化测试通过（`npm run build` + `npm run test:api:unit`）。

**冻结/延期（7-01 之后）**：Account Manager、CRM、KPI、屏蔽/拉黑、`moderation_logs` 扩展、任何新增业务模块。除阻塞上线的缺陷外，一律延期。

**移动端目标（与 Web 7-01 解耦）**：原生工程重建 → 签名配置 → TestFlight → Google Play 内测。Apple 审核时间不可控时，允许 App Store 延后上线，**不影响 7-01 整体发布**。

---

## A. Release Readiness Report（发布就绪报告）

### A.1 各域就绪度

| 域 | 就绪度 | 结论 | 主要剩余项 |
|---|---|---|---|
| Backend 工程与安全基线 | ~85% | 条件性就绪 | 生产密钥/环境变量注入、正式域名 HTTPS |
| Web App | ~85% | 条件性就绪 | 正式域名、法律页占位符替换 |
| PostgreSQL 生产 | ~80% | 条件性就绪 | 生产 `DATABASE_URL`、备份验证、首次启动迁移核验 |
| 对象存储 COS | ~80% | 条件性就绪 | 生产 Bucket/CDN/密钥、上传冒烟 |
| 合规（GDPR + UGC 举报） | ~80% | 条件性就绪 | 法律文本定稿、举报 SLA 流程文档化 |
| 移动端提审准备 | ~30% | 高风险并行 | 原生工程重建、账号/签名、商店素材 |

### A.2 代码层就绪证据

- 支付安全：`backend/routes/payment.js`（Live Mode 守卫 + Webhook 签名校验）、`backend/utils/maskSensitive.js`（`sk_`/`pk_`/手机号脱敏）。
- PostgreSQL：`backend/db/migrations.js` `runStartupMigrations()`（PostgreSQL/SQLite 双分支，全部 `IF NOT EXISTS` 幂等）。
- COS：`backend/lib/storage.js`（`assertProductionStorageReady`，生产缺配置拒绝启动）、`backend/app.js` 启动校验。
- CSRF：`backend/middleware/adminAuth.js`（双提交令牌 + 常量时间比较）、`backend/routes/admin.js`（登录下发 `adminCsrf`）。
- GDPR：`backend/routes/gdpr.js`、`backend/routes/users.js`、`backend/middleware/auth.js`（注销冷静期写保护）。
- UGC 举报：`backend/routes/reports.js`、`backend/prisma/schema.prisma`（`content_reports`）、`admin.html`（后台入口）、`tests/api-reports.test.js`。

### A.3 测试

- 验证命令：根目录 `npm install` → `npm run build` → `npm run test:api:unit`。
- 现状：绿（除 3 项已知历史无关失败外）。建议 CI-like 复跑前先 `npx jest --clearCache` 以保证套件顺序确定性。

---

## B. Go / No-Go Checklist（上线决策清单）

> 详细分章清单见 [`../GO_NOGO_CHECKLIST.md`](../GO_NOGO_CHECKLIST.md) 与 [`./RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md)。此处为决策级摘要。

### B.1 Backend / Web（7-01 上线必备）
- [x] `npm run build` 通过
- [x] `npm run test:api:unit` 通过（除 3 项已知历史失败）
- [x] 管理后台 CSRF 双提交令牌
- [x] UGC 举报闭环（API + 模型 + 后台 + 状态流转）
- [x] `content_reports` 启动期幂等迁移（PostgreSQL + SQLite 双分支）
- [ ] 生产 `DATABASE_URL` + `DATABASE_PROVIDER=postgresql` 已配置
- [ ] `JWT_SECRET` / `ADMIN_PASSWORD` 等生产密钥经 Secrets 注入（非默认值）
- [ ] COS 生产配置就绪（Fail-Closed，不回退本地）
- [ ] `/api/health` 生产返回 200
- [ ] 正式域名 + HTTPS（Web）
- [ ] 隐私/条款页可访问 + 法律占位符替换
- [ ] Sentry DSN 配置且 release 关联

### B.2 移动端（提审准备，可与 Web 解耦）
- [x] `capacitor.config.json` appId/webDir 正确、域名收敛到 `summitlink.app`
- [x] iOS/Android 构建工作流 Capacitor 版本对齐（8.3.4）
- [ ] ⛔ 原生工程重建并入库（`npx cap add ios/android`）
- [ ] ⛔ 签名 Secrets 配置（`IOS_*` / `ANDROID_KEYSTORE_*`）
- [ ] ⛔ 产出 TestFlight 包 / Google Play AAB（需 Apple/Google 账号 + 构建主机）
- [ ] 商店素材（截图/文案/隐私标签）就绪

### B.3 决策矩阵

| 范围 | 结论 | 说明 |
|---|---|---|
| Web + Backend（含举报合规） | **GO（条件性）** | 代码就绪且测试通过；待生产密钥/COS/DB 配置核验 + 正式域名 |
| iOS 提审 | **CONDITIONAL GO** | 需原生工程重建 + Apple 账号/签名；审核不可控则 App Store 延后，不阻塞 7-01 |
| Android 内测 | **CONDITIONAL GO** | 需签名 Secrets 产出 AAB；内测轨道先行 |

> **总体建议**：以 **Web 7-01 准时上线** 为第一目标 **GO**；移动端按 CONDITIONAL GO 并行，门槛项未清前不提审。

---

## C. Production Deployment Plan（生产部署计划）

### C.1 部署顺序（D-Day）
1. **冻结**：确认代码冻结于发布分支，CI 全绿。
2. **环境变量**：在 Railway/生产环境注入完整变量（见 §H 清单），运行 `node scripts/check-env.js` / `scripts/validate-env.js` 自检。
3. **数据库**：切换 `DATABASE_PROVIDER=postgresql` 与生产 `DATABASE_URL`；首次启动由 `runStartupMigrations()` 应用幂等 schema patch（见 §G）。先验证一次性备份可用。
4. **对象存储**：配置 COS（`COS_BUCKET`/`COS_REGION`/`COS_SECRET_ID`/`COS_SECRET_KEY`/`COS_CDN_DOMAIN`/`TENCENT_CLOUD_APPID`）。缺配置生产将 Fail-Closed 拒绝启动。
5. **部署 Backend + Web**：经既有流水线 [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml)（或腾讯云 [`deploy-tencent.yml`](../.github/workflows/deploy-tencent.yml)）。
6. **冒烟**：`scripts/smoke-test.js`；核验 `/api/health=200`、登录、上传落 COS、举报创建、GDPR 导出。
7. **可观测性**：确认 Sentry 收到 release 事件，`health-check.yml` 定时任务启用。
8. **官网**：经 [`deploy-website.yml`](../.github/workflows/deploy-website.yml) 发布。

### C.2 P1 — 生产切换检查表（链接到权威文档）
- **部署文档**：[`./DEPLOYMENT.md`](./DEPLOYMENT.md)、[`./DEPLOY_GUIDE.md`](./DEPLOY_GUIDE.md)
- **PostgreSQL 生产切换**：[`./POSTGRESQL_MIGRATION.md`](./POSTGRESQL_MIGRATION.md)、[`./POSTGRES_MIGRATION_REPORT.md`](./POSTGRES_MIGRATION_REPORT.md)
  - [ ] `DATABASE_PROVIDER=postgresql`、`DATABASE_URL` 指向生产实例
  - [ ] 自动备份策略验证（[`.github/workflows/backup.yml`](../.github/workflows/backup.yml)）
  - [ ] 首次启动迁移日志 `"[startup] schema patch applied"` 出现，无报错
  - [ ] 关键表存在性核验：`content_reports` / `coupons` / `invite_records`
- **COS 生产配置**：[`./CN_DEPLOYMENT.md`](./CN_DEPLOYMENT.md)、[`./CDN_SETUP.md`](./CDN_SETUP.md)
  - [ ] Bucket 带 APPID 后缀，区域与 `COS_REGION` 一致
  - [ ] `COS_CDN_DOMAIN` HTTPS 可访问，回源正常
  - [ ] 上传冒烟（图片/视频/文档/GPX）落 COS 且可下载
  - [ ] 生产未设置 `STORAGE_PROVIDER=local`
- **Railway 环境变量**：见 §H + [`./ENVIRONMENT.md`](./ENVIRONMENT.md)
  - [ ] 必填项全部注入且非默认值；可选项按启用功能补齐

---

## D. Rollback Plan（回滚方案）

### D.1 总原则
- 本轮变更以**增量**为主（仅新增 1 张表 `content_reports` + 既有幂等列），无破坏性 schema 变更，回滚低风险。
- 优先**应用层回滚（revert 部署）**，数据库通常无需回滚。

### D.2 应用回滚（Web/Backend）
1. 在 Railway/部署平台回滚到上一个稳定发布（redeploy 上一镜像/上一 commit）。
2. 复跑冒烟 `scripts/smoke-test.js`，确认 `/api/health=200`。
3. 详见 [`./GRADUAL_ROLLOUT.md`](./GRADUAL_ROLLOUT.md) §5 回滚 SOP 与 [`./RUNBOOK.md`](./RUNBOOK.md)。

### D.3 数据库回滚
- 新增 `content_reports` 表为增量、不影响既有读写，**默认无需删除**（保留即可）。
- 如确需移除：在确认无依赖后手动 `DROP TABLE IF EXISTS content_reports;`（连同 `idx_content_reports_*` 索引）。注意此操作丢失举报数据，需先备份。
- 严重数据故障：从 §C 步骤 3 的发布前备份恢复（PostgreSQL PITR / 快照）。

### D.4 单功能降级（无需整体回滚）
- 举报接口异常：可临时下线 `app.use('/api/reports')` 路由（`backend/app.js`），后台举报视图随之隐藏，其余功能不受影响。
- COS 异常：生产为 Fail-Closed，不可静默回退本地磁盘；优先修复 COS 凭据/网络或回滚部署。

### D.5 移动端回滚
- iOS：App Store Connect → Phased Release → Pause。
- Android：`bundle exec fastlane android halt_android`（staged rollout halt）。
- 详见 [`./GRADUAL_ROLLOUT.md`](./GRADUAL_ROLLOUT.md) §1.3 / §2.4。

---

## E. Remaining Risks（剩余风险，按 High / Medium / Low）

### 🔴 High
1. **移动端原生工程未重建**：`ios/`、`android/` 非完整可构建工程，需 `npx cap add` 重建并回贴配置；影响 TestFlight/Play 内测时间。
2. **Apple/Google 账号与签名 Secrets 未到位**：账号开通/审批存在外部不确定性，可能阻塞提审。
3. **Apple 审核时间不可控**：可能导致 App Store 延后（已被接受，不阻塞 7-01 Web 发布）。

### 🟡 Medium
1. **生产环境变量/密钥注入**：`JWT_SECRET`、`ADMIN_PASSWORD`、`DATABASE_URL`、COS、`SENTRY_DSN` 等未注入即上线将导致启动失败或安全降级。
2. **PostgreSQL 首次切换**：生产首启迁移需核验日志，备份策略需提前验证。
3. **法律文本定稿**：`legal/*.md` 占位符（主体/邮箱/地址）替换依赖营业执照，影响隐私标签一致性核对。
4. **举报响应 SLA 未文档化**：Apple 1.2 期望 24h 内处理用户举报，需运营流程落地。

### 🔵 Low
1. **3 项已知历史测试失败**：与本轮变更无关，不阻塞上线（建议后续清理）。
2. **ICP 备案 / 国内内容安全**：仅影响国内区，可延期。
3. **监控告警细化**：Slack/邮件告警通路与关键指标看板可上线后补强。

---

## F. 上线后 30 天迭代路线图（Post-Launch Roadmap）

> 原则：稳定优先；7-01 后两周内只做稳定性/合规收口，不开新业务功能。

**Week 1（7/1–7/7）— 稳定与监控**
- 生产监控守护：错误率、5xx、支付成功率、Crash-free 指标看板。
- 举报 SLA 流程上线（24h 内处理）+ 后台值班排期。
- 移动端：完成 TestFlight + Google Play 内测轨道灰度（≥48h 无崩溃）。

**Week 2（7/8–7/14）— 合规与上架收口**
- 法律文本定稿替换占位符，iOS 隐私标签 / Play Data safety 一致性复核。
- App Store 提审（若账号/签名就绪）；按审核反馈快速迭代。
- 修复灰度暴露的高优缺陷。

**Week 3（7/15–7/21）— 性能与体验**
- Core Web Vitals / Lighthouse 指标优化（[`./performance.md`](./performance.md)）。
- 清理 3 项历史测试失败，补齐回归。

**Week 4（7/22–7/31）— 增量功能解冻评审**
- 复盘上线 KPI，评审是否解冻被延期模块（屏蔽/拉黑、`moderation_logs` 扩展等）。
- 规划下一迭代（v1.5）需求与排期。

---

## G. 数据库变更说明（Database Change Notes）

> 实现：[`backend/db/migrations.js`](../backend/db/migrations.js) `runStartupMigrations(prisma)`，应用启动时执行，全部幂等（`CREATE TABLE/INDEX IF NOT EXISTS`、SQLite ALTER 以 try/catch 忽略重复列）。PostgreSQL 与 SQLite 双分支。

**本轮关键新增：`content_reports`（UGC 举报，Apple Guideline 1.2）**

| 列 | 类型(PostgreSQL) | 说明 |
|---|---|---|
| `id` | SERIAL PK | 主键 |
| `reporter_id` | INTEGER | 举报人（可空，兼容匿名/系统） |
| `target_type` | TEXT NOT NULL | 举报对象类型（白名单校验） |
| `target_id` | INTEGER NOT NULL | 举报对象 ID |
| `reason` | TEXT NOT NULL | 举报原因（白名单校验） |
| `detail` | TEXT | 补充描述 |
| `status` | TEXT DEFAULT 'pending' | pending → reviewing → resolved/dismissed |
| `handled_by` | INTEGER | 处理人（管理员） |
| `handled_at` | TIMESTAMPTZ | 处理时间 |
| `resolution` | TEXT | 处理结论 |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | 创建时间 |

索引：`idx_content_reports_status(status)`、`idx_content_reports_target(target_type, target_id)`。

**变更特性**：
- **仅新增表 + 索引，不改动既有表结构**，对既有读写零影响。
- **幂等**：重复启动安全；PostgreSQL 与 SQLite 均覆盖。
- 其余幂等项（`coupons`、`user_coupons`、`invite_records`、`users`/`posts`/`insurance_inquiries` 增量列）为既有迁移，本轮不新增破坏性变更。

---

## H. 生产环境变量清单（Production Environment Variables）

> 权威来源：[`../.env.example`](../.env.example) 与 [`./ENVIRONMENT.md`](./ENVIRONMENT.md)。生产注入后运行 `node scripts/check-env.js` 自检。

### H.1 必填（缺失将拒绝启动或安全降级）
| 变量 | 说明 |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | 监听端口（默认 8080） |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_URL` | 生产 PostgreSQL 连接串 |
| `JWT_SECRET` | ≥32 字符强随机；生产为默认值/缺失将抛错 |
| `ADMIN_PASSWORD` | 管理后台强密码 |
| `CORS_ORIGINS` | 正式域名白名单（逗号分隔） |

### H.2 对象存储 COS（生产 Fail-Closed，必填）
| 变量 | 说明 |
|---|---|
| `COS_BUCKET` | Bucket（建议带 APPID 后缀） |
| `COS_REGION` | 如 `ap-beijing` |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | 访问密钥 |
| `COS_CDN_DOMAIN` | CDN 域名（HTTPS） |
| `TENCENT_CLOUD_APPID` / `TENCENT_CLOUD_REGION` | 腾讯云 APPID / 区域 |
| `UPLOADS_DIR` | （可选）Docker 卷挂载目录 |

> 生产环境禁止设置 `STORAGE_PROVIDER=local`（启动校验会拒绝）。

### H.3 支付（启用对应渠道时必填）
| 变量 | 说明 |
|---|---|
| `STRIPE_SECRET_KEY` | 生产 `sk_live_*` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_*` |
| `STRIPE_WEBHOOK_SECRET` | 生产 Webhook 端点密钥 |
| `WECHAT_*` / `ALIPAY_*` | 微信/支付宝（如启用） |
| `INSURANCE_WEBHOOK_SECRET` | 保险 Webhook HMAC 验签（接入时） |

### H.4 安全 / 合规
| 变量 | 说明 |
|---|---|
| `PII_ENCRYPTION_KEY` | 手机/邮箱 AES-256-GCM 加密（`openssl rand -hex 32`） |
| `INVESTOR_TOKEN` | 投资者看板访问令牌（建议配置） |

### H.5 可观测性 / 通知（推荐）
| 变量 | 说明 |
|---|---|
| `SENTRY_DSN` / `SENTRY_ENV` / `SENTRY_TRACES_RATE` | 错误监控 |
| `SMTP_*` | 邮件通知 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_MAILTO` | Web Push |

### H.6 可选功能
| 变量 | 说明 |
|---|---|
| `AMAP_KEY` / `AMAP_SECURITY_CODE` / `MAPBOX_TOKEN` | 地图 |
| `APPLE_TEAM_ID` / `ANDROID_SHA256_FINGERPRINT` / `APP_STORE_URL` / `PLAY_STORE_URL` | 深链/商店跳转 |
| `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` | 第三方登录 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | AI 教练 |
| `S3_BUCKET_US` / `AWS_*` | 海外对象存储 |

---

## I. Release Notes（最终发布说明）

### SummitLink — 2026-07-01 Release（Web + Backend）

**Security**
- 管理后台 CSRF：cookie 会话强制双提交 CSRF Token（常量时间比较），Bearer（Authorization 头）鉴权请求予以豁免。
- 支付安全：Stripe Live Mode 守卫 + Webhook 签名校验；日志 PII/密钥脱敏（`sk_`/`pk_`/手机号）。

**Infrastructure**
- 数据库迁移至 PostgreSQL（`DATABASE_PROVIDER=postgresql`），启动期幂等 schema patch。
- 文件存储永久化到腾讯云 COS（生产 Fail-Closed，禁止回退本地磁盘）。

**Compliance**
- GDPR：数据导出、账号删除、注销冷静期写保护、注册同意留痕。
- UGC 举报（Apple Guideline 1.2）：用户举报 API（`POST /api/reports`、`GET /api/reports/mine`）+ 管理后台流转（pending → reviewing → resolved/dismissed），新增 `content_reports` 表。

**Quality**
- 自动化测试通过（`npm run build` + `npm run test:api:unit`，除 3 项已知历史失败）。

**Known Limitations**
- 移动端原生工程需重建后方可提审；App Store 审核时间不可控时允许延后，不影响 Web 7-01 发布。

---

## J. P2 — 上架 Checklist 索引

> 详细步骤在各权威指南，本节为入口与关键门槛。

- **App Store**：[`../APP_STORE_CHECKLIST.md`](../APP_STORE_CHECKLIST.md)、[`./appstore-submit-guide.md`](./appstore-submit-guide.md)、文案 [`../APP_STORE_COPY.md`](../APP_STORE_COPY.md)
  - 关键门槛：原生工程重建、Distribution 证书/Profile、隐私标签、UGC 举报入口、5 张截图。
- **Google Play**：[`./googleplay-submit-guide.md`](./googleplay-submit-guide.md)
  - 关键门槛：签名 keystore、Data safety 表单、内容分级、AAB（内部→封闭→正式）。
- **TestFlight**：[`../MOBILE_BUILD_GUIDE.md`](../MOBILE_BUILD_GUIDE.md)、[`./fastlane-setup.md`](./fastlane-setup.md)、灰度 [`./GRADUAL_ROLLOUT.md`](./GRADUAL_ROLLOUT.md)
  - 关键门槛：Apple 账号 + `IOS_*` 签名 Secrets，经 `build-ios.yml` / `fastlane-beta.yml` 出包内测。
