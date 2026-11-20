# 換品牌與內容指南（給接手單位）

把平台換成自己的品牌、視覺與內容時，需要改的地方依「改了馬上看得到」到「容易漏掉」排列。
改完請跑 `npm test`、`npm run build`、`npm run lint`，並用 `npm run test:e2e` 走一遍主要流程。

> 建置：Node.js **22 以上**。前端在專案根目錄 `npm ci && npm run build`（輸出 `dist/`）；
> 後端在 `server/` 執行 `npm ci --omit=dev`。想把前端與後端放在同一個 Node 應用（例如 Hostinger Node.js 託管），
> 後端設環境變數 `STATIC_DIR` 指向建置後的 `dist/` 即可；打包腳本是 `scripts/make-install-package.sh`。

## 1. 標誌與圖示（`public/`）

| 檔案 | 用途 |
|---|---|
| `public/favicon.svg` | 瀏覽器分頁圖示，也是登入頁、頂欄、行銷頁導覽的標誌（`AppShell.jsx`、`LoginPage.jsx`、`MarketingNav.jsx` 等直接引用） |
| `public/logo-mark.svg`、`public/logo-mark-reverse.svg` | 標誌（深色與淺色底版本），報告封面使用 |
| `public/icons/icon-192.png`、`icon-512.png`、`maskable-512.png`、`apple-touch-icon.png` | 手機「加到主畫面」的圖示（PWA） |

- 換圖時保留檔名與尺寸，程式就不用改。
- `maskable-512.png` 要把標誌放在中央 80% 的安全區內，否則在 Android 上會被圓形遮罩切掉。
- 報告封面的標誌排版在 `printable-report/CoverPage.jsx`、`ThreeSixtyReport.jsx`、`GroupPrintableReport.jsx`、`compass/CompassReportPages.jsx`。

## 2. 名稱與應用設定

- `index.html`：`<title>`、`apple-mobile-web-app-title`、`theme-color`。
- `vite.config.js`：PWA 的 `name`、`short_name`、`theme_color`、`background_color`（這些會寫進 `manifest.webmanifest`）。
- 顯示品牌名稱的元件（搜尋「榕光」）：`AppShell.jsx`、`SideNav.jsx`、`UserMenu.jsx`、`LoginPage.jsx`、`OnboardingBanner.jsx`、`InstallPrompt.jsx`、行銷頁（`marketing/`）。
- 後端的名稱出處：`server/src/routes/chat.js`（AI 小幫手自我介紹與系統提示）、`server/src/lib/mailer.js`（信件寄件者預設）、`server/src/lib/accountDeletion.js`、`server/src/lib/health.js`。

## 3. 配色與字型

- 色票在 `tailwind.config.js`（`ink` 主色、`brass` 輔色、`paper` 底色、`slate` 灰階），只改色值，名稱沿用。
- 深色模式：`src/styles/dark.css`、`src/styles/dark-status.css`（CSS 變數）。
- 設定色與底色的對比度（AA）由 `src/survey/utils/color.js` 處理；換色後跑 `npm test` 會檢查。
- 設計說明與樣張：`docs/design/`。

## 4. 法律文字與經營者資訊（上線前必改）

- `src/survey/legal/policy.js`：
  - `operatorName`（經營者名稱）、`contactEmail`（個資聯絡信箱）要換成自己單位的。
  - `status: 'published'` 之前頁面會顯示草稿標記；`provisional: true` 是「暫定版」旗標，請法務審閱後再移除。
  - 內文 `{{operator}}`、`{{contact}}` 會自動換成上面的設定。
  - 文字中提到的第三方（延伸閱讀的第二大腦 API、AI 小幫手的 OpenRouter、寄信服務）要對照你實際使用的服務修改。
- 修改政策後要同步升版：前端 `src/survey/legal/policy.js` 與後端 `server/src/lib/policy.js` 的 `POLICY_VERSION` **必須一致**（有測試檢查）。升版後每位用戶下次登入都會看到同意畫面。
- 政策文字要對照程式實際行為：改了蒐集欄位、保存期間或第三方，就要回頭改文字。

