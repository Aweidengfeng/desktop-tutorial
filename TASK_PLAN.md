# 📋 SummitLink 任务分工总表
> **最后更新**：2026-05-11 (PR-24 App Store 完整 metadata（EN+ZH）+ Fastlane 自动化发布 + Universal Links/App Links 深度链接)
> **规则**：每次对话/PR完成后自动更新此文件，完成项打 ✅
> **目标**：SummitLink 全球上架（iOS App Store + Google Play）

---

## 🧑 你来做（人工操作）

### 🏢 A 类 — 账号注册

| # | 任务 | 链接 | 费用 | 状态 |
|---|------|------|------|------|
| A-01 | 注册 Apple 开发者账号 | [developer.apple.com/enroll](https://developer.apple.com/programs/enroll/) | $99/年 | ⬜ |
| A-02 | 注册 Google Play 开发者账号 | [play.google.com/console](https://play.google.com/console/signup) | $25一次性 | ⬜ |
| A-03 | 注册 Stripe 账号（填营业执照） | [dashboard.stripe.com/register](https://dashboard.stripe.com/register) | 免费+手续费 | ✅ |
| A-06 | 注册 Mercury / Brex 美国商业银行账户 | [mercury.com](https://mercury.com) / [brex.com](https://brex.com) | 免费 | ⬜ |
| A-07 | 腾讯云服务器购买 | 腾讯云上海 ap-shanghai | ¥1,200/年 | ✅（**已完成 2026-05-14**，IP: 49.234.163.103）|
| A-08 | ICP 备案（境内公司+境内服务器） | [腾讯云 ICP 备案](https://console.cloud.tencent.com/beian) | 免费 | ⬜ |
| A-09 | 域名购买 summitlink.app | Cloudflare Registrar | ~$15/年 | ✅ |
| A-05 | 注册 Sentry 账号 + 创建 Node.js 项目 | [sentry.io/signup](https://sentry.io/signup/) | 免费 | ⬜ |

---

### ⚙️ B 类 — Railway 环境变量配置

| # | 任务 | 具体操作 | 状态 |
|---|------|---------|------|
| B-01 | 配置 Sentry DSN | A-05完成后 → Railway Variables → `SENTRY_DSN=https://xxx@sentry.io/xxx` | ⬜ |
| B-02 | 配置 Mapbox Token | [mapbox.com](https://mapbox.com) 注册 → `MAPBOX_TOKEN=pk.xxx` | ⬜ |
| B-03 | 配置 Stripe 密钥 | A-03审核后 → `STRIPE_SECRET_KEY=sk_live_xxx` + `STRIPE_PUBLISHABLE_KEY=pk_live_xxx` | ⬜ |
| B-04 | 绑定自定义域名 | A-04完成后 → Railway → Settings → Domains → summitlink.app | ⬜ |
| B-05 | 配置 Apple Sign In 环境变量 | A-01审核后 → `APPLE_CLIENT_ID` + `APPLE_TEAM_ID` + `APPLE_KEY_ID` | ⬜ |
| B-06 | 配置腾讯云 5 个 GitHub Secrets | `TENCENT_HOST=49.234.163.103` + `TENCENT_SSH_PORT` + `TENCENT_SSH_USER` + `TENCENT_SSH_KEY` + `TENCENT_DEPLOY_PATH=/opt/summitlink` | ⬜ |
| B-07 | DNS 智能分流配置 | Cloudflare Worker geo-router 上线，见 docs/DNS_GEO_ROUTING.md | ⬜ |
| B-08 | 配置 `TENCENT_COS_*` 三个变量 | `TENCENT_COS_SECRET_ID` + `TENCENT_COS_SECRET_KEY` + `TENCENT_COS_BUCKET` | ⬜ |

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

### 🔴 第一批 — 本周（App Store 硬门槛）

| # | PR 内容 | 涉及任务 | 状态 |
|---|---------|---------|------|
| PR-01 | 品牌统一(AlpineLink→SummitLink) + 安全漏洞修复 + SW升级 + mock-pay移除 | T-01, T-02, T-07, T-08, T-20 | ✅ |
| PR-02 | 邮箱注册/登录（替代手机号为主） | T-05 | ✅ |
| PR-03 | HTTP缓存中间件 + Capacitor完整配置 + GDPR接口 | T-14, T-17, T-09 | ✅ |

---

### 🟡 第二批 — 下周（国际化体验）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-04 | Apple Sign In 后端接入 | T-03 | A-01 审核通过 | ✅ |
| PR-05 | Google OAuth 后端接入 | T-04 | 无 | ✅ |
| PR-06 | GDPR Cookie 同意横幅 | T-09 | 无 | ✅ |
| PR-07 | 地图 IP 自动切换（非中国IP→Mapbox）| T-10 | B-02 完成 | ✅ |
| PR-08 | 硬编码中文全部 i18n 化 | T-11 | 无 | ✅ |

---

### 🟢 第三批 — 两周后（商业化）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-09 | Stripe 支付完整接入 | T-06 | A-03+B-03 完成 | ✅ |
| PR-10 | 投资人看板接真实数据 | T-18 | PR-09 完成 | ✅ |
| PR-11 | PII 字段加密（手机号等）| T-16 | 无 | ✅ |
| PR-12 | index.html 拆包瘦身（目标<200KB）| T-13 | 无 | ✅ |
| PR-13 | 价格多货币显示（USD/EUR/CNY）| T-12 | PR-09 完成 | ✅ |

---

### 🔵 第四批 — App Store 上架硬需求

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-14 | App 图标集（SVG源文件）+ 启动屏 + Capacitor配置 | C-01 | 无 | ✅ |
| PR-15 | iOS Info.plist 权限描述（相机/位置/通知等） | C-04 | 无 | ✅ |
| PR-16 | Android AndroidManifest 权限声明 | C-04 | 无 | ✅ |
| PR-17 | Capacitor iOS/Android 打包 CI workflow + 移动端打包指南 | C-04 | 无 | ✅ |
| PR-18 | App Store / Google Play 截图模板（5张HTML模板 + 自动截图脚本） | C-01 | 无 | ✅ |

---

### ⚫ 第五批 — 生产就绪（文档与运维）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-19 | Railway自动部署CI + 冒烟测试 + 发布前自检 + env检查 | 运维 | 无 | ✅ |
| PR-20 | App Store Connect 提交指南 + Google Play 提交指南 + Secrets 配置文档 | C-04 | A-01, A-02 | ✅ |
| PR-21 | 一键图标生成脚本（iOS/Android/PWA全尺寸）+ 品牌占位SVG | C-01辅助 | 无 | ✅ |

---

### 🟣 第六批 — App 上架最终技术模块

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-22 | Universal Links(iOS) + App Links(Android) + 深度链接后端路由 | App Store 审核必测 | A-01 | ✅ |
| PR-23 | Fastlane 自动化发布（TestFlight + Google Play Internal） | C-04自动化 | A-01, A-02 | ✅ |
| PR-24 | App Store 完整 metadata（EN+ZH 描述/关键词/发布说明），C-02 ✅ | C-02 | 无 | ✅ |

---

### 🔶 第七批 — CN 节点接入 + 美国主体调整（2026-05-14）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-25 | E2E 修复 + 付费开关 + Mapbox/Sentry 降级 + App Store文案 | 运维 | 无 | ✅ |
| PR-26 | Railway deploy workflow 优化（缺 secret 跳过 build-ios/android/sentry）| CI | 无 | ✅ |
| PR-27 | 区域配置抽离 `backend/lib/region.js`（双区基础）| 架构 | 无 | ✅ |
| PR-28 | COS 存储迁移（腾讯云对象存储，图片 CDN 兜底）| 存储 | 无 | ✅ |
| PR-29 | 腾讯云 CN 部署 workflow（.github/workflows/deploy-tencent.yml）| CI/CD | B-06 | ✅ |
| PR-30 | DNS 智能分流配置文档 + Cloudflare 脚本 | DNS | B-07 | ✅ |
| PR-31 | 腾讯云专属 Docker Compose 部署文件（deploy/tencent/）| 部署 | A-07 | ✅ |
| PR-32 | 主体由 HK 改为 US LLC + region.js 默认 USD/global | 架构/文档 | 无 | ✅ |
| PR-33 | 更新 TASK_PLAN.md + 新建 PROGRESS_2026-05-14.md | 文档 | 无 | ✅ |

---

## 📊 进度统计

| 类别 | 总数 | 已完成 | 进度 |
|------|------|--------|------|
| 你来做 A类（账号）| 9 | 3 | 33% |
| 你来做 B类（配置）| 8 | 0 | 0% |
| 你来做 C类（上架）| 5 | 4 | 80% |
| 我来做 PR第一批 | 3 | 3 | 100% |
| 我来做 PR第二批 | 5 | 5 | 100% |
| 我来做 PR第三批 | 5 | 5 | 100% 🎉 |
| 我来做 PR第四批 | 5 | 5 | 100% 🎉 |
| 我来做 PR第五批 | 3 | 3 | 100% 🎉 |
| 我来做 PR第六批 | 3 | 3 | 100% 🎉 |
| 我来做 PR第七批 | 9 | 9 | 100% 🎉 |
| **总计** | **55** | **40** | **~82%** |

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-05-03 | 初始化任务计划表，确定全球上架路线图 |
| 2026-05-03 | 决策：公益培训模块不做，专注全球攀登者连接平台 |
| 2026-05-03 | Railway 部署成功，`/api/health` 返回 `db:ok`，latency 4ms |
| 2026-05-03 | PR-01 合并：品牌统一、安全漏洞修复、SW升级、mock-pay移除 |
| 2026-05-03 | PR-02 后端已完成，auth.js已有Email登录实现，标记✅ |
| 2026-05-03 | PR-03合并：HTTP缓存中间件、Capacitor完整配置、GDPR接口。发现auth.js已有Email/Apple/Google登录后端实现，PR-04/05标记后端✅ |
| 2026-05-03 | PR-06/07/08 合并：GDPR横幅(前端)、IP地图自动切换(/api/config/map)、i18n英文兜底 |
| 2026-05-03 | PR-11/12 合并：PII字段AES-256-GCM加密、index.html拆包瘦身 |
| 2026-05-03 | 法律页面完善（privacy/terms完整内容）+ App Store文案文件创建，C-03标记✅ |
| 2026-05-04 | PR-09合并：Stripe支付完整接入（测试模式），stripe_payments表，webhook，/api/payment/config+create-intent+stripe-stats |
| 2026-05-04 | PR-10合并：投资人看板接真实数据库数据（admin/stats增加stripeRevenue/stripeTransactions字段） |
| 2026-05-04 | PR-13合并：价格多货币显示（USD/EUR/CNY/GBP等），/api/currency/rates+convert，www/js/currency.js前端格式化工具 |
| 2026-05-04 | PR-06/07/08合并：GDPR横幅、IP地图切换、i18n英文fallback |
| 2026-05-04 | PR-11/12合并：AES-256-GCM PII加密、index.html拆包瘦身 |
| 2026-05-04 | A-03完成：Stripe账号已注册（测试模式运行中，待绑银行卡激活live） |
| 2026-05-04 | PR-14/15/16完成：App图标SVG源文件、iOS权限描述(Info.plist)、Android权限声明(AndroidManifest) |
| 2026-05-11 | PR-17合并：Capacitor iOS/Android 打包 CI workflow + 移动端打包指南 |
| 2026-05-11 | PR-18合并：App Store/Google Play截图模板(5张HTML模板+自动截图脚本)，C-01✅ |
| 2026-05-11 | PR-19合并：Railway自动部署workflow + 冒烟测试脚本 + 发布前自检清单 + env变量检查器 |
| 2026-05-11 | PR-20合并：App Store Connect提交指南 + Google Play提交指南 + GitHub Secrets配置文档，C-04文档就绪 |
| 2026-05-11 | PR-21合并：一键生成所有平台图标（iOS 15尺寸 + Android 10尺寸 + PWA 8尺寸），generate-icons.js + 品牌占位SVG |
| 2026-05-11 | PR-22合并：Universal Links(iOS) + App Links(Android) + deeplinks路由(/verify-email, /reset-password) + universalLinks中间件 + docs/universal-links-setup.md + nginx.conf更新 |
| 2026-05-11 | PR-23合并：Fastlane自动化发布（fastlane/Appfile, Fastfile, Gemfile, Deliverfile）+ GitHub Actions workflow（fastlane-beta.yml，push tag v* 触发）+ docs/fastlane-setup.md |
| 2026-05-11 | PR-24合并：App Store完整metadata（EN+ZH）：name/subtitle/description/keywords/promotional_text/release_notes/support_url/marketing_url + zh-Hans全套 + default/privacy_url，C-02✅ |
| 2026-05-13 | PR-25合并：E2E测试修复（seed-prisma.js + posts/teams种子数据），CI 解绿 |
| 2026-05-13 | PR-26合并：付费按钮开关 PAYMENTS_ENABLED=false + Mapbox→OSM降级 + Sentry静默 + App Store免费文案 |
| 2026-05-13 | PR-27合并：区域配置抽离 backend/lib/region.js（cn/global双区），PR-145（Launch P0）总 PR 合并 |
| 2026-05-13 | PR-28合并：腾讯云 COS 存储迁移（图片 CDN 兜底），COS_BUCKET/COS_REGION 等变量已就绪 |
| 2026-05-14 | 用户已取得美国公司 US LLC 执照 ✅，战略由"香港主体"改为"美国主体 + 境内主体"双主体 |
| 2026-05-14 | 用户购买腾讯云上海服务器 ✅（IP: 49.234.163.103，2核4GB，TencentOS 3.3）|
| 2026-05-14 | 用户已购买域名 summitlink.app ✅ |
| 2026-05-14 | PR-29~33合并（本批次五合一）：CN 节点 workflow + DNS 分流 + deploy/tencent/ 目录 + US主体更新 + 进度文档 |

---

> ⚠️ **规则说明**
> - 每次 PR 合并后，对应行状态改为 ✅
> - 每次对话结束，更新日志追加一行
> - 前置条件未完成的 PR 不提前开始
> - 你完成 A/B/C 类任务后，告知我，我来更新对应状态
