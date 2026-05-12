#!/usr/bin/env bash
set -euo pipefail

VERSION=$(cat VERSION)
SLUG="summitlink-backend@${VERSION}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "⚠️  SENTRY_AUTH_TOKEN 未设置，跳过 release 创建"
  exit 0
fi

echo "📦 Creating Sentry release: $SLUG"
sentry-cli releases new "$SLUG"
sentry-cli releases set-commits "$SLUG" --auto
sentry-cli releases finalize "$SLUG"
echo "✅ Release $SLUG 已 finalize"
