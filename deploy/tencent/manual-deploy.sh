#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

read_env_value() {
  local key="$1"
  local value
  value=$(grep -E "^${key}=" .env | head -n 1 | cut -d '=' -f2- || true)
  echo "$value"
}

is_placeholder_value() {
  local value="$1"
  case "$value" in
    ''|CHANGEME*|your_*|example*|TODO*|"（备案中）")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.cn.yml"
cd "$ROOT_DIR"

log_info "开始腾讯云手动部署（目录: $ROOT_DIR）"

# 1) 检查依赖
a=0
for cmd in docker git curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "缺少依赖: $cmd"
    a=1
  fi
done

COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  log_warn "未检测到 docker-compose，改用 docker compose"
else
  log_error "缺少依赖: docker-compose（或 docker compose 插件）"
  a=1
fi

if [ "$a" -ne 0 ]; then
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon 未运行，请先启动 Docker"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "未找到 $COMPOSE_FILE"
  exit 1
fi

# 2) 拉取最新代码
log_info "拉取最新代码: git pull origin main"
git pull origin main

# 3) 复制 .env.example -> .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    log_warn "已创建 .env（来自 .env.example）"
  else
    cp deploy/tencent/env.template .env
    log_warn "未找到 .env.example，已使用 deploy/tencent/env.template 创建 .env"
  fi
fi

# 4) 提示填写必要环境变量
required_vars=(DATABASE_URL JWT_SECRET ADMIN_PASSWORD)
if grep -q '^DATABASE_URL_CN=' .env; then
  required_vars+=(DATABASE_URL_CN)
fi

missing_vars=()
for var_name in "${required_vars[@]}"; do
  current_value="$(read_env_value "$var_name")"
  if is_placeholder_value "$current_value"; then
    missing_vars+=("$var_name")
  fi
done

if [ "${#missing_vars[@]}" -gt 0 ]; then
  log_warn "请先填写以下必要环境变量: ${missing_vars[*]}"
  read -r -p "现在打开 .env 编辑? [Y/n] " answer
  answer=${answer:-Y}
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    "${EDITOR:-nano}" .env
  fi

  still_missing=()
  for var_name in "${missing_vars[@]}"; do
    current_value="$(read_env_value "$var_name")"
    if is_placeholder_value "$current_value"; then
      still_missing+=("$var_name")
    fi
  done

  if [ "${#still_missing[@]}" -gt 0 ]; then
    log_error "以下变量仍未填写: ${still_missing[*]}"
    log_error "请完成 .env 后重新执行: bash deploy/tencent/manual-deploy.sh"
    exit 1
  fi
fi

# 5) 启动容器
log_info "执行: $COMPOSE_CMD -f docker-compose.cn.yml up -d --build"
$COMPOSE_CMD -f docker-compose.cn.yml up -d --build

# 6) 健康检查（最多 60 秒）
log_info "等待健康检查（最多 60 秒）..."
health_ok=0
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1 || curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    health_ok=1
    break
  fi
  sleep 1
done

if [ "$health_ok" -ne 1 ]; then
  log_error "健康检查失败（60 秒超时）"
  log_info "输出容器日志帮助排查..."
  $COMPOSE_CMD -f docker-compose.cn.yml logs --tail=120 || true
  exit 1
fi

# 7) 成功提示
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
SERVER_IP=${SERVER_IP:-localhost}
log_success "部署成功！"
log_success "健康检查: http://$SERVER_IP:8080/health"
log_success "应用访问:  http://$SERVER_IP"
