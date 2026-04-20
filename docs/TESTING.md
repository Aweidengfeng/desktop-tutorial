# SummitLink 测试指南

## 目录

- [快速开始](#快速开始)
- [测试类型说明](#测试类型说明)
- [本地运行](#本地运行)
- [CI 集成](#ci-集成)
- [添加新测试](#添加新测试)
- [Fixture 设计说明](#fixture-设计说明)
- [常见问题](#常见问题)

---

## 快速开始

```bash
# 安装依赖（根目录 + 后端）
npm install
cd backend && npm install && cd ..

# 运行所有测试（API + E2E）
npm test

# 只运行 API 单元测试（快，~2 秒）
npm run test:api:unit

# 只运行旧 API 集成测试（需网络，打生产服务器）
node tests/api.test.js

# 只运行 E2E 测试（Playwright，需网络）
npm run test:e2e
```

---

## 测试类型说明

### 1. API 单元测试 (`tests/api-new-features.test.js`)

- **框架**：Jest + supertest
- **数据库**：in-memory SQLite（每个 `describe` 块独立）
- **不需要**：网络连接、环境变量、外部服务
- **运行方式**：`npx jest tests/api-new-features.test.js --forceExit`

覆盖以下 PR #47 + PR #48 新功能：

| 序号 | 功能 | 路径 |
|------|------|------|
| 1 | 注册隐私/协议同意 | `POST /api/auth/register` |
| 2 | AI 助手开关 | `/api/assistant` |
| 3 | 订单状态机 | `/api/admin/expedition-orders/:id/transition` |
| 4 | 可疑轨迹 | `POST /api/tracks`, `GET /api/admin/tracks?flagged=1` |
| 5 | 内容审核 | `POST /api/posts`, `GET /api/admin/moderation-logs` |
| 6 | 天气缓存 | `GET /api/weather` |
| 7 | 审核流转 | `/api/admin/guide-applications/:id/review` |
| 8 | 全局搜索 | `GET /api/search` |
| 9 | 登顶窗口热力 | `GET /api/weather/summit-window/:peakId` |
| 10 | 电子护照 | `GET /api/certificates/:trackId` |
| 11 | 通知系统 | `GET /api/notifications`, `POST /api/notifications/:id/read` |
| 12 | 请求 ID 链路 | 健康检查 `x-request-id` |

### 2. 旧 API 集成测试 (`tests/api.test.js`)

- **框架**：原生 Node.js `fetch`（无框架）
- **目标**：生产服务器（`https://precious-miracle-production.up.railway.app`）
- **运行方式**：`node tests/api.test.js`

### 3. E2E 测试 (`tests/*.spec.js`)

- **框架**：Playwright
- **目标**：生产服务器（`baseURL` 在 `playwright.config.js` 配置）
- **运行方式**：`npm run test:e2e`

包含的 spec 文件：

| 文件 | 说明 |
|------|------|
| `tests/e2e.spec.js` | 原有主页、登录、峰值加载等 |
| `tests/e2e-new-features.spec.js` | PR #47 + #48 新功能 E2E |
| `tests/weather-camps.spec.js` | 营地天气 |
| `tests/commercial-peaks.spec.js` | 商业攀登峰值 |

---

## 本地运行

### 前置条件

1. Node.js 20+
2. 安装所有依赖：
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```
3. Playwright 浏览器（E2E 测试需要）：
   ```bash
   npx playwright install chromium
   ```

### 运行单元测试（不需要网络）

```bash
# 运行所有 jest 单元测试
npm run test:api:unit

# 运行某个具体用例
npx jest tests/api-new-features.test.js -t "注册隐私"
```

### 运行 E2E 测试

```bash
# 运行所有 E2E
npm run test:e2e

# 只运行新功能 E2E
npx playwright test tests/e2e-new-features.spec.js

# 有头模式（本地调试）
npx playwright test tests/e2e-new-features.spec.js --headed
```

### 环境变量

E2E 测试会读取以下环境变量（均有默认值，不配置也能运行）：

```env
ADMIN_PASSWORD=your-admin-password  # admin.html 管理员测试用
```

---

## CI 集成

`.github/workflows/test.yml` 流程：

```
push/PR → install root deps → install backend deps → install Playwright → audit → test:api → test:e2e → upload artifacts
```

**关键步骤说明**：
- `npm install`：安装根级依赖（jest、supertest、playwright）
- `cd backend && npm install`：安装后端依赖（pino、express-rate-limit 等，单元测试加载后端路由时需要）
- `npm run test:api`：先跑旧集成测试（打生产），再跑 jest 单元测试（in-memory）
- `npm run test:e2e`：Playwright 打生产

---

## 添加新测试

### 添加 API 单元测试

在 `tests/api-new-features.test.js` 里新增 `describe` 块：

```javascript
describe('新功能名称 /api/xxx', () => {
  let app, db, userToken;

  beforeAll(() => {
    clearDbCache();         // 清除模块缓存，重建内存数据库
    app = createApp();      // 创建测试 Express 应用
    db  = require('../backend/db/database');
    const user = createTestUser(db, { phone: '139000xxxxx' });
    userToken = user.token;
  });

  test('Happy path → 200', async () => {
    const res = await request(app)
      .get('/api/xxx')
      .set(authHeader(userToken));
    expect(res.status).toBe(200);
  });

  test('失败分支 → 400', async () => {
    // ...
  });
});
```

**注意**：每个 `describe` 块必须有独立的 `clearDbCache()` + `createApp()` 调用，以确保数据库隔离。

### 添加 E2E 测试

在 `tests/e2e-new-features.spec.js` 里新增 `test.describe` 块：

```javascript
test.describe('新功能名称', () => {
  test('用例描述', async ({ page }) => {
    await page.goto('/summitlink');
    // Playwright 操作...
  });
});
```

或创建新的 spec 文件（如 `tests/my-feature.spec.js`），Playwright 会自动发现。

---

## Fixture 设计说明

### in-memory SQLite 隔离机制

每个 API 单元测试 `describe` 块通过以下方式实现数据库隔离：

1. **`clearDbCache()`** — 清除 Node.js 模块缓存中所有 `backend/` 相关模块
2. **`createApp()`** — 重新 require 所有路由，触发 `backend/db/database.js` 重新执行，创建新的 `:memory:` SQLite 实例
3. **`createTestUser(db, opts)`** — 在当前内存数据库中创建测试用户，返回 `{ id, token, phone, password }`
4. **`createAdminToken()`** — 生成携带 `isAdmin: true` 的 JWT（用于管理员路由）

### 模块路径说明

```
项目根目录/
├── node_modules/          # jest, supertest, playwright, bcrypt, better-sqlite3 等
├── backend/
│   ├── node_modules/      # pino, express-rate-limit, multer 等后端专用包
│   ├── routes/            # 各路由文件（由 testApp.js 直接 require）
│   ├── db/database.js     # 数据库单例（受 DATABASE_PATH 环境变量控制）
│   └── utils/             # moderation, trackValidator, weatherCache 等
└── tests/
    ├── helpers/
    │   ├── db.js          # clearDbCache() 工具
    │   ├── auth.js        # createTestUser(), createAdminToken()
    │   └── testApp.js     # createApp() — 测试用 Express 实例
    └── api-new-features.test.js
```

---

## 常见问题

**Q: jest 运行完后卡住不退出**
A: 加 `--forceExit` 参数。原因是 better-sqlite3 的文件描述符没有被显式关闭。`package.json` 中的 `test:api:unit` 脚本已包含此参数。

**Q: 单元测试中为什么 `OPENWEATHER_API_KEY` 未配置时天气接口返回 502 而非 503？**
A: `GET /api/weather` 路由在无 API Key 时，`fetchWeather()` 直接 reject，catch 之后 throw，最终返回 502。`GET /api/weather/summit-window/:peakId` 则返回 mock 数据（200）。

**Q: E2E 测试中某些测试跳过了（skip）**
A: 跳过通常是因为测试账号在生产数据库中没有对应数据（如没有轨迹记录）。这是正常的降级行为，不影响 CI 通过。

**Q: 如何在 CI 中通过管理员 API 测试？**
A: 在 GitHub Repository Secrets 中配置 `ADMIN_PASSWORD`，CI workflow 会自动注入为环境变量。
