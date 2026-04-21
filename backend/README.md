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

## Railway 部署说明

### Volume 挂载（数据持久化）

Railway 容器重启后，容器内的临时文件会丢失。**必须挂载 Volume** 来持久化 SQLite 数据库和上传的图片文件。

**步骤：**

1. 在 Railway 项目中，进入 **Service → Volumes**，新增一个 Volume，挂载路径设为 `/data`。
2. 在 Railway **Service → Variables** 面板中添加以下环境变量：

```
NODE_ENV=production
DATABASE_PATH=/data/summitlink.db
UPLOADS_DIR=/data/uploads
JWT_SECRET=<用 openssl rand -hex 32 生成的随机字符串>
ADMIN_PASSWORD=<改成你的强密码>
CORS_ORIGINS=https://你的正式域名,https://www.你的正式域名
SEED_ON_START=false
```

### 首次部署流程

1. 挂载好 Volume 并填写所有环境变量（包括强密码）。
2. **仅首次**：将 `SEED_ON_START` 临时设为 `true`，触发一次数据填充。
3. 部署成功后，立即将 `SEED_ON_START` 改回 `false`，**防止每次重启都重跑 seed**。

> ⚠️ 生产环境启动时会校验 `JWT_SECRET` 和 `ADMIN_PASSWORD`：若仍为默认值，服务将**拒绝启动**并打印错误。请务必修改为强随机值。

---



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
- `GET /api/tracks/:id/export?format=gpx|kml` — 导出标准 GPX 1.1 / KML 2.2 文件。公开轨迹任何人可下载；非公开轨迹需作者 JWT。

```bash
# 示例：下载 GPX
curl -o track.gpx "https://your-app.railway.app/api/tracks/1/export?format=gpx"
# 示例：下载 KML
curl -o track.kml "https://your-app.railway.app/api/tracks/1/export?format=kml"
```

### 山峰（扩展）
- `GET /api/peaks?category=eight_thousanders|seven_summits|classic|technical` — 按分类查询山峰列表
- `GET /api/peaks/:id/weather` — 获取山峰当前天气（代理到 /api/weather）

```bash
# 示例：获取八千米山峰列表
curl "https://your-app.railway.app/api/peaks?category=eight_thousanders"
# 示例：获取珠峰天气
curl "https://your-app.railway.app/api/peaks/1/weather"
```

### 向导入驻
- `POST /api/guides/apply` — 提交向导申请 `{ name, cert, specialty, languages, dayRate, region }`（需 JWT）
- `GET /api/guides/me` — 查看自己的申请状态（需 JWT）
- `PUT /api/guides/me` — 更新向导资料（仅 pending 状态）（需 JWT）

```bash
# 示例：提交向导申请
curl -X POST "https://your-app.railway.app/api/guides/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","specialty":"高海拔攀登","dayRate":300}'
```

### 俱乐部入驻
- `GET /api/clubs/me` — 查看自己的俱乐部/申请状态（需 JWT）
- `PUT /api/clubs/me` — 更新俱乐部/申请资料（需 JWT）

### 商业攀登（expeditions）
- `POST /api/expeditions` — 已审核向导/俱乐部发布远征（需 JWT）
- `GET /api/expeditions?status=published&peak_id=&publisher_type=` — 已发布远征列表
- `GET /api/expeditions/:id` — 远征详情
- `PUT /api/expeditions/:id` — 修改远征（仅 pending 状态，发布者需 JWT）
- `POST /api/expeditions/:id/order` — 用户下单 `{ participants, contact_name, contact_phone }`（需 JWT）
- `GET /api/expeditions/orders/my` — 我的订单列表（需 JWT）
- `POST /api/expeditions/orders/:id/mock-pay` — 模拟支付（内测，推进订单到 paid 状态，TODO: B2 阶段替换为真实支付）（需 JWT）

```bash
# 示例：查看已发布商业攀登
curl "https://your-app.railway.app/api/expeditions"
# 示例：下单（需登录）
curl -X POST "https://your-app.railway.app/api/expeditions/1/order" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participants":2,"contact_name":"张三","contact_phone":"13800138000"}'
```

### 短信验证码登录（A9）
- `POST /api/auth/sms/send { phone }` — 发送验证码（60 秒冷却，mock 模式打印到控制台）
- `POST /api/auth/sms/verify { phone, code }` — 验证登录（失败 3 次锁定 10 分钟）

```bash
# 示例：发送验证码
curl -X POST "https://your-app.railway.app/api/auth/sms/send" \
  -H "Content-Type: application/json" -d '{"phone":"13800138000"}'
# 示例：验证并登录
curl -X POST "https://your-app.railway.app/api/auth/sms/verify" \
  -H "Content-Type: application/json" -d '{"phone":"13800138000","code":"123456"}'
```

### 管理后台（扩展）
- `GET /api/admin/club-applications?status=pending|approved|rejected` — 俱乐部申请列表
- `POST /api/admin/club-applications/:id/approve` — 审核通过俱乐部申请
- `POST /api/admin/club-applications/:id/reject { reason }` — 拒绝俱乐部申请
- `PUT /api/admin/guides/:id/config { commission_rate, listing_fee_paid }` — 设置向导抽成/入驻费
- `PUT /api/admin/clubs/:id/config { commission_rate, listing_fee_paid }` — 设置俱乐部抽成/入驻费
- `GET /api/admin/expeditions?status=pending` — 待审核商业攀登列表
- `POST /api/admin/expeditions/:id/approve` — 审核通过商业攀登
- `POST /api/admin/expeditions/:id/reject { reason }` — 拒绝商业攀登
- `GET /api/admin/sms-codes` — 查看最近 50 条验证码（**仅内测用**，正式版移除）

```bash
# 示例：获取待审核向导申请
curl "https://your-app.railway.app/api/admin/guides?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# 示例：查看验证码（内测调试）
curl "https://your-app.railway.app/api/admin/sms-codes" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 环境变量（新增）

| 变量名 | 说明 |
|--------|------|
| `AMAP_SECURITY_CODE` | 高德 Web JS API 2.0 安全密钥（**必须配置，否则地图无法初始化**）|
| `SMS_PROVIDER` | 短信服务商（不设置默认 mock，设为 `aliyun` 切换阿里云 SDK，B2 阶段实现）|

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
| `JWT_SECRET` | JWT 签名密钥（**生产环境必须修改**）|
| `ADMIN_PASSWORD` | 后台管理员密码（**生产环境必须修改**）|
| `AMAP_KEY` | 高德地图 Web JS API Key（在高德开放平台申请）|
| `AMAP_SECURITY_CODE` | 高德 Web JS API 2.0 安全密钥（**必须配置，否则地图无法加载**）|
| `DATABASE_PATH` | SQLite 数据库文件路径，默认 `backend/db/summitlink.db`。Railway 建议设为 `/data/summitlink.db` |
| `UPLOADS_DIR` | 上传文件目录，默认 `backend/uploads`。Railway 建议设为 `/data/uploads` |
| `CORS_ORIGINS` | 生产环境 CORS 白名单（逗号分隔），如 `https://xxx.com,https://www.xxx.com`|
| `SEED_ON_START` | 设为 `true` 时执行数据填充，默认 `false`（跳过）。**仅首次部署前临时设为 true** |
| `SMS_PROVIDER` | 短信服务商（留空=mock 模式；`aliyun`=阿里云短信，B2 阶段实现）|
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
