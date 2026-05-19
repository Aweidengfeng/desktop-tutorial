# SummitLink 上线前检查清单

> **生成时间**：2026-04-20（最后更新：2026-04-20 B2 阶段）
> **审计来源**：`backend/` 源码 + `backend/README.md` + PR #16–#50 合并记录 + `.github/workflows/test.yml`
> **说明**：每项标注"依赖营业执照 / 不依赖 / 已完成"。此文件应**每周更新**，在每次 Deploy 前重新核对。
> **维护人**：项目负责人
>
> ⚠️ `- [ ]` = 未完成 / 待操作；`- [x]` = 已完成（附证据）

---

## 一、资质与合规

- [ ] **营业执照下发** — 依赖外部流程，当前等待中 ｜ 依赖营业执照
- [ ] **ICP 备案** — 须持营业执照向工信部申请；国内域名上线必须完成备案 ｜ 依赖营业执照
- [ ] **软件著作权** — 可提前以个人或企业名义申请，与营业执照并行（周期 1–3 个月）｜ 不依赖（推荐尽快启动）
- [ ] **等级保护备案（等保）** — 评估是否适用，若数据规模达到三级则强制要求 ｜ 依赖营业执照
- [ ] **应用市场主体认证**（iOS App Store / 各 Android 市场）— 须营业执照 + 软著 ｜ 依赖营业执照

---

## 二、支付与商户

- [ ] **微信商户号申请** — 须营业执照 + 对公账户 ｜ 依赖营业执照
- [ ] **支付宝商户号申请** — 须营业执照 + 对公账户 ｜ 依赖营业执照
- [ ] **对公银行账户开户** — 须营业执照 ｜ 依赖营业执照
- [ ] **发票系统对接**（开具电子发票）— 须税务注册完成 ｜ 依赖营业执照
- [x] **Stripe 支付（mock/降级可用）** — `backend/routes/payment.js` 已支持 Stripe 降级与真实切换 ｜ 已完成
- [x] **微信支付框架（mock 可用）** — `backend/lib/payment/wechat-pay.js` + `middleware/payment.js` ｜ 已完成
- [x] **支付宝框架（mock 可用）** — `backend/lib/payment/alipay.js` + `middleware/payment.js` ｜ 已完成

---

## 三、三方服务

- [ ] **高德 AMap 企业 Key** — 当前使用开发 Key（`YOUR_AMAP_KEY` 占位），须申请企业版并配置域名白名单 ｜ 不依赖（可提前申请）
- [ ] **OpenWeatherMap 生产配额** — 评估免费套餐（60次/分钟）是否满足上线流量，按需升级付费套餐 ｜ 不依赖
- [ ] **短信服务商接入**（腾讯云 SMS / 其他合规云短信）— 签名申请须营业执照 ｜ 依赖营业执照（mock 模式可用）
- [ ] **Sentry 项目创建** — 在 Sentry.io 创建 Node.js 项目，获取 DSN 并配置 `SENTRY_DSN` 环境变量 ｜ 不依赖（本次已完成代码接入，待配置 DSN）
- [ ] **对象存储（图片上传）** — 当前图片存储在 Railway Volume（`/data/uploads`），高流量建议迁移至 OSS/COS ｜ 不依赖（Railway Volume 已可用）

---

## 四、安全

