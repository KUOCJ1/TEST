#!/usr/bin/env bash
#
# 備份還原演練（不動正式資料）：把最新的備份複製到暫存目錄，檢查它「真的能打開、
# 完整、資料量與正式庫相近」。演練的目的是在出事之前就知道備份可用——只有「能還原」
# 的備份才算備份。
#
# 用法（VPS 上執行；不需要停服務、不會寫入正式資料庫）：
#   bash deploy/restore-drill.sh
#
# 可用環境變數覆寫：
#   DB_FILE=/var/lib/ai-assessment/db.json.sqlite3
#   BACKUP_DIR=/var/backups/ai-assessment
#   MAX_AGE_HOURS=30          # 最新備份超過這個小時數就警告（預設 30，配合每日備份）
#   MAX_DRIFT_PCT=20          # 備份與正式庫資料筆數差距超過這個百分比就警告
#
# 結束代碼：0＝全部通過（可能有警告）；1＝有失敗項目。
set -euo pipefail

DB_FILE="${DB_FILE:-/var/lib/ai-assessment/db.json.sqlite3}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-assessment}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-30}"
MAX_DRIFT_PCT="${MAX_DRIFT_PCT:-20}"

FAIL=0; WARN=0
pass() { echo "  ✅ $1"; }
warn() { echo "  ⚠️  $1"; WARN=$((WARN + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

command -v sqlite3 >/dev/null 2>&1 || { echo "✗ 找不到 sqlite3，請先安裝：sudo apt install -y sqlite3" >&2; exit 1; }

echo "==> 找最新備份（$BACKUP_DIR）"
LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' 2>/dev/null | sort | tail -n 1 || true)"
if [ -z "$LATEST" ]; then
  fail "找不到任何備份檔（db-*.sqlite3）。先跑：bash deploy/backup.sh"
  echo "結果：失敗 $FAIL"; exit 1
fi
echo "    $LATEST"

AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LATEST") ) / 3600 ))
if [ "$AGE_H" -le "$MAX_AGE_HOURS" ]; then pass "備份夠新（約 ${AGE_H} 小時前）"; else warn "最新備份已是 ${AGE_H} 小時前（超過 ${MAX_AGE_HOURS}）：確認 cron 有在跑"; fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$LATEST" "$WORK/restored.sqlite3"
echo "==> 在暫存目錄演練還原（$WORK），不會碰正式資料庫"

if sqlite3 "$WORK/restored.sqlite3" "PRAGMA integrity_check;" | grep -q "^ok$"; then pass "完整性檢查通過"; else fail "完整性檢查失敗"; fi

count() { sqlite3 "$1" "SELECT COUNT(*) FROM records WHERE collection='$2';" 2>/dev/null || echo "-1"; }

echo "==> 資料筆數（備份 vs 正式庫）"
for col in users submissions groups assessments; do
  B="$(count "$WORK/restored.sqlite3" "$col")"
  if [ "$B" = "-1" ]; then fail "備份讀不到 $col（表結構不對？）"; continue; fi
  if [ -f "$DB_FILE" ]; then
    L="$(count "$DB_FILE" "$col")"
    DIFF=$(( L > B ? L - B : B - L ))
    BASE=$(( L > 0 ? L : 1 ))
    PCT=$(( DIFF * 100 / BASE ))
    if [ "$PCT" -le "$MAX_DRIFT_PCT" ]; then pass "$col：備份 $B／正式 $L"; else warn "$col：備份 $B／正式 $L（差 ${PCT}%，備份可能太舊）"; fi
  else
    pass "$col：備份 $B（找不到正式庫 $DB_FILE，略過比對）"
  fi
done

USERS="$(count "$WORK/restored.sqlite3" users)"
if [ "$USERS" -ge 1 ]; then pass "備份含 $USERS 位用戶"; else fail "備份裡沒有任何用戶"; fi

echo
echo "結果：失敗 $FAIL、警告 $WARN"
if [ "$FAIL" -gt 0 ]; then echo "❌ 備份演練未通過，請勿依賴這份備份"; exit 1; fi
echo "✅ 備份演練通過（真正還原的步驟見 DEPLOYMENT.md「備份與還原」）"
