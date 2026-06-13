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

echo "==> 建置前端（base=/, API=/api）"
npm ci
npm run build

echo "==> 部署前端靜態檔 → $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete dist/ "$WEB_ROOT/"

echo "==> 同步後端程式 → $SERVER_DIR（保留 .env 與 data）"
sudo mkdir -p "$SERVER_DIR"
sudo rsync -a --delete \
  --exclude node_modules --exclude data --exclude .env \
  "$APP_DIR/server/" "$SERVER_DIR/"

echo "==> 安裝後端相依（僅 production）"
( cd "$SERVER_DIR" && sudo npm ci --omit=dev )

echo "==> 重啟服務並重載 Nginx"
sudo systemctl restart "$SERVICE"
sudo systemctl reload nginx

echo "==> 完成 ✅  服務狀態："
sudo systemctl --no-pager --lines=0 status "$SERVICE" || true
