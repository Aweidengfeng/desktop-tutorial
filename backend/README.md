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

## 遇到问题？

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
