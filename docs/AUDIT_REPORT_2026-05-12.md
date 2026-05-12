# 🛡️ SummitLink 上架前代码审计报告

**审计日期**: 2026-05-12
**审计范围**: 默认分支最新提交（基于当前工作树快照）
**审计结论**: 🔴 （存在阻断发布的 P0 问题）

---

## 🔴 严重问题（阻断发布，必须修复）

### 1. Stripe 生产支付链路仍信任前端金额，Webhook 无重放/幂等防护
- **文件**: `backend/routes/payment.js:31-41`, `backend/routes/payment.js:63-87`
- **影响**: 切 Stripe 生产后，服务端直接信任客户端提交的 `amount/orderId/orderType`，且 webhook 只校验签名、不记录 `event.id`，存在金额篡改、重复回放、状态错乱、退款闭环不完整的发布阻断风险。
- **证据**:
  ```js
  const { amount, currency = 'usd', orderId, orderType } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata: { orderId: orderId || '', orderType: orderType || 'general', userId: String(req.user.id) }
  });
  ```
  ```js
  if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }
  if (event.type === 'payment_intent.succeeded') {
    await prisma.$executeRaw`UPDATE stripe_payments SET status = 'paid' ...`;
  }
  ```
- **建议修复**: 金额必须由服务端按订单重算；把 Stripe intent 与内部订单强绑定；持久化 `event.id` 做幂等/防重放；补齐 `succeeded/failed/refunded` 全状态与退款处理。

### 2. GDPR 注销 / 导出不满足"真正删除 / 可读导出"要求
- **文件**: `backend/routes/users.js:20-24`, `backend/routes/users.js:41-45`, `backend/routes/users.js:54-59`
- **影响**: 当前"注销"仅匿名化 `users` 表，帖子/评论/轨迹/订单等关联数据仍保留；数据导出直接返回加密后的 `phone/email` 字段，不是可读导出，存在合规阻断。
- **证据**:
  ```js
  const [user] = await prisma.$queryRaw`
    SELECT id, name, username, phone, email, ... FROM users WHERE id = ${userId}
  `;
  const exportData = { user, posts, tracks, orders, comments, exportedAt: new Date().toISOString() };
  res.json(exportData);
  ```
  ```js
  await prisma.$executeRaw`
    UPDATE users
    SET deleted_at = ${new Date()}, phone = NULL, email = NULL, password = NULL,
        name = '[已注销用户]', avatar = NULL
    WHERE id = ${req.user.id}
  `;
  ```
- **建议修复**: 明确"删除 vs 匿名化"策略并补齐全表级清理；导出前对 PII 解密；补充删除任务/事务与审计记录。

### 3. Prisma schema 与真实数据库结构明显漂移，且仓库无 migrations
- **文件**: `backend/prisma/schema.prisma:692-720`, `backend/db/database.js:1527-1581`, `backend/db/database.js:1672-1734`
- **影响**: Prisma 模型未覆盖 `order_no/status_history/refund_reason/refunded_at` 等真实列，运行时依赖手写 SQL 和 `ALTER TABLE` 补丁；切 PostgreSQL/多环境时极易出现 schema drift、客户端类型失真、迁移失败。
- **建议修复**: 以 Prisma schema 为单一事实源重建订单模型；补齐正式 migration；停止依赖启动时 `ALTER TABLE` 漂移修补。

### 4. 移动端原生工程 / 权限配置仍是模板态，发布流水线不可验证
- **文件**: `ios-permissions-template/Info.plist.additions.xml`, `android-permissions-template/AndroidManifest.permissions.xml`, `fastlane/Appfile`, `.github/workflows/build-ios.yml`, `.github/workflows/build-android.yml`
- **影响**: 仓库中看到的是 Info.plist / AndroidManifest 模板，而非实际原生工程文件；Fastlane 仍是 Apple ID / Team ID 占位；CI 却直接假设 `ios/App`、`android/` 可构建，属于上架前硬阻断。
- **建议修复**: 提交真实原生工程并完成权限文案/Manifest 最小化；填充 Fastlane / App Store Connect 配置；让 iOS/Android CI 在 PR 上可真实构建。

### 5. 投资者接口复用 `ADMIN_PASSWORD` 且允许 query token 认证
- **文件**: `backend/routes/investor.js:108-116`
- **影响**: 同一口令同时承担管理员登录和投资者 API 访问；`?token=` 还会把凭证暴露给日志、代理、历史记录、Referer，属于高风险鉴权设计。
- **证据**:
  ```js
  const token = req.headers['x-investor-token'] || req.query.token;
  const expectedToken = process.env.INVESTOR_TOKEN || process.env.ADMIN_PASSWORD;
  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: '需要投资者访问令牌' });
  }
  ```
- **建议修复**: 移除 query 参数鉴权；独立投资者密钥/账号体系；最好改成短期 JWT 或 Basic/OIDC，并单独审计访问。

---

## ⚠️ 警告（强烈建议在灰度前修复）

