# AlpineLink — Prisma 数据库设计说明

> **方案A（全新重建）**：抛弃原有 better-sqlite3 + 原生 SQL，改用 **Prisma ORM + PostgreSQL**（Railway 托管）。

---

## 目录

1. [快速开始](#快速开始)
2. [模块划分](#模块划分)
3. [ER 关系图（文字版）](#er-关系图文字版)
4. [各表字段说明](#各表字段说明)
5. [索引策略](#索引策略)
6. [迁移步骤](#迁移步骤)

---

## 快速开始

```bash
# 1. 安装依赖
npm install prisma @prisma/client

# 2. 初始化（已有 schema.prisma 则跳过）
npx prisma init

# 3. 配置 .env
echo 'DATABASE_URL="postgresql://user:pass@host:5432/alpinelink"' >> .env

# 4. 推送 schema 到数据库（开发/方案A）
npx prisma db push

# 5. 生成 Prisma Client
npx prisma generate

# 6. 查看数据库（可选）
npx prisma studio
```

---

## 模块划分

| 模块 | 包含的表 |
|------|---------|
| **用户与认证** | `users`, `sms_codes` |
| **山峰与路线** | `peaks`, `climbing_routes` |
| **动态/帖子** | `posts`, `likes`, `comments`, `comment_likes` |
| **向导** | `guides`, `guide_applications`, `guide_expeditions`, `guide_posts`, `guide_photos`, `guide_services` |
| **俱乐部** | `clubs`, `club_members`, `club_applications`, `club_activities`, `club_posts`, `club_photos`, `club_route_pricing` |
| **组队/活动** | `teams`, `team_members` |
| **聊天** | `conversations`, `messages` |
| **预约/订单** | `bookings`, `orders`, `custom_orders`, `expedition_orders`, `activity_orders` |
| **商业远征** | `expeditions` |
| **装备** | `gear`, `gear_checklist`, `smart_gear_lists` |
| **轨迹/记录** | `tracks`, `summit_records`, `user_summits`, `user_expeditions` |
| **离线远征日志** | `user_expeditions_log`, `expedition_moments`, `expedition_subscribers` |
| **SOS/救援** | `sos_records`, `rescue_contacts` |
| **健康信息** | `medical_info`, `emergency_contacts` |
| **AI教练/成就** | `coach_assessments`, `user_achievements` |
| **保险** | `insurance_plans`, `insurance_inquiries` |
| **内容** | `articles`, `banners` |
| **社交/通知** | `follows`, `notifications`, `favorites` |
| **评价** | `reviews` |
| **管理** | `peak_suggestions`, `moderation_logs` |

---

## ER 关系图（文字版）

```
User (1) ─────────────────────────────────────────────────────────────────────
  │ 1:N  ──► Post ──► Like (N:M User↔Post via likes)
  │           └──► Comment (自引用 parent_id, N:M User↔Comment via comment_likes)
  │
  │ 1:1  ──► Guide ──► Booking (N)
  │           ├──► GuideExpedition (N)
  │           ├──► GuidePost (N)
  │           ├──► GuidePhoto (N)
  │           ├──► GuideService (N)
  │           └──► Review (N, targetType="guide")
  │
  │ 1:1  ──► GuideApplication
  │
  │ 1:N  ──► Club (creator)
  │           ├──► ClubMember (N:M User↔Club)
  │           ├──► ClubApplication (N)
  │           ├──► ClubActivity (N)
  │           ├──► ClubPost (N)
  │           ├──► ClubPhoto (N)
  │           ├──► ClubRoutePricing (N) ──► ClimbingRoute ──► Peak
  │           └──► Review (N, targetType="club")
  │
  │ N:M  ──► Team (via TeamMember) ── leader → User
  │
  │ 1:N  ──► Conversation (user1/user2) ──► Message (sender)
  │
  │ N:M  ──► Follow (follower_id / following_id)
  │
  │ 1:N  ──► UserExpeditionLog ──► ExpeditionMoment
  │                              └──► ExpeditionSubscriber (N:M User)
  │
  │ 1:N  ──► SosRecord
  │ 1:1  ──► MedicalInfo
  │ 1:N  ──► EmergencyContact
  │ 1:1  ──► CoachAssessment
  │ 1:N  ──► UserAchievement
  └──────────────────────────────────────────────────────────────────────────

Peak (1)
  ├── 1:N ──► ClimbingRoute
  ├── 1:N ──► UserExpeditionLog
  ├── 1:N ──► UserSummit
  ├── 1:N ──► UserExpedition
  ├── 1:N ──► SmartGearList
  ├── 1:N ──► GuideExpedition
  └── 1:N ──► PeakSuggestion

Expedition (1)
  └── 1:N ──► ExpeditionOrder ──► User

InsurancePlan (1)
  └── 1:N ──► InsuranceInquiry ──► User
```

---

## 各表字段说明

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int PK | 自增主键 |
| name | String | 昵称（必填） |
| username | String? unique | 用户名 |
| phone | String? unique | 手机号（登录用） |
| password | String? | bcrypt 哈希，SMS 登录用户为空 |
| avatar | String? | 头像 URL |
| level | String | 攀登等级，默认"初级攀登者" |
| isAdmin | Boolean | 是否管理员 |
| isBanned | Boolean | 是否封禁 |

### sms_codes

| 字段 | 类型 | 说明 |
|------|------|------|
| phone | String | 发送目标手机号 |
| code | String | 6位验证码 |
| purpose | String | "login" / "register" / "reset" |
| expiresAt | DateTime | 过期时间（通常 +5min） |
| used | Boolean | 是否已使用 |

> **业务规则**：同一手机号 60 秒内只能发一次（业务层控制，不在 DB 层加唯一索引）。

### peaks

山峰静态数据，由管理员维护。`type` 字段值：`"commercial"` / `"expedition"` / `"training"`。

### climbing_routes

隶属于某一山峰的路线，向导和俱乐部可挂载定价（`club_route_pricing`）。

### posts / likes / comments / comment_likes

社区动态。`comments` 表支持嵌套回复（`parent_id` 自引用）。

### guides / guide_applications

向导先提交 `guide_applications`，管理员审核通过后在 `guides` 表建档（`status='approved'`）。

### clubs

`commissionRate`：平台抽佣比例（默认 15%）。`verified`：是否经过商业资质审核。

### conversations / messages

私信系统。`user1_id < user2_id` 约定（业务层保证），避免重复会话。

### user_expeditions_log / expedition_moments

离线远征日志，`client_uuid` 保证离线同步幂等性。

### sos_records

SOS 求救记录，`userId` 可为空（游客 SOS）。

### reviews

统一评价表，通过 `targetType`（`"guide"` / `"club"` / `"peak"`）区分被评对象。

---

## 索引策略

| 表 | 索引字段 | 原因 |
|----|---------|------|
| users | phone, username | 登录查询 |
| sms_codes | phone | 验证码查询 |
| posts | user_id | 个人主页帖子列表 |
| comments | post_id | 帖子评论列表 |
| messages | conversation_id | 消息历史 |
| notifications | user_id | 通知列表 |
| user_expeditions_log | user_id | 用户远征列表 |
| expedition_moments | expedition_id | 远征时间线 |
| reviews | (target_type, target_id) | 指定对象评价列表 |

所有 `@unique` 字段自动建索引，所有 `@relation` 外键字段 Prisma 自动建索引（PostgreSQL）。

---

## 迁移步骤

### 方案A — 全新建库（推荐，Railway 新 DB 实例）

```bash
# 1. 在 Railway 创建新的 PostgreSQL 服务，获取 DATABASE_URL
# 2. 本地 .env 配置 DATABASE_URL
# 3. 推送 schema
npx prisma db push

# 4. 运行种子数据（峰值、测试账号等）
SEED_ON_START=true node backend/db/seed.js
```

### 替换应用层数据库调用

迁移后，`backend/db/database.js` 的原生 SQL 查询逐步替换为 Prisma Client 调用：

```js
// 旧
const users = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// 新
const user = await prisma.user.findUnique({ where: { id } });
```

> **推荐顺序**：按模块逐个替换，每个模块替换后运行对应测试用例。
