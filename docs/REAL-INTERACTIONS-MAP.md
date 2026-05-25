# Real Interactions Map — 每个可点击元素完整追踪

> 本文档描述每个可点击元素 → 触发的 API → 写入的表 → 谁能看到

---

## 导航 & 底部 Tab

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 底部 Tab: 首页 | 无（切换页面） | — | 本人 |
| 底部 Tab: 探索 | GET /api/peaks | — | 所有人 |
| 底部 Tab: 聊天 | GET /api/messages/conversations | — | 本人 |
| 底部 Tab: 装备 | GET /api/gear | — | 所有人 |
| 底部 Tab: 我的 | GET /api/auth/me | — | 本人 |

---

## 首页 (Home)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 轮播 Banner 点击 | 根据 link_type 跳转山峰/页面/文章 | — | 跳转目标 |
| 八千米山峰卡片 | 打开 PeakDetail modal (本地) | — | 本人 |
| 向导卡片 | GET /api/guides/:id | — | 本人 |
| 队伍卡片 | 打开 TeamDetail modal | — | 本人 |
| "查看全部"按钮 | 切换到探索页对应 tab | — | 本人 |

---

## 探索页 (Explore)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 山峰分类 Tab | GET /api/peaks?type=... | — | 所有人 |
| 山峰详情卡片 | 打开 PeakDetail modal | — | 本人 |
| 向导筛选 | GET /api/guides?... | — | 所有人 |
| 向导头像 | openGuideProfile() → GET /api/guides/:id | — | 本人 |
| 预约向导 | 打开 BookingModal | — | 本人 |
| 搜索框 | GET /api/search?q=...&type=all | — | 本人 |
| 俱乐部卡片 | GET /api/clubs/:id | — | 本人 |
| 加入俱乐部 | POST /api/clubs/:id/join | club_members | 俱乐部成员 |

---

## 聊天页 (Chat)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 会话列表项 | 打开聊天窗口 | — | 双方 |
| 发送文字消息 | POST /api/messages | messages | 收件人 |
| 发送图片消息 | POST /api/upload + POST /api/messages | messages, uploads | 收件人 |
| 发送位置消息 | geolocation + POST /api/messages (type='location') | messages | 收件人 |
| 发送 SOS 消息 | POST /api/sos | sos_records | 救援人员 |
| "+" 按钮 → 图片 | 图片选择器 → POST /api/upload | uploads | — |
| "+" 按钮 → 位置 | geolocation → message type=location | messages | 收件人 |
| 聊天记录滚动到底 | GET /api/messages?page=2 | — | 双方 |
| 用户头像 | openUserProfile() | — | 本人 |
| 广场 Tab | GET /api/posts | — | 所有人 |
| 发布按钮 | POST /api/posts | posts | 关注者 + 广场 |

---

## 社区广场 (Community)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 帖子列表 | GET /api/posts | — | 所有人 |
| 作者头像/名字 | openUserProfile() → GET /api/users/:id | — | 本人 |
| 关注按钮 (帖子上) | POST /api/follows | follows | 被关注者粉丝数 |
| ❤️ 点赞 | POST /api/posts/:id/like | post_likes | 发帖人（点赞数） |
| 💬 评论 | GET /api/comments?post_id= | — | 所有人 |
| 评论提交 | POST /api/comments | comments | 所有人 |
| "@用户" 评论 | POST /api/comments | comments + notifications | 被@用户 |
| 📤 分享 | navigator.share / clipboard | — | — |
| 新动态红点 | Socket.IO new_post 或 60s 轮询 | — | 关注者 |
| "X 条新动态" 点击 | GET /api/posts (刷新) | — | 本人 |

---

