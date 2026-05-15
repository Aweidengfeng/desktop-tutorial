#!/usr/bin/env bash
# =============================================================================
# deploy/tencent/deploy.sh
# =============================================================================
# CN 节点部署脚本（由 CI/CD 调用或手动执行）
# 执行路径：服务器上 TENCENT_DEPLOY_PATH 目录
#
# 用法（手动）：
#   cd /opt/summitlink
#   bash deploy/tencent/deploy.sh
# =============================================================================

set -euo pipefail

DEPLOY_PATH="${TENCENT_DEPLOY_PATH:-/opt/summitlink}"
LOG_FILE="/var/log/summitlink/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$TIMESTAMP] $*" | tee -a "$LOG_FILE"
}

log "=============================="
log " SummitLink CN Deploy Start"
log " Path: $DEPLOY_PATH"
log "=============================="

cd "$DEPLOY_PATH"

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
  log "⚠️  .env 不存在，从模板创建..."
  if [ -f "deploy/tencent/.env.example" ]; then
    cp deploy/tencent/.env.example .env
    log "⚠️  请编辑 .env 填写真实 secrets，然后重新运行此脚本"
    exit 1
  fi
fi

# 复制腾讯云专用配置文件
log "▶ 复制 tencent 专用配置..."
cp deploy/tencent/docker-compose.yml docker-compose.yml
cp deploy/tencent/nginx.conf nginx.conf

# 拉取最新镜像
log "▶ 拉取依赖镜像..."
docker compose pull --quiet 2>&1 | tee -a "$LOG_FILE" || true

# 重建并启动
log "▶ docker compose up -d --build..."
docker compose up -d --build --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# 等待后端健康
log "▶ 等待后端健康检查（最多 60s）..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8080/api/health > /dev/null 2>&1; then
    log "✅ 健康检查通过！"
    break
  fi
  if [ "$i" -eq 12 ]; then
    log "❌ 健康检查失败（60s 超时）"
    docker compose logs backend --tail=50 | tee -a "$LOG_FILE"
    exit 1
  fi
  log "  等待中... ($i/12)"
  sleep 5
done

# 清理旧镜像（释放磁盘空间）
log "▶ 清理旧镜像..."
docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true

log "=============================="
log " ✅ 部署成功！"
log " 健康检查：http://localhost:8080/api/health"
log "=============================="
