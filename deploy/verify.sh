#!/usr/bin/env bash
#
# 部署後驗證（Sprint 7 驗收條件 7.2）：一個指令逐項檢查部署結果，印出
# PASS／WARN／FAIL。deploy.sh 結尾會自動執行；也可以隨時單獨跑：
#   bash deploy/verify.sh
#
# FAIL＝服務沒有正常運作（應立即處理），有任何 FAIL 時結束代碼為 1；
# WARN＝功能可用但有設定該補（例如 SMTP、備份排程），不影響結束代碼。
#
# 可用環境變數覆寫預設值（預設值對應本站 VPS 實況）：
#   APP_DIR     程式碼目錄（git checkout）          預設：本腳本上一層
#   SERVER_DIR  後端部署目錄                         /opt/ai-assessment/server
#   WEB_ROOT    前端靜態檔目錄                       /var/www/ai-assessment
#   SITE_URL    對外網址                             https://assess.rong-rise.com
#   API_URL     後端本機位址                         http://localhost:<.env 的 PORT，預設 3101>
#   BACKUP_DIR  備份目錄（與 deploy/backup.sh 一致）  /var/backups/ai-assessment
#   SERVICE     systemd 服務名稱                     ai-assessment-api
#   SUDO        讀 .env／crontab 用的前綴             sudo（設成空字串則不用）
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVER_DIR="${SERVER_DIR:-/opt/ai-assessment/server}"
WEB_ROOT="${WEB_ROOT:-/var/www/ai-assessment}"
SITE_URL="${SITE_URL:-https://assess.rong-rise.com}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-assessment}"
SERVICE="${SERVICE:-ai-assessment-api}"
SUDO="${SUDO-sudo}"
ENV_FILE="$SERVER_DIR/.env"

PASS=0; WARN=0; FAIL=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS + 1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; WARN=$((WARN + 1)); }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL + 1)); }

# 讀 .env 裡某個鍵的值（檔案通常只有 root 可讀）。
env_value() { $SUDO grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2-; }
# 從 JSON 取欄位（用 node，VPS 一定有，不另外依賴 jq）。json_get '<json>' secondBrain.ok
json_get() {
  node -e 'let v=JSON.parse(process.argv[1]);for(const k of process.argv[2].split("."))v=v?.[k];console.log(v ?? "")' "$1" "$2" 2>/dev/null
}

PORT="$(env_value PORT)"
API_URL="${API_URL:-http://localhost:${PORT:-3101}}"
EXPECTED="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || true)"

echo "==> 部署驗證（預期版本：${EXPECTED:-未知}）"

# 1. 服務
if command -v systemctl >/dev/null 2>&1 && systemctl cat "$SERVICE" >/dev/null 2>&1; then
  if systemctl is-active --quiet "$SERVICE"; then pass "systemd 服務 $SERVICE 執行中"
  else fail "systemd 服務 $SERVICE 沒有在執行（sudo journalctl -u $SERVICE -n 50 看原因）"; fi
fi

# 2. 後端健康檢查＋版本
HEALTH="$(curl -sf --max-time 5 "$API_URL/api/health" 2>/dev/null || true)"
if [ "$(json_get "$HEALTH" ok)" = "true" ]; then
  pass "後端健康檢查 $API_URL/api/health"
  BACKEND_COMMIT="$(json_get "$HEALTH" version.commit)"
  if [ -z "$BACKEND_COMMIT" ]; then warn "後端沒有版本資訊（build-info.json 不存在，不是用 deploy.sh 部署的？）"
  elif [ -n "$EXPECTED" ] && [ "$BACKEND_COMMIT" != "$EXPECTED" ]; then fail "後端版本 $BACKEND_COMMIT ≠ 預期 $EXPECTED（服務沒有重啟成新版？）"
  else pass "後端版本 $BACKEND_COMMIT"; fi
else
  fail "後端健康檢查失敗：$API_URL/api/health 沒有回應 {\"ok\":true}"
fi

# 3. 前端版本（deploy.sh 寫在靜態檔目錄的 build-info.json）
if [ -f "$WEB_ROOT/build-info.json" ]; then
  FRONTEND_COMMIT="$(json_get "$(cat "$WEB_ROOT/build-info.json")" commit)"
  if [ -n "$EXPECTED" ] && [ "$FRONTEND_COMMIT" != "$EXPECTED" ]; then fail "前端版本 $FRONTEND_COMMIT ≠ 預期 $EXPECTED"
  else pass "前端版本 $FRONTEND_COMMIT"; fi
else
  warn "前端沒有版本資訊（$WEB_ROOT/build-info.json 不存在）"
fi

# 4. 對外網址
# 連不上時 curl 本身就會印 000（再 || echo 會變成 000000），只需吞掉結束代碼。
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SITE_URL" 2>/dev/null || true)"
if [ "$CODE" = "200" ]; then pass "對外網址 $SITE_URL 回應 200"
else fail "對外網址 $SITE_URL 回應 $CODE（檢查 Nginx／Traefik）"; fi

# 5. 外部依賴
DEEP="$(curl -sf --max-time 10 "$API_URL/api/health?deep=1" 2>/dev/null || true)"
if [ -n "$DEEP" ]; then
  if [ "$(json_get "$DEEP" deps.secondBrain.ok)" = "true" ]; then pass "第二大腦 API 連線正常"
  else warn "第二大腦 API 連不到（延伸閱讀會暫時空白，評測本身不受影響）"; fi
  if [ "$(json_get "$DEEP" deps.openRouter.configured)" = "true" ]; then pass "OpenRouter API 金鑰已設定"
  else warn "未設定 OPENROUTER_API_KEY（AI 小幫手停用）"; fi
fi

# 6. 設定檔
if $SUDO test -r "$ENV_FILE" 2>/dev/null; then
  if [ -n "$(env_value SMTP_HOST)" ] && [ -n "$(env_value SMTP_USER)" ] && [ -n "$(env_value SMTP_PASS)" ]; then
    pass "SMTP 已設定（記得實際寄一封確認收得到）"
  else
    warn "SMTP 未設定：異常告警信與教練「寄送提醒信」停用（見 DEPLOYMENT.md）"
  fi
  TP="$(env_value TRUST_PROXY)"
  if [ -n "$TP" ] && [ "$TP" != "0" ]; then
    pass "TRUST_PROXY=$TP（仍需從外部網路開「管理後台 → 系統狀態」確認看到的是你的真實 IP）"
  else
    warn "TRUST_PROXY 未設定或為 0：註冊／登入限流會全站共用一份額度（本站應為 2）"
  fi
else
  warn "讀不到 $ENV_FILE，略過 SMTP／TRUST_PROXY 檢查"
fi

# 7. 備份
if command -v crontab >/dev/null 2>&1; then
  if $SUDO crontab -l 2>/dev/null | grep -q 'deploy/backup.sh'; then pass "備份排程（cron）已設定"
  else warn "root 的 crontab 沒有 deploy/backup.sh 排程（見 DEPLOYMENT.md「備份與還原」）"; fi
else
  warn "沒有 crontab 指令，略過備份排程檢查"
fi
LATEST="$($SUDO find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' -mmin -1560 2>/dev/null | head -n 1)"
if [ -n "$LATEST" ]; then pass "26 小時內有備份：$(basename "$LATEST")"
else warn "$BACKUP_DIR 沒有 26 小時內的備份"; fi

echo "==> 結果：PASS $PASS、WARN $WARN、FAIL $FAIL"
[ "$FAIL" -eq 0 ]
