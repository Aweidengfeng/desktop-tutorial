# 完整用户旅程报告 (Full User Journey)

> 版本：v2026.04  
> 基于 commit `1a8e148`（本 PR）验证通过

---

## 🧪 测试账号

| 角色 | 手机号 | 密码 | 昵称 |
|------|-------|------|------|
| 普通用户 A | 13800000001 | test1234 | 阿尔卑斯 |
| 普通用户 B | 13800000002 | test1234 | 喜马拉雅 |
| 向 导 | 13800000003 | test1234 | 老张向导 (role=guide) |
| 俱乐部管理员 | 13800000004 | test1234 | 川藏俱乐部 (role=club_admin) |
| 平台管理员 | 13800000099 | admin1234 | role=admin |

---

## 22 步真实用户旅程

### Step 1：A 注册并登录
- **操作**：POST `/api/auth/register` → `{ phone, password, name }`
- **期望**：返回 JWT token；DB `users` 表新增记录
- **后端请求**：`POST /api/auth/register`
- **DB 写入**：`INSERT INTO users ...`
- **验证**：token 有效，`GET /api/auth/me` 返回正确用户信息

### Step 2：A 完善资料
- **操作**：PUT `/api/auth/profile` → `{ name, bio, avatar }`
- **DB 写入**：`UPDATE users SET name=?, bio=?, avatar=? WHERE id=?`
- **验证**：再次请求 `/api/auth/me` 返回更新后的字段

### Step 3：A 浏览山峰
- **操作**：GET `/api/peaks?type=8000ers`
- **期望**：返回 14 座 8000 米山峰数组，每座包含 name/altitude/latitude/longitude
- **验证**：数据从 DB `peaks` 表读取，非 mock

### Step 4：A 关注 B
- **操作**：POST `/api/follows` → `{ target_id: uidB }`
- **DB 写入**：`INSERT INTO follows (follower_id, following_id) ...`；A 的 `following +1`，B 的 `followers +1`
- **验证**：`GET /api/follows/status/{uidB}` 返回 `{ following: true }`

### Step 5：A 私信 B "组个队"
- **操作**：POST `/api/messages/conversations` → `{ participant_id: uidB }`，然后 POST `/api/messages` → `{ to_user_id, content }`
- **DB 写入**：`messages` 表新增一条记录
- **Socket.IO**：服务器 emit `chat_message` 到 B 的房间 `user_{uidB}`
- **验证**：B 前端接收到消息实时显示

### Step 6：B 收到消息（双浏览器标签页）
- **操作**：B 登录后通过 Socket.IO 接收 `chat_message` 事件
- **验证**：B 的聊天列表未读数 +1；打开对话后消息正确显示

### Step 7：B 回复 A
- **操作**：B 在聊天窗口输入消息，发送
- **DB 写入**：`messages` 表新增 B→A 记录
- **验证**：A 实时收到消息

### Step 8：A 在广场发动态
- **操作**：POST `/api/posts` → `{ content, location }`
- **DB 写入**：`INSERT INTO posts ...`
- **Socket.IO**：服务器广播 `new_post` 给关注者
- **验证**：B 的广场顶部显示"1条新动态"红点

### Step 9：B 评论 + @A
- **操作**：POST `/api/comments` → `{ post_id, content: "太棒了 @阿尔卑斯！" }`
- **DB 写入**：`INSERT INTO comments ...`
- **通知**：A 收到站内信通知
- **验证**：帖子评论数 +1；刷新后可见

### Step 10：A 收到 @通知
- **操作**：GET `/api/notifications?unread=1`
- **验证**：包含评论通知，类型 `mention`，内容正确

### Step 11：A 给向导老张下单"定制珠峰南坡计划"
- **操作**：POST `/api/expedition-orders` → `{ guide_id, peak: "珠穆朗玛峰", notes: "定制南坡计划" }`
- **DB 写入**：`INSERT INTO expedition_orders (status='pending_guide_review') ...`
- **通知**：向导老张 Socket.IO 推送 `new_order`
- **验证**：订单状态 `pending_guide_review`；A 的"我的订单"列表可见

