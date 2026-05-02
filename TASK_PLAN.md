# 📋 SummitLink 任务分工总表
> **最后更新**：2026-05-03
> **规则**：每次对话/PR完成后自动更新此文件，完成项打 ✅
> **目标**：SummitLink 全球上架（iOS App Store + Google Play）

---

## 🧑 你来做（人工操作）

### 🏢 A 类 — 账号注册

| # | 任务 | 链接 | 费用 | 状态 |
|---|------|------|------|------|
| A-01 | 注册 Apple 开发者账号 | [developer.apple.com/enroll](https://developer.apple.com/programs/enroll/) | $99/年 | ⬜ |
| A-02 | 注册 Google Play 开发者账号 | [play.google.com/console](https://play.google.com/console/signup) | $25一次性 | ⬜ |
| A-03 | 注册 Stripe 账号（填营业执照） | [dashboard.stripe.com/register](https://dashboard.stripe.com/register) | 免费+手续费 | ⬜ |
| A-04 | 购买域名 summitlink.app | [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | ~$15/年 | ⬜ |
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

---

### 📱 C 类 — App Store / Google Play 提交

| # | 任务 | 说明 | 状态 |
|---|------|------|------|
| C-01 | 准备 App Store 截图（5张）| iPhone 6.5寸，展示核心功能 | ⬜ |
| C-02 | 写 App Store 描述文案（英文+中文）| 简介、功能描述、关键词 | ⬜ |
| C-03 | 确认隐私政策 URL | 使用 `/legal/privacy` 页面 URL | ⬜ |
| C-04 | App Store Connect 填写信息 | 年龄分级、类别(Sports/Travel)、联系方式 | ⬜ |
| C-05 | 软件著作权申请 | [登记中心](http://www.ccopyright.com.cn)，周期1-3月 | ⬜ |

---

## 🤖 我来做（PR，你点 Merge）

### 🔴 第一批 — 本周（App Store 硬门槛）

| # | PR 内容 | 涉及任务 | 状态 |
|---|---------|---------|------|
| PR-01 | 品牌统一(AlpineLink→SummitLink) + 安全漏洞修复 + SW升级 + mock-pay移除 | T-01, T-02, T-07, T-08, T-20 | ✅ |
| PR-02 | 邮箱注册/登录（替代手机号为主） | T-05 | ⬜ |
| PR-03 | HTTP缓存中间件 + Capacitor完整配置 | T-14, T-17 | ⬜ |

---

### 🟡 第二批 — 下周（国际化体验）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-04 | Apple Sign In 后端接入 | T-03 | A-01 审核通过 | ⬜ |
| PR-05 | Google OAuth 后端接入 | T-04 | 无 | ⬜ |
| PR-06 | GDPR Cookie 同意横幅 | T-09 | 无 | ⬜ |
| PR-07 | 地图 IP 自动切换（非中国IP→Mapbox）| T-10 | B-02 完成 | ⬜ |
| PR-08 | 硬编码中文全部 i18n 化 | T-11 | 无 | ⬜ |

---

### 🟢 第三批 — 两周后（商业化）

| # | PR 内容 | 涉及任务 | 前置条件 | 状态 |
|---|---------|---------|---------|------|
| PR-09 | Stripe 支付完整接入 | T-06 | A-03+B-03 完成 | ⬜ |
| PR-10 | 投资人看板接真实数据 | T-18 | PR-09 完成 | ⬜ |
| PR-11 | PII 字段加密（手机号等）| T-16 | 无 | ⬜ |
| PR-12 | index.html 拆包瘦身（目标<200KB）| T-13 | 无 | ⬜ |
| PR-13 | 价格多货币显示（USD/EUR/CNY）| T-12 | PR-09 完成 | ⬜ |

---

## 📊 进度统计

| 类别 | 总数 | 已完成 | 进度 |
|------|------|--------|------|
| 你来做 A类（账号）| 5 | 0 | 0% |
| 你来做 B类（配置）| 5 | 0 | 0% |
| 你来做 C类（上架）| 5 | 0 | 0% |
| 我来做 PR第一批 | 3 | 1 | 33% |
| 我来做 PR第二批 | 5 | 0 | 0% |
| 我来做 PR第三批 | 5 | 0 | 0% |
| **总计** | **28** | **1** | **4%** |

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-05-03 | 初始化任务计划表，确定全球上架路线图 |
| 2026-05-03 | 决策：公益培训模块不做，专注全球攀登者连接平台 |
| 2026-05-03 | Railway 部署成功，`/api/health` 返回 `db:ok`，latency 4ms |
| 2026-05-03 | PR-01 合并：品牌统一、安全漏洞修复、SW升级、mock-pay移除 |

---

> ⚠️ **规则说明**
> - 每次 PR 合并后，对应行状态改为 ✅
> - 每次对话结束，更新日志追加一行
> - 前置条件未完成的 PR 不提前开始
> - 你完成 A/B/C 类任务后，告知我，我来更新对应状态
