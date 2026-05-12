# 🚀 SummitLink 2026 Q2 上架路线图（双主体 + 4 阶段）

> **生成时间**：2026-05-12
> **决策摘要**：阶段化上架（P1）+ 暂只开香港公司（C3）+ Railway 海外节点（S1）+ 并发开 PR（R1）
> **关键现状**：境内公司 ✅ 未开户、香港公司 5/12 提交注册（5/15 前下来）、Stripe 暂为测试模式

---

## 🏗️ 一、目标架构（最终态）

```
┌─────────────────────────────────────────────────────────┐
│                      用户层                              │
├───────────────┐                ├───────────────────────┤
│  国内大陆用户  │                │  海外/境外用户         │
└───────┬───────┘                └────────┬──────────────┘
        │                                 │
        └───────────┬─────────────────────┘
                    ▼
        ┌─────────────────────────┐
        │   智能 DNS + 全球 CDN   │
        │  按 IP 分流解析          │
        └───────────┬─────────────┘
                    │
       ┌────────────┴─────────────┐
       ▼                          ▼
┌──────────────────┐   ┌────────────────────────┐
│ 杭州国内服务器    │   │ 香港/新加坡境外服务器    │
│ （阿里云）        │   │ （Railway / Vultr）     │
├──────────────────┤   ├────────────────────────┤
│ 国内接口业务      │   │ 海外接口业务            │
│ 微信/支付宝跨境  │   │ Stripe / PayPal        │
│ 支撑 ICP 备案     │   │ 全球低延迟              │
└────────┬─────────┘   └──────────┬─────────────┘
         │                        │
         ▼                        ▼
   人民币结算                  美金 / 港币结算
         │                        │
         └────────────┬───────────┘
                      ▼
         ┌─────────────────────────┐
         │   香港公司对公账户       │
         │  WISE / Airwallex       │
         └─────────────────────────┘

主体配套：
┌───────────────────┐   ┌───────────────────────┐
│  内地公司主体     │   │   香港公司主体         │
│  ICP 备案 / 合规  │   │   海外上架 / 收款      │
└───────────────────┘   └───────────────────────┘
```

---

## ⏰ 二、4 阶段时间表

| 阶段 | 时间 | 主体 | 部署 | 功能 | 审核 |
|---|---|---|---|---|---|
| **阶段 1** | **5/15** | 个人开发者 | Railway 海外 | 免费社区+地图+队伍（隐藏付费） | iOS 48h |
| **阶段 2** | **6/01** | 香港公司 | + 香港边缘节点 | + Stripe Live（USD/HKD/EUR/JPY） | v1.1 更新 24h |
| **阶段 3** | **6/15** | 香港公司 | + 阿里云香港 | + 中国区 iOS（仅 IAP） | 中国区 iOS 7 天 |
| **阶段 4** | **7/01+** | 内地公司 + 香港公司 | 完整双区 | + 微信/支付宝/Android 国内市场 | Android 国内市场 |

---

## 🔑 三、需要申请的"真实 API / Key / 账号"清单

### 🔴 P0 — 5/15 提审前必须有（5 项）

| # | 服务 | 用途 | 链接 | 费用 | 状态 |
|---|---|---|---|---|---|
| 1 | Apple Developer | iOS 提审 | https://developer.apple.com/programs/enroll/ | $99/年 | ⬜ |
| 2 | Google Play Console | Android 提审 | https://play.google.com/console/signup | $25 | ⬜ |
| 3 | 域名 summitlink.app | 隐私政策 URL | https://cloudflare.com/products/registrar | $15/年 | ⬜ |
| 4 | Mapbox Token | 海外用户地图 | https://account.mapbox.com/access-tokens/ | 免费 5万次/月 | ⬜ |
| 5 | Sentry DSN | 崩溃监控 | https://sentry.io/signup/ | 免费 5k events/月 | ⬜ |

**Railway 环境变量（拿到后立即配）**：
```bash
MAPBOX_TOKEN=pk.xxx
SENTRY_DSN=https://xxx@oxxx.ingest.sentry.io/xxx
```

### 🟡 P1 — 香港公司下来后 1 周内（5 项）

| # | 服务 | 用途 | 链接 | 前置 | 状态 |
|---|---|---|---|---|---|
| 6 | Stripe HK Live | 真实收款 | https://dashboard.stripe.com/register | BR + 港币账户 | ⬜ |
| 7 | WISE Business | 香港离岸账户 | https://wise.com/business | BR + 法人护照 | ⬜ |
| 8 | Apple Sign In Service ID | iOS 第三方登录 | https://developer.apple.com/account/resources/identifiers | A-01 通过 | ⬜ |
| 9 | Google OAuth Client | Google 登录 | https://console.cloud.google.com/apis/credentials | Gmail | ⬜ |
| 10 | SendGrid / Postmark | 邮件验证 | https://signup.sendgrid.com/ | 个人邮箱 | ⬜ |