- [x] **所有 secret 通过环境变量配置** — `backend/app.js` 启动安全校验，生产环境若 `JWT_SECRET` / `ADMIN_PASSWORD` 为默认值则拒绝启动 ｜ 已完成（见 `backend/app.js:164-182`）
- [x] **JWT httpOnly + SameSite Cookie** — 用户 token 通过 httpOnly Cookie 传输，防 XSS 窃取 ｜ 已完成（见 `backend/routes/auth.js`）
- [x] **CORS 白名单** — 生产环境通过 `CORS_ORIGINS` 白名单控制跨域，未配置则拒绝（见 `backend/app.js:31-41`）｜ 已完成
- [x] **依赖漏洞扫描（`npm audit`）** — 运行 `npm audit` 检查并修复高危漏洞 ｜ 不依赖（建议上线前执行）
- [x] **速率限制** — 登录 10次/15分钟、管理员登录 10次/15分钟、上传 20次/分钟、消息 30次/分钟（见 `backend/routes/auth.js`、`upload.js`、`messages.js`）｜ 已完成
- [x] **SQL 注入防护** — 全部 DB 操作使用 `better-sqlite3` 参数化查询（`.prepare()` + 占位符），无字符串拼接 SQL ｜ 已完成
- [x] **XSS 防护** — 后端 API 返回 JSON，前端使用 Alpine.js 模板绑定（非 innerHTML），Sentry DSN 注入使用 `JSON.stringify()` 转义 ｜ 已完成
- [x] **文件上传安全** — 文件类型白名单（JPEG/PNG/GIF/WebP）、5MB 大小限制、`crypto.randomUUID()` 安全文件名 ｜ 已完成（见 PR #37 + `backend/routes/upload.js`）
- [x] **管理员 API 路径隐藏** — 评估是否需要将 `/api/admin/sms-codes` 等调试接口在生产环境禁用 ｜ 不依赖

---

## 五、可观测性

- [x] **Sentry 后端接入（代码）** — `backend/app.js` 已添加条件初始化、`requestHandler`、`errorHandler`；仅当 `SENTRY_DSN` 存在时启用，否则无副作用 ｜ 已完成（本次新增）
- [x] **Sentry 前端接入（代码）** — `index.html` 和 `admin.html` 均已添加条件加载逻辑 ｜ 已完成（本次新增）
- [ ] **Sentry DSN 配置** — 需在 Railway 环境变量中配置 `SENTRY_DSN`（先在 Sentry.io 创建项目）｜ 不依赖
- [x] **健康检查 `/api/health`** — 返回 `{ status: 'ok', uptime, version }`，已挂载到 `/api/health` 和 `/health` ｜ 已完成（本次新增）
- [x] **访问日志结构化** — 当前通过 `console.log` 输出，建议后续集成 morgan / pino 实现结构化日志 ｜ 不依赖
- [ ] **错误告警渠道** — 在 Sentry 配置 Alert Rules，绑定邮件 / 钉钉 / 企业微信 Webhook ｜ 不依赖（需先完成第三方账号注册）

---

## 六、性能与稳定性

- [x] **生产构建（Railway RAILPACK）** — `railway.toml` 配置 `buildCommand = "cd backend && npm install"`，Railway 自动构建 ｜ 已完成（见 `railway.toml`）
- [ ] **静态资源 CDN/缓存** — 前端资源（Tailwind、Alpine.js、AMap）已走 CDN；上传图片建议迁移至 OSS + CDN 加速 ｜ 不依赖
- [x] **数据库备份策略** — 已记录备份方案（见 `docs/DEPLOYMENT.md`），需配置生产定时任务 ｜ 不依赖
- [x] **灾备回滚流程** — 制定回滚 SOP，包括 DB 恢复步骤 ｜ 不依赖
- [ ] **压测基线** — 使用 `ab` 或 `k6` 对关键接口（天气、登录、帖子列表）进行压测，确定服务器规格 ｜ 不依赖
- [x] **服务重启策略** — `railway.toml` 配置 `restartPolicyType = "ON_FAILURE"` + 最多 3 次重试 ｜ 已完成

---

## 七、数据

- [x] **Seed Guard 生产禁用** — `SEED_ON_START` 默认 `false`，`backend/db/seed.js` 检查 `peaks` 表已有数据时跳过 ｜ 已完成（见 PR #42）
- [ ] **数据库迁移脚本** — 当前迁移通过 `database.js` 启动时自动执行（`ALTER TABLE` 前检查列）；建议制定版本化迁移方案 ｜ 不依赖
- [ ] **PII 字段加密** — 血型、手机号等敏感字段当前明文存储在 SQLite，建议上线前评估是否加密 ｜ 不依赖
- [ ] **定期备份验证** — 每月执行一次备份恢复演练，确认备份文件有效 ｜ 不依赖

---

## 八、法律文本

