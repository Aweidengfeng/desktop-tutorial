# 🏔️ 巅峰探索 SummitLink 后端服务

## 你需要准备什么

只需要安装 **Node.js**（去 [nodejs.org](https://nodejs.org) 下载 LTS 版本安装即可）

安装完成后，在终端输入 `node -v` 能看到版本号说明安装成功。

---

## 第一次启动步骤（按顺序操作）

### 第1步：进入后端目录

打开终端/命令行，输入：

```bash
cd backend
```

### 第2步：安装依赖

```bash
npm install
```

等待安装完成（可能需要1-2分钟，看到光标停止闪烁即可）。

### 第3步：创建配置文件

把 `.env.example` 文件复制一份，改名为 `.env`

- **Windows**：`copy .env.example .env`
- **Mac/Linux**：`cp .env.example .env`

### 第4步：填充示例数据

```bash
node db/seed.js
```

看到 `✅ 示例数据填充完成！` 说明成功。

### 第5步：启动服务

```bash
npm start
```

看到 `✅ SummitLink后端运行在 http://localhost:3000` 说明成功。

### 第6步：打开前端

浏览器访问 [http://localhost:3000/攀登3-20260415-summitlink.html](http://localhost:3000/攀登3-20260415-summitlink.html)

你会看到巅峰探索的页面，所有数据都来自后端！

---

## 以后每次启动只需要

```bash
cd backend
npm start
```

---

## 接口地址一览

| 功能 | 方法 | 地址 |
|------|------|------|
| 用户注册 | POST | `/api/auth/register` |
| 用户登录 | POST | `/api/auth/login` |
| 获取当前用户 | GET | `/api/auth/me` |
| 更新资料 | PUT | `/api/auth/profile` |
| 山峰列表 | GET | `/api/peaks?type=8000ers` |
| 山峰详情 | GET | `/api/peaks/:id` |
| 向导列表 | GET | `/api/guides` |
| 申请成为向导 | POST | `/api/guides/apply` |
| 队伍列表 | GET | `/api/teams` |
| 创建队伍 | POST | `/api/teams` |
| 加入队伍 | POST | `/api/teams/:id/join` |
| 我的轨迹 | GET | `/api/tracks/my` |
| 保存轨迹 | POST | `/api/tracks` |
| 装备列表 | GET | `/api/gear?mode=buy` |
| 发布装备 | POST | `/api/gear` |
| 社区帖子 | GET | `/api/posts` |
| 发布帖子 | POST | `/api/posts` |
| 帖子点赞 | POST | `/api/posts/:id/like` |
| 创建订单 | POST | `/api/pay/create` |
| 查询订单 | GET | `/api/pay/status/:orderNo` |
| 天气数据 | GET | `/api/weather?location=珠峰大本营` |
| 登顶榜 | GET | `/api/leaderboard/monthly` |

---

## 测试接口（可选）

安装完成并启动后，可以在浏览器直接访问以下地址测试：

- 山峰列表：http://localhost:3000/api/peaks?type=8000ers
- 向导列表：http://localhost:3000/api/guides
- 队伍列表：http://localhost:3000/api/teams
- 登顶榜：http://localhost:3000/api/leaderboard/monthly
- 天气：http://localhost:3000/api/weather?location=珠峰大本营

---

## 新增 API 接口说明

### 文件上传
- `POST /api/upload` — 上传图片（multipart/form-data, field: `file`），返回 `{ url, filename }`。支持 JPEG/PNG/GIF/WebP，最大 10MB。

### 认证扩展
- `POST /api/auth/sms/send` — 发送短信验证码（开发模式打印到控制台）`{ phone }`
- `POST /api/auth/sms/verify` — 验证码登录/注册 `{ phone, code }`，返回 `{ token, user }`
- `POST /api/auth/wechat` — 微信登录 mock `{ code }`，返回 `{ token, user }`
- `POST /api/auth/apple` — Apple 登录 mock `{ identityToken }`，返回 `{ token, user }`
- `PUT /api/auth/settings` — 保存用户设置 `{ useMetric, language }`（需 JWT）
- `PUT /api/auth/privacy` — 保存隐私设置 `{ profile_public, posts_public, follows_public, allow_stranger_msg }`（需 JWT）

### 攀登线路
- `GET /api/routes` — 所有线路列表
- `GET /api/routes/:id` — 线路详情
- `GET /api/routes/:id/clubs` — 该线路下的所有报价俱乐部（含俱乐部信息 + 报价）
- `POST /api/routes` — 创建线路（管理员）
- `PUT /api/routes/:id` — 更新线路（管理员）
- `DELETE /api/routes/:id` — 删除线路（管理员）
- `POST /api/routes/pricing` — 设置俱乐部-线路报价

### 俱乐部
- `GET /api/clubs` — 列表（分页）
- `GET /api/clubs/:id` — 详情
- `GET /api/clubs/:id/guides` — 俱乐部旗下向导列表
- `POST /api/clubs` — 创建（需 JWT）
- `PUT /api/clubs/:id` — 更新（管理员/创建者）
- `DELETE /api/clubs/:id` — 删除（管理员）
- `PUT /api/clubs/:id/verify` — 切换认证状态（管理员）

### 轨迹
- `POST /api/tracks` — 保存轨迹 `{ name, points: [{lat,lng,ele,ts}...], distance, elevation_gain, duration }`（需 JWT）
- `GET /api/tracks?user_id=` — 轨迹列表
- `GET /api/tracks/:id` — 轨迹详情

### 预约
- `POST /api/bookings` — 创建预约（探索/商业）`{ type, peak_name, route_id, club_id, guide_id, date, people, price, notes }`（需 JWT）
- `GET /api/bookings?user_id=` — 用户预约列表（需 JWT）

### 用户
- `GET /api/users/:id/achievements` — 用户成就（需 JWT）
- `GET /api/users/:id/membership` — 会员信息（需 JWT）
- `GET /api/users/:id/summits` — 登顶记录
- `GET /api/users/:id/expeditions` — 远征记录
- `GET /api/users/:id/followers` — 粉丝列表
- `GET /api/users/:id/following` — 关注列表
- `POST /api/follow` — 关注用户 `{ followee_id }`（需 JWT）
- `DELETE /api/follow` — 取消关注 `{ followee_id }`（需 JWT）

---

## 环境变量说明（`.env`）

| 变量名 | 说明 |
|--------|------|
| `PORT` | 监听端口（默认 8080）|
| `JWT_SECRET` | JWT 签名密钥 |
| `WECHAT_APPID` | 微信小程序 AppID（留占位）|
| `WECHAT_SECRET` | 微信小程序 Secret（留占位）|
| `APPLE_CLIENT_ID` | Apple Sign In Client ID（留占位）|
| `APPLE_TEAM_ID` | Apple Developer Team ID（留占位）|
| `APPLE_KEY_ID` | Apple Sign In Key ID（留占位）|


**端口占用（Port 3000 in use）**

修改 `.env` 里的 `PORT=3001`，然后重新 `npm start`

**数据库重置**

删除 `backend/db/summitlink.db` 文件，然后重新运行：

```bash
node db/seed.js
```

**模块未找到（Cannot find module）**

重新运行：

```bash
npm install
```

**默认演示账号**

- 手机号：`13800138000`
- 密码：`123456`

---

## 技术栈

- **运行时**：Node.js
- **框架**：Express.js
- **数据库**：SQLite（通过 better-sqlite3，无需安装数据库服务器）
- **认证**：JWT（jsonwebtoken）
- **密码加密**：bcrypt
