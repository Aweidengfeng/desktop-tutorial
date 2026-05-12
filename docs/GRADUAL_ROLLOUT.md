# 🚀 SummitLink 真机灰度发布方案 v1.3.0

> 适用范围：iOS App Store + Google Play  
> 维护者：@gaoshanyindi  
> 最后更新：2026-05-12

---

## 0. 总览

- **灰度目标**：在生产环境用真实用户验证至少 48 小时（内测 + 各灰度阶段累计），再放量到 100%。
- **发布阶段**：

  | 阶段 | 用户规模 | 停留时长 | 触发回滚条件 |
  |---|---|---|---|
  | 内测（TestFlight / Internal） | 5–20 人 | 48 h | 任一阈值超标 |
  | 灰度 1% | ~1% 生产用户 | 4 h | 同上 |
  | 灰度 5% | ~5% | 4 h | 同上 |
  | 灰度 25% | ~25% | 12 h | 同上 |
  | 灰度 50% | ~50% | 24 h | 同上 |
  | 全量 100% | 所有用户 | — | — |

- 任意阶段触发回滚条件 → 立即执行 [第 5 节回滚 SOP](#5-回滚-sop一页)。

---

## 1. iOS 灰度发布（App Store）

### 1.1 TestFlight 内测

- **内部测试组** ≤ 100 人，无需 Apple 审核，上传后几分钟生效。
- **外部测试组** ≤ 10,000 人，需 Apple Beta App Review（通常 24 h 内通过）。
- 构建命令：

  ```bash
  bundle exec fastlane ios beta_ios
  ```

  > 该 lane 会自动递增 build number、编译 IPA、上传到 TestFlight（[`fastlane/Fastfile`](../fastlane/Fastfile)）。

- 后续步骤：
  1. App Store Connect → TestFlight → 选择构建版本 → 添加内部测试人员
  2. 等待处理完成（通常 15–30 分钟）
  3. 测试人员通过 TestFlight App 安装并测试
  4. 收集反馈，确认 [第 4 节指标](#4-监控与决策指标) 无异常后，进入 1.2 阶段

### 1.2 App Store 分阶段发布（Phased Release）

- App Store 提供 **7 天自动分阶段**，按如下比例递进：
  `1% → 2% → 5% → 10% → 20% → 50% → 100%`（每档 1 天）
- **启用方式**：App Store Connect → 选择版本 → Version Release → 勾选 **☑ Phased Release**
- **暂停**：可在任意阶段点击"Pause"，最多可停留 30 天，到期后必须手动恢复或完整发布
- **强制全量**：发现问题修复后，可手动点击"Release Update"立即推全量，跳过剩余阶段
- 关键监控指标（参考 [第 4 节](#4-监控与决策指标)）：
  - Crash-free rate ≥ 99.5%
  - API 5xx 比例 < 1%
  - 首屏白屏率 < 3%

### 1.3 iOS 回滚

> ⚠️ **重要**：App Store **不支持将已发布版本回退**，审核员看到的"回滚"实际是下架再重审。

- **首选方案**：通过 Server-side feature flag（环境变量 `FEATURE_X=off` 或基于 `user_id` hash）关闭问题功能，不等 Apple 重新审核即可生效。
- **次选方案**：申请 Expedited Review，提交包含修复的新版本，说明紧急情况（Apple 通常 24 h 内响应）。
- **暂停分阶段发布**：在 App Store Connect 点击"Pause"可阻止新用户收到该版本更新，已安装用户保持现状。
- **Sentry 告警联动**：如 Crash-free rate 跌破阈值，立即在飞书/Slack 应急群通报，同步暂停 Phased Release。

---

## 2. Android 灰度发布（Google Play）

### 2.1 Internal testing（内测轨道）

- ≤ 100 人，几分钟内生效，无需 Google 审核。
- 命令：

  ```bash
  bundle exec fastlane android beta_android
  ```

  > lane 会自动编译签名 AAB 并上传到 Internal Testing track（[`fastlane/Fastfile`](../fastlane/Fastfile)）。

- 操作步骤：
  1. Google Play Console → 内测 → 管理测试人员 → 添加邮件地址
  2. 测试人员通过应用详情页链接安装
  3. 测试 48 h，确认无问题后晋升到 Closed testing 或 Production

### 2.2 Closed testing（封闭测试轨道）

- 通过 email list 或 Google Group 邀请，适合 200–1,000 人灰度。
- Google Play Console → 封闭测试 → 创建版本 → 上传同一 AAB → 管理测试人员
- 同样无需公开审核，但存在"审核窗口"（通常数小时）。

### 2.3 Production with Staged Rollout（生产灰度）

分阶段推送到正式用户，**必须先通过 Internal / Closed testing 后再晋升**。

- 发起 1% 灰度：

  ```bash
  bundle exec fastlane android rollout_android percent:1
  ```

- 调整灰度比例（例如升至 5%）：

  ```bash
  bundle exec fastlane android rollout_android percent:5
  ```

- 暂停灰度（halt）—— 将 rollout 比例设为 0，新版本不再向新用户分发：

  ```bash
  bundle exec fastlane android halt_android
  ```

  > **注意**：Google Play 没有独立的"halt"API，实现方式是把 `rollout` 设为 `0.0`，已安装新版本的用户维持现状，不会自动降级。

### 2.4 Android 回滚

- **Staged rollout 期间**：执行 `halt_android` → 新版本停止分发。
- **完全回滚**：必须上传一个 **versionCode 更大**、但代码回退到旧逻辑的修复版本（Google Play 不允许上传更小的 versionCode）。
- 步骤：
  1. 执行 `halt_android` 暂停当前灰度
  2. 在代码中 revert 问题 commit（或通过 feature flag 关闭功能）
  3. 递增 `versionCode`，重新编译并上传
  4. 在 Internal testing 验证后晋升到 Production

---

## 3. 后端 / 配置灰度

### 3.1 Railway 灰度策略

- **当前部署架构**：Railway 单实例部署（见 [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml)），不支持原生金丝雀/蓝绿。
- **替代方案**：在应用层实现 Feature Flag：
  - 环境变量开关：`FEATURE_NEW_CHAT=on` / `off`（Railway Dashboard 实时生效，无需重启）
  - 用户 hash 分流：`if (userId % 100 < rolloutPercent) { /* 新功能 */ }`
- 后端回滚：Railway Dashboard → 选择上一个成功的 Deployment → "Rollback"（或在 CI 触发 revert commit）。

### 3.2 数据库迁移灰度

- 所有 schema 变更必须遵循**向后兼容**原则：**先使新旧代码都兼容，再切新代码，最后清理旧字段**。
- Prisma migration 路径：`backend/prisma/migrations/`
- 列删除分两个版本：
  - v1：在代码层停止写入该字段，并避免新代码继续依赖读取；数据库列暂时保留，必要时仅在注释/文档中标记 deprecated
  - v2：确认所有实例都已运行不再依赖该字段的版本后，再通过 migration 真正删除列

---

## 4. 监控与决策指标

在灰度期间，每 **30 分钟**检查下表指标，超阈值持续 10 分钟即触发回滚 SOP。

| 指标 | 触发回滚阈值 | 数据源 |
|---|---|---|
| Crash-free rate | < 99.5% | Sentry（[`backend/middleware/sentry.js`](../backend/middleware/sentry.js)）|
| API 5xx 比例 | > 1% | Sentry / Railway Logs |
| 登录成功率 | < 95% | 自定义埋点（待补充）|
| 支付成功率 | < 90% | Stripe Dashboard |
| 首屏白屏率 | > 3% | Sentry Performance |

快速查询当前灰度状态：

```bash
bash scripts/rollout-status.sh
```

---

## 5. 回滚 SOP（一页）

### 5.1 触发条件（满足任一即启动）

- 上述任一指标超阈值，持续 **10 分钟**以上
- 应用商店收到 ≥ 3 条同类 1 星评论（集中在同一功能点）
- 客服反馈聚类（例如"全部无法登录"）
- 媒体 / 社交平台负面声量爆发

### 5.2 回滚步骤（按顺序执行）

| 步骤 | 预计耗时 | 操作 |
|---|---|---|
| **第 0 步** | 即刻 | 在飞书 / 钉钉 / Slack 应急群发布"启动回滚"通告，@相关人 |
| **第 1 步** | ≤ 5 min | 通过 Feature Flag 关闭可疑功能（Railway Dashboard 修改环境变量）|
| **第 2 步** | ≤ 10 min | Google Play：执行 `bundle exec fastlane android halt_android` |
| **第 3 步** | ≤ 15 min | App Store：在 App Store Connect 点击"Pause"暂停 Phased Release |
| **第 4 步** | ≤ 30 min | 后端：在 Railway Dashboard 将部署回滚到上一稳定版本 |
| **第 5 步** | ≤ 1 h | 撰写 Incident Postmortem，填入 [第 5.4 节](#54-postmortem-记录模板) |

> 执行过程中，所有进展**实时更新到应急群**，切勿沉默。

### 5.3 联系人（待补充）

| 角色 | 姓名 | 联系方式 | 备用联系人 |
|---|---|---|---|
| 主负责人 | @gaoshanyindi | 🔍 待填 | 🔍 待填 |
| iOS 上架 | 🔍 待填 | 🔍 待填 | 🔍 待填 |
| Android 上架 | 🔍 待填 | 🔍 待填 | 🔍 待填 |
| Stripe 财务 | 🔍 待填 | 🔍 待填 | 🔍 待填 |
| Railway 运维 | 🔍 待填 | 🔍 待填 | 🔍 待填 |

### 5.4 Postmortem 记录模板

```markdown
## Incident Postmortem — v1.3.0 灰度回滚

- **发生时间**：
- **发现时间**：
- **解决时间**：
- **影响范围**：X% 用户，约 N 分钟
- **根本原因**：
- **回滚措施**：
- **后续改进**：
  - [ ]
  - [ ]
```

---

## 6. 命令速查

### iOS

```bash
# 构建并上传到 TestFlight（内测）
bundle exec fastlane ios beta_ios

# 查看 TestFlight 测试组状态（需 App Store Connect API）
bash scripts/rollout-status.sh
```

### Android

```bash
# 构建并上传到 Internal Testing track（内测）
bundle exec fastlane android beta_android

# 晋升到 Production，发起 1% 灰度
bundle exec fastlane android rollout_android percent:1

# 调整灰度比例到 5%
bundle exec fastlane android rollout_android percent:5

# 调整灰度比例到 25%
bundle exec fastlane android rollout_android percent:25

# 调整灰度比例到 50%
bundle exec fastlane android rollout_android percent:50

# 全量（100%）
bundle exec fastlane android rollout_android percent:100

# 暂停灰度（halt）
bundle exec fastlane android halt_android

# 查看当前灰度状态
bash scripts/rollout-status.sh
```

### 后端（Railway）

```bash
# 部署（CI 自动触发，手动可用）
git push origin main  # 触发 .github/workflows/deploy-railway.yml

# 查看当前健康状态
node scripts/smoke-test.js
```

---

## 7. 检查清单

发布前逐项确认：

- [ ] TestFlight 内测组已配置（≥ 5 名内部测试人员）
- [ ] TestFlight 内测通过 ≥ 48 h，无崩溃
- [ ] App Store Connect 版本已勾选 **☑ Phased Release**
- [ ] Google Play Internal track 已上传并测试通过
- [ ] Staged rollout 起始百分比 = **1%**
- [ ] Sentry Crash-free rate 基线已确认（≥ 99.5%）
- [ ] Sentry 告警通道已配置（参考 P2-B）
- [ ] Stripe Dashboard 生产模式 Webhook 端点已配置
- [ ] Railway 部署版本与 `VERSION` 文件（`1.3.0`）一致
- [ ] 应急联系人已填入 [第 5.3 节](#53-联系人待补充)
- [ ] `scripts/rollout-status.sh` 可正常运行（或友好降级）
- [ ] 全员已阅读本文档并在群里回复"✅ 已读"

---

## 参考文档

- [`docs/RELEASE_READINESS_CHECKLIST.md`](./RELEASE_READINESS_CHECKLIST.md) — 上架前终审 Checklist
- [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md) — iOS 上架指南
- [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md) — Android 上架指南
- [`docs/fastlane-setup.md`](./fastlane-setup.md) — Fastlane 环境配置
- [`docs/RUNBOOK.md`](./RUNBOOK.md) — 生产应急手册
- [`fastlane/Fastfile`](../fastlane/Fastfile) — 所有 CI/CD lane 定义
- [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml) — 后端部署流程