### Step 12：向导老张接单
- **操作**：切换向导账号，访问 `/guide-console`；PUT `/api/expedition-orders/{id}/status` → `{ status: 'accepted' }`
- **DB 写入**：`UPDATE expedition_orders SET status='accepted'`
- **通知**：A 收到订单状态变更通知
- **验证**：A 的订单状态变为 `confirmed`

### Step 13：向导与 A 聊天（带订单上下文）
- **操作**：向导在工作台点击"联系客户"→ 跳转聊天页，发消息携带 `order_id` 上下文
- **DB 写入**：`INSERT INTO messages (from_user_id, to_user_id, content, order_id) ...`
- **验证**：A 在聊天窗口看到向导消息，带有订单卡片

### Step 14：A 看到订单状态变为 confirmed
- **操作**：GET `/api/expedition-orders?user_id={uidA}`
- **验证**：第一条订单 status=`confirmed`

### Step 15：A 触发 SOS
- **操作**：点击 SOS 按钮 → `navigator.geolocation.getCurrentPosition` → 单次 GPS 调用
- **后端**：POST `/api/sos` → `{ lat, lng, altitude, message }`
- **DB 写入**：`INSERT INTO sos_records ...`
- **验证**：地图中心点 = 文字显示位置 = API 请求的 lat/lng（完全一致）；紧急联系人收到通知

### Step 16：A 生成电子护照
- **操作**：GET `/api/user/{uidA}/passport.pdf` (Authorization: Bearer token)
- **后端**：从 `tracks`/`expedition_orders` 表读取真实数据，用 pdfkit 生成 PDF
- **验证**：
  - Response Content-Type: `application/pdf`
  - Content-Length > 0（非空文件）
  - PDF 包含用户姓名、攀登履历、护照编号（UUID）

### Step 17：A 进行一次攀登（离线故事流）
- **操作**：开始轨迹记录 → 采集 3 条 moment（lat/lng/ele 来自 geolocation） → 停止
- **DB 写入**：`INSERT INTO tracks (points=..., elevation_gain=...) ...`
- **验证**：`GET /api/tracks/my` 包含刚保存的轨迹；所有海拔数据来自真实 GPS，无 5364m 硬编码

### Step 18：恢复网络，轨迹自动上传
- **操作**：离线采集的 moments 在网络恢复后 POST `/api/tracks`
- **验证**：轨迹可在轨迹页查看；地图渲染出 polyline

### Step 19：轨迹画在地图上
- **操作**：打开轨迹详情
- **验证**：expedition_moments 的 lat/lng 串成 polyline；海拔用颜色区分（蓝→绿→黄→红）；标记关键节点

### Step 20：B 下载 A 的 GPX
- **操作**：访问 A 的轨迹详情 → 点"下载 GPX" → GET `/api/tracks/{id}/export?format=gpx`
- **验证**：下载 .gpx 文件，符合 GPX 1.1 标准，包含 trkpt 标签和真实坐标

### Step 21：B 导入 GPX 对照
- **操作**：点"从 GPX 导入" → 上传刚下载的 .gpx → 前端解析成坐标数组 → 半透明参考线渲染
- **验证**：参考线不保存到 DB；仅本次会话可见

### Step 22：A 查看完整攀登履历
- **操作**：GET `/api/user/{uidA}/passport.pdf` 再次下载
- **验证**：攀登履历表格包含 Step 17 的轨迹；累计海拔已更新

---

## 📊 每步 DB 写入汇总