## 5. 外部服務（預設指向原單位，請改成自己的或停用）

| 位置 | 預設 | 處理 |
|---|---|---|
| `BRAIN_API_BASE_URL`（`server/src/routes/learningResources.js`、`lib/health.js`） | 原單位的知識庫網址 | **不設的話仍會預設呼叫原單位的知識庫。** 請設成自己的服務；沒有的話設成一個不存在的網址即可停用（延伸閱讀區會自然不顯示，不影響其他功能），但管理後台的外部依賴健康檢查會顯示該服務不可用，並可能寄告警信給管理員。要完全移除需改 `learningResources.js` 與 `health.js` |
| `APP_URL`（`lib/mailer.js`、`routes/chat.js`） | 原單位正式站網址 | 設成你自己的網站網址（信件裡的連結會用它） |
| `OPENROUTER_API_KEY` | 無 | 要用 AI 小幫手才申請；沒填就自動停用 |
| `SMTP_*` | 無 | 要寄信才設定；三項都填才啟用 |

金鑰與密碼一律只放在伺服器的環境變數，不要寫進程式碼或提交到版控。

## 6. 評量題庫與報告文字

- 題庫設定在 `src/survey/data/assessments/`，每個評量一個檔。結構（題數、構面、子能力、反向題、量表）改動前先讀 `docs/` 與 `CLAUDE.md` 的「評量定義固定與防呆」：
  改結構要升版該題庫的 `ITEM_VERSION` 並更新結構指紋 `src/test/fixtures/assessment-fingerprints.json`（`node scripts/print-fingerprints.mjs`），測試會擋。純文字修改不用。
- 可由管理者在後台覆寫的只有文字（名稱、題目、評語、等級說明），不含計分（`docs/PLATFORM_MANUAL.md` 第 4.4 節）。
- 報告用語、構面定義與子能力說明：`leadership-9d.js` 的 `COMMENTARY`、`DIMENSION_COMMENTARY`、`DIMENSION_DEFINITIONS`、`SUB_DEFINITIONS`。
- 英文名稱與簡稱：`assessment-english-names.js`、各題庫的 `ABBR`（報告 PDF 檔名使用，新評量一定要有）。
- 首頁與說明頁文字：`marketing/`、`data/assessment-guides.js`。
- 題庫內容若含第三方商標或授權內容（例如標示 ® 的名稱），換成自己的內容前請先確認使用權。

## 7. 手冊與文件

- 使用手冊：`docs/user-manual.md`；截圖用 `npm run manual:screenshots` 重新產生，PDF 用 `npm run generate-manual`，輸出到 `public/user-manual.pdf`。
- 維運手冊：`docs/PLATFORM_MANUAL.md`、`CLAUDE.md`（給 AI 協作工具的速查）、`DEPLOYMENT.md`。

## 8. 安全標頭（CSP）

- VPS 用 Nginx 時，標頭在 `deploy/nginx/ai-assessment-behind-traefik.conf`。
- 單一 Node 應用模式（設了 `STATIC_DIR`）時，標頭由後端加，預設內容安全政策（CSP）只回報不攔截：
  環境變數 `CSP_MODE` 可設 `report-only`（預設）、`enforce`（正式啟用）、`off`。
  建議先用預設模式把所有功能走一遍（作答、報告列印、QR Code、AI 小幫手、管理後台），確認瀏覽器主控台沒有違規，再改成 `enforce`。
- 如果加了外部字型、分析碼或其他外部資源，要同步擴充 `server/src/app.js` 的 `CSP` 字串（與 Nginx 設定同一份）。

## 9. 資料

- 這份程式碼不含任何使用者或作答資料，新站是全新資料庫。
- 第一位管理員由環境變數 `ADMIN_EMAIL`／`ADMIN_PASSWORD` 在第一次啟動時建立；忘記密碼用 `node scripts/reset-admin-password.mjs`（先停服務）。
