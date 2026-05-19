#!/bin/bash
# 生产迁移脚本 - 在腾讯云服务器执行
set -e

echo "🔄 备份数据库..."
mkdir -p /opt/summitlink/backups
pg_dump "$DATABASE_URL" > /opt/summitlink/backups/backup_$(date +%Y%m%d_%H%M%S).sql

echo "🚀 执行迁移..."
npx prisma migrate deploy

echo "✅ 迁移完成"
