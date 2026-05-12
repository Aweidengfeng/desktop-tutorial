# 📊 SummitLink Sentry 告警调优

> 适用：v1.3.0+  
> 维护：@gaoshanyindi  
> 最后更新：2026-05-12

## 0. 设计原则
- **告警必须可执行** — 告警 = "现在就要人介入"。日常监控放看板，不发告警。
- **不喊狼来了** — 同一告警 1 小时内只发 1 次，避免 alert fatigue
- **PII 零容忍** — Sentry 上下文绝不出现手机/邮箱/明文密码

## 1. 告警规则（Project → Alerts）

| 告警名 | 触发条件 | 优先级 | 通道 | 备注 |
|---|---|---|---|---|
| ❌ Crash-free session < 99% | 5 分钟窗口 | P0 | Slack #oncall + 短信 | 用于灰度终止判断 |
| ❌ API 5xx 突增 | 每分钟 ≥ 20 起 issue 持续 5 分钟 | P0 | Slack #oncall | |
| ⚠️ 新 issue 首次出现 | 任意 unresolved issue 首次 | P1 | Slack #engineering | |
| ⚠️ 登录失败率 > 5% | tag:operation=auth.login 错误率 | P1 | Slack #engineering | |
| ⚠️ 支付错误 | tag:operation=payment.* | P1 | Slack #payments + 邮件 | |
| 💸 Sentry 配额 > 80% | event 配额警告 | P2 | 邮件 | 避免月底失明 |

## 2. 通知通道
### 2.1 Slack
- Channel：`#summitlink-oncall`（P0）、`#summitlink-engineering`（P1）、`#summitlink-payments`（支付）
- Sentry Slack Integration 安装方式：在 Sentry Project Settings → Integrations 安装 Slack 并绑定对应 Channel
- 应急按钮：每条 P0 告警自带 "Acknowledge" 按钮

### 2.2 邮件
- P0 / P1 同时抄送 `oncall@summitlink.app`
- P2 仅邮件

### 2.3 短信（可选）
- P0 走 Twilio / 阿里云短信（待运维补充）

## 3. 采样率与配额
| 环境 | tracesSampleRate | profilesSampleRate | 备注 |
|---|---|---|---|
| development | 0.0 | 0.0 | 不上报性能 |
| staging | 1.0 | 1.0 | 100% 收集 |
| production | 0.1 | 0.1 | 10% 采样降低成本 |

Sentry 配额：待补充（每月预估事件量 / 当前使用量）。

## 4. Release Tagging
- CI 在 main 合入时执行 `scripts/sentry-release.sh`
- 命令：`sentry-cli releases new "summitlink-backend@${VERSION}"` → `finalize`
- 关联 commits：`sentry-cli releases set-commits ...`
- 灰度发布时自动 `deploy` 标签（`environment=production`、`name=v1.3.0-staged-5pct`）

## 5. PII 过滤（beforeSend）
- 移除事件中的：邮箱、手机号、JWT token、Stripe secret key
- 实现位置：`backend/middleware/sentry.js`
- 测试方式：本地构造一个错误 + 故意带 `phone:13800138000`，确认 Sentry 上看不到

## 6. 用户上下文
- 只 `setUser({ id: 'sha256(user_id)前 12 位' })`
- 不上传 email / phone / name
- 实现位置：`backend/middleware/sentry.js` + `backend/middleware/auth.js`

## 7. 看板与查询
- 主看板：`<SENTRY_DASHBOARD_URL_PLACEHOLDER>`
- 常用查询：
  - 所有 P0：`is:unresolved level:fatal`
  - 支付错误：`is:unresolved tags[operation]:payment.*`
  - 登录失败：`is:unresolved tags[operation]:auth.login`

## 8. 演练
- 每月手动触发一次"假错误"验证告警链路：
  - 命令：`curl https://api.summitlink.app/api/_debug/raise`（生产关闭，仅 staging 可用）
- 验证：Slack 是否在 5 分钟内收到告警

## 9. 检查清单
- [ ] Sentry DSN 已配置
- [ ] release tag 自动同步
- [ ] tracesSampleRate 已分环境
- [ ] PII 过滤已启用
- [ ] Slack Integration 已安装
- [ ] 6 条核心告警规则已建立
