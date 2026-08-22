# CLAUDE.md

本檔記錄專案的設定、架構與 VPS 部署環境，供日後接續開發參考。

## 專案概述

領導力 / 職能線上評量系統。前端為填答與報告介面，後端提供帳號、評量提交、
教練後台與班級分析。核心評量為 **L9D（經贏® 領導力九大構面行為評量）**：
9 大構面 × 20 子能力 × 90 題（含反向題），詳見 `docs/leadership-9d-spec.md`。

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | React 19 + Vite 8 + Tailwind CSS 3 |
| 後端 | Node.js (**≥22**，`better-sqlite3` 的原生模組要求；Node 20 會在載入時 segfault) + Express 4 |
| 認證 | JWT（httpOnly cookie）+ bcryptjs |
| 儲存 | SQLite（`better-sqlite3`），檔案路徑為 `${DB_PATH}.sqlite3`；`DB_PATH` 預設 `/var/lib/ai-assessment/db.json`。舊版純 JSON 檔開機時會自動偵測並遷移，原檔保留不動 |
| 測試 | Vitest（前端）、`node --test`（後端） |

## 常用指令

前端（專案根目錄）：
```bash
npm install          # 安裝相依
npm run dev          # 本機開發（Vite）
npm test             # 跑 Vitest（CI 必須全綠）
npm run build        # 產出 dist/
npm run lint         # ESLint（提交前應為 0 problems）
```

後端（`server/`）：
```bash
cd server
npm ci
npm run dev          # node --watch --env-file=.env
npm start            # node src/server.js
npm test             # node --test
```

## 目錄結構

```
src/
├── App.jsx, main.jsx, index.css
├── survey/
│   ├── AppShell.jsx, SurveyApp.jsx
│   ├── admin/        管理後台
│   ├── auth/         登入/註冊
│   ├── coach/        教練後台（班級管理、組織分析）CoachDashboard.jsx
│   ├── components/   ResultPanel、RadarChart、NarrativeReport、GroupNarrativeReport…
│   ├── dashboard/    UserDashboard（個人歷史/分析）
│   ├── profile/      個人設定
│   ├── data/assessments/   題庫設定（leadership-9d.js、ai-competency…）
│   └── utils/        scoring.js（計分）、narrative.js（敘事評語組裝）
└── test/             前端測試（含 narrative.test.js）
server/
├── src/server.js     Express 進入點
└── test/
deploy/               部署設定（見下）
docs/                 規格書（leadership-9d-spec.md / .pdf）
```

## 評量領域重點（L9D）

- 計分：`effectiveScore = reversed ? (6 - raw) : raw`（量表 1–5）。
- 子能力平均 → 構面平均 → 構面總分 → 全量表總分（90–450）。
- 落點 4 級：探索期(90–225)/發展期(226–315)/精熟期(316–405)/卓越(406–450)。
- 構面 5 級：精熟(≥4.2)/熟練(3.4–4.19)/發展中(2.6–3.39)/萌芽(1.8–2.59)/待啟蒙(<1.8)。
- 子能力評語 3 段：high(≥4.5)/mid(3.5–4.49)/low(<3.5)，見 `bandOf()`。
- 敘事段落以 `seed = hash(總分 | 構面ID)` 選模板 → 同報告穩定、跨人有變化。
- 三圈層：foundation / interpersonal / organizational（見 `leadership-9d.js` 的 `LAYERS`）。
- 設定驅動、向後相容：題庫有 `COMMENTARY` 才顯示敘事報告，無則不顯示也不報錯。

## 班級管理與 QR Code 報到

- 每筆作答提交都會寫入 `groupId`，精準對應提交當下所屬的班級（同一梯次）。班級報告
  （`GET /api/coach/groups/:id`）優先以 `groupId` 歸屬；`groupId` 為 `null` 的舊資料
  才退回「用當下成員名單反查」的相容邏輯，讓既有正式站資料不會從報告中消失。
  這個設計讓同一學員可重複參加多梯課程而不互相污染成績，也讓移出班級成員不會抹掉
  他當時的作答紀錄。
- 重複提交檢查以「班級 + 階段（課前/課後）」為鍵：同班同階段擋 409、同班課前→課後
  放行、不同梯次放行；不屬於任何班級時不擋（供「重新作答」與歷次趨勢功能使用）。
- QR Code 報到：班別多了 `joinCode`／`joinCodeCreatedAt` 欄位（單一代碼，重新產生會
  讓舊代碼立即失效；撤銷＝設為 `null`，可逆）。
  - `POST /api/coach/groups/:id/join-code`　產生／重新產生（限本班教練或 admin）。
    若班級尚未設定 `startDate` 會自動設為現在，避免學員掃碼後看到「尚未開放作答」。
  - `DELETE /api/coach/groups/:id/join-code`　撤銷。
  - `GET /api/public/join/:code`　**免登入**查詢班級／評量顯示資訊（不含成員或成績），
    代碼無效回 404，有獨立 rate limit。
  - `POST /api/groups/join`（需登入）　已登入使用者掃到另一個班級的 QR 時直接加入，
    不必重新註冊/登入。
  - `POST /api/auth/register`、`POST /api/auth/login` 可帶 `joinCode`，成功後自動加入
    對應班級，回應內含 `joinedGroup` 供前端導向該評量的作答頁。
  - 前端：`App.jsx` 讀取 `?join=CODE` 導向對應流程；`LoginPage.jsx` 顯示班級橫幅並把
    `joinCode` 併入註冊/登入請求；教練端 `GroupTab.jsx` → `QrCodeCard.jsx` 提供
    產生／重新產生／撤銷、複製連結、全螢幕投影（`qrcode` 套件以 `await import()`
    動態載入，避免灌進教練後台共用 chunk）。
