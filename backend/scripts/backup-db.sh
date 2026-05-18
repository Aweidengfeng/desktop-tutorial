#!/bin/bash
# backup-db.sh — SQLite 数据库定期备份脚本
# 将 DB 文件备份到 /data/backups/ 并保留最近7天
# 若 TENCENT_COS_SECRET_ID 存在，同步上传至 COS

set -e

DB_PATH="${DATABASE_PATH:-/data/summitlink.db}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/summitlink_${TIMESTAMP}.db"

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
  echo "⚠️  数据库文件不存在: $DB_PATH，跳过备份"
  exit 0
fi

# 使用 sqlite3 .backup 命令做一致性热备份（WAL 安全，无损坏风险）
if command -v sqlite3 > /dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
  echo "✅ 备份完成 (sqlite3 .backup): $BACKUP_FILE"
else
  # 降级：cp 备份，同时复制 WAL/SHM（若存在）
  echo "⚠️  sqlite3 未安装，降级为 cp 备份（可能在 WAL 模式下不完整）"
  cp "$DB_PATH" "$BACKUP_FILE"
  [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal" || true
  echo "✅ 备份完成 (cp): $BACKUP_FILE"
fi

# 清理7天前的备份文件
find "$BACKUP_DIR" -name "summitlink_*.db" -mtime +7 -exec rm -f {} \; 2>/dev/null || true
echo "🧹 已清理7天前的旧备份"

# COS 上传（若已配置密钥）
if [ -n "$TENCENT_COS_SECRET_ID" ] && [ -n "$TENCENT_COS_SECRET_KEY" ] && [ -n "$COS_BUCKET" ]; then
  echo "☁️  上传至腾讯云 COS..."
  if command -v coscmd > /dev/null 2>&1; then
    coscmd config -a "$TENCENT_COS_SECRET_ID" -s "$TENCENT_COS_SECRET_KEY" -b "$COS_BUCKET" -r "${COS_REGION:-ap-shanghai}"
    coscmd upload "$BACKUP_FILE" "backups/$(basename "$BACKUP_FILE")" && echo "✅ COS 上传成功"
  else
    echo "⚠️  coscmd 未安装，跳过 COS 上传（pip install coscmd 可安装）"
  fi
else
  echo "ℹ️  COS 未配置，备份仅保存本地"
fi

echo "✅ 备份完成: summitlink_${TIMESTAMP}.db"