**Railway 环境变量**：
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APPLE_CLIENT_ID=com.summitlink.app
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY=...（.p8 文件内容）
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@summitlink.app
```

### 🟢 P2 — 海外功能完善（按需，2–3 周）

| # | 服务 | 用途 | 链接 | 状态 |
|---|---|---|---|---|
| 11 | OpenWeatherMap | 山峰天气 | https://openweathermap.org/api | ⬜ |
| 12 | Twilio | 国际短信 | https://www.twilio.com/console | ⬜ |
| 13 | Cloudflare R2 / AWS S3 | 图片存储 | https://dash.cloudflare.com/ | ⬜ |
| 14 | OneSignal / Firebase FCM | 推送通知 | https://onesignal.com/ | ⬜ |
| 15 | Algolia / Meilisearch | 全文搜索 | https://www.algolia.com/ | ⬜ |
| 16 | Cloudflare Turnstile | 防机器人 | https://dash.cloudflare.com/ | ⬜ |

### 🔵 P3 — 大陆主体上架（6–7 月，等 ICP）

| # | 服务 | 用途 | 备注 | 状态 |
|---|---|---|---|---|
| 17 | ICP 备案 | 国内域名可访问 | 境内公司 BR + 法人身份证，20 天 | ⬜ |
| 18 | 微信支付商户号（跨境） | 大陆用户付费 | https://pay.weixin.qq.com/index.php/extend/cross_border | ⬜ |
| 19 | 支付宝商户号（国际版） | 大陆用户付费 | https://global.alipay.com/ | ⬜ |
| 20 | 阿里云 SMS | 国内短信 | 需 BR + ICP | ⬜ |
| 21 | 高德 AMap 企业 Key | 国内地图 | 需 BR | ⬜ |
| 22 | 阿里云内容安全 | UGC 审核 | 国内合规强制 | ⬜ |
| 23 | 软件著作权 | Android 国内市场 | 加急 1 周 ¥800–1500 | ⬜ |

---

## 🤖 四、Copilot 立即开始的 PR 队列

### 🔥 立即（不依赖任何 key）

| PR | 内容 | 预计耗时 |
|---|---|---|
| **PR-19** | 修 E2E 5 个失败（CI 解锁） | 2h |
| **PR-20** | 付费按钮加 `PAYMENTS_ENABLED` 开关 | 1h |
| **PR-21** | App Store 描述文案改为免费版（中英双语） | 1h |
| **PR-22** | Mapbox token 缺失时降级 OSM（避免黑屏） | 1h |
| **PR-23** | Sentry DSN 自动启用 + 健康检查上报 | 1h |
| **PR-25** | `config/region.js` 区域配置抽离（双区基础） | 2h |

### 🟡 等 API key 到位后

| PR | 触发条件 |
|---|---|
| PR-24 Apple Sign In 配 Service ID | A-01 通过 |
| PR-26 Stripe HK Live + HKD/JPY 货币 | BR + Stripe Live |
| PR-27 SendGrid 邮件验证 | SENDGRID_API_KEY 配置 |
| PR-28 Google OAuth 真实接入 | GOOGLE_CLIENT_ID 配置 |

---

## 💸 五、双主体年度成本（最低预算）

| 项 | 金额 |
|---|---|
| 香港公司注册 | HK$5,500（约 ¥5,000） |
| 香港地址+秘书 | HK$3,000/年 |
| 香港年审/审计 | HK$5,000/年 |
| 香港报税 | HK$3,000/年 |
| 海外服务器（Railway）| ¥600/月 |
| 阿里云杭州 ECS 4核8G | ¥3,600/年 |
| 阿里云 CDN | ¥500/月 |
| ICP 备案 | ¥0（自助） |
| 软著加急 | ¥800 |
| **第一年合计** | **约 ¥35,000** |
| **第二年起** | **约 ¥25,000/年** |

---

## ⚠️ 六、税务与资金流（关键）

```
海外用户付款 (Stripe USD)
    ↓
SummitLink HK Ltd. (WISE/Airwallex)
    ↓ 关联交易，需服务/技术外包合同
内地公司账户（人民币，按购汇牌价）
    ↓ 6% 增值税开发票
工资 / 服务器 / 税务
```

**关键点**：
- 香港利得税 8.25%/16.5%，**离岸豁免**可申请 0% 税
- 内地从香港收款必须签外包合同，开 6% 增值税发票
- 个人股东分红：香港 0%，大陆 20%
- **强烈建议**雇佣跨境会计师（¥1,500–3,000/月）

---

## 📌 七、决策记录

| 决策 | 选项 | 理由 |
|---|---|---|
| 上架节奏 | **P1** 阶段化上架 | 5/15 抢占暑期攀登季 |
| 主体策略 | **C3** 暂只香港公司，内地公司 6 月再启用 | 减少现金流压力 |
| 海外服务器 | **S1** Railway | 已在用，零运维 |
| PR 节奏 | **R1** 立刻并发开 5+ 个 PR | 利用注册账号等待期 |

---

## 🚦 八、Go/No-Go 标志（5/14 收盘前必须全绿）

- [ ] CI main 分支 ✅ 全绿（PR-19 合并后）
- [ ] Mapbox token 已配置（或 PR-22 降级方案验证通过）
- [ ] Sentry DSN 已配置（或代码静默跳过验证通过）
- [ ] Apple Developer 账号已审核通过
- [ ] Google Play 账号已注册
- [ ] 域名 summitlink.app DNS 已生效
- [ ] 隐私政策 URL `https://summitlink.app/legal/privacy` 可访问
- [ ] Capacitor `npx cap add ios && npx cap sync` 本地跑通
- [ ] 5 张 App Store 截图就绪

---

> 📝 **维护规则**：本文档为唯一上架真相源（Single Source of Truth），任何状态变更后必须更新对应 ⬜/✅ 标记，并在 TASK_PLAN.md 联动同步。
