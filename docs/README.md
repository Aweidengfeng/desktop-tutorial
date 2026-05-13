# SummitLink API 文档说明

SummitLink 高山探险户外社交平台 — API 接口文档中心。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `swagger.yaml` | OpenAPI 3.0 完整接口文档 |
| `error-codes.md` | 统一错误码说明 |
| `README.md` | 本文件，使用指南 |

---

## 如何本地查看 Swagger UI

### 方法一：使用 Swagger UI Docker（推荐）

```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/docs/swagger.yaml \
  -v $(pwd)/docs:/docs \
  swaggerapi/swagger-ui
```

打开浏览器访问：[http://localhost:8080](http://localhost:8080)

### 方法二：使用 swagger-ui-express（集成到 Express）

```bash
npm install swagger-ui-express js-yaml
```

在 `backend/app.js` 中添加：

```js
const swaggerUi = require('swagger-ui-express');
const YAML = require('js-yaml');
const fs = require('fs');
const path = require('path');

const swaggerDoc = YAML.load(fs.readFileSync(path.join(__dirname, '../docs/swagger.yaml'), 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
```

访问：[http://localhost:3000/api-docs](http://localhost:3000/api-docs)

### 方法三：VS Code 插件

安装 [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi) 插件，直接在 VS Code 中预览。

### 方法四：在线编辑器

将 `swagger.yaml` 内容粘贴到 [editor.swagger.io](https://editor.swagger.io) 即可预览。

---

## 接口分级说明

| 优先级 | 模块 | 说明 |
|--------|------|------|
| **P0** | 认证模块 | 核心功能，必须最先实现 |
| **P1** | 帖子、评论、山峰/路线、活动、消息 | 主要业务功能 |
| **P2** | 向导、俱乐部、SOS、后台统计 | 扩展功能，后续实现 |

---

## 认证方式说明（Bearer JWT）

大多数接口需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

**获取 Token 流程：**

1. 调用 `POST /api/auth/send-code` 发送短信验证码（云短信服务 / mock）
2. 调用 `POST /api/auth/login` 用手机号和验证码登录
3. 响应中的 `data.token` 即为 JWT Token
4. 在后续请求的 `Authorization` 头中携带此 Token

**Token 有效期：** 7 天

**示例：**

```bash
# 1. 发送验证码
curl -X POST https://desktop-tutorial-production-182a.up.railway.app/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000"}'

# 2. 登录获取 Token
curl -X POST https://desktop-tutorial-production-182a.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "code": "123456"}'

# 3. 使用 Token 访问受保护接口
curl https://desktop-tutorial-production-182a.up.railway.app/api/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## WebSocket 连接说明

### 连接地址

```
ws://localhost:3000/ws?token=<jwt_token>
```

生产环境：
```
wss://desktop-tutorial-production-182a.up.railway.app/ws?token=<jwt_token>
```

### 消息协议

**客户端发送消息：**
```json
{
  "type": "message",
  "chatId": 1,
  "content": "你好！",
  "msgType": "text"
}
```

**服务端推送新消息：**
```json
{
  "type": "message",
  "data": {
    "id": 10,
    "chatId": 1,
    "senderId": 2,
    "content": "你好！",
    "msgType": "text",
    "createdAt": "2026-01-01T12:00:00Z"
  }
}
```

**心跳保活（每 30 秒发送一次）：**
```json
{ "type": "ping" }
```

**服务端心跳响应：**
```json
{ "type": "pong" }
```

### 前端示例代码

```javascript
const token = localStorage.getItem('token');
const ws = new WebSocket(`wss://desktop-tutorial-production-182a.up.railway.app/ws?token=${token}`);

ws.onopen = () => {
  console.log('WebSocket 已连接');
  // 心跳
  setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 30000);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'message') {
    console.log('收到新消息:', msg.data);
  }
};

// 发送消息
ws.send(JSON.stringify({
  type: 'message',
  chatId: 1,
  content: '你好！',
  msgType: 'text'
}));
```

---

## 开发环境变量（.env 模板）

在 `backend/` 目录下创建 `.env` 文件，参考以下模板：

```env
# ─── 服务配置 ───────────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── 数据库（Railway PostgreSQL）───────────────────
DATABASE_URL=postgresql://user:password@host:5432/dbname

# ─── JWT ────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d

# ─── 腾讯云短信（预留） ─────────────────────────────
SMS_PROVIDER=mock
TENCENT_SMS_SDK_APP_ID=your_sdk_app_id
TENCENT_SMS_SECRET_ID=your_secret_id
TENCENT_SMS_SECRET_KEY=your_secret_key

# ─── 跨域 ────────────────────────────────────────────
CORS_ORIGINS=https://your-frontend-domain.com

# ─── Sentry 错误监控（可选）─────────────────────────
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project
```

> ⚠️ **注意**：`.env` 文件不能提交到 Git，已在 `.gitignore` 中忽略。

---

## 生产环境地址

- **API Base URL**：`https://desktop-tutorial-production-182a.up.railway.app`
- **Swagger UI**：`https://desktop-tutorial-production-182a.up.railway.app/api-docs`（部署后）
- **健康检查**：`GET /api/health`
