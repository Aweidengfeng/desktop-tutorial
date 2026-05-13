# 🚀 SummitLink 上架前终审 Checklist

> **当前目标版本**: v1.3.0  
> **使用方式**: 每次发布前，发布负责人 fork 本文档为 `RELEASE_v1.3.0_CHECK.md`（或在 Issue 中复用），逐项勾选。  
> **维护者**: @gaoshanyindi  
> **最后更新**: 2026-05-12

## ✅ 总览
- 本清单包含 🔴 阻断项 与 ⚠️ 强烈建议项，发布前请逐项核对并勾选。
- 阻断项任意一条未勾选 → **禁止提审**。
- 相关材料入口：[`CHANGELOG.md`](../CHANGELOG.md) / [`docs/releases/v1.3.0.md`](./releases/v1.3.0.md) / [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) / [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md) / [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)

## 🔴 阻断项一览（一眼看完）
- [ ] `VERSION` 文件内容为 `1.3.0` 且与 [`CHANGELOG.md`](../CHANGELOG.md) 顶部版本一致
- [ ] iOS `CFBundleShortVersionString` / `CFBundleVersion` 已递增（🔍 当前仓库仅模板：[`ios-permissions-template/Info.plist.additions.xml`](../ios-permissions-template/Info.plist.additions.xml)）
- [ ] Android `versionName` / `versionCode` 已递增（🔍 待补充 `android/app/build.gradle`）
- [ ] 生产环境 Stripe 密钥为 `sk_live_*`，并完成 webhook 签名校验
- [ ] `NODE_ENV=production` 且 Stripe Live Guard 通过（参考 [`scripts/validate-env.js`](../scripts/validate-env.js) / [`backend/routes/payment.js#L9-L17`](../backend/routes/payment.js#L9-L17)）
- [ ] GDPR 数据导出与账户注销接口可用（[`backend/routes/users.js#L17-L78`](../backend/routes/users.js#L17-L78), [`backend/routes/users.js#L80-L176`](../backend/routes/users.js#L80-L176)）
- [ ] PII（手机/邮箱）AES-256-GCM 加密生效（[`backend/utils/crypto.js`](../backend/utils/crypto.js)）
- [ ] 隐私政策 / 服务条款公开可访问（[`backend/routes/legal.js`](../backend/routes/legal.js), [`legal/PRIVACY_POLICY.md`](../legal/PRIVACY_POLICY.md), [`legal/TERMS_OF_SERVICE.md`](../legal/TERMS_OF_SERVICE.md)）
- [ ] `/api/health` 在生产返回 200（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`scripts/smoke-test.js`](../scripts/smoke-test.js)）
- [ ] Railway 部署与冒烟链路可执行（[`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml)）

---

## 详细分章节

### 1. 🎫 版本与构建
- [ ] `VERSION` 文件 = `1.3.0` 且与 `CHANGELOG.md` 顶部版本一致（[`VERSION`](../VERSION), [`CHANGELOG.md`](../CHANGELOG.md), [`docs/releases/v1.3.0.md`](./releases/v1.3.0.md)）
- [ ] iOS `Info.plist` 的 `CFBundleShortVersionString` / `CFBundleVersion` 已递增（🔍 待补充真实 iOS 工程文件；当前仅有 [`ios/ExportOptions.plist`](../ios/ExportOptions.plist) 与权限模板 [`ios-permissions-template/Info.plist.additions.xml`](../ios-permissions-template/Info.plist.additions.xml)）
- [ ] Android `versionName` / `versionCode` 已递增（🔍 待补充真实 `android/` 工程；参考 [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)）
- [ ] git tag `v1.3.0` 已打并推送（🔍 待补充 tag/release 链接）
- [ ] CI 在 main 上是绿的（最近 run：[`actions/runs/25710429332`](https://github.com/gaoshanyindi/desktop-tutorial/actions/runs/25710429332)；主流程见 [`.github/workflows/test.yml`](../.github/workflows/test.yml)）

### 2. 📱 iOS 提审
- [ ] App Icon 全尺寸齐全（参考 [PR #128](../../pull/128)，脚本 [`scripts/generate-icons.js`](../scripts/generate-icons.js)，规范 [`docs/icon-generation-guide.md`](./icon-generation-guide.md)）
- [ ] LaunchScreen 已配置（🔍 待补充 `ios/App/App/Base.lproj/LaunchScreen.storyboard`，当前仓库无该文件）
- [ ] Info.plist 权限文案已补齐：`NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`、`NSLocationWhenInUseUsageDescription`、`NSLocationAlwaysAndWhenInUseUsageDescription`（模板 [`ios-permissions-template/Info.plist.additions.xml`](../ios-permissions-template/Info.plist.additions.xml)）
- [ ] 截图 6.7" / 6.1" / 5.5" 各一套（参考 [PR #125](../../pull/125)，模板 [`screenshots/template-ios.html`](../screenshots/template-ios.html), [`screenshots/README.md`](../screenshots/README.md)）
- [ ] App Store Connect 文案（标题/副标题/描述/关键词/营销 URL）已填（[`APP_STORE_COPY.md`](../APP_STORE_COPY.md), [`fastlane/metadata/en-US/`](../fastlane/metadata/en-US), [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md)）
- [ ] 隐私政策 URL 可公开访问（[`APP_STORE_COPY.md`](../APP_STORE_COPY.md), [`backend/routes/legal.js`](../backend/routes/legal.js)）
- [ ] 支持 URL 可公开访问（[`fastlane/metadata/default/support_url.txt`](../fastlane/metadata/default/support_url.txt), [`APP_STORE_COPY.md`](../APP_STORE_COPY.md)）
- [ ] Apple 帐号年费有效（参考 [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md)）
- [ ] Fastlane match 证书已同步（参考 [PR #130](../../pull/130)，当前仓库存在 [`fastlane/Fastfile`](../fastlane/Fastfile)；🔍 待补充 match 仓库/配置）
- [ ] Universal Links：`apple-app-site-association` 已部署并可访问，Content-Type 为 `application/json`（[`public/.well-known/apple-app-site-association`](../public/.well-known/apple-app-site-association), [`docs/universal-links-setup.md`](./universal-links-setup.md)）

### 3. 🤖 Android 提审
- [ ] App Icon adaptive 全密度齐全（参考 [PR #128](../../pull/128), [`scripts/generate-icons.js`](../scripts/generate-icons.js), [`docs/icon-generation-guide.md`](./icon-generation-guide.md)）
- [ ] 启动屏配置完成（🔍 待补充 `android/app/src/main/res/drawable/launch_background.xml`）
- [ ] AndroidManifest 危险权限已最小化（模板 [`android-permissions-template/AndroidManifest.permissions.xml`](../android-permissions-template/AndroidManifest.permissions.xml)）
- [ ] AAB（Android App Bundle）签名构建可用（[`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md), [`fastlane/Fastfile`](../fastlane/Fastfile), [`.github/workflows/build-android.yml`](../.github/workflows/build-android.yml)）
- [ ] Google Play Console 商店列表（标题/简短描述/完整描述/类别）已填（[`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md), [`APP_STORE_COPY.md`](../APP_STORE_COPY.md)）
- [ ] Feature graphic 1024x500 已提供（参考 [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)；🔍 可补充素材到 `assets/`）
- [ ] 内容分级问卷已完成（[`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)）
- [ ] 隐私政策 URL 已配置（[`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md), [`backend/routes/legal.js`](../backend/routes/legal.js)）
- [ ] App Links：`assetlinks.json` 已部署并可访问（[`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json), [`docs/universal-links-setup.md`](./universal-links-setup.md)）

### 4. 💳 Stripe 生产切换
- [ ] `STRIPE_SECRET_KEY` 在 Railway 已配置为 `sk_live_*`（[`scripts/validate-env.js`](../scripts/validate-env.js), [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md), [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] 生产环境 `STRIPE_DISABLED` 未设置或为 false（参考 [`docs/incidents/2026-05-12-stripe-degraded-mode.md`](./incidents/2026-05-12-stripe-degraded-mode.md)）
- [ ] `STRIPE_WEBHOOK_SECRET` 已切换为生产 endpoint secret（[`docs/ENVIRONMENT.md`](./ENVIRONMENT.md), [`backend/routes/payment.js#L132-L137`](../backend/routes/payment.js#L132-L137)）
- [ ] Webhook endpoint 在 Stripe Dashboard 配置为生产域名（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md)）
- [ ] Webhook 签名校验代码已启用（[`backend/routes/payment.js#L127-L141`](../backend/routes/payment.js#L127-L141)）
- [ ] Live Mode 守卫（PR #129）确认 `NODE_ENV=production` 且 key 前缀检测通过（[PR #129](../../pull/129), [`backend/routes/payment.js#L9-L17`](../backend/routes/payment.js#L9-L17), [`scripts/validate-env.js`](../scripts/validate-env.js)）
- [ ] 退款 / 失败 / 重复扣款的客服流程已写入运营手册（[`docs/RUNBOOK.md`](./RUNBOOK.md)）
- [ ] 测试模式完成至少 3 笔成功支付 + 1 笔退款 E2E 验证（🔍 待补充测试记录）

### 5. 🔐 安全与合规
- [ ] `.env` 不在 git 历史中（命令：`git log --all -- .env`，当前仓库检查结果应为空）
- [ ] `JWT_SECRET` 在生产环境 ≥ 32 字符且为强随机（[`docs/ENVIRONMENT.md`](./ENVIRONMENT.md), [`backend/.env.example`](../backend/.env.example)）
- [ ] `ADMIN_PASSWORD` 已修改为强密码（[`docs/ENVIRONMENT.md`](./ENVIRONMENT.md), [`backend/.env.example`](../backend/.env.example)）
- [ ] CORS 白名单仅包含正式域名（[`backend/app.js#L75-L94`](../backend/app.js#L75-L94), [`backend/.env.example`](../backend/.env.example)）
- [ ] Helmet / CSP 在生产开启（[`backend/app.js#L111-L166`](../backend/app.js#L111-L166)）
- [ ] PII 字段（手机/邮箱）AES-256-GCM 加密生效（参考 [PR #118](../../pull/118), [PR #132](../../pull/132), [`backend/utils/crypto.js`](../backend/utils/crypto.js)）
- [ ] GDPR 横幅在 EU IP 下显示（参考 [PR #117](../../pull/117), [`backend/routes/gdpr.js`](../backend/routes/gdpr.js)）
- [ ] 隐私政策 / 服务条款 HTML 页面可访问（参考 [PR #119](../../pull/119), [`backend/routes/legal.js`](../backend/routes/legal.js), [`legal/PRIVACY_POLICY.md`](../legal/PRIVACY_POLICY.md), [`legal/TERMS_OF_SERVICE.md`](../legal/TERMS_OF_SERVICE.md)）
- [ ] 数据导出 / 账户注销端点存在并可用（参考 [PR #106](../../pull/106), [`backend/routes/users.js#L17-L78`](../backend/routes/users.js#L17-L78), [`backend/routes/users.js#L80-L176`](../backend/routes/users.js#L80-L176)）
- [ ] 日志中无 PII 泄露（参考 [PR #123](../../pull/123), [PR #131](../../pull/131), [`backend/app.js#L7-L42`](../backend/app.js#L7-L42), [`backend/middleware/sentry.js`](../backend/middleware/sentry.js)）

### 6. ☁️ 基础设施
- [ ] Railway 生产环境 env 变量全部配置（参考 [`scripts/validate-env.js`](../scripts/validate-env.js), [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] PostgreSQL 备份策略已启用（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] Redis（如有）可达（🔍 当前仓库未发现 Redis 配置，若启用请补充连通性检查）
- [ ] 腾讯云 COS Bucket 配置 + CDN 域名可访问（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`docs/CN_DEPLOYMENT.md`](./CN_DEPLOYMENT.md)）
- [ ] 健康检查端点 `/api/health` 在生产返回 200（[`scripts/smoke-test.js`](../scripts/smoke-test.js), [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] 至少配置一个故障转移节点或回滚预案（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`docs/RUNBOOK.md`](./RUNBOOK.md)）
- [ ] Railway 部署冒烟链路可执行（[`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml), [`scripts/smoke-test.js`](../scripts/smoke-test.js)）

### 7. 📊 监控与告警
- [ ] Sentry 告警策略文档已审阅并执行（[`docs/SENTRY_ALERTS.md`](./SENTRY_ALERTS.md)）
- [ ] Sentry DSN 已在生产配置（[`docs/ENVIRONMENT.md`](./ENVIRONMENT.md), [`backend/middleware/sentry.js#L12-L13`](../backend/middleware/sentry.js#L12-L13)）
- [ ] Sentry release 与版本号关联（[`backend/middleware/sentry.js#L81-L82`](../backend/middleware/sentry.js#L81-L82), [`VERSION`](../VERSION)）
- [ ] Sentry 环境标签 = `production`（[`backend/middleware/sentry.js#L80-L81`](../backend/middleware/sentry.js#L80-L81), [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] 错误告警发送到 Slack / 邮件通路存在（P2-B 细化；当前文档为邮件告警建议：[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)）
- [ ] 健康检查告警已配置（[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`.github/workflows/health-check.yml`](../.github/workflows/health-check.yml)）
- [ ] 关键指标看板（DAU / 错误率 / 支付成功率）可访问（🔍 待补充看板链接）

### 8. 🧪 测试与质量
- [ ] CI 全绿（单测/集成/E2E/压测）（[`.github/workflows/test.yml`](../.github/workflows/test.yml), [`.github/workflows/load-test.yml`](../.github/workflows/load-test.yml), [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml)）
- [ ] 手动 smoke test 已通过（PR #126 脚本：[`scripts/smoke-test.js`](../scripts/smoke-test.js), [`.github/workflows/deploy-railway.yml`](../.github/workflows/deploy-railway.yml), [PR #126](../../pull/126)）
- [ ] 在 TestFlight / Play 内测轨道完成至少 48 小时灰度，无崩溃（详见 [`docs/GRADUAL_ROLLOUT.md §1`](./GRADUAL_ROLLOUT.md#1-ios-灰度发布app-store)、[`§2`](./GRADUAL_ROLLOUT.md#2-android-灰度发布google-play)；命令：`bundle exec fastlane ios beta_ios` / `bundle exec fastlane android beta_android`）
- [ ] 灰度状态可查询（命令：`bash scripts/rollout-status.sh`；详见 [`docs/GRADUAL_ROLLOUT.md §6`](./GRADUAL_ROLLOUT.md#6-命令速查)）
- [ ] 第 4 节监控指标（Crash-free ≥ 99.5%、5xx < 1%、支付成功率 ≥ 90%）在灰度期间无超阈值（[`docs/GRADUAL_ROLLOUT.md §4`](./GRADUAL_ROLLOUT.md#4-监控与决策指标)）

### 9. 📞 应急
- [ ] 回滚 SOP 已阅读（[`docs/GRADUAL_ROLLOUT.md §5`](./GRADUAL_ROLLOUT.md#5-回滚-sop一页)；含 iOS Phased Release 暂停 + Android halt + Railway revert 完整步骤）
- [ ] Android staged rollout halt 命令已验证（`bundle exec fastlane android halt_android`；参考 [`docs/GRADUAL_ROLLOUT.md §2.4`](./GRADUAL_ROLLOUT.md#24-android-回滚)）
- [ ] App Store Phased Release 暂停方式已知晓（App Store Connect → 版本 → Pause；参考 [`docs/GRADUAL_ROLLOUT.md §1.3`](./GRADUAL_ROLLOUT.md#13-ios-回滚)）
- [ ] 主要负责人电话 + 备用联系人已更新（[`docs/GRADUAL_ROLLOUT.md §5.3`](./GRADUAL_ROLLOUT.md#53-联系人待补充)；🔍 待补充值班通讯录）
- [ ] Stripe / Apple / Google 官方 support 链接已整理（[`docs/RUNBOOK.md`](./RUNBOOK.md), [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md), [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)）

### 10. 📄 法律与运营
- [ ] 隐私政策最后修订日期 ≤ 30 天（[`backend/routes/legal.js`](../backend/routes/legal.js)）
- [ ] 服务条款最后修订日期 ≤ 30 天（[`backend/routes/legal.js`](../backend/routes/legal.js)）
- [ ] App Store / Google Play 描述无虚假宣传词（[`APP_STORE_COPY.md`](../APP_STORE_COPY.md), [`docs/appstore-submit-guide.md`](./appstore-submit-guide.md), [`docs/googleplay-submit-guide.md`](./googleplay-submit-guide.md)）
- [ ] 涉及医疗 / 金融 / 紧急救援免责声明已注明（[`backend/routes/legal.js`](../backend/routes/legal.js), [`legal/DATA_PROCESSING.md`](../legal/DATA_PROCESSING.md)）

---

## 📝 提审记录
| 版本 | 日期 | 提审人 | 商店 | 结果 |
|---|---|---|---|---|
| 1.3.0 | TBD | @gaoshanyindi | App Store | 待提审 |
| 1.3.0 | TBD | @gaoshanyindi | Google Play | 待提审 |
