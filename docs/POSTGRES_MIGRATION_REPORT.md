# PostgreSQL 正式迁移报告（SQLite → PostgreSQL）

> 适用范围：将生产 SQLite 数据库迁移到 Railway / 自托管 PostgreSQL，
> **保留 SQLite 作为回滚库**，不覆盖现有数据，使用 `prisma migrate deploy`
> 建表，禁止 `prisma db push --accept-data-loss`（仅空库初始化例外）。

---

## 0. 交付物清单

| 文件 | 作用 |
|---|---|
| `backend/scripts/pg-migrate-deploy.sh` | 一键编排：备份 → 生成 PG 基线 → `migrate deploy` → 数据迁移 → 校验 |
| `backend/scripts/migrate-sqlite-to-postgres.js` | 数据迁移脚本（SQLite→PG，类型自适应，不覆盖，序列修复） |
| `backend/scripts/verify-migration.js` | 数据校验脚本（逐表行数对比 + 唯一约束 + 主键序列） |
| 本文件 | 迁移报告 / 回滚方案 / 切换步骤 |

npm 快捷入口：`npm run db:pg:migrate`、`npm run db:pg:data`、`npm run db:pg:verify`。

---

## 1. 为什么不能直接 `prisma migrate deploy` 现有 migrations

`backend/prisma/migrations/` 中的历史迁移是 **SQLite 方言**
（`INTEGER ... AUTOINCREMENT`、`DATETIME`、`REAL`、`ADD COLUMN IF NOT EXISTS`），
无法直接部署到 PostgreSQL。

因此 `pg-migrate-deploy.sh` 在临时目录中，基于当前 `schema.prisma`
（datasource 临时切换为 `postgresql`）用 `prisma migrate diff --from-empty`
生成一份 **PostgreSQL 方言** 的基线迁移，再对空库执行 `prisma migrate deploy`。
这属于「全新空数据库初始化」，符合禁令例外条款；**全程不使用 `db push --accept-data-loss`**。

基线 DDL 已验证为标准 PG 方言（节选）：

```sql
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ...
);
```

---

## 2. 安全保证（对应迁移要求）

| 要求 | 实现 |
|---|---|
| 保留 SQLite 作为回滚库 | 源库**全程只读**（`better-sqlite3 { readonly:true }`）；迁移前复制 `summitlink_<ts>.db` + 导出 `.json` 双备份到 `backups/`。 |
| 不允许直接覆盖现有数据库 | 数据脚本在写入前逐表 `COUNT(*)`，**任一目标表非空即中止（退出码 2）**；`migrate deploy` 仅对空库建表。 |
| 使用 `prisma migrate deploy` | 由 `pg-migrate-deploy.sh` 步骤 3 执行。 |
| 禁止 `db push --accept-data-loss` | 全流程未使用；表结构一律走 `migrate deploy`。 |
| 迁移后不立即删除 SQLite，保留 ≥14 天 | 备份保留在 `backups/`，脚本输出显式提醒；清理需人工在 14 天后执行。 |
| 新写入先验证 PG 正常 | 见 §6 切换步骤——切换后先用校验脚本与冒烟确认 PG 读写正常，再放开流量。 |

---

## 3. 数据迁移脚本说明（`migrate-sqlite-to-postgres.js`）

- **来源**：`better-sqlite3` 只读逐表读取（自动排除 `sqlite_%` 与 `_prisma_%`）。
- **目标**：Prisma Client（PG），通过 `information_schema.columns` 自省每列真实类型。
- **类型自适应**：`BOOLEAN`（0/1→true/false）、`TIMESTAMP/DATE`（字符串/epoch→Date）、
  整型/数值、`JSON/JSONB` 分别正确转换；仅迁移源表与目标表**共有的列**。
- **外键顺序**：多轮重试，失败行（多因外键依赖未就绪）在后续轮次自动重插，
  无需手工维护拓扑顺序；最多 20 轮，仍失败则以退出码 3 报告明细。
- **自增序列修复**：导入后对整型自增 `id` 执行 `setval(pg_get_serial_sequence(...))`，
  非序列列（cuid / 业务码主键）自动跳过。

## 4. 数据校验脚本说明（`verify-migration.js`）