## 我的 (Me)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 编辑资料 | PUT /api/auth/profile | users | 本人 |
| 修改密码 | PUT /api/auth/change-password | users | 本人 |
| 下载电子护照 | GET /api/user/:id/passport.pdf | users.passport_uuid | 本人 |
| 设置 → 账号 | PUT /api/auth/profile | users | 本人 |
| 设置 → 隐私 | PUT /api/auth/privacy | users | 本人 |
| 设置 → 通知 | PUT /api/auth/settings | user_settings | 本人 |
| 设置 → 注销（冷静期） | POST /api/auth/request-deletion | users.deleted_at | 24h 后生效，可取消 |
| 设置 → 取消注销 | POST /api/auth/cancel-deletion | users.deleted_at = NULL | 仅冷静期内有效 |
| GDPR 数据导出 | GET /api/gdpr/export | — | 返回 JSON 附件 |
| GDPR 立即注销 | DELETE /api/gdpr/delete-account | users + 关联 PII 表 | 不可撤销 |
| 我的订单 | GET /api/expedition-orders?user_id=me | — | 本人 |
| 我的轨迹 | GET /api/tracks/my | — | 本人 |
| 轨迹详情 | GET /api/tracks/:id | — | 本人（非公开）/ 所有人（公开） |
| 下载 GPX | GET /api/tracks/:id/export?format=gpx | — | 同上 |
| 紧急联系人 | GET/POST/DELETE /api/emergency-contacts | emergency_contacts | 本人 |
| SOS 按钮 | openSOS() → geolocation → POST /api/sos | sos_records | 救援联系人 |
| 分享定位 | sendLocation() → POST /api/location-share | location_shares | 选定接收人 |

---

## SOS 页

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 页面打开 | navigator.geolocation.getCurrentPosition | — | — |
| 获取海拔 | GET /api/altitude?lat=&lng= | — | — |
| 发送 SOS | POST /api/sos | sos_records | 救援联系人 + 平台 |
| 拨打救援电话 | tel:{number} (移动端) / clipboard (PC) | — | — |
| 分享定位 | POST /api/location-share | location_shares | 接收人 |
| 联系人电话按钮 | tel:{phone} (移动端) / clipboard (PC) | — | — |

---

## 向导工作台 (/guide-console)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 工作台入口 | GET /api/guides/my-profile | — | 向导本人 |
| 订单列表 | GET /api/expedition-orders?guide_id=me | — | 向导本人 |
| 接单 | PUT /api/expedition-orders/:id/status → accepted | expedition_orders | 客户（收通知） |
| 拒单 | PUT /api/expedition-orders/:id/status → rejected | expedition_orders | 客户（收通知） |
| 联系客户 | POST /api/messages/conversations | conversations | 双方 |
| 发消息 | POST /api/messages | messages | 客户 |

---

## 俱乐部工作台 (/club-console)

| 元素 | 触发 API | 写入表 | 可见范围 |
|------|---------|-------|---------|
| 成员管理 | GET /api/clubs/:id/members | — | 管理员 |
| 移除成员 | DELETE /api/clubs/:id/members/:uid | club_members | 被移除者 |
| 发布活动 | POST /api/clubs/:id/activities | club_activities | 俱乐部成员 |
| 审核加入申请 | PUT /api/clubs/:id/applications/:id | club_members | 申请人 |

---

## 搜索 (/api/search)

| 参数 | 搜索范围 | 返回格式 |
|------|---------|--------|
| type=mountain | peaks 表：name, name_en, description | { type, id, name, altitude, image } |
| type=user | users 表：name, username, bio | { type, id, name, avatar, level } |
| type=post | posts 表：content | { type, id, content, authorName } |
| type=guide | guides 表：name, specialty, bio | { type, id, name, rating } |
| type=club | clubs 表：name, description | { type, id, name, members_count } |
| type=article | articles 表：title, content | { type, id, title } |
| type=all | 以上全部 | 按类型分组 |

---

## Socket.IO 事件

| 事件名 | 方向 | 触发时机 | 接收方 |
|-------|------|---------|-------|
| `chat_message` | Server→Client | 有新消息 | `user_{to_user_id}` |
| `typing` | Server→Client | 对方输入中 | `user_{to_user_id}` |
| `new_post` | Server→Client | 有新帖子 | 发帖人的关注者 |
| `new_order` | Server→Client | 客户下单 | `guide_{guide_id}` |
| `order_status` | Server→Client | 订单状态变更 | `user_{user_id}` |
| `sos_alert` | Server→Client | SOS 触发 | 平台管理员房间 |
| `unread_count` | Server→Client | 未读数变更 | `user_{id}` |
