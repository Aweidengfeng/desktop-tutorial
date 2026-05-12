#!/usr/bin/env bash
# scripts/rollout-status.sh
#
# 一条命令查询 SummitLink v1.3.0 当前灰度状态（iOS TestFlight + Android Google Play）。
# 依赖：
#   iOS   — APPLE_API_KEY_ID, APPLE_API_ISSUER_ID, APPLE_API_KEY_CONTENT（Base64 .p8）
#   Android — GOOGLE_PLAY_JSON_KEY（service account JSON 文件路径）
# 缺少 token 时，该平台显示"⚠️ 跳过"，不影响另一平台查询。
#
# 用法：
#   bash scripts/rollout-status.sh
#   VERSION=1.3.0 bash scripts/rollout-status.sh

set -euo pipefail

APP_VERSION="${VERSION:-$(cat "$(dirname "$0")/../VERSION" 2>/dev/null || echo '1.3.0')}"
BUNDLE_ID="${IOS_BUNDLE_ID:-app.summitlink}"
export ANDROID_PACKAGE_NAME="${ANDROID_PACKAGE_NAME:-app.summitlink}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      SummitLink 灰度发布状态查询  v${APP_VERSION}         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ──────────────────────────────────────────────────────────
# 1. iOS — TestFlight（通过 App Store Connect API）
# ──────────────────────────────────────────────────────────
echo "📱 iOS TestFlight 状态"
echo "─────────────────────────────────────────────"

IOS_OK=true
for var in APPLE_API_KEY_ID APPLE_API_ISSUER_ID APPLE_API_KEY_CONTENT; do
  if [ -z "${!var:-}" ]; then
    echo "  ⚠️  缺少环境变量 ${var}，跳过 iOS 查询。"
    IOS_OK=false
    break
  fi
done

if [ "$IOS_OK" = "true" ]; then
  # 写临时 .p8 key 文件
  TMP_KEY_FILE="$(mktemp /tmp/asc_key_XXXXXX.p8)"
  trap 'rm -f "$TMP_KEY_FILE"' EXIT

  # openssl base64 -d works on both GNU/Linux and macOS (BSD), unlike base64 -d/-D
  echo "$APPLE_API_KEY_CONTENT" | openssl base64 -d > "$TMP_KEY_FILE" 2>/dev/null || {
    echo "  ⚠️  APPLE_API_KEY_CONTENT Base64 解码失败，跳过 iOS 查询。"
    IOS_OK=false
  }
fi

