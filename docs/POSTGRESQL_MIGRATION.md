# PostgreSQL 迁移指南（Phase 1）

> **文档创建日期**：2026-04-27
> **适用版本**：AlpineLink B1-Alpha 及以上

---

## 概述

AlpineLink 当前使用 SQLite（`better-sqlite3` + Prisma），适合开发环境。
生产环境需迁移至 PostgreSQL（Railway PostgreSQL 服务）以解决：
- SQLite 并发写入瓶颈（10 并发即卡顿，出现 `SQLITE_BUSY`）
- SQLite 是**投资人融资尽调红线**

本指南描述从 SQLite 到 PostgreSQL 的完整迁移流程。

---

## 迁移步骤

### Step 1: Railway 开通 PostgreSQL 服务

1. 在 Railway 项目中点击 **"Add Service"** → **"Database"** → **"PostgreSQL"**
2. 等待服务启动（约 30 秒）
3. 点击 PostgreSQL 服务 → **"Variables"** 面板，复制 `DATABASE_URL`
   - 格式：`postgresql://postgres:<password>@<host>:5432/<db_name>`

### Step 2: 修改环境变量

在 Railway 项目的 **Variables** 面板（backend 服务）中设置：

```
DATABASE_PROVIDER=postgresql
DATABASE_URL=<Railway PostgreSQL 提供的 URL>
```

> ⚠️ 同时确认 `DATABASE_PATH` 变量可保留（仅供 `better-sqlite3` 开发环境使用，PostgreSQL 模式下不影响）

### Step 3: 运行 Prisma 迁移

```bash
cd backend
node scripts/generate-prisma-client.js --push
```

> 说明：`generate-prisma-client.js` 会根据 `DATABASE_PROVIDER` 环境变量自动调整 Prisma schema 中的 provider，然后运行 `prisma generate` 和 `prisma db push`，操作完成后自动还原 schema 文件。
>
> 若需分步执行：
> ```bash
> node scripts/generate-prisma-client.js   # 仅生成 Prisma Client
> DATABASE_PROVIDER=postgresql DATABASE_URL=<pg_url> npx prisma db push --schema=prisma/schema.prisma
> ```

### Step 4: 数据迁移（从 SQLite 导出）

```bash
# 导出 SQLite 数据（在 backend 目录中运行）
cd backend
node ../scripts/export-sqlite.js > ../backup-$(date +%Y%m%d).json

# 检查导出内容
cat backup-*.json | head -50

# 导入到 PostgreSQL（数据导入脚本待补充，Phase 1.2）
# node scripts/import-postgres.js < backup.json
```

> 注意：`export-sqlite.js` 导出的是原始 SQLite 数据（包含 Prisma 内部表）。
> 导入脚本需在 Step 3 完成（Prisma 创建表结构）后执行。

### Step 5: 验证

部署后执行以下验收测试：

- **健康检查**：`GET /api/health` → 应返回 `{ status: "ok" }`
- **登录测试**：POST `/api/auth/login` 使用测试账号
- **发帖/评论**：创建帖子并评论，验证写入成功
- **轨迹保存**：上传一条 GPS 轨迹，验证保存和读取
- **向导预约**：提交预约请求，验证订单创建

---

## 已知需要手动修复的 SQLite 专有语法

在 PostgreSQL 迁移时，以下代码需要额外处理：

| 文件 | 问题 | PostgreSQL 替代方案 |
|------|------|-------------------|
| `backend/routes/routes.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/admin.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/tracks.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/expeditions.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/bookings.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/messages.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/teams.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/pay.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/chat.gateway.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/groupChats.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/clubConsole.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/routes/insurance.js` | `last_insert_rowid()` | 改用 `RETURNING id` 语法 |
| `backend/db/database.js` | `better-sqlite3` 同步 API | 仅用于开发，保持现状 |
| `backend/db/seed.js` | `better-sqlite3` 同步 API | 仅用于开发，保持现状 |

所有 `last_insert_rowid()` 处均已标注 `TODO(Phase1-PG)` 注释，可通过以下命令快速定位：

```bash
grep -rn "TODO(Phase1-PG)" backend/routes/
```

### `last_insert_rowid()` 替换示例

```javascript
// SQLite（当前）：
await prisma.$executeRaw`INSERT INTO table_name (col1, col2) VALUES (${val1}, ${val2})`;
const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
const newId = Number(idRow.id);

// PostgreSQL（迁移后）：
const [{ id: newId }] = await prisma.$queryRaw`
  INSERT INTO table_name (col1, col2) VALUES (${val1}, ${val2}) RETURNING id
`;
```

---

## Schema 变化注意事项

### TEXT JSON → JSONB（建议，非强制）

SQLite 将 JSON 数据存储为 `TEXT`，PostgreSQL 支持原生 `JSONB` 类型（更高效，支持索引）。

影响字段：
- `tracks.points`（GPS 坐标数组）
- `expeditions.addons`、`itinerary`、`included`、`excluded`
- `expedition_orders.participants`、`addons`
- `teams.equipment_required`

迁移时可选择保留 `TEXT` 类型（Prisma `String` 映射）或改为 `Json` 类型（Prisma PostgreSQL 支持 `Json`/`Jsonb`）。

### INTEGER 自增主键

SQLite 使用 `INTEGER PRIMARY KEY AUTOINCREMENT`，PostgreSQL 等效为 `SERIAL` 或 `BIGSERIAL`。
Prisma `@id @default(autoincrement())` 在 PostgreSQL 上会自动生成 `SERIAL`，无需手动修改。

---

## 回滚方案

若迁移后出现问题，可快速回滚：

1. 在 Railway Variables 面板将以下变量改回 SQLite 配置：
   ```
   DATABASE_PROVIDER=sqlite
   DATABASE_URL=file:./dev.db
   DATABASE_PATH=/data/summitlink.db
   ```
2. 重新部署 backend 服务
3. SQLite 数据文件仍在 Railway Volume 中，数据不会丢失

> ⚠️ 注意：回滚后，PostgreSQL 期间写入的数据**不会**同步回 SQLite。如有重要数据，需手动导出并导入。

---

## 常见问题

**Q: `prisma db push` 报错 "column already exists"？**
A: PostgreSQL 不支持 `CREATE TABLE IF NOT EXISTS` 中的 `OR REPLACE`，但 Prisma 会自动处理。若报错，尝试 `npx prisma migrate reset --force`（⚠️ 会清空数据）。

**Q: `last_insert_rowid()` 在 PostgreSQL 上报错？**
A: 是的，这是 SQLite 专有函数。需替换为 `RETURNING id` 语法（见上文替换示例）。所有位置已标注 `TODO(Phase1-PG)`。

**Q: Railway PostgreSQL 免费额度？**
A: Railway PostgreSQL 无永久免费层。按实际使用量计费（存储 $0.25/GB/月，计算按使用时长计费）。小项目月费约 $5~15。
