#!/usr/bin/env bash
# 產出「獨立安裝包」zip：前端（已建置）＋後端程式＋安裝說明，給只能跑單一 Node.js 應用的主機
# （例如 Hostinger Node.js 託管）上傳使用。
#   用法：bash scripts/make-install-package.sh [輸出資料夾，預設 ./install-package-out]
# 包裡不含 .env、資料庫、node_modules、測試與任何客戶資料。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-install-package-out}"
NAME="ai-assessment-installer"
STAGE="$(mktemp -d)/$NAME"
COMMIT="$(git rev-parse --short=7 HEAD 2>/dev/null || echo unknown)"

echo "→ 建置前端"
npm run build >/dev/null

mkdir -p "$STAGE/public" "$STAGE/data"
cp -r dist/. "$STAGE/public/"
# 後端：只帶執行需要的檔案
cp -r server/src "$STAGE/src"
cp -r server/scripts "$STAGE/scripts"
cp server/package-lock.json "$STAGE/"
# 啟動指令改成「有 .env 就讀」（Node 22.9+），讓不能在面板設環境變數的主機也能用
node -e "const p=require('./server/package.json');p.scripts={start:'node --env-file-if-exists=.env src/server.js'};require('fs').writeFileSync(process.argv[1],JSON.stringify(p,null,2)+'\\n')" "$STAGE/package.json"
cp deploy/hosting/env.example "$STAGE/.env.example"
cp deploy/hosting/INSTALL.md "$STAGE/安裝說明.md"
printf '{"commit":"%s","builtAt":"%s"}\n' "$COMMIT" "$(date -u +%FT%TZ)" > "$STAGE/build-info.json"
: > "$STAGE/data/.keep"

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
( cd "$(dirname "$STAGE")" && zip -qr "$OUT/$NAME-$COMMIT.zip" "$NAME" )
echo "✓ $OUT/$NAME-$COMMIT.zip"