if [ "$IOS_OK" = "true" ]; then
  # 生成 App Store Connect JWT（ES256）
  # 使用 Ruby（fastlane 已依赖）：ECDSA sign → 将 DER 格式签名转为 JWT 所需的 JOSE R||S（raw）格式
  JWT=""
  RUBY_ERR_FILE="$(mktemp /tmp/jwt_err_XXXXXX)"
  if command -v ruby &>/dev/null; then
    JWT=$(TMP_KEY_FILE="$TMP_KEY_FILE" \
          APPLE_API_KEY_ID="$APPLE_API_KEY_ID" \
          APPLE_API_ISSUER_ID="$APPLE_API_ISSUER_ID" \
          ruby -e '
      require "openssl"; require "json"; require "base64"
      def b64url(s); Base64.strict_encode64(s.b).tr("+/", "-_").delete("="); end
      key  = OpenSSL::PKey::EC.new(File.read(ENV["TMP_KEY_FILE"]))
      now  = Time.now.to_i
      hdr  = b64url(JSON.generate({ alg: "ES256", kid: ENV["APPLE_API_KEY_ID"], typ: "JWT" }))
      pld  = b64url(JSON.generate({ iss: ENV["APPLE_API_ISSUER_ID"], iat: now, exp: now + 300, aud: "appstoreconnect-v1" }))
      inp  = "#{hdr}.#{pld}"
      der  = key.sign(OpenSSL::Digest::SHA256.new, inp)
      # Convert DER-encoded ECDSA signature to JOSE raw R||S (32 bytes each):
      #   - 64 hex chars = 32 bytes = one P-256 coordinate (256-bit field element)
      #   - [-32, 32] slices the last 32 bytes to handle OpenSSL leading-zero padding
      asn1 = OpenSSL::ASN1.decode(der)
      r    = [asn1.value[0].value.to_s(16).rjust(64, "0")].pack("H*")[-32, 32]
      s    = [asn1.value[1].value.to_s(16).rjust(64, "0")].pack("H*")[-32, 32]
      puts "#{inp}.#{b64url(r + s)}"
    ' 2>"$RUBY_ERR_FILE" || echo "")
  fi

  if [ -z "$JWT" ]; then
    RUBY_ERR=$(head -1 "$RUBY_ERR_FILE" 2>/dev/null || echo "")
    rm -f "$RUBY_ERR_FILE"
    echo "  ⚠️  JWT 生成失败（需要 Ruby；请确认 Ruby 可用且 .p8 key 格式正确），跳过 iOS 查询。${RUBY_ERR:+ 错误：$RUBY_ERR}"
    echo "     手动查看：https://appstoreconnect.apple.com/apps"
  else
    rm -f "$RUBY_ERR_FILE"
    RESPONSE=$(curl -s --max-time 15 \
      -H "Authorization: Bearer ${JWT}" \
      "https://api.appstoreconnect.apple.com/v1/builds?filter[app.bundleId]=${BUNDLE_ID}&filter[preReleaseVersion.version]=${APP_VERSION}&limit=5&sort=-uploadedDate" \
      2>/dev/null) || true

    if [ -z "$RESPONSE" ]; then
      echo "  ⚠️  API 请求失败（网络超时或凭证无效），跳过 iOS 查询。"
      echo "     请前往 App Store Connect 手动查看：https://appstoreconnect.apple.com/apps"
    elif echo "$RESPONSE" | grep -q '"data"'; then
      BUILD_COUNT=$(echo "$RESPONSE" | grep -o '"processingState"' | wc -l | tr -d ' ')
      echo "  ✅ App Bundle ID : ${BUNDLE_ID}"
      echo "  ✅ 版本          : ${APP_VERSION}"
      echo "  ✅ TestFlight builds 数量（最近）: ${BUILD_COUNT}"

      # 提取 processingState
      STATES=$(echo "$RESPONSE" | grep -o '"processingState":"[^"]*"' | sed 's/"processingState":"//;s/"//')
      if [ -n "$STATES" ]; then
        echo "  ✅ Build 状态    : $(echo "$STATES" | paste -sd ',' -)"
      fi
    else
      echo "  ⚠️  API 返回异常，无法获取 TestFlight 状态。"
      echo "     请前往 App Store Connect 手动查看："
      echo "     https://appstoreconnect.apple.com/apps"
    fi
  fi
fi

echo ""

# ──────────────────────────────────────────────────────────
# 2. Android — Google Play（通过 googleapis / curl）
# ──────────────────────────────────────────────────────────
echo "🤖 Android Google Play 状态"
echo "─────────────────────────────────────────────"

ANDROID_OK=true
if [ -z "${GOOGLE_PLAY_JSON_KEY:-}" ]; then
  echo "  ⚠️  缺少环境变量 GOOGLE_PLAY_JSON_KEY，跳过 Android 查询。"
  ANDROID_OK=false
elif [ ! -f "$GOOGLE_PLAY_JSON_KEY" ]; then
  echo "  ⚠️  GOOGLE_PLAY_JSON_KEY 指向的文件不存在：${GOOGLE_PLAY_JSON_KEY}"
  ANDROID_OK=false
fi

if [ "$ANDROID_OK" = "true" ]; then
  # 尝试用 bundletool / gcloud / python 查询（优先 python，因为 Railway 环境通常有）
  if command -v python3 &>/dev/null && python3 -c "import google.oauth2.service_account" 2>/dev/null; then
    python3 - <<'PYEOF'
import os, json, sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

key_file = os.environ.get("GOOGLE_PLAY_JSON_KEY", "")
package = os.environ.get("ANDROID_PACKAGE_NAME", "app.summitlink")
version = os.environ.get("VERSION", "1.3.0")

try:
    creds = service_account.Credentials.from_service_account_file(
        key_file,
        scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    service = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

    # 列出所有 track 状态
    tracks = ["internal", "alpha", "beta", "production"]
    edit = service.edits().insert(body={}, packageName=package).execute()
    edit_id = edit["id"]

    print(f"  ✅ Package Name  : {package}")
    for track_name in tracks:
        try:
            result = service.edits().tracks().get(
                packageName=package, editId=edit_id, track=track_name
            ).execute()
            releases = result.get("releases", [])
            for rel in releases:
                status = rel.get("status", "unknown")
                rollout = rel.get("userFraction", None)
                ver_codes = rel.get("versionCodes", [])
                rollout_str = f" (rollout {float(rollout)*100:.0f}%)" if rollout is not None else ""
                print(f"  ✅ [{track_name:10}] status={status}{rollout_str}  versionCodes={ver_codes}")
        except Exception:
            pass  # track 可能还没有版本

    # 删除草稿 edit（不提交）
    service.edits().delete(packageName=package, editId=edit_id).execute()

except Exception as e:
    print(f"  ⚠️  查询失败：{e}")
    print(f"     请前往 Google Play Console 手动查看：")
    print(f"     https://play.google.com/console/developers")
PYEOF
  else
    echo "  ⚠️  未找到 google-auth / google-api-python-client，无法自动查询。"
    echo "     手动查看：https://play.google.com/console/developers"
    echo "     或安装：pip install google-auth google-api-python-client"
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  查询完成。如需调整灰度：                            ║"
echo "║  Android: bundle exec fastlane android rollout_android percent:5  ║"
echo "║  Android: bundle exec fastlane android halt_android              ║"
echo "║  iOS:     App Store Connect → 版本 → Phased Release             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
