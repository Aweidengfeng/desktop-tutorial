# SummitLink 后端 API 概览

本文档按模块分组列出后端所有主要接口，路径信息来源于 `backend/routes/` 下的实际源码。

**鉴权说明：**
- 标注 `🔐 JWT` 的接口需要在 Header 中携带 `Authorization: Bearer <token>`
- 标注 `🔑 Admin` 的接口需要管理员 JWT token（通过 `POST /api/admin/login` 获取）
- 无标注的接口为公开接口

---

## 目录

1. [认证鉴权 `/api/auth`](#认证鉴权-apiauth)
2. [山峰 `/api/peaks`](#山峰-apipeaks)
3. [天气 `/api/weather`](#天气-apiweather)
4. [商业向导 `/api/guides`](#商业向导-apiguides)
5. [俱乐部 `/api/clubs`](#俱乐部-apiclubs)
6. [轨迹 `/api/tracks`](#轨迹-apitracks)
7. [商业攀登 `/api/expeditions`](#商业攀登-apiexpeditions)
8. [文章 `/api/articles`](#文章-apiarticles)
9. [个人资料 `/api/profile`](#个人资料-apiprofile)
10. [定制攀登 `/api/customs`](#定制攀登-apicustoms)
11. [救援 `/api/rescue`](#救援-apirescue)
12. [保险 `/api/insurance`](#保险-apiinsurance)
13. [社区帖子 `/api/posts`](#社区帖子-apiposts)
14. [评论 `/api/comments`](#评论-apicomments)
15. [私信 `/api/messages`](#私信-apimessages)
16. [关注 `/api/follows`](#关注-apifollows)
17. [通知 `/api/notifications`](#通知-apinotifications)
18. [装备市场 `/api/gear`](#装备市场-apigear)
19. [登顶榜 `/api/leaderboard`](#登顶榜-apileaderboard)
20. [Banner `/api/banners`](#banner-apibanners)
21. [支付 `/api/pay`](#支付-apipay)
22. [预约 `/api/bookings`](#预约-apibookings)
23. [用户 `/api/users`](#用户-apiusers)
24. [攀登线路 `/api/routes`](#攀登线路-apiroutes)
25. [队伍 `/api/teams`](#队伍-apiteams)
26. [文件上传 `/api/upload`](#文件上传-apiupload)
27. [管理后台 `/api/admin`](#管理后台-apiadmin)
28. [系统 `/api/health`](#系统-apihealth)
29. [向导服务 `/api/guides/:guideId/services`](#向导服务-apiguidesguididservices)
30. [向导服务订单 `/api/guide-service-orders`](#向导服务订单-apiguide-service-orders)
31. [俱乐部活动报名 `/api/clubs/:clubId/activities/:actId`](#俱乐部活动报名-apiclubsclubidactivitiesactid)
32. [俱乐部活动订单 `/api/activity-orders`](#俱乐部活动订单-apiactivity-orders)
33. [商业资质申请](#商业资质申请)

---

## 认证鉴权 `/api/auth`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/register` | — | 用户注册 `{ name, phone, password }` |
| `POST` | `/api/auth/login` | — | 密码登录（有速率限制） `{ phone, password }` |
| `GET` | `/api/auth/me` | 🔐 JWT | 获取当前登录用户信息 |
| `PUT` | `/api/auth/profile` | 🔐 JWT | 更新个人资料 `{ name, avatar, bio, ... }` |
| `PUT` | `/api/auth/settings` | 🔐 JWT | 保存用户设置 `{ useMetric, language }` |
| `GET` | `/api/auth/settings` | 🔐 JWT | 获取用户设置 |
| `PUT` | `/api/auth/privacy` | 🔐 JWT | 保存隐私设置 `{ profile_public, posts_public, follows_public, allow_stranger_msg }` |
| `GET` | `/api/auth/privacy` | 🔐 JWT | 获取隐私设置 |
| `POST` | `/api/auth/sms/send` | — | 发送短信验证码 `{ phone }`（60s 冷却）|
| `POST` | `/api/auth/sms/verify` | — | 短信验证码登录/注册 `{ phone, code }`（失败 3 次锁定 10 分钟）|
| `POST` | `/api/auth/wechat` | — | 微信登录 mock `{ code }` |
| `POST` | `/api/auth/apple` | — | Apple 登录 mock `{ identityToken }` |

---

## 山峰 `/api/peaks`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/peaks` | — | 山峰列表，支持 `?category=eight_thousanders\|seven_summits\|classic\|technical`（兼容 `?type=` 参数）|
| `GET` | `/api/peaks/:id` | — | 山峰详情 |
| `GET` | `/api/peaks/:id/weather` | — | 山峰当前天气（代理到 `/api/weather`）|
| `POST` | `/api/peaks/suggest` | 🔐 JWT | 提交山峰建议 |

---

## 天气 `/api/weather`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/weather` | — | 当前天气，`?location=<地名>` 或 `?lat=&lon=`。无参数时返回 200 + null 数据 + 提示 |
| `GET` | `/api/weather/forecast` | — | 7 天预报，`?location=<地名>` 或 `?lat=&lon=` |
| `GET` | `/api/weather/camps` | — | 营地分层天气，`?peak_id=<山峰ID>` |
| `GET` | `/api/weather/popular-peaks` | — | 热门山峰天气概览 |

---

## 商业向导 `/api/guides`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/guides` | — | 向导列表 |
| `GET` | `/api/guides/:id` | — | 向导详情 |
| `GET` | `/api/guides/:id/expeditions` | — | 向导发布的商业攀登列表 |
| `GET` | `/api/guides/:id/reviews` | — | 向导评价列表 |
| `POST` | `/api/guides/:id/review` | 🔐 JWT | 提交向导评价 `{ rating, content }` |
| `GET` | `/api/guides/:id/posts` | — | 向导发布的帖子 |
| `GET` | `/api/guides/:id/photos` | — | 向导相册 |
| `GET` | `/api/guides/me` | 🔐 JWT | 查看自己的向导申请状态 |
| `PUT` | `/api/guides/me` | 🔐 JWT | 更新向导资料（仅 pending 状态）|
| `GET` | `/api/guides/my/profile` | 🔐 JWT | 获取向导详细资料 |
| `PUT` | `/api/guides/my/profile` | 🔐 JWT | 更新向导详细资料 |
| `POST` | `/api/guides/apply` | 🔐 JWT | 提交向导入驻申请 `{ name, cert, specialty, languages, dayRate, region }` |
| `POST` | `/api/guides/payment` | 🔐 JWT | 向导入驻费支付 |

---

## 俱乐部 `/api/clubs`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/clubs` | — | 俱乐部列表（分页）|
| `GET` | `/api/clubs/featured` | — | 精选俱乐部 |
| `GET` | `/api/clubs/:id` | — | 俱乐部详情 |
| `GET` | `/api/clubs/:id/activities` | — | 俱乐部活动列表 |
| `GET` | `/api/clubs/:id/members` | — | 俱乐部成员列表 |
| `GET` | `/api/clubs/:id/reviews` | — | 俱乐部评价列表 |
| `GET` | `/api/clubs/:id/posts` | — | 俱乐部帖子 |
| `POST` | `/api/clubs/:id/review` | 🔐 JWT | 提交俱乐部评价 |
| `POST` | `/api/clubs/:id/activity` | 🔐 JWT | 发布俱乐部活动 |
| `PUT` | `/api/clubs/:id/activity/:actId` | 🔐 JWT | 更新俱乐部活动 |
| `DELETE` | `/api/clubs/:id/activity/:actId` | 🔐 JWT | 删除俱乐部活动 |
| `GET` | `/api/clubs/:id/members/:userId` | 🔐 JWT | 查看成员信息 |
| `POST` | `/api/clubs/:id/join` | 🔐 JWT | 加入俱乐部 |
| `DELETE` | `/api/clubs/:id/join` | 🔐 JWT | 退出俱乐部 |
| `POST` | `/api/clubs` | 🔐 JWT | 创建俱乐部 |
| `PUT` | `/api/clubs/:id` | 🔐 JWT | 更新俱乐部（管理员/创建者）|
| `GET` | `/api/clubs/me` | 🔐 JWT | 查看我的俱乐部 |
| `PUT` | `/api/clubs/me` | 🔐 JWT | 更新我的俱乐部资料 |
| `POST` | `/api/clubs/apply` | 🔐 JWT | 提交俱乐部入驻申请 |
| `GET` | `/api/clubs/apply/status` | 🔐 JWT | 查询我的入驻申请状态 |

---

## 轨迹 `/api/tracks`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/tracks` | 🔐 JWT | 轨迹列表，支持 `?user_id=` 过滤 |
| `GET` | `/api/tracks/my` | 🔐 JWT | 我的轨迹列表 |
| `GET` | `/api/tracks/:id` | 🔐 JWT | 轨迹详情（含 points WGS84 坐标数组）|
| `POST` | `/api/tracks` | 🔐 JWT | 保存轨迹 `{ name, points: [{lat,lng,ele,ts}], distance, elevation_gain, duration }` |
| `DELETE` | `/api/tracks/:id` | 🔐 JWT | 删除轨迹（仅作者）|
| `GET` | `/api/tracks/:id/export` | — | 导出 GPX/KML 文件，`?format=gpx\|kml`（公开轨迹无需鉴权，私有轨迹需 JWT，有速率限制）|

---

## 商业攀登 `/api/expeditions`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/expeditions` | — | 已发布远征列表，支持 `?status=published&peak_id=&publisher_type=` |
| `GET` | `/api/expeditions/:id` | — | 远征详情 |
| `POST` | `/api/expeditions` | 🔐 JWT | 发布远征（已审核向导/俱乐部）|
| `PUT` | `/api/expeditions/:id` | 🔐 JWT | 修改远征（仅 pending 状态，发布者）|
| `GET` | `/api/expeditions/orders/my` | 🔐 JWT | 我的订单列表 |
| `POST` | `/api/expeditions/:id/order` | 🔐 JWT | 用户下单 `{ participants, contact_name, contact_phone }` |
| `POST` | `/api/expeditions/orders/:id/mock-pay` | 🔐 JWT | 模拟支付（内测，TODO: B2 阶段替换为真实支付）|

---

## 文章 `/api/articles`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/articles` | — | 文章列表，支持 `?category=expedition\|technical\|hiking\|gear` |
| `GET` | `/api/articles/featured` | — | 精选文章 |
| `GET` | `/api/articles/:id` | — | 文章详情 |
| `POST` | `/api/articles` | 🔐 JWT | 发布文章 |
| `POST` | `/api/articles/:id/like` | 🔐 JWT | 点赞文章 |

---

## 个人资料 `/api/profile`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/profile/medical` | 🔐 JWT | 获取医疗信息 |
| `PUT` | `/api/profile/medical` | 🔐 JWT | 更新医疗信息 `{ blood_type, allergies, health_notes }` |
| `GET` | `/api/profile/emergency-contacts` | 🔐 JWT | 获取紧急联系人列表 |
| `POST` | `/api/profile/emergency-contacts` | 🔐 JWT | 添加紧急联系人 `{ name, phone, relationship }` |
| `DELETE` | `/api/profile/emergency-contacts/:id` | 🔐 JWT | 删除紧急联系人 |
| `GET` | `/api/profile/gear-checklist` | 🔐 JWT | 获取装备清单 |
| `POST` | `/api/profile/gear-checklist` | 🔐 JWT | 添加装备清单项 |
| `PUT` | `/api/profile/gear-checklist/:id` | 🔐 JWT | 更新装备清单项（勾选/取消）|
| `GET` | `/api/profile/favorites` | 🔐 JWT | 获取收藏列表 |
| `POST` | `/api/profile/favorites` | 🔐 JWT | 添加收藏 `{ type, target_id }` |
| `DELETE` | `/api/profile/favorites/:id` | 🔐 JWT | 删除收藏 |

---

## 定制攀登 `/api/customs`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/customs` | 🔐 JWT | 提交定制攀登申请 |
| `GET` | `/api/customs` | 🔐 JWT | 获取我的定制申请列表 |
| `GET` | `/api/customs/:id` | 🔐 JWT | 获取定制申请详情 |
| `PUT` | `/api/customs/:id/cancel` | 🔐 JWT | 取消定制申请 |
| `GET` | `/api/customs/admin/all` | 🔐 JWT（管理员）| 管理员查看所有定制申请 |

---

## 救援 `/api/rescue`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/rescue/contacts` | — | 获取救援联系方式列表 |
| `POST` | `/api/rescue/sos` | 🔐 JWT | 发送 SOS 求救记录 `{ location, peak_name, message }` |
| `GET` | `/api/rescue/sos/history` | 🔐 JWT | 获取当前用户的 SOS 记录历史 |

---

## 保险 `/api/insurance`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/insurance` | — | 获取保险产品列表（预留）|

---

## 社区帖子 `/api/posts`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/posts` | — | 帖子列表（含 `images` 字段）|
| `POST` | `/api/posts` | 🔐 JWT | 发布帖子 `{ content, images }` |
| `POST` | `/api/posts/:id/like` | 🔐 JWT | 帖子点赞/取消点赞 |

---

## 评论 `/api/comments`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/comments` | — | 评论列表，`?post_id=` |
| `POST` | `/api/comments` | 🔐 JWT | 发表评论 `{ post_id, content, images }`（允许纯图片评论）|

---

## 私信 `/api/messages`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/messages/conversations` | 🔐 JWT | 获取会话列表 |
| `POST` | `/api/messages/conversations` | 🔐 JWT | 创建或获取与某用户的会话 `{ user_id }` |
| `GET` | `/api/messages/conversations/:id/messages` | 🔐 JWT | 获取会话消息列表（含 `type` 和 `images` 字段）|
| `POST` | `/api/messages/conversations/:id/messages` | 🔐 JWT | 发送消息 `{ content, type, images }`（限流 30 次/分钟）|

---

## 关注 `/api/follows`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/follows` | 🔐 JWT | 关注用户 `{ followee_id }` |
| `DELETE` | `/api/follows` | 🔐 JWT | 取消关注 `{ followee_id }` |

---

## 通知 `/api/notifications`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/notifications` | 🔐 JWT | 获取通知列表 |
| `PUT` | `/api/notifications/:id/read` | 🔐 JWT | 标记通知已读 |
| `PUT` | `/api/notifications/read-all` | 🔐 JWT | 全部标为已读 |

---

## 装备市场 `/api/gear`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/gear` | — | 装备列表，`?mode=buy\|sell\|rent&category=` |
| `POST` | `/api/gear` | 🔐 JWT | 发布装备 `{ name, brand, price, condition, image, description, mode, category }` |

---

## 登顶榜 `/api/leaderboard`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/leaderboard` | — | 全时登顶榜 |
| `GET` | `/api/leaderboard/monthly` | — | 月度登顶榜 |

---

## Banner `/api/banners`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/banners` | — | 获取首页 Banner 列表 |

---

## 支付 `/api/pay`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/pay/create` | — | 创建支付订单 `{ amount, method }` |
| `GET` | `/api/pay/status/:orderNo` | — | 查询订单状态 |

---

## 预约 `/api/bookings`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/bookings` | 🔐 JWT | 创建预约 `{ type, peak_name, route_id, club_id, guide_id, date, people, price, notes }` |
| `GET` | `/api/bookings` | 🔐 JWT | 用户预约列表 |

---

## 用户 `/api/users`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/users/:id/achievements` | 🔐 JWT | 用户成就 |
| `GET` | `/api/users/:id/membership` | 🔐 JWT | 会员信息 |
| `GET` | `/api/users/:id/summits` | — | 登顶记录 |
| `GET` | `/api/users/:id/expeditions` | — | 远征记录 |
| `GET` | `/api/users/:id/followers` | — | 粉丝列表 |
| `GET` | `/api/users/:id/following` | — | 关注列表 |

---

## 攀登线路 `/api/routes`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/routes` | — | 所有线路列表 |
| `GET` | `/api/routes/:id` | — | 线路详情 |
| `GET` | `/api/routes/:id/clubs` | — | 该线路下的所有报价俱乐部（含俱乐部信息 + 报价）|
| `POST` | `/api/routes` | 🔑 Admin | 创建线路 |
| `PUT` | `/api/routes/:id` | 🔑 Admin | 更新线路 |
| `DELETE` | `/api/routes/:id` | 🔑 Admin | 删除线路 |
| `POST` | `/api/routes/pricing` | 🔑 Admin | 设置俱乐部-线路报价 |

---

## 队伍 `/api/teams`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/teams` | — | 队伍列表 |
| `GET` | `/api/teams/:id` | — | 队伍详情 |
| `POST` | `/api/teams` | 🔐 JWT | 创建队伍 |
| `POST` | `/api/teams/:id/join` | 🔐 JWT | 加入队伍 |
| `DELETE` | `/api/teams/:id/leave` | 🔐 JWT | 离开队伍 |

---

## 文件上传 `/api/upload`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/upload` | 🔐 JWT | 单图上传（multipart/form-data, field: `file`）最大 5MB，限流 20 次/分钟 |
| `POST` | `/api/upload/multiple` | 🔐 JWT | 多图上传，最多 9 张，每张最大 5MB，限流 20 次/分钟 |

---

## 管理后台 `/api/admin`

> 所有接口（除 `/login`）均需管理员 JWT token。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/login` | 管理员登录 `{ username, password }`（限流 10 次/15 分钟）|
| `GET` | `/api/admin/stats` | 平台统计数据 |
| `GET` | `/api/admin/users` | 用户列表（支持搜索）|
| `PUT` | `/api/admin/users/:id/ban` | 封禁/解封用户 |
| `GET` | `/api/admin/posts` | 帖子列表（含待审核）|
| `PUT` | `/api/admin/posts/:id/approve` | 通过帖子审核 |
| `PUT` | `/api/admin/posts/:id/reject` | 拒绝帖子 |
| `GET` | `/api/admin/guides` | 向导申请列表，`?status=pending\|approved\|rejected` |
| `PUT` | `/api/admin/guides/:id/approve` | 审核通过向导申请 |
| `PUT` | `/api/admin/guides/:id/reject` | 拒绝向导申请 `{ reason }` |
| `PUT` | `/api/admin/guides/:id/config` | 设置向导抽成/入驻费 `{ commission_rate, listing_fee_paid }` |
| `GET` | `/api/admin/clubs` | 俱乐部列表 |
| `PUT` | `/api/admin/clubs/:id/verify` | 切换俱乐部认证状态 |
| `PUT` | `/api/admin/clubs/:id/config` | 设置俱乐部抽成/入驻费 |
| `GET` | `/api/admin/club-applications` | 俱乐部申请列表，`?status=pending\|approved\|rejected` |
| `POST` | `/api/admin/club-applications/:id/approve` | 通过俱乐部申请 |
| `POST` | `/api/admin/club-applications/:id/reject` | 拒绝俱乐部申请 `{ reason }` |
| `GET` | `/api/admin/club-activities` | 俱乐部活动列表 |
| `PUT` | `/api/admin/club-activities/:id/end` | 结束俱乐部活动 |
| `DELETE` | `/api/admin/club-activities/:id` | 删除俱乐部活动 |
| `GET` | `/api/admin/orders` | 订单列表 |
| `GET` | `/api/admin/bookings` | 预约列表 |
| `PUT` | `/api/admin/bookings/:id/status` | 更新预约状态 |
| `GET` | `/api/admin/gear` | 装备列表 |
| `DELETE` | `/api/admin/gear/:id` | 删除装备 |
| `GET` | `/api/admin/expeditions` | 商业攀登列表，`?status=pending` |
| `POST` | `/api/admin/expeditions/:id/approve` | 审核通过商业攀登 |
| `POST` | `/api/admin/expeditions/:id/reject` | 拒绝商业攀登 `{ reason }` |
| `GET` | `/api/admin/guide-expeditions` | 向导商业攀登列表 |
| `GET` | `/api/admin/reviews` | 评价列表 |
| `DELETE` | `/api/admin/reviews/:id` | 删除评价 |
| `GET` | `/api/admin/sms-codes` | 查看近 50 条验证码（**仅内测用，正式版移除**）|

---

## 系统 `/api/health`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/health` | — | 健康检查，返回 `{ status, uptime, version }` |

---

## 向导服务 `/api/guides/:guideId/services`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/guides/:guideId/services` | — | 向导服务列表（公开；向导本人可见已删除项）|
| `POST` | `/api/guides/:guideId/services` | �� JWT | 发布新服务 `{ title, type, mountain, region, price, price_unit, duration_days, max_clients, difficulty, description }` |
| `PUT` | `/api/guides/:guideId/services/:id` | 🔐 JWT | 更新服务信息 |
| `DELETE` | `/api/guides/:guideId/services/:id` | 🔐 JWT | 软删服务（status=deleted）|
| `POST` | `/api/guides/:guideId/services/:id/book` | 🔐 JWT | 预约向导服务 `{ emergency_contact_name, emergency_contact_phone, agreed_waiver, waiver_version, notes }` → 返回 `{ order_no, order }` |
| `GET` | `/api/guides/:guideId/services/:id/bookings` | 🔐 JWT | 向导查看该服务的预约列表（需为向导本人）|

> **价目说明：** `price_unit` 支持 `per_day`、`per_person`、`per_session`。付费服务需向导通过商业资质认证（`commercial_verified=1`），否则返回 `422 { error: "commercial_not_verified" }`。

---

## 向导服务订单 `/api/guide-service-orders`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/guide-service-orders/my` | 🔐 JWT | 当前用户的向导服务订单列表（含关联 guide_services、guides）|
| `POST` | `/api/guide-service-orders/:id/pay` | 🔐 JWT | 模拟支付（`pending_payment → paid`）|
| `POST` | `/api/guide-service-orders/:id/cancel` | 🔐 JWT | 取消订单 |
| `POST` | `/api/guide-service-orders/:id/refund-request` | 🔐 JWT | 申请退款 `{ reason }` |

---

## 俱乐部活动报名 `/api/clubs/:clubId/activities/:actId`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/clubs/:clubId/activities/:actId/enroll` | 🔐 JWT | 报名俱乐部活动 `{ emergency_contact_name, emergency_contact_phone, agreed_waiver, waiver_version }` → 返回 `{ order_no, order }` |
| `GET` | `/api/clubs/:clubId/activities/:actId/enrollments` | 🔐 JWT | 查看报名用户列表（需为俱乐部创始人）|

---

## 俱乐部活动订单 `/api/activity-orders`

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `GET` | `/api/activity-orders/my` | 🔐 JWT | 当前用户的活动订单列表（含关联 club_activities、clubs）|
| `POST` | `/api/activity-orders/:id/pay` | 🔐 JWT | 模拟支付（`pending_payment → paid`）|
| `POST` | `/api/activity-orders/:id/cancel` | 🔐 JWT | 取消订单 |
| `POST` | `/api/activity-orders/:id/refund-request` | �� JWT | 申请退款 `{ reason }` |

---

## 商业资质申请

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/guides/:id/commercial-apply` | 🔐 JWT | 向导提交商业资质申请 `{ business_license_url, business_license_no, insurance_cert_url, bank_account_name, bank_account_no, bank_name }`（仅限向导本人）|
| `POST` | `/api/clubs/:id/commercial-apply` | 🔐 JWT | 俱乐部提交商业资质申请（仅限创始人）|
| `GET` | `/api/admin/guides/commercial` | 🔑 Admin | 向导商业资质申请列表（分页 `?page=1&limit=20`）|
| `POST` | `/api/admin/guides/:id/commercial-review` | 🔑 Admin | 审核向导商业资质 `{ action: "approve"/"reject"/"need_info", note }` |
| `GET` | `/api/admin/clubs/commercial` | 🔑 Admin | 俱乐部商业资质申请列表 |
| `POST` | `/api/admin/clubs/:id/commercial-review` | 🔑 Admin | 审核俱乐部商业资质 |
