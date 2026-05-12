# 🚀 SummitLink v1.3.0 发布执行单（D-Day Runbook）

> **目标版本**: v1.3.0  
> **计划发布日**: TBD（确认窗口期后填入）  
> **发布负责人**: @gaoshanyindi  
> **本文档用法**: 发布当天打开此文件，**从上往下逐项勾选**，每完成一项填写时间戳。所有 🔴 步骤未完成 → 暂停发布。

---

## 📋 前置确认（D-2 ~ D-1，提前 24-48 小时）

- [ ] **🔴 终审清单全绿** — [`docs/RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md) 所有 10 条阻断项已勾选
- [ ] **🔴 CI 在 main 上是绿的** — 最近一次 [`test.yml`](../.github/workflows/test.yml) 运行 `conclusion=success`
- [ ] **🔴 VERSION 文件 = `1.3.0`** — `cat VERSION` 输出 `1.3.0`，且与 [`CHANGELOG.md`](../CHANGELOG.md) 顶部一致
- [ ] **🔴 应急联系人就位** — [`docs/GRADUAL_ROLLOUT.md §5.3`](./GRADUAL_ROLLOUT.md#53-联系人待补充) 主备值班人已确认到岗
- [ ] **🔴 回滚 SOP 全员已读** — Slack `#summitlink-oncall` 中所有成员回复「✅ 已读」
- [ ] Stripe Dashboard 切换到 Live mode，webhook 端点指向生产域名
- [ ] Sentry release 已通过 [`scripts/sentry-release.sh`](../scripts/sentry-release.sh) 同步
- [ ] TestFlight 内测组累计灰度 ≥ 48 小时，无崩溃报告
- [ ] Google Play Internal track 累计灰度 ≥ 48 小时，无崩溃报告

---

## 🎬 D-Day 发布流水（按时间顺序）

### T-0h ❄️ 冻结期开始
- [ ] **冻结 main 分支** — GitHub Settings → Branches → main → 临时勾选 "Restrict pushes"，仅保留发布负责人写权限
- [ ] **在飞书/Slack 应急群发布 "v1.3.0 发布开始" 通告** — 包含本文档链接、预计放量时间表
- [ ] **打 git tag** — `git tag -a v1.3.0 -m "Release v1.3.0" && git push origin v1.3.0`
- [ ] 记录此刻 Sentry Crash-free rate 基线：______ %

### T+0h 🟢 后端先行（Railway）
- [ ] **Railway 部署 v1.3.0** — 等 [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml) 跑完
- [ ] **冒烟测试** — `node scripts/smoke-test.js` 全部 ✅
- [ ] **健康检查** — `curl https://api.summitlink.app/api/health` 返回 `200`
- [ ] **PostgreSQL 连接正常** — 检查 Railway logs 无 DB 连接错误
- [ ] **Sentry release 创建成功** — Sentry 后台能看到 `summitlink-backend@1.3.0`

### T+1h 📱 iOS 提交审核
- [ ] **Fastlane 上传 App Store** — `bundle exec fastlane ios release_ios`
- [ ] **在 App Store Connect 勾选 ☑ Phased Release**
- [ ] 截图、文案、隐私政策 URL 二次确认
- [ ] 提交审核（Submit for Review）
- [ ] 预计审核时长：24-48h（记录提交时间：______）

### T+1h 🤖 Android 内测晋升到生产
- [ ] **Internal Testing → Production（1% staged rollout）**
      ```bash
      bundle exec fastlane android rollout_android percent:1
      ```
- [ ] **Google Play Console 确认** — 进入发布状态
- [ ] 等待 Google Play 自动审核（通常 2-4h，最长 7 天）

### 🍎 iOS 审核通过后
- [ ] **收到 Apple 审核通过邮件** — 时间：______
- [ ] **手动 Release（启动 Phased Release）** — App Store Connect → 版本 → Release This Version
- [ ] 自动放量节奏：`1% → 2% → 5% → 10% → 20% → 50% → 100%`（每档 1 天）
- [ ] 监控指标，超阈值立即 Pause（参考 [`docs/GRADUAL_ROLLOUT.md §1.2`](./GRADUAL_ROLLOUT.md#12-app-store-分阶段发布phased-release)）

---

## 📊 灰度期监控（D+0 ~ D+5）

每 30 分钟检查一次，**指标超阈值持续 10 分钟 → 立即启动回滚**：

| 时间 | iOS Phased % | Android Rollout % | Crash-free | API 5xx | 支付成功率 | 备注 |
|---|---|---|---|---|---|---|
| D-Day +1h | — | 1% | _____% | _____% | _____% | |
| D-Day +4h | — | 5% | _____% | _____% | _____% | `fastlane android rollout_android percent:5` |
| D-Day +8h | 1% | 5% | _____% | _____% | _____% | |
| D-Day +24h | 2% | 25% | _____% | _____% | _____% | `fastlane android rollout_android percent:25` |
| D-Day +48h | 5% | 50% | _____% | _____% | _____% | `fastlane android rollout_android percent:50` |
| D-Day +72h | 10% | 100% | _____% | _____% | _____% | `fastlane android rollout_android percent:100` |
| D-Day +5d | 100% | 100% | _____% | _____% | _____% | 🎉 全量 |

阈值参考（详见 [`docs/GRADUAL_ROLLOUT.md §4`](./GRADUAL_ROLLOUT.md#4-监控与决策指标)）：
- Crash-free rate ≥ 99.5%
- API 5xx 比例 < 1%
- 支付成功率 ≥ 90%
- 首屏白屏率 < 3%

**查询命令：**
```bash
bash scripts/rollout-status.sh   # 当前两端灰度状态
API_BASE_URL="https://<target-api-host>" node scripts/smoke-test.js   # 后端冒烟（将 <target-api-host> 替换为当前灰度目标环境）
```

---

## 🚨 回滚触发（任意一条即启动）

- [ ] Crash-free < 99.5% 持续 10 分钟
- [ ] API 5xx > 1% 持续 10 分钟
- [ ] ≥ 3 条同类 1 星评论集中投诉同一功能
- [ ] 客服反馈聚类（如「全员无法登录」）
- [ ] Stripe 退款异常或重复扣款

**回滚步骤（≤ 30 分钟完成核心 4 步）：**

1. ⏱️ ≤ 5 min — Slack 应急群通告 + Feature Flag 关闭可疑功能
2. ⏱️ ≤ 10 min — Android: `bundle exec fastlane android halt_android`
3. ⏱️ ≤ 15 min — iOS: App Store Connect → 版本 → **Pause Phased Release**
4. ⏱️ ≤ 30 min — Railway: Dashboard → 上一个成功 Deployment → **Rollback**
5. ⏱️ ≤ 1h — 撰写 Postmortem（模板见 [`docs/GRADUAL_ROLLOUT.md §5.4`](./GRADUAL_ROLLOUT.md#54-postmortem-记录模板)）

---

## ✅ 全量后收尾（D+5 ~ D+7）

- [ ] 解冻 main 分支（移除临时 push 限制）
- [ ] 在 GitHub 创建 Release：`v1.3.0` → 关联 CHANGELOG
- [ ] 在 [`docs/RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md) §提审记录 填"已发布"
- [ ] 关闭/合并 v1.3.0 相关 milestone
- [ ] 7 天值班观察期结束后，撰写发布回顾（What went well / What to improve）
- [ ] **启动 v1.4.0 规划** — 把延期项搬到下一个 milestone

---

## 📝 发布签字

| 角色 | 姓名 | 签字时间 | 备注 |
|---|---|---|---|
| 发布负责人 | @gaoshanyindi | TBD | |
| 后端 | 🔍 待填 | TBD | |
| iOS | 🔍 待填 | TBD | |
| Android | 🔍 待填 | TBD | |
| 运维 | 🔍 待填 | TBD | |
| 财务/Stripe | 🔍 待填 | TBD | |

---

## 🔗 参考

- [`docs/RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md) — 提审前终审
- [`docs/GRADUAL_ROLLOUT.md`](./GRADUAL_ROLLOUT.md) — 真机灰度方案
- [`docs/SENTRY_ALERTS.md`](./SENTRY_ALERTS.md) — 告警规则
- [`docs/RUNBOOK.md`](./RUNBOOK.md) — 生产应急手册
- [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md) / [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md) — 上架指南
- [`fastlane/Fastfile`](../fastlane/Fastfile) — 所有 CI/CD lane
