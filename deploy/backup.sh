#!/usr/bin/env bash
#
# 資料庫每日備份：用 sqlite3 的線上備份指令（服務不用停機，WAL 模式下直接
# cp 主檔案可能漏掉尚未 checkpoint 的內容，見 DEPLOYMENT.md「備份與還原」）。
# 保留最近 N 份、自動清掉更舊的，避免備份目錄無限長大。
#
# 用法（VPS 上執行，或排進 cron）：
#   bash deploy/backup.sh
#
# 可用環境變數覆寫路徑與保留份數：
#   DB_FILE=/var/lib/ai-assessment/db.json.sqlite3
#   BACKUP_DIR=/var/backups/ai-assessment
#   KEEP=14
#
# 排進 cron（每天凌晨 3 點）：
#   crontab -e
#   0 3 * * * DB_FILE=/var/lib/ai-assessment/db.json.sqlite3 /opt/ai-assessment/app/deploy/backup.sh >> /var/log/ai-assessment-backup.log 2>&1
#
set -euo pipefail

DB_FILE="${DB_FILE:-/var/lib/ai-assessment/db.json.sqlite3}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-assessment}"
KEEP="${KEEP:-14}"

if [ ! -f "$DB_FILE" ]; then
  echo "✗ 找不到資料庫檔案：$DB_FILE" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ 找不到 sqlite3 指令，請先安裝：sudo apt install -y sqlite3" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M%S)"
DEST="$BACKUP_DIR/db-$STAMP.sqlite3"

echo "==> 備份 $DB_FILE → $DEST"
sqlite3 "$DB_FILE" ".backup '$DEST'"

# 備份檔案至少要能被 sqlite3 打開且通過完整性檢查，才算一次成功的備份——
# 只確認檔案存在無法排除「備份寫壞了但沒人發現」的情況。
if ! sqlite3 "$DEST" "PRAGMA integrity_check;" | grep -q "^ok$"; then
  echo "✗ 備份檔案完整性檢查失敗：$DEST" >&2
  exit 1
fi
echo "==> 完整性檢查通過"

# 清掉超過 KEEP 份的舊備份（依檔名排序，最舊的先刪）。
COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' | wc -l)
if [ "$COUNT" -gt "$KEEP" ]; then
  EXCESS=$((COUNT - KEEP))
  echo "==> 超過保留份數（$COUNT > $KEEP），清掉最舊的 $EXCESS 份"
  find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' | sort | head -n "$EXCESS" | xargs rm -f
fi

echo "==> 完成 ✅  目前保留 $(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' | wc -l) 份備份於 $BACKUP_DIR"
