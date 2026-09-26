#!/usr/bin/env bash
#
# 在 VPS 上更新部署：建置前端 → 同步靜態檔 → 同步後端 → 重啟服務。
# 於專案根目錄執行：bash deploy/deploy.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/ai-assessment}"
SERVER_DIR="${SERVER_DIR:-/opt/ai-assessment/server}"
SERVICE="${SERVICE:-ai-assessment-api}"

cd "$APP_DIR"

# 版本資訊（Sprint 7）：寫進前端打包與前後端各一份 build-info.json，部署後
# `curl /api/health` 或管理後台「系統狀態」就能確認跑的是不是這一版。
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BUILD_INFO="{\"commit\":\"$COMMIT\",\"builtAt\":\"$BUILT_AT\"}"

echo "==> 建置前端（base=/, API=/api，版本 $COMMIT）"
npm ci
VITE_BUILD_COMMIT="$COMMIT" VITE_BUILT_AT="$BUILT_AT" npm run build

echo "==> 部署前端靜態檔 → $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete dist/ "$WEB_ROOT/"
echo "$BUILD_INFO" | sudo tee "$WEB_ROOT/build-info.json" > /dev/null

echo "==> 同步後端程式 → $SERVER_DIR（保留 .env 與 data）"
sudo mkdir -p "$SERVER_DIR"
sudo rsync -a --delete \
  --exclude node_modules --exclude data --exclude .env \
  "$APP_DIR/server/" "$SERVER_DIR/"
echo "$BUILD_INFO" | sudo tee "$SERVER_DIR/build-info.json" > /dev/null

echo "==> 安裝後端相依（僅 production）"
( cd "$SERVER_DIR" && sudo npm ci --omit=dev )

echo "==> 重啟服務並重載 Nginx"
sudo systemctl restart "$SERVICE"
sudo systemctl reload nginx

echo "==> 完成 ✅  服務狀態："
sudo systemctl --no-pager --lines=0 status "$SERVICE" || true

# 部署後自動驗證（Sprint 7）：服務剛重啟，稍等它開始監聽再檢查。
sleep 3
bash "$APP_DIR/deploy/verify.sh"