- 帶有效 `joinCode` 的註冊/登入請求，rate limit 會放寬（預設每 5 分鐘 10 次 → 100 次），
  讓整班同時掃碼註冊不會被擋；額度仍有界，且綁定「持有教練發出的代碼」。

## Git 開發慣例

- 開發分支：`claude/ai-assessment-survey-4vhjun`（功能分支）。
- 推送：`git push -u origin <branch>`；推送後若無 PR 則建立 draft PR。
- 提交與 PR 前確保 `npm test`、`npm run build`、`npm run lint` 通過。

## VPS 部署環境

正式站：**https://assess.rong-rise.com**（單機、同網域）。完整指南見 `DEPLOYMENT.md`。

架構（本站採 Traefik 既有反向代理方案）：
```
Traefik (host 網路, 80/443, Cloudflare DNS challenge 自動簽 TLS)
   └─> Nginx (本機 127.0.0.1:8090, 不對外、不處理 TLS)
         ├─ /        靜態前端  /var/www/ai-assessment
         └─ /api     反向代理  →  後端 127.0.0.1:3101
```

關鍵路徑與埠（本站實況）：
- 前端原始碼：`/opt/ai-assessment/app`（git clone，checkout 功能分支）
- 後端程式：`/opt/ai-assessment/server`（由 `deploy.sh` rsync 同步）
- 前端靜態檔：`/var/www/ai-assessment`
- 資料檔：`/var/lib/ai-assessment/db.json.sqlite3`（SQLite，擁有者 `www-data`）；同目錄下的 `db.json`（若存在）是遷移前的舊檔快照，僅供備援參考，程式不會再讀寫它
- 後端埠 `PORT=3101`（3001 已被佔用）、Nginx 用 `8090`（8080 已被佔用）
- systemd 服務：`ai-assessment-api`

部署設定檔（repo 內 `deploy/`）：
- `deploy/deploy.sh` — 一鍵重新部署腳本
- `deploy/ai-assessment-api.service` — systemd unit
- `deploy/nginx/ai-assessment-behind-traefik.conf` — 本站使用（Traefik 後方）
- `deploy/nginx/ai-assessment.conf` — 獨立 Nginx + certbot 方案（非本站）
- `deploy/traefik/ai-assessment.yml` — Traefik 路由（需併入既有 dynamic.yml）

### 更新版本到 VPS（在 VPS 上執行）

```bash
cd /opt/ai-assessment/app
git fetch origin claude/ai-assessment-survey-4vhjun
git checkout claude/ai-assessment-survey-4vhjun
git pull origin claude/ai-assessment-survey-4vhjun
bash deploy/deploy.sh    # 重建前端 → 同步後端 → npm ci --omit=dev → 重啟服務 + reload nginx
```
`deploy.sh` 會保留 `.env` 與資料檔。部署後驗證：
```bash
curl -s localhost:3101/api/health     # 應回 {"ok":true}
```

> 注意：VPS 部署在 VPS 本機執行（`deploy.sh` 全是 `sudo systemctl`、`rsync` 等本機操作）。
> 雲端開發容器無法直接 SSH 部署到 VPS。

### 後端環境變數（`server/.env`，由 `server/.env.example` 複製）

必填鍵：`JWT_SECRET`、`PORT`（本站 3101）、`DB_PATH`、`ADMIN_EMAIL`、
`ADMIN_PASSWORD`、`NODE_ENV=production`。`.env` 已列入 `.gitignore`，不進版控。

選填鍵 `TRUST_PROXY`：本站架構 Traefik → Nginx → 這支 API 有兩層反向代理，且兩層都走
loopback，不設定的話 Express 會把所有請求都當成同一個 IP（Nginx 自己的位址），導致
註冊/登入 rate limit 形同全站共用一份額度。本站應設為 `2`，但**務必在部署後從外部
網路實際驗證** `req.ip` 讀到的是使用者真實 IP，不能只憑推論設定——設太高會讓偽造的
`X-Forwarded-For` 被當真、形同繞過限流，設太低則限流仍然全站共用。

> ⚠️ 安全守則：絕不在程式碼、提交訊息、文件或對話中索取或重現密碼、JWT 密鑰、
> SSH 金鑰等任何憑證。`.env` 僅在 VPS 上以實際值存在。

## CI

GitHub Actions `deploy.yml`：在功能分支 push 時 `npm ci` → `npm run build`
→ 部署到 GitHub Pages（base `/TEST/`，預覽用途，與正式 VPS 站獨立）。

## 疑難排解（VPS）

- 後端日誌：`sudo journalctl -u ai-assessment-api -f`
- Nginx 錯誤：`sudo tail -f /var/log/nginx/error.log`
- `502 Bad Gateway`：後端未啟動或埠不符 → 檢查服務與 `.env` 的 `PORT`。
- 登入後一直登出：確認 HTTPS 已啟用且 `NODE_ENV=production`（Secure cookie 需 HTTPS）。
- 整班掃 QR 註冊時出現「請求過於頻繁」：檢查 `.env` 的 `TRUST_PROXY` 是否已設定
  （見上方「後端環境變數」），未設定時所有使用者的請求都會被 rate limiter 當成同一
  個 IP。
- 備份：`cp /var/lib/ai-assessment/db.json.sqlite3 ~/backup-$(date +%F).sqlite3`
