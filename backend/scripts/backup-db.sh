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

# 使用 SQLite 原生备份，避免在 WAL/写入过程中直接复制数据库文件导致备份不一致
if ! command -v sqlite3 > /dev/null 2>&1; then
  echo "❌ 未找到 sqlite3，无法执行一致性备份"
  exit 1
fi

sqlite3 "$DB_PATH" ".backup \"$BACKUP_FILE\""
echo "✅ 备份完成: $BACKUP_FILE"

# 清理7天前的备份文件
find "$BACKUP_DIR" -name "summitlink_*.db" -mtime +7 -delete
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
