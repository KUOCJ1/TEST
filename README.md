# 全方位職能評測平台

線上職能／領導力評量系統：自動計分、落點分析、360° 多元評測、班級管理與教練後台。
正式站：<https://assess.rong-rise.com>

## 內建評量（4 套＋2 套預設停用，設定驅動）

| 評量 | 說明 |
|---|---|
| **L9D 經贏® 領導力九大構面行為評量** | 9 大構面 × 20 子能力 × 90 題（含反向題），支援 360° |
| **AI 全方位職能** | 課前／課後評測，量化學習成長 |
| **DISC 行為風格** | 風格型（無高低之分） |
| **識己® 16 型** | 風格型 |
| **領導力羅盤**（預設停用） | 原創領導力行為頻率評量：應變環／養成環 8 構面、人機協作、四組張力，不做總分；嚴格的 360° 隱私，班級組織診斷。設計見 `docs/leadership-new/` |
| **接班準備度評測**（預設停用） | 升任企圖、準備程度、條件接受、長期意向（自評，不做總分） |

## 角色與功能
- **學員**：註冊／登入（可掃班級 QR Code 報到）、作答、即時報告與敘事評語、歷次趨勢、發展目標與延伸閱讀、AI 小幫手。
- **教練**：班級管理、QR Code 報到、作答進度與催交（可寄提醒信）、班級學習成效、評語、梯次比較。
- **管理者**：全站 KPI、題庫開關、跨班級／跨梯次趨勢、用戶與角色、系統狀態（版本、外部依賴、寄信設定）。

## 技術
- **前端**：React 19 + Vite + Tailwind CSS，手刻 SVG 圖表（零第三方圖表相依）。
- **後端**：Node.js ≥ 22 + Express，JWT（httpOnly cookie）、bcrypt。
- **儲存**：SQLite（`better-sqlite3`）。
- **測試**：Vitest（前端）、`node --test`（後端）、Playwright（E2E，含無障礙掃描）。

## 開發
```bash
npm install
npm run dev            # 前端 (http://localhost:5173)，/api 會 proxy 到 :3001

# 另開一個終端機啟動後端（需要 Node ≥ 22）
cd server
npm install
cp .env.example .env   # 填入 JWT_SECRET 等
npm run dev
```

## 測試與建置
```bash
npm run lint           # ESLint（應為 0 problems）
npm test               # 前端 Vitest
npm run build          # production 打包
npm run test:e2e       # Playwright 端對端測試

cd server && npm test  # 後端 API 測試（node --test + supertest）
```

## 文件

- **[docs/PLATFORM_MANUAL.md](./docs/PLATFORM_MANUAL.md)** — 平台維運手冊，給接手維運與後續開發的工程師：架構、功能地圖、維運機制、常見 SOP。
- **[docs/SPRINT_PLAN.md](./docs/SPRINT_PLAN.md)** — Sprint 規劃、驗收標準與實作結果。
- **[docs/user-manual.md](./docs/user-manual.md)** — 給最終使用者（學員／教練／管理者）的操作手冊。
- **[docs/leadership-9d-spec.md](./docs/leadership-9d-spec.md)** — L9D 評量的規格書（構面定義、計分公式）。
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — 從零開始在全新 VPS 上架站的逐步指南。
- **[CHANGELOG.md](./CHANGELOG.md)** — 更新日誌：每次上線使用者看得到的變化。
- **[CLAUDE.md](./CLAUDE.md)** — 給 AI 協作工具的精簡速查表。

## 部署（VPS：Ubuntu + Nginx + HTTPS）
完整步驟見 **[DEPLOYMENT.md](./DEPLOYMENT.md)**。更新版本時於專案根目錄執行：
```bash
git pull && bash deploy/deploy.sh   # 結尾會自動跑 deploy/verify.sh 驗證
```

> 資料存在 `/var/lib/ai-assessment/db.json.sqlite3`（SQLite，WAL 模式），適合課程／中小規模；
> 需更高併發或多機時，建議改接 PostgreSQL 等資料庫。備份請用 `bash deploy/backup.sh`，
> 不要直接複製資料庫檔案。
