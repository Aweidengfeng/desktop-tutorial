# 🚀 SummitLink 2026 Q2 上架路线图（双主体 + 4 阶段）

> **生成时间**：2026-05-12  **最后更新**：2026-05-14
> **决策摘要**：阶段化上架（P1）+ **美国公司 US LLC + 境内公司双主体**（C3 已更新）+ Railway 海外节点（S1）+ 并发开 PR（R1）
> **关键现状**：境内公司 ✅ 未开户、**美国公司 US LLC 执照已取得 ✅**、腾讯云上海服务器已购买 ✅（49.234.163.103）、域名已购买 ✅、Stripe 暂为测试模式

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
│ 🇨🇳 上海 CN 节点  │   │ 🌍 海外节点             │
│ （腾讯云上海）    │   │ （Railway 生产）        │
├──────────────────┤   ├────────────────────────┤
│ 国内接口业务      │   │ 海外接口业务            │
│ 微信/支付宝跨境  │   │ Stripe USD / EUR        │
│ 支撑 ICP 备案     │   │ 全球低延迟              │
│ IP: 49.234.163.103│   │ Railway.app             │
└────────┬─────────┘   └──────────┬─────────────┘
         │                        │
         ▼                        ▼
   人民币结算                  美金 / USD 结算
         │                        │
         └────────────┬───────────┘
                      ▼
         ┌─────────────────────────────┐
         │   🇺🇸 美国公司 US LLC        │
         │  Mercury Business Banking   │
         └─────────────────────────────┘
              │ 内部转账 + 外包合同
              ▼
         ┌─────────────────────────┐
         │   🇨🇳 中国境内公司        │
         │  人民币账户 / 开发票      │
         └─────────────────────────┘

主体配套：
┌───────────────────┐   ┌───────────────────────┐
│  🇨🇳 境内公司主体  │   │   🇺🇸 美国公司主体      │
│  ICP 备案 / 合规  │   │   海外上架 / Stripe USD │
└───────────────────┘   └───────────────────────┘
```

---

## ⏰ 二、4 阶段时间表

| 阶段 | 时间 | 主体 | 部署 | 功能 | 审核 |
|---|---|---|---|---|---|
| **阶段 1** | **5/15** | 个人开发者 + Apple Developer | Railway 海外 | 免费社区+地图+队伍（隐藏付费） | iOS 48h |
| **阶段 2** | **6/01** | **🇺🇸 US LLC**（执照已取得 ✅）| Railway 海外 | + Stripe US Live（USD/EUR/JPY/GBP）美国主体审核 3-7 天，比 HK 快 | v1.1 更新 24h |
| **阶段 3** | **6/15** | US LLC + **🇨🇳 境内公司** | + 腾讯云上海 | + ICP 备案启动 + 微信/支付宝境内通道（比跨境更便宜更稳定）| 境内合规 |
| **阶段 4** | **7/01+** | 双主体完整落地 | 完整双区（Railway + 腾讯云）| + DNS 智能分流上线 + Android 国内市场 + 微信/支付宝跨境 | Android 国内市场 |

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
| 7 | Mercury / Brex Business Banking | 美国商业银行账户 | https://mercury.com / https://brex.com | US LLC EIN + 护照 | ⬜ |
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
| 美国 LLC 注册 | $500–800（Stripe Atlas / 代注册） |
| 美国注册地址 + Registered Agent | $100–200/年 |
| 美国税务申报（Form 1120/5472） | $500–1,000/年（会计师）|
| 海外服务器（Railway）| ¥600/月 |
| 腾讯云上海 ECS 2核4GB | ¥1,200/年（当前已购）|
| 腾讯云 CDN | ¥300/月 |
| ICP 备案 | ¥0（自助）|
| 软著加急 | ¥800 |
| **第一年合计** | **约 ¥30,000**（比香港主体便宜约 ¥5,000）|
| **第二年起** | **约 ¥20,000/年** |

---

## 💰 五-B、双主体资金流

```
海外用户付款 (Stripe USD)
    ↓
SummitLink US LLC (Mercury Business Banking)
    ↓ 内部转账 + 技术服务合同（美国→中国）
境内公司账户（人民币，按购汇牌价换汇）
    ↓ 6% 增值税开发票
工资 / 服务器 / 税务
```

**关键点**：
- 美国 LLC 联邦所得税 21%（C-Corp），但 Single-Member LLC 可做 Pass-through 税（0% 公司税）
- 内地从美国收款必须签技术服务合同，开 6% 增值税发票
- **vs. 香港主体优势**：Stripe US 审核 3-7 天（香港需 2-4 周 + KYC 材料复杂）；Mercury 开户更快
- **vs. 香港主体劣势**：美国税务申报稍复杂（建议找华人会计师 $500–1000/年）

---

## 📌 七、决策记录

| 决策 | 选项 | 理由 |
|---|---|---|
| 上架节奏 | **P1** 阶段化上架 | 5/15 抢占暑期攀登季 |
| 主体策略 | **🇺🇸 US LLC + 🇨🇳 境内公司双主体**（已更新：原香港主体改为美国主体）| US LLC Stripe 审核 3-7 天更快；Mercury 开户简便；免港币 KYC 繁琐材料 |
| 海外服务器 | **S1** Railway | 已在用，零运维 |
| CN 服务器 | **腾讯云上海** 49.234.163.103（2核4GB，已购买 ✅）| 上海节点延迟低，价格合理 |
| PR 节奏 | **R1** 立刻并发开 PR | 利用注册账号等待期 |

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
