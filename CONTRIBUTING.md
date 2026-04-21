# 贡献指南

感谢您对"巅峰探索 SummitLink"项目的关注！以下是参与贡献的基本流程和规范。

---

## 开始之前

1. 阅读 [README.md](./README.md) 了解项目整体情况
2. 阅读 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 了解系统架构
3. 阅读 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 了解本地开发启动方式

---

## 开发流程

### 1. Fork 并克隆仓库

```bash
git clone https://github.com/gaoshanyindi/desktop-tutorial.git
cd desktop-tutorial
```

### 2. 安装依赖并启动

```bash
# 安装后端依赖
cd backend && npm install && cd ..

# 复制并配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入必要的 API Key

# 启动服务
npm start
```

### 3. 创建功能分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 4. 提交变更

- 每次提交保持单一职责
- 提交消息格式：`<type>: <description>`
  - `feat`: 新功能
  - `fix`: Bug 修复
  - `docs`: 文档更新
  - `refactor`: 代码重构（不改变行为）
  - `test`: 添加或修改测试
  - `chore`: 构建/依赖相关变更

示例：
```
feat: 添加山峰收藏功能
fix: 修复营地天气 C2/C3 数据相同的问题
docs: 更新 API 文档中的轨迹接口说明
```

### 5. 运行测试

```bash
# API 集成测试
npm run test:api

# E2E 测试（需要 Railway 生产环境可访问）
npm run test:e2e
```

确保所有测试通过后再提交 PR。

### 6. 提交 Pull Request

- PR 标题清晰描述变更内容
- PR 描述中列出主要变更点
- 如涉及后端接口变更，同步更新 [docs/API.md](./docs/API.md)
- 如涉及环境变量新增，同步更新 [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)

---

## 代码规范

### 后端（Node.js）

- 使用 `require` 模块化，遵循 CommonJS 规范
- 路由处理器使用 `try/catch` 捕获错误并返回标准错误响应 `{ error: '...' }`
- 数据库操作使用 `better-sqlite3` 同步 API
- 新增需要鉴权的接口，在路由中使用 `auth` 或 `adminAuth` 中间件
- 新增数据库字段，使用迁移模式（`db.pragma('table_info')` 检查列是否存在）

### 前端（HTML/Alpine.js）

- 状态管理使用 Alpine.js `x-data`
- API 请求统一通过 `fetch` 发起，处理 loading 和 error 状态
- 不直接修改 DOM，通过响应式数据驱动 UI 更新

---

## 安全规范

- 不要在代码中硬编码任何密钥、Token 或密码
- 不要提交 `.env` 文件（已在 `.gitignore` 中排除）
- 新增文件上传接口时，确保文件类型校验和大小限制
- 新增公开接口时，评估是否需要速率限制

---

## 报告 Bug

请通过 [GitHub Issues](https://github.com/gaoshanyindi/desktop-tutorial/issues) 报告 Bug，包含以下信息：

1. 复现步骤
2. 预期行为
3. 实际行为
4. 环境信息（浏览器版本、Node.js 版本）

---

## 联系

如有问题，可通过 GitHub Issues 或 {{CONTACT_EMAIL}} 联系项目维护者。