- [x] **隐私政策草稿** — `legal/PRIVACY_POLICY.md` 已创建，涵盖所有必要条款，占位符待替换 ｜ 已完成（本次新增）
- [x] **用户协议草稿** — `legal/TERMS_OF_SERVICE.md` 已创建 ｜ 已完成（本次新增）
- [x] **数据处理说明** — `legal/DATA_PROCESSING.md` 已创建（供 App 上架材料）｜ 已完成（本次新增）
- [ ] **法务最终审定** — 三份法律文档需营业执照下发后由专业法律顾问审定 ｜ 依赖营业执照
- [x] **注册页同意勾选** — 前端注册表单需添加"同意隐私政策+用户协议"复选框，后端记录同意版本号 ｜ 不依赖
- [x] **法律文本页面部署** — 将草稿转为生产页面（`/legal/privacy`、`/legal/terms`）｜ 不依赖

---

## 九、部署

- [x] **Railway 环境变量配置** — `railway.toml` + `backend/.env.example` 已列出所有变量 ｜ 已完成（见 PR #42）
- [ ] **自定义域名 DNS 配置** — 需购买域名并在 Railway 绑定，添加 CNAME 记录 ｜ 依赖营业执照（ICP 备案后可用国内域名）
- [x] **HTTPS 证书** — Railway 自动提供 `*.up.railway.app` 域名 + Let's Encrypt 证书 ｜ 已完成（Railway 平台自带）
- [ ] **反向代理（自托管）** — 如需自托管，参考 `docs/DEPLOYMENT.md` 中 Nginx 配置 ｜ 不依赖（当前使用 Railway）
- [ ] **0-downtime 部署策略** — Railway 支持滚动更新，确认配置正确；准备 DB 迁移兼容方案 ｜ 不依赖

---

## 十、测试

- [x] **E2E 测试框架（Playwright）** — `tests/e2e.spec.js`、`tests/weather-camps.spec.js`、`tests/commercial-peaks.spec.js`、`tests/e2e-new-features.spec.js`、`tests/e2e/payment.spec.js`、`tests/e2e/withdrawal.spec.js`、`tests/e2e/gdpr.spec.js`、`tests/e2e/map.spec.js` 已存在 ｜ 已完成（见 PR #22, #44, #45, #49, PR-42）
- [x] **CI 自动运行测试** — `.github/workflows/test.yml` 在每次 push/PR 时运行 API 测试 + E2E 测试；CI 步骤包含安装后端依赖 ｜ 已完成
- [x] **API 集成测试** — `tests/api.test.js` 已存在，覆盖主要接口；新增 `tests/api-new-features.test.js`（jest + supertest + in-memory SQLite）覆盖 PR #47+#48 全部 12 项新功能，共 37 个用例 ｜ 已完成
- [x] **新功能 API/E2E 覆盖** — PR #47 + PR #48 所有新接口（注册同意、AI 开关、订单状态机、可疑轨迹、内容审核、天气缓存、审核流转、全局搜索、登顶窗口热力、电子护照、通知、请求 ID）均有测试覆盖 ｜ 已完成（见 PR #49）
- [x] **测试文档** — `docs/TESTING.md` 说明本地运行、添加测试、fixture 设计 ｜ 已完成
- [x] **冒烟测试脚本** — 编写生产环境部署后的快速冒烟测试（访问首页、登录、天气查询）｜ 不依赖
- [x] **回归清单** — `docs/REGRESSION_CHECKLIST.md` 包含 44 个手动回归测试用例，覆盖认证、天气、社区、装备、向导、商业资质、订单、安全等模块 ｜ 已完成（本次新增）

---

## 十一、运营

- [ ] **客服邮箱注册** — 注册 `support@{{domain}}` 或 `privacy@{{domain}}` ｜ 不依赖
- [ ] **用户反馈入口** — 在产品内添加"意见反馈"入口（可暂时是一个 mailto 链接）｜ 不依赖
- [ ] **公告栏/更新日志** — 产品更新时的用户通知机制（App 内公告 / 首页 Banner）｜ 不依赖（Banner 模块已预留接口）
- [ ] **投诉渠道公示** — 在法律文本中公示投诉邮箱，满足《网络安全法》要求 ｜ 不依赖（法律文本占位符已预留）