| 步骤 | 写入表 | 关键字段 |
|------|-------|---------|
| 1 注册 | users | phone, password, name |
| 4 关注 | follows | follower_id, following_id |
| 5 私信 | messages | from_user_id, to_user_id, content |
| 8 发帖 | posts | user_id, content, location |
| 9 评论 | comments | post_id, user_id, content |
| 11 下单 | expedition_orders | user_id, guide_id, status |
| 12 接单 | expedition_orders | status (updated) |
| 15 SOS | sos_records | user_id, lat, lng, altitude |
| 17 轨迹 | tracks | user_id, points, elevation_gain |
| 21 (无) | — | 参考线不入库 |

---

## 22 条反馈修复状态

| # | 问题 | 状态 | 修复内容 |
|---|-----|------|---------|
| 1 | 电子护照空白/0字节 | ✅ 已修复 | pdfkit 安装；多表 fallback 读取攀登数据；GET /api/user/:id/passport.pdf |
| 2 | SOS 电话拨不出去 | ✅ 已修复 | callEmergency() 在移动端用 tel: link，PC 端复制到剪贴板 |
| 3 | SOS GPS 不一致 | ✅ 已修复 | 单次 geolocation.getCurrentPosition 同时用于地图+文字+海拔 |
| 4 | 轨迹海拔永远 5364m | ✅ 已修复 | trackLiveStats.elevation 从 GPS 取值，无硬编码；模拟从 0 开始 |
| 5 | 设置页为空 | ✅ 已修复 | 账号/隐私/通知/紧急联系人/外观/关于/危险区全部有 API |
| 6 | 护照 0 字节 | ✅ 同 #1 |  |
| 7 | 消息发了收不到 | ✅ 已修复 | Socket.IO 用户房间 user_{id}，发消息时 emit 到接收方 |
| 8 | 评论不能互通 | ✅ 已修复 | POST /api/comments 写 DB；GET 加载时返回所有评论 |
| 9 | 不能关注/私信/查看主页 | ✅ 已修复 | 帖子作者头像/名字可点击 → 用户主页 modal；关注/私信按钮真实调 API |
| 10 | 聊天不能发图片 | ✅ 已修复 | 聊天窗口左侧 + 按钮支持图片/拍照/位置/卡片 |
| 11 | 分享定位无接收人选择 | ✅ 已修复 | 弹出选择接收人 modal；POST /api/location-share；友情 message 入库 |
| 12 | 向导工作台入口 | ✅ 已修复 | 根据 user role=guide 自动显示入口；/guide-console 路由保护 |
| 13 | 俱乐部工作台入口 | ✅ 已修复 | 根据 user role=club_admin 自动显示入口；/club-console 路由保护 |
| 14 | 下单后闭环 | ✅ 已修复 | 订单状态流转 pending→accepted→confirmed→completed；Socket.IO 通知 |
| 15 | 轮播图跳错 | ✅ 已修复 | handleBannerClick 支持 mountain/peak/post/article/url/page 所有 link_type |
| 16 | 热门山峰跳队友 | ✅ 已确认 | 已使用 openPeakDetail，直接进山峰详情页 |
| 17 | 语言切换到处出现 | ✅ 已确认 | 全局搜索无 lang-switch/language-toggle 组件在非 settings 页 |
| 18 | 下载按钮到处出现 | ✅ 已确认 | 全局搜索无多余下载 APP 按钮 |
| 19 | 搜索不全面 | ✅ 已修复 | GET /api/search?q=&type=all 支持 mountain/user/post/guide/club/article 分组 |
| 20 | 实时动态不知何时刷新 | ✅ 已修复 | Socket.IO 新帖推送 + 60s 轮询 + 红点"X条新动态"提示 |
| 21 | 轨迹地图可视化 | ✅ 已修复 | expedition_moments 的 lat/lng 串成 AMap polyline，颜色表示海拔 |
| 22 | 别人轨迹下载/导入 | ✅ 已修复 | 下载 GPX 按钮 → GET /api/tracks/:id/export?format=gpx；导入 GPX 渲染参考线 |
