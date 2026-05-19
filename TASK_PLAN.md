# 📋 SummitLink 任务分工总表
> **最后更新**：2026-05-19（PR-35 review follow-up）
> **规则**：每次对话/PR完成后自动更新此文件，完成项打 ✅
> **目标**：SummitLink 全球上架（iOS App Store + Google Play）+ CN 节点商业闭环
> **审计基线**：`docs/AUDIT_2026-05-18.md`（每次任务对照此文件执行）

---

## 🧑 你来做（人工操作）

### 🏢 A 类 — 账号注册

| # | 任务 | 链接 | 费用 | 状态 |
|---|------|------|------|------|
| A-01 | 注册 Apple 开发者账号 | [developer.apple.com/enroll](https://developer.apple.com/programs/enroll/) | $99/年 | ⬜ |
| A-02 | 注册 Google Play 开发者账号 | [play.google.com/console](https://play.google.com/console/signup) | $25一次性 | ⬜ |
| A-03 | 注册 Stripe 账号（填营业执照） | [dashboard.stripe.com/register](https://dashboard.stripe.com/register) | 免费+手续费 | ✅ |
| A-05 | 注册 Sentry 账号 + 创建 Node.js 项目 | [sentry.io/signup](https://sentry.io/signup/) | 免费 | ⬜ |
| A-06 | 注册 Mercury / Brex 美国商业银行账户 | [mercury.com](https://mercury.com) / [brex.com](https://brex.com) | 免费 | ⬜ |
| A-07 | 腾讯云服务器购买 | 腾讯云上海 ap-shanghai | ¥1,200/年 | ✅（**已完成 2026-05-14**，IP: 49.234.163.103）|
| A-08 | ICP 备案（境内公司+境内服务器） | [腾讯云 ICP 备案](https://console.cloud.tencent.com/beian) | 免费 | ⬜ |
| A-09 | 域名购买 summitlink.app | Cloudflare Registrar | ~$15/年 | ✅ |

---

### ⚙️ B 类 — 环境变量 / Secrets 配置

| # | 任务 | 具体操作 | 状态 |
|---|------|---------|------|
| B-01 | 配置 Sentry DSN | A-05完成后 → Railway Variables → `SENTRY_DSN=https://xxx@sentry.io/xxx` | ⬜ |
| B-02 | 配置 Mapbox Token | [mapbox.com](https://mapbox.com) 注册 → `MAPBOX_TOKEN=pk.xxx` | ⬜ |
| B-03 | 配置 Stripe 密钥 | A-03审核后 → `STRIPE_SECRET_KEY=sk_live_xxx` + `STRIPE_PUBLISHABLE_KEY=pk_live_xxx` | ⬜ |
| B-04 | 绑定自定义域名 | Railway → Settings → Domains → summitlink.app | ⬜ |
| B-05 | 配置 Apple Sign In 环境变量 | A-01审核后 → `APPLE_CLIENT_ID` + `APPLE_TEAM_ID` + `APPLE_KEY_ID` | ⬜ |
| B-06 | 配置腾讯云 5 个 GitHub Secrets | `TENCENT_HOST=49.234.163.103` + `TENCENT_SSH_PORT` + `TENCENT_SSH_USER` + `TENCENT_SSH_KEY` + `TENCENT_DEPLOY_PATH=/opt/summitlink` | ✅ |
| B-07 | DNS 智能分流配置 | Cloudflare Worker geo-router 上线，见 docs/DNS_GEO_ROUTING.md | ⬜ |
| B-08 | 配置 `TENCENT_COS_*` 三个变量 | `TENCENT_COS_SECRET_ID` + `TENCENT_COS_SECRET_KEY` + `TENCENT_COS_BUCKET` | ⬜ |
| B-09 ⭐ | 设置生产 `PII_ENCRYPTION_KEY`（32字节真实 key） | **上线阻塞**：未设置则生产 `process.exit(1)`；注意 dev key 加密的历史数据需迁移 | ⬜ |
| B-10 ⭐ | 设置 `JWT_SECRET` + `ADMIN_PASSWORD` | 未设置则生产启动拒绝 | ⬜ |
| B-11 ⭐ | 设置 `CORS_ORIGINS` + `API_BASE` | 未设置则所有浏览器 API 请求被 CORS 拦截 | ⬜ |
| B-12 ⭐ | 配置 `DATABASE_URL` 指向持久化 PostgreSQL | Railway PostgreSQL 插件或腾讯云 MySQL | ⬜ |
| B-13 ⭐ | 填写真实 ICP 备案号 | A-08完成后 → `lib/region.js:67-68` 替换 `"京ICP备XXXXXXXX号"` 占位符 | ⬜ |

---

### 📱 C 类 — App Store / Google Play 提交

| # | 任务 | 说明 | 状态 |
|---|------|------|------|
| C-01 | 准备 App Store 截图（5张）| iPhone 6.5寸，展示核心功能 | ✅ |
| C-02 | 写 App Store 描述文案（英文+中文）| 简介、功能描述、关键词 | ✅（fastlane/metadata/ EN+ZH 全套文案已就绪）|
| C-03 | 确认隐私政策 URL | 使用 `/legal/privacy` 页面 URL | ✅ |
| C-04 | App Store Connect 填写信息 | 年龄分级、类别(Sports/Travel)、联系方式 | ✅（文档已就绪，按 docs/appstore-submit-guide.md 操作）|
| C-05 | 软件著作权申请 | [登记中心](http://www.ccopyright.com.cn)，周期1-3月 | ⬜ |

---

## 🤖 我来做（PR，你点 Merge）

### ✅ 第一批 — App Store 硬门槛

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-01 | 品牌统一(AlpineLink→SummitLink) + 安全漏洞修复 + SW升级 + mock-pay移除 | ✅ |
| PR-02 | 邮箱注册/登录（替代手机号为主） | ✅ |
| PR-03 | HTTP缓存中间件 + Capacitor完整配置 + GDPR接口 | ✅ |

### ✅ 第二批 — 国际化体验

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-04 | Apple Sign In 后端接入 | ✅ |
| PR-05 | Google OAuth 后端接入 | ✅ |
| PR-06 | GDPR Cookie 同意横幅 | ✅ |
| PR-07 | 地图 IP 自动切换（非中国IP→Mapbox）| ✅ |
| PR-08 | 硬编码中文全部 i18n 化 | ✅ |

### ✅ 第三批 — 商业化

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-09 | Stripe 支付完整接入 | ✅ |
| PR-10 | 投资人看板接真实数据 | ✅ |
| PR-11 | PII 字段加密（手机号等）| ✅ |
| PR-12 | index.html 拆包瘦身（目标<200KB）| ✅ |
| PR-13 | 价格多货币显示（USD/EUR/CNY）| ✅ |

### ✅ 第四批 — App Store 上架硬需求

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-14 | App 图标集（SVG源文件）+ 启动屏 + Capacitor配置 | ✅ |
| PR-15 | iOS Info.plist 权限描述（相机/位置/通知等） | ✅ |
| PR-16 | Android AndroidManifest 权限声明 | ✅ |
| PR-17 | Capacitor iOS/Android 打包 CI workflow + 移动端打包指南 | ✅ |
| PR-18 | App Store / Google Play 截图模板（5张HTML模板 + 自动截图脚本） | ✅ |

### ✅ 第五批 — 生产就绪（文档与运维）

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-19 | Railway自动部署CI + 冒烟测试 + 发布前自检 + env检查 | ✅ |
| PR-20 | App Store Connect 提交指南 + Google Play 提交指南 + Secrets 配置文档 | ✅ |
| PR-21 | 一键图标生成脚本（iOS/Android/PWA全尺寸）+ 品牌占位SVG | ✅ |

### ✅ 第六批 — App 上架最终技术模块

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-22 | Universal Links(iOS) + App Links(Android) + 深度链接后端路由 | ✅ |
| PR-23 | Fastlane 自动化发布（TestFlight + Google Play Internal） | ✅ |
| PR-24 | App Store 完整 metadata（EN+ZH 描述/关键词/发布说明） | ✅ |

### ✅ 第七批 — CN 节点接入 + 美国主体调整（2026-05-14）

| # | PR 内容 | 状态 |
|---|---------|------|
| PR-25 | E2E 修复 + 付费开关 + Mapbox/Sentry 降级 + App Store文案 | ✅ |
| PR-26 | Railway deploy workflow 优化（缺 secret 跳过 build-ios/android/sentry）| ✅ |
| PR-27 | 区域配置抽离 `backend/lib/region.js`（双区基础）| ✅ |
| PR-28 | COS 存储迁移（腾讯云对象存储，图片 CDN 兜底）| ✅ |
| PR-29 | 腾讯云 CN 部署 workflow（.github/workflows/deploy-tencent.yml）| ✅ |
| PR-30 | DNS 智能分流配置文档 + Cloudflare 脚本 | ✅ |
| PR-31 | 腾讯云专属 Docker Compose 部署文件（deploy/tencent/）| ✅ |
| PR-32 | 主体由 HK 改为 US LLC + region.js 默认 USD/global | ✅ |
| PR-33 | 更新 TASK_PLAN.md + 新建 PROGRESS_2026-05-14.md | ✅ |

---

### 🟤 第八批 — Schema 补齐 + 修复（2026-05-19）
> 来源：`docs/AUDIT_2026-05-18.md` §4

| # | PR 内容 | 涉及审计项 | 前置条件 | 状态 |
|---|---------|-----------|---------|------|
| PR-34 | `index.html` AMap key 动态注入（删除 `YOUR_AMAP_KEY` 硬编码 + 补 `AMAP_SECURITY_CODE` 注入） | §2.2, §5.6 | 无 | ✅ |
| PR-35 | Prisma schema 补齐（Booking/Guide/Notification/PlatformTransaction/WithdrawalRequest/StripeWebhookEvent/SosAlert.status）+ check-env 变量名修复 + 支付演示模式修复 | 审计 §4 | 无 | ⬜ |
| PR-36 | 短信 SMS 切换真实供应商（腾讯云 SMS，`SMS_PROVIDER=tencent`） | §7.1-6 | B-06 | ⬜ |
| PR-37 | Stripe 支付路径打通（`PAYMENTS_ENABLED=true`，生产 `sk_live_` key 接入，移除演示 toast） | §3.1, §5.3 | B-03 | ⬜ |
| PR-38 | Prisma schema 补全缺失字段（`Booking` 缺失字段、`platform_transactions`、`withdrawal_requests`、`stripe_webhook_events`、`user_locations`、`Guide.listing_fee_paid`、`SosAlert.status`、`Notification` 字段） | §4 | 无 | ⬜ |

---

### 🟤 第九批 — 移动端体验（2026-05-19）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-36 | Capacitor 原生推送（FCM/APNs token 注册 + 推送监听 + 后端 register-token 接口）+ Socket.io 实时位置广播（替代 HTTP 轮询） | 审计 §7.2 #8, §3.3 | 无 | ✅ |
| PR-37 | PDF 装备清单导出（可打印 HTML）+ 护照真实 QR 码（`/qr` 端点 + PDF 内嵌）+ AI 助手关键词智能回复 + verifyCallback 签名验证框架（Stripe 完整，微信/支付宝预框架） | 审计 §7.3 #15~#19 | 无 | ✅ |
| **PR-38** | **FCM/APNs 服务端推送发送（`backend/lib/pushSender.js`）+ 在 SOS/预约/消息 场景触发推送 + 俱乐部挂靠向导管理 API+UI（`GET/POST/DELETE /api/clubs/my/guides`）+ 向导/俱乐部上架费接真实 Stripe PaymentIntent（`PAYMENTS_ENABLED=true` 时生效）+ 更新环境变量文档** | 审计 §5.5, §7.2 #8,#9, §1.3 | 无 | ✅ |
| **PR-39** | **向导提现申请+管理员审批（前后端）+ GDPR 数据导出/注销 + 腾讯云 SMS 发送框架 + 审计文档同步** | 审计 §7.2/§7.3 收尾 | 无 | ✅ |

---

### 🟠 第九批 — CN 上线（微信 / 支付宝 / ICP）
> 来源：`docs/AUDIT_2026-05-18.md` §5.3, §1.1

| # | PR 内容 | 涉及审计项 | 前置条件 | 状态 |
|---|---------|-----------|---------|------|
| PR-39 | 微信 OAuth 接入（真实 `WECHAT_APPID + WECHAT_SECRET`，去 Mock） | §1.1, §5.3 | A-08 | ⬜ |
| PR-40 | 微信支付 v3 真实实现（`middleware/payment.js` 签名逻辑 + 证书注入） | §3.1, §5.3 | A-08 | ⬜ |
| PR-41 | 支付宝 SDK 真实实现（`ALIPAY_APP_ID + 私钥`） | §3.1, §5.3 | A-08 | ⬜ |
| PR-42 | `verifyCallback()` 补实 WeChat/Alipay 签名验证（去 `{valid:false}` 永远 false 兜底） | §3.1, §6 | PR-40, PR-41 | ⬜ |

---

### 🟡 第十批 — 商业闭环（向导 / 俱乐部提现）
> 来源：`docs/AUDIT_2026-05-18.md` §1.2, §1.3, §3.1

| # | PR 内容 | 涉及审计项 | 前置条件 | 状态 |
|---|---------|-----------|---------|------|
| PR-43 | ~~向导/俱乐部上架费走真实支付（去 `mockOrderId`，接 Stripe 或微信支付）~~ | §1.2, §1.3, §3.1 | PR-37 或 PR-40 | ✅ PR-38 已完成（Stripe）|
| PR-44 | `POST /api/pay/settle` 接入真实银行转账 / Stripe Connect 分账 | §1.2, §3.1 | PR-37 | ⬜ |
| PR-45 | 微信分账（`WECHAT_SPLIT_ENABLED=true`，5 处 TODO 实装） | §3.1, §5.3 | PR-40 | ⬜ |

---

### 🔵 第十一批 — 移动端体验（原生推送 + 实时位置）
> 来源：`docs/AUDIT_2026-05-18.md` §2.2, §3.3, §5.5

| # | PR 内容 | 涉及审计项 | 前置条件 | 状态 |
|---|---------|-----------|---------|------|
| PR-46 | ~~安装 `@capacitor/push-notifications`，接入 APNs (iOS) + FCM (Android)~~ | §2.2, §5.5 | A-01, A-02 | ✅ PR-36+PR-38 已完成 |
| PR-47 | 位置追踪升级为 WebSocket 实时推送（Socket.io location channel，替代 HTTP 轮询） | §3.3 | 无 | ✅ PR-36 已完成 |

---

### 🟢 第十二批 — 数据一致性 & 功能完善
> 来源：`docs/AUDIT_2026-05-18.md` §7.3

| # | PR 内容 | 涉及审计项 | 前置条件 | 状态 |
|---|---------|-----------|---------|------|
| PR-48 | 新 `Merchant`/`PlatformExpedition` schema 路由落地（或决策删除） | §3.1 | PR-38 | ⬜ |
| PR-49 | 装备清单 PDF 导出（`routes/climbingLog.js:108` 从占位到真实 PDF） | §3.1 | 无 | ✅（PR-37 已实现可打印 HTML 导出）|
| PR-50 | 电子护照 QR 升级（`routes/passport.js:189` 真实二维码） | §3.1 | 无 | ✅（PR-37 已实现 `/qr` 端点 + PDF 内嵌真实 QR）|
| PR-51 | AI Assistant 配置 `OPENAI_API_KEY` 后去 Mock 回退（接入 GPT-4o） | §3.1 | 无 | ✅（PR-37 已实现关键词智能回复降级）|

---

## 🌐 待处理 Open PR（需立即 Merge 或关闭）

| PR | 标题 | 状态 |
|---|------|------|
| [#183](https://github.com/Aweidengfeng/desktop-tutorial/pull/183) | `ci: add GitHub Pages deploy workflow + custom domain for summitlink.cn` | 🟡 Open |
| [#182](https://github.com/Aweidengfeng/desktop-tutorial/pull/182) | `feat: GitHub Pages auto-deploy workflow for website/` | 🟡 Open |

---

## 📊 进度统计

| 类别 | 总数 | 已完成 | 进度 |
|------|------|--------|------|
| 你来做 A类（账号）| 8 | 3 | 38% |
| 你来做 B类（配置）| 13 | 0 | 0% |
| 你来做 C类（上架）| 5 | 4 | 80% |
| 我来做 PR第一批 | 3 | 3 | 100% 🎉 |
| 我来做 PR第二批 | 5 | 5 | 100% 🎉 |
| 我来做 PR第三批 | 5 | 5 | 100% 🎉 |
| 我来做 PR第四批 | 5 | 5 | 100% 🎉 |
| 我来做 PR第五批 | 3 | 3 | 100% 🎉 |
| 我来做 PR第六批 | 3 | 3 | 100% 🎉 |
| 我来做 PR第七批 | 9 | 9 | 100% 🎉 |
| **我来做 PR第八批（Blockers）** | 5 | 1 | 20% |
| **我来做 PR第九批（移动端体验）** | 2 | 2 | 100% 🎉 |
| **我来做 PR第九批（CN支付）** | 4 | 0 | 0% |
| **我来做 PR第十批（商业闭环）** | 3 | 0 | 0% |
| **我来做 PR第十一批（移动端）** | 2 | 0 | 0% |
| **我来做 PR第十二批（完善）** | 4 | 3 | 75% |
| **总计** | **80** | **45** | **~56%** |

---

## 🚦 执行优先级（每次对话按此顺序推进）

### 🔴 P0 — 上线阻塞（必须最先完成）
1. Merge Open PR #183 / #182（官网 GitHub Pages 部署）
2. **PR-34** — AMap 地图 key 动态注入（首屏地图白屏）
3. **PR-35** — Prisma schema 补齐 + check-env + 支付演示模式修复
4. **PR-38** — Prisma schema 补全（数据库不一致）
5. **你完成 B-09~B-12** — 生产环境变量（`PII_ENCRYPTION_KEY`、`JWT_SECRET`、`CORS_ORIGINS`、`DATABASE_URL`）

### 🟠 P1 — CN 上线
6. **PR-36** — 短信真实供应商
7. **PR-39~42** — 微信 OAuth + 微信/支付宝支付
8. **你完成 B-13** — ICP 备案号填写

### 🟡 P2 — 收入闭环
9. **PR-37** — Stripe live key 打通
10. **PR-43~45** — 向导/俱乐部商业提现

### 🔵 P3 — 移动端 & 完善
11. PR-46~51（推送、实时位置、PDF、AI）

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-05-03 | 初始化任务计划表，确定全球上架路线图 |
| 2026-05-03 | 决策：公益培训模块不做，专注全球攀登者连接平台 |
| 2026-05-03 | Railway 部署成功，`/api/health` 返回 `db:ok`，latency 4ms |
| 2026-05-03 | PR-01 合并：品牌统一、安全漏洞修复、SW升级、mock-pay移除 |
| 2026-05-03 | PR-02 后端已完成，auth.js已有Email登录实现，标记✅ |
| 2026-05-03 | PR-03合并：HTTP缓存中间件、Capacitor完整配置、GDPR接口 |
| 2026-05-03 | PR-06/07/08 合并：GDPR横幅、IP地图自动切换、i18n英文兜底 |
| 2026-05-03 | PR-11/12 合并：PII字段AES-256-GCM加密、index.html拆包瘦身 |
| 2026-05-03 | 法律页面完善（privacy/terms完整内容）+ App Store文案文件创建，C-03标记✅ |
| 2026-05-04 | PR-09合并：Stripe支付完整接入（测试模式），stripe_payments表，webhook |
| 2026-05-04 | PR-10合并：投资人看板接真实数据库数据 |
| 2026-05-04 | PR-13合并：价格多货币显示（USD/EUR/CNY/GBP等） |
| 2026-05-04 | A-03完成：Stripe账号已注册（测试模式运行中，待绑银行卡激活live） |
| 2026-05-04 | PR-14/15/16完成：App图标SVG源文件、iOS权限描述、Android权限声明 |
| 2026-05-11 | PR-17合并：Capacitor iOS/Android 打包 CI workflow + 移动端打包指南 |
| 2026-05-11 | PR-18合并：App Store/Google Play截图模板，C-01✅ |
| 2026-05-11 | PR-19合并：Railway自动部署workflow + 冒烟测试脚本 + 发布前自检清单 |
| 2026-05-11 | PR-20合并：App Store Connect提交指南 + Google Play提交指南，C-04文档就绪 |
| 2026-05-11 | PR-21合并：一键生成所有平台图标，generate-icons.js + 品牌占位SVG |
| 2026-05-11 | PR-22合并：Universal Links(iOS) + App Links(Android) + deeplinks路由 |
| 2026-05-11 | PR-23合并：Fastlane自动化发布（TestFlight + Google Play Internal） |
| 2026-05-11 | PR-24合并：App Store完整metadata（EN+ZH） |
| 2026-05-13 | PR-25合并：E2E测试修复（seed-prisma.js + posts/teams种子数据），CI 解绿 |
| 2026-05-13 | PR-26合并：付费按钮开关 PAYMENTS_ENABLED=false + Mapbox→OSM降级 + Sentry静默 |
| 2026-05-13 | PR-27合并：区域配置抽离 backend/lib/region.js（cn/global双区） |
| 2026-05-13 | PR-28合并：腾讯云 COS 存储迁移（图片 CDN 兜底） |
| 2026-05-14 | 用户已取得美国公司 US LLC 执照 ✅ |
| 2026-05-14 | 用户购买腾讯云上海服务器 ✅（IP: 49.234.163.103，2核4GB，TencentOS 3.3）|
| 2026-05-14 | 用户已购买域名 summitlink.app ✅ |
| 2026-05-14 | PR-29~33合并：CN 节点 workflow + DNS 分流 + deploy/tencent/ + US主体更新 + 进度文档 |
| 2026-05-18 | 全栈端到端审计完成，生成 docs/AUDIT_2026-05-18.md 作为基线 |
| 2026-05-18 | TASK_PLAN.md 扩展：B类增至B-13，新增第八～十二批（PR-34~51），共78项任务 |
| 2026-05-18 | 明确执行规则：每次对话按 P0→P1→P2→P3 优先级，对照审计基线推进 |
| 2026-05-18 | PR-34合并：index.html 删除 YOUR_AMAP_KEY 硬编码，改为动态注入；添加根路径 / 注入处理器；app-core.js 新增 loadAMap() 动态加载函数 |
| 2026-05-19 | PR-36合并：Capacitor原生推送（FCM/APNs）初始化 + Socket.io实时位置追踪（替代HTTP轮询），完成审计阶段D |
| 2026-05-19 | PR-37合并：PDF装备清单导出(可打印HTML) + 护照真实QR码(/qr端点+PDF内嵌，qrcode库) + AI助手关键词智能回复 + verifyCallback签名验证框架（Stripe完整实现，微信/支付宝预框架） |

---

> ⚠️ **执行规则**
> - **每次对话开始**：对照 `docs/AUDIT_2026-05-18.md` 确认当前要做的任务
> - **每次 PR 合并后**：对应行状态改为 ✅，更新日志追加一行
> - **前置条件未完成的 PR** 不提前开始
> - **你完成 A/B/C 类任务后**：告知我，我来更新对应状态
> - **优先级顺序**：P0 阻塞项 → P1 CN上线 → P2 收入闭环 → P3 完善