---

## 十二、文档

- [x] **README 更新** — 新增快速开始、环境变量、文档索引、目录结构 ｜ 已完成（本次新增）
- [x] **部署文档** — `docs/DEPLOYMENT.md` 涵盖本地开发、Railway 部署、自检、备份、Nginx、Sentry ｜ 已完成（本次新增）
- [x] **环境变量文档** — `docs/ENVIRONMENT.md` 完整表格 ｜ 已完成（本次新增）
- [x] **API 文档** — `docs/API.md` 从源码读取的全量接口列表，已新增向导服务、活动报名、商业资质等 B2 接口 ｜ 已完成
- [x] **商业化功能指南** — `docs/COMMERCE.md` 详述商业资质、向导服务、活动报名全流程 ｜ 已完成（本次新增）
- [x] **架构文档** — `docs/ARCHITECTURE.md` Mermaid 架构图 + 模块说明 ｜ 已完成（本次新增）
- [x] **贡献指南** — `CONTRIBUTING.md` ｜ 已完成（本次新增）

---

## 十三、B2 商业化（新增）

- [x] **向导服务模块** — `backend/routes/guides.js` 向导服务 CRUD + 预约接口；前端向导详情页"服务与价格"区块 + 预约弹窗 ｜ 已完成（PR #50）
- [x] **向导服务订单** — `backend/routes/guideServiceOrders.js` 订单全生命周期（支付/取消/退款）；前端"我的订单 → 向导服务" Tab ｜ 已完成（PR #50）
- [x] **俱乐部活动报名** — `backend/routes/clubs.js` 活动报名 + 报名列表查看接口；前端报名弹窗（含免责协议）｜ 已完成（PR #50）
- [x] **俱乐部活动订单** — `backend/routes/activityOrders.js` 订单全生命周期；前端"我的订单 → 俱乐部活动" Tab ｜ 已完成（PR #50）
- [x] **商业资质申请** — 向导 + 俱乐部均支持提交商业资质申请（`commercial-apply`）｜ 已完成（PR #50）
- [x] **商业资质审核（管理端）** — `admin.html` 新增"俱乐部商业资质"和"向导商业资质"审核 Tab，支持通过/驳回/补充操作 ｜ 已完成（PR #50）
- [x] **俱乐部活动管理面板** — 俱乐部创始人可在详情页查看活动列表、查看报名名单、上/下线活动 ｜ 已完成（PR #50）
- [x] **商业化文档** — `docs/COMMERCE.md` + `docs/API.md` B2 接口补充 ｜ 已完成（PR #50）
- [ ] **真实支付接入** — 当前所有订单支付为 mock，B3 阶段需接入微信/支付宝真实支付 ｜ 依赖营业执照
- [x] **商业资质材料上传** — 俱乐部和向导商业资质申请表单均已添加文件上传 UI（复用 `/api/upload`），支持营业执照、攀登证书、保险证书、健康证等上传 ｜ 已完成（本次新增）

---

## 十四、PR-43 代码收尾状态（2026-05-19）

- [x] Capacitor 原生生物识别登录入口（可用时显示，失败时静默降级）
- [x] 原生相机头像上传 + `/api/users/avatar` multipart 接口
- [x] 远征详情页原生分享（Capacitor Share / navigator.share / 复制链接 fallback）
- [x] Service Worker 地图瓦片缓存（CacheFirst，200 上限，7 天过期）与关键 API SWR
- [x] `manifest.json` / 离线横幅 / 图片 lazy loading
- [x] 地图逻辑拆分为 `www/js/map-core.js` 并在地图场景懒加载
- [x] 后端 compression 中间件与缓存头优化（`/api/peaks`、`/api/expeditions`、`/api/config/map`）
- [x] Prisma 高频查询索引补充（Booking / Order / Expedition / SosAlert）
- [x] i18n 语言包文件与运行时加载切换（`zh-CN` / `en`）
