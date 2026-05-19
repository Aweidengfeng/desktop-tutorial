#!/bin/bash
# backup-db.sh — PostgreSQL 备份脚本（本地 + 可选 COS）
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/summitlink/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="backup_${TIMESTAMP}.sql"
BACKUP_FILE="${BACKUP_DIR}/${FILENAME}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 未配置"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "🔄 开始 PostgreSQL 备份..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "✅ 本地备份完成: $BACKUP_FILE"

# 本地保留 7 天
find "$BACKUP_DIR" -type f -name 'backup_*.sql' -mtime +7 -delete 2>/dev/null || true
echo "🧹 本地保留策略执行完成（7天）"

COS_SECRET_ID_VALUE="${COS_SECRET_ID:-${TENCENT_COS_SECRET_ID:-}}"
COS_SECRET_KEY_VALUE="${COS_SECRET_KEY:-${TENCENT_COS_SECRET_KEY:-}}"
COS_BUCKET_VALUE="${COS_BUCKET:-${TENCENT_COS_BUCKET:-}}"
COS_REGION_VALUE="${COS_REGION:-${TENCENT_COS_REGION:-ap-shanghai}}"
COS_PATH_PREFIX="${COS_PATH_PREFIX:-db-backups}"

if [ -n "$COS_SECRET_ID_VALUE" ] && [ -n "$COS_SECRET_KEY_VALUE" ] && [ -n "$COS_BUCKET_VALUE" ]; then
  echo "☁️ 检测到 COS 配置，开始上传..."
  if command -v coscmd >/dev/null 2>&1; then
    coscmd config -a "$COS_SECRET_ID_VALUE" -s "$COS_SECRET_KEY_VALUE" -b "$COS_BUCKET_VALUE" -r "$COS_REGION_VALUE" >/dev/null
    coscmd upload "$BACKUP_FILE" "${COS_PATH_PREFIX}/${FILENAME}"
    echo "✅ COS 上传完成: ${COS_PATH_PREFIX}/${FILENAME}"
    COS_CUTOFF_DATE="$(date -d '30 days ago' +%Y%m%d 2>/dev/null || true)"
    if [ -n "$COS_CUTOFF_DATE" ]; then
      coscmd list "${COS_PATH_PREFIX}/" 2>/dev/null | awk '{print $1}' | while read -r key; do
        base="$(basename "$key")"
        backup_date="$(echo "$base" | sed -n 's/^backup_\([0-9]\{8\}\)_[0-9]\{6\}\.sql$/\1/p')"
        if [ -n "$backup_date" ] && [ "$backup_date" -lt "$COS_CUTOFF_DATE" ]; then
          coscmd delete "$key" >/dev/null 2>&1 || true
        fi
      done
      echo "🧹 COS 保留策略执行完成（30天）"
    fi
  else
    echo "⚠️ coscmd 未安装，跳过 COS 上传"
  fi
else
  echo "ℹ️ 未配置 COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET，跳过 COS 上传"
fi

echo "✅ 备份流程结束"