1. **后端安全头不完整，未见 Helmet/CSP/HSTS；前端仍大量内联/CDN 脚本** — `backend/app.js:46-68`, `index.html:7-18`, `index.html:74-112`
2. **JWT 为长生命周期单密钥，缺 refresh/revoke 机制** — `backend/routes/auth.js:218-220`, `backend/middleware/auth.js:8-15`, `backend/routes/admin.js:52-58`
3. **验证码/支付/Webhook 限流覆盖不完整，且多处使用进程内 Map，无法支撑多节点** — `backend/routes/auth.js:600-607`, `backend/routes/payment.js:29-30,59,128,201`
4. **OSS 上传默认公开 URL，且 OSS 模式下内容审核可能被绕过** — `backend/routes/upload.js:54-93`, `backend/middleware/ossUpload.js:49-57`
5. **日志与 Sentry 未配置敏感字段脱敏** — `backend/app.js:7-12,74-78,360-361`, `backend/middleware/sentry.js:18-25`, `index.html:92-97`
6. **Prisma `Unsafe` 原生 SQL 使用面过大，维护期易引入注入** — `backend/routes/admin.js:109-123,652-671`, `backend/routes/expeditions.js:162-178` 等
7. **CI/CD 把安全/部署异常降级为告警，且 smoke test 有过期路由** — `.github/workflows/test.yml:51-54`, `.github/workflows/deploy-railway.yml:110-113,128-142,178-182`, `scripts/smoke-test.js:146-149`
8. **前端 i18n 仍是局部兜底，未形成完整 EN fallback** — `index.html:123-168,171-173,2932-2933`

---

## ✅ 通过项（已实现良好实践）

1. **当前工作树未见真实 live secret，且 `.env` 已被忽略** — `.env.example:13,78-82`, `.gitignore:5`, `backend/.gitignore:2`
2. **PII 加密采用 AES-256-GCM + 确定性 IV，兼容旧明文数据** — `backend/utils/crypto.js:31-48,56-70`
3. **全局错误处理不会把堆栈直接回传前端** — `backend/app.js:358-364`
4. **Service Worker 未主动缓存 API 响应，敏感接口离线面较小** — `www/sw.js:24-33`
5. **PR 流程已配置测试工作流** — `.github/workflows/test.yml:4-7,75-83`

---

## 📊 维度评分表

| 维度 | 评分 | 备注 |
|---|---|---|
| 1. 安全与密钥 | ⚠️ | 当前树未见 live secret，但缺 CSP/HSTS、JWT/Investor 鉴权设计偏弱、限流覆盖不完整 |
| 2. PII 加密 | ⚠️ | 加密实现基本正确；但无密钥轮换，GDPR 导出/注销不合规 |
| 3. Stripe 支付 | 🔴 | 金额信任前端、Webhook 无幂等/重放保护、退款闭环不完整 |
| 4. Prisma & 数据库 | 🔴 | schema drift 明显，且无 migrations 目录 |
| 5. 移动端（Capacitor / iOS / Android） | 🔴 | 原生工程/权限文件仍是模板态，Fastlane / Appfile 未完成 |
| 6. 前端 & PWA | ⚠️ | SW 不缓存 API 是优点，但 inline script / i18n 完整性仍不足 |
| 7. 错误处理 & 日志 | ⚠️ | 前端/后端 Sentry 与日志未见 PII scrub / redact |
| 8. CI/CD & 部署 | ⚠️ | 测试在 PR 上运行，但 audit / smoke / deploy 有多处软失败与过期检查 |
| 9. 依赖与许可证 | ⚠️ | 双 lockfile 已锁定；但 audit 不阻断，且存在 dev / optional `LGPL-3.0-or-later`（sharp / libvips）需法务确认 |
| 10. 测试覆盖 | ⚠️ | JWT / 并发 / 弱网 / 商业订单覆盖不错；但未见 Stripe webhook、PII 轮换、GDPR 删除链路专项测试 |

---

## 🎯 建议的修复优先级路线

### P0（24h 内）
- 重做 Stripe 生产链路：服务端定价、订单绑定、Webhook 幂等 / 重放保护、退款闭环
- 修复 GDPR：可读数据导出 + 真正删除 / 匿名化策略落地
- 切齐 Prisma schema 与数据库，补正式 migrations
- 移除 `investor` 对 `ADMIN_PASSWORD` 的复用与 query token
- 补齐真实 iOS / Android 原生工程与上架配置

### P1（灰度前）
- 上 Helmet + CSP + HSTS，继续消除 inline script
- 把验证码 / 支付 / Webhook 限流迁到 Redis
- OSS 改私有桶 + 短期签名 URL，并修复 OSS 模式内容审核
- 为日志 / Sentry 增加 PII 脱敏
- 让 `npm audit` / smoke test 真正阻断部署

### P2（GA 前）
- 上 JWT refresh / revoke 与设备会话管理
- 减少 / 封装 `queryRawUnsafe`
- 补 Stripe / GDPR / PII key rotation 自动化测试
- 做国际化文案清点与 EN fallback 完整性检查
- 做依赖许可证清单与法务复核
