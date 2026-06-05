#!/usr/bin/env bash
#
# pg-migrate-deploy.sh
# ------------------------------------------------------------------
# 一键执行 SQLite → PostgreSQL 正式迁移的编排脚本。
#
# 严格遵循迁移要求：
#   1. 保留 SQLite 作为回滚库（仅备份、只读，绝不删除）。
#   2. 不直接覆盖现有数据库（目标 PG 须为空库；数据脚本带非空中止保护）。
#   3. 使用 `prisma migrate deploy` 建表（不使用 db push --accept-data-loss）。
#   4. 迁移后保留 SQLite ≥ 14 天再考虑清理。
#
# 由于历史 migrations（backend/prisma/migrations/）采用 SQLite 方言
# （AUTOINCREMENT/DATETIME 等），无法直接 deploy 到 PostgreSQL。本脚本
# 因此在临时工作目录中，基于当前 schema.prisma 用 `prisma migrate diff`
# 生成一份 **PostgreSQL 方言** 的基线迁移，再对空 PG 库执行
# `prisma migrate deploy`。这属于「全新空数据库初始化」，符合规则。
#
# 必填环境变量：
#   DATABASE_URL   目标 PostgreSQL 连接串（postgresql://...）
#   SQLITE_PATH    源 SQLite 文件路径（如 /data/summitlink.db）
#
# 用法：
#   DATABASE_URL="******host:5432/summitlink" \
#   SQLITE_PATH=/data/summitlink.db \
#   bash backend/scripts/pg-migrate-deploy.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
SQLITE_PATH="${SQLITE_PATH:-$BACKEND_DIR/summitlink.db}"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
WORKDIR="$(mktemp -d /tmp/pgmig.XXXXXX)"

log() { echo "[pg-migrate] $*"; }

if [[ "${DATABASE_URL:-}" != postgres*://* ]]; then
  echo "[pg-migrate] 错误：DATABASE_URL 必须为 postgresql:// 连接串" >&2
  exit 1
fi
if [[ ! -f "$SQLITE_PATH" ]]; then
  echo "[pg-migrate] 错误：找不到源 SQLite 文件：$SQLITE_PATH" >&2
  exit 1
fi

# ── 1. 备份 SQLite（保留为回滚库） ────────────────────────────────
log "步骤 1/6：备份 SQLite 源库"
mkdir -p "$BACKUP_DIR"
cp -v "$SQLITE_PATH" "$BACKUP_DIR/summitlink_$TS.db"
DATABASE_PATH="$SQLITE_PATH" NODE_PATH="$BACKEND_DIR/node_modules" \
  node "$REPO_ROOT/scripts/export-sqlite.js" \
  > "$BACKUP_DIR/summitlink_$TS.json" || true
log "备份完成：$BACKUP_DIR/summitlink_$TS.db (+ .json)"
log "⚠️  迁移后请保留该备份至少 14 天后再清理。"

# ── 2. 生成 PostgreSQL 方言基线迁移 ──────────────────────────────
log "步骤 2/6：基于 schema.prisma 生成 PostgreSQL 基线迁移"
mkdir -p "$WORKDIR/migrations/0_init"
# 复制 schema 并把 datasource provider 改为 postgresql
sed -E 's/provider = "sqlite"/provider = "postgresql"/' \
  "$BACKEND_DIR/prisma/schema.prisma" > "$WORKDIR/schema.prisma"
cat > "$WORKDIR/migrations/migration_lock.toml" <<'EOF'
provider = "postgresql"
EOF
( cd "$BACKEND_DIR" && npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$WORKDIR/schema.prisma" \
  --script > "$WORKDIR/migrations/0_init/migration.sql" )
log "基线迁移已生成：$WORKDIR/migrations/0_init/migration.sql"

# ── 3. prisma migrate deploy（对空 PG 库建表） ───────────────────
log "步骤 3/6：对目标 PostgreSQL 执行 prisma migrate deploy"
( cd "$BACKEND_DIR" && DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema "$WORKDIR/schema.prisma" )
log "表结构已通过 migrate deploy 创建。"

# ── 4. 生成 PG Prisma Client + 全文索引 ─────────────────────────
log "步骤 4/6：生成 PostgreSQL Prisma Client 并创建全文索引"
( cd "$BACKEND_DIR" && DATABASE_PROVIDER=postgresql DATABASE_URL="$DATABASE_URL" \
    node scripts/generate-prisma-client.js )
DATABASE_PROVIDER=postgresql DATABASE_URL="$DATABASE_URL" \
  node "$BACKEND_DIR/scripts/pg-search-indexes.js" || true

# ── 5. 数据迁移（SQLite → PostgreSQL） ───────────────────────────
log "步骤 5/6：执行数据迁移"
DATABASE_PROVIDER=postgresql DATABASE_URL="$DATABASE_URL" SQLITE_PATH="$SQLITE_PATH" \
  node "$BACKEND_DIR/scripts/migrate-sqlite-to-postgres.js"

# ── 6. 数据校验 ─────────────────────────────────────────────────
log "步骤 6/6：执行数据校验"
DATABASE_PROVIDER=postgresql DATABASE_URL="$DATABASE_URL" SQLITE_PATH="$SQLITE_PATH" \
  JSON_OUT="$BACKUP_DIR/verify_$TS.json" \
  node "$BACKEND_DIR/scripts/verify-migration.js"

log "✅ 迁移与校验完成。"
log "回滚库备份：$BACKUP_DIR/summitlink_$TS.db"
log "下一步：将应用 DATABASE_PROVIDER=postgresql、DATABASE_URL 指向 PG 后重启，并监控新写入。"
rm -rf "$WORKDIR"