- 逐表 **SQLite 行数 vs PostgreSQL 行数** 对比。
- `users.username` / `users.phone` **唯一约束抽样**（distinct 计数一致）。
- 主键 **MAX(id)** 对比，确认序列已修复（`pgMax >= sqliteMax`）。
- 任一不一致 → 退出码 4（**禁止切换流量**）；可选 `JSON_OUT` 落盘结果。

---

## 5. 迁移前后行数对比（真实运行验证）

下表为本工具链对一份真实 SQLite 源库（按 `schema.prisma` 全量建表、含示例数据）
在**真实 PostgreSQL 16** 上端到端运行的输出节选——`migrate deploy` 建全部 74 张表、
数据迁移、校验全部通过：

```
  table                               sqlite    postgres  status
  ------------------------------------------------------------------
  peaks                                    2           2  OK
  users                                    3           3  OK
  ...(其余 72 张表 0 → 0，全部 OK)...
  ------------------------------------------------------------------
  TOTAL                                    5           5

  唯一约束抽样 users.username: sqlite distinct=3, postgres distinct=3 -> OK
  唯一约束抽样 users.phone:    sqlite distinct=3, postgres distinct=3 -> OK
  [verify] ✅ 校验通过：所有表行数一致、唯一约束与主键序列正常。
```

附加验证：
- 序列修复有效——迁移后向 PG 插入新用户，`id` 自增为 **4**（高于迁移最大 id=3，无主键冲突）。
- 防覆盖有效——对已填充的 PG 重跑数据脚本，**以退出码 2 中止**并列出非空表。

> 生产执行时，上表会被真实业务行数自动填充；请将本节替换为生产运行的实际输出，
> 并归档 `backups/verify_<ts>.json`。

---

## 6. 切换步骤（Cutover）

1. **冻结写入**：将后端置为维护/只读，停止对 SQLite 的写入。
2. **运行迁移**：
   ```bash
   DATABASE_URL="******HOST:5432/summitlink" \
   SQLITE_PATH=/data/summitlink.db \
   npm run db:pg:migrate
   ```
   该命令完成：备份 → 生成 PG 基线 → `migrate deploy` → 全文索引 → 数据迁移 → 校验。
3. **校验通过**后（退出码 0），切换应用环境变量：
   `DATABASE_PROVIDER=postgresql`、`DATABASE_URL=<PG>`，重启服务。
4. **新写入先验证 PG 正常**：
   - 冒烟核心读写（注册/登录、发帖、下单各一次）；
   - 再次 `npm run db:pg:verify` 复核行数与约束；
   - 观察日志无 Prisma 连接/约束错误后，再放开全量流量。
5. **保留 SQLite ≥14 天**：`backups/summitlink_<ts>.db` 与原 `/data/summitlink.db`
   均不得在 14 天内删除。

---

## 7. 回滚方案

- **即时回滚（秒级）**：源库全程只读、未变更。将应用环境变量改回
  `DATABASE_PROVIDER=sqlite`、`DATABASE_URL=file:/data/summitlink.db` 并重启即可恢复。
- **数据回滚**：若 PG 数据异常，丢弃 PG 库数据，回退至 SQLite；必要时用
  `backups/summitlink_<ts>.db` / `.json` 重建。
- **结构回滚**：保留 PG 基线迁移记录；如需重做，**对生产禁止 `db push --accept-data-loss`**，
  应清空目标库后重新 `migrate deploy`。
- **回滚后**：仍保留 PG 库快照以便排查，不要在定位问题前清理。

---

## 8. 风险与注意事项

1. PG 连接需开启 SSL / 正确的 `DATABASE_URL`，否则 `migrate deploy` 与脚本均会失败（fail-fast）。
2. 极大表的逐批插入耗时较长；可调 `BATCH_SIZE`（默认 200）。
3. `prisma migrate diff/deploy` 必须使用 **backend 内置的 Prisma 6.19.x**
   （脚本已 `cd backend` 调用）；勿用环境中可能存在的 Prisma 7.x（其 schema/标志不兼容）。
4. 切换后 14 天观察期内，保留 SQLite 与全部备份，确认无回滚需求后再清理。
