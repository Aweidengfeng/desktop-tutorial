#!/usr/bin/env bash
# =============================================================================
# scripts/cloudflare-geo-dns.sh
# =============================================================================
# 用 Cloudflare API 自动为 summitlink.app 创建智能 DNS 记录
#
# 使用方法：
#   export CF_API_TOKEN="your-cloudflare-api-token"
#   export CF_ZONE_ID="your-zone-id"
#   export RAILWAY_IP="1.2.3.4"   # Railway 的出口 IP（可在 Railway 控制台查看）
#   bash scripts/cloudflare-geo-dns.sh
#
# 获取 Zone ID：Cloudflare Dashboard → 选择你的域名 → 右侧"Zone ID"
# 获取 API Token：Cloudflare Dashboard → My Profile → API Tokens → Create Token
#   → 权限选 Zone:DNS:Edit
# =============================================================================

set -euo pipefail

CN_IP="49.234.163.103"

# 检查必需环境变量
: "${CF_API_TOKEN:?请设置 CF_API_TOKEN 环境变量}"
: "${CF_ZONE_ID:?请设置 CF_ZONE_ID 环境变量}"
: "${RAILWAY_IP:?请设置 RAILWAY_IP 环境变量（Railway 节点 IP）}"

CF_API="https://api.cloudflare.com/client/v4"

cf_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  curl -s -X "$method" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    ${data:+--data "$data"} \
    "$CF_API$path"
}

create_or_update_record() {
  local name="$1"
  local content="$2"
  local proxied="${3:-true}"
  local comment="${4:-}"

  echo "→ 配置 A 记录: $name → $content"

  # 查找已存在的记录
  existing=$(cf_request GET "/zones/$CF_ZONE_ID/dns_records?type=A&name=$name" | \
    python3 -c "import sys,json; r=json.load(sys.stdin); print(r['result'][0]['id'] if r['result'] else '')" 2>/dev/null || echo "")

  if [ -n "$existing" ]; then
    # 更新已有记录
    result=$(cf_request PUT "/zones/$CF_ZONE_ID/dns_records/$existing" \
      "{\"type\":\"A\",\"name\":\"$name\",\"content\":\"$content\",\"proxied\":$proxied,\"comment\":\"$comment\"}")
  else
    # 创建新记录
    result=$(cf_request POST "/zones/$CF_ZONE_ID/dns_records" \
      "{\"type\":\"A\",\"name\":\"$name\",\"content\":\"$content\",\"proxied\":$proxied,\"comment\":\"$comment\"}")
  fi

  success=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success','false'))" 2>/dev/null || echo "false")
  if [ "$success" = "True" ] || [ "$success" = "true" ]; then
    echo "  ✅ 成功"
  else
    echo "  ❌ 失败: $result"
  fi
}

echo "=============================="
echo " SummitLink Cloudflare DNS 配置"
echo "=============================="
echo ""
echo "CN 节点  : $CN_IP（腾讯云上海）"
echo "Railway  : $RAILWAY_IP（海外节点）"
echo ""

# A 记录：@（主域名）→ CN 节点（Cloudflare 代理，Worker 会做分流）
create_or_update_record "summitlink.app" "$CN_IP" "true" "SummitLink CN node (geo-routing via Worker)"

# A 记录：api-cn（境内备案期间临时入口）→ CN 节点
create_or_update_record "api-cn.summitlink.app" "$CN_IP" "true" "SummitLink CN API temp entry (pre-ICP)"

# A 记录：www → CN 节点（Worker 负责分流）
create_or_update_record "www.summitlink.app" "$CN_IP" "true" "SummitLink www (geo-routing via Worker)"

echo ""
echo "=============================="
echo " 下一步：部署 Cloudflare Worker"
echo "=============================="
echo "  1. 将 scripts/cloudflare-worker-geo-router.js 上传到 Cloudflare Workers"
echo "  2. 设置 Worker 环境变量："
echo "       CN_BACKEND=http://$CN_IP"
echo "       RAILWAY_BACKEND=https://your-app.railway.app"
echo "  3. 添加 Worker 路由: summitlink.app/* → summitlink-geo-router"
echo ""
echo "详细步骤见 docs/DNS_GEO_ROUTING.md"
