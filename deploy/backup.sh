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
#   KEEP=14                          本機保留份數
#   OFFSITE_REMOTE=r2crypt:backups   異地副本（rclone 目的地，見 DEPLOYMENT.md「異地備份」）；沒設定就只留本機
#   OFFSITE_KEEP_DAYS=180            異地副本保留天數（預設 180 天＝半年）
#
# 排進 cron（每天凌晨 3 點）：
#   crontab -e
#   0 3 * * * DB_FILE=/var/lib/ai-assessment/db.json.sqlite3 /opt/ai-assessment/app/deploy/backup.sh >> /var/log/ai-assessment-backup.log 2>&1
#
set -euo pipefail

# 備份含全部學員的姓名、Email、密碼雜湊、作答與職涯意向：只有擁有者可讀寫。
umask 077

DB_FILE="${DB_FILE:-/var/lib/ai-assessment/db.json.sqlite3}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-assessment}"
KEEP="${KEEP:-14}"
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
OFFSITE_KEEP_DAYS="${OFFSITE_KEEP_DAYS:-180}"

if [ ! -f "$DB_FILE" ]; then
  echo "✗ 找不到資料庫檔案：$DB_FILE" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ 找不到 sqlite3 指令，請先安裝：sudo apt install -y sqlite3" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
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

# 異地副本：和資料庫同一台主機的備份擋不住整機或磁碟損毀。建議用 rclone 的 crypt 遠端，
# 這樣上傳到雲端的內容是加密的（雲端服務商看不到學員資料）。失敗時本機備份仍保留，
# 但腳本以非 0 結束，cron 日誌與 verify.sh 才看得到。
if [ -n "$OFFSITE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "✗ 設定了 OFFSITE_REMOTE 但找不到 rclone，請先安裝：sudo apt install -y rclone" >&2
    exit 2
  fi
  echo "==> 上傳異地副本 → $OFFSITE_REMOTE"
  if ! rclone copy "$DEST" "$OFFSITE_REMOTE"; then
    echo "✗ 異地副本上傳失敗（本機備份已保留：$DEST）" >&2
    exit 2
  fi
  rclone delete "$OFFSITE_REMOTE" --min-age "${OFFSITE_KEEP_DAYS}d" || echo "⚠️ 清除過期的異地副本失敗（不影響本次備份）" >&2
  echo "==> 異地副本完成（保留 ${OFFSITE_KEEP_DAYS} 天）"
fi

echo "==> 完成 ✅  目前保留 $(find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sqlite3' | wc -l) 份備份於 $BACKUP_DIR"
