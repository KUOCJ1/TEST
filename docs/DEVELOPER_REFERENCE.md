# 開發者參考：領導力／職能線上評量平台

> 給接手開發者的完整參考：從架構、角色與權限，到兩套領導力評量（L9D 九大構面、八大構面 70 題）的結構與規則。
> 內容以 2026-11 的程式碼為準；細節以程式與測試為最終依據，本文件與程式不一致時以程式為準，並請回頭修正本文件。
>
> 相關文件：`CLAUDE.md`（AI 協作速查）、`docs/PLATFORM_MANUAL.md`（維運手冊）、`docs/leadership-9d-spec.md`（L9D 規格）、
> `docs/leadership-360-70-mapping.md`（70 題對照）、`DEPLOYMENT.md`（部署）、`docs/REBRAND_GUIDE.md`（換品牌）。

---

## 目錄

1. [產品概要](#1-產品概要)
2. [系統架構](#2-系統架構)
3. [角色設計與權限](#3-角色設計與權限)
4. [資料模型](#4-資料模型)
5. [評量框架總覽](#5-評量框架總覽)
6. [L9D 九大構面（90 題）](#6-l9d-九大構面90-題)
7. [八大構面（70 題）與待決問題](#7-八大構面70-題與待決問題)
8. [核心 7 構面與跨評量規則](#8-核心-7-構面與跨評量規則)
9. [360° 多評分者機制](#9-360-多評分者機制)
10. [班級與作答流程](#10-班級與作答流程)
11. [報告](#11-報告)
12. [隱私、同意與稽核](#12-隱私同意與稽核)
13. [開發規範與防呆](#13-開發規範與防呆)
14. [待決事項與已知問題](#14-待決事項與已知問題)
15. [文件與程式索引](#15-文件與程式索引)

---

## 1. 產品概要

- 用途：企業領導力與職能的線上評量。學員自評、邀請他人評（360°），系統產出個人報告、360° 報告與班級報告；
  教練（講師）帶班、留評語、追蹤發展目標；管理員管理題庫、帳號與資料。
- 主要評量：**L9D（經贏® 領導力九大構面行為評量，90 題）**，以及客戶專案用的 **八大構面（70 題）**。
  另有 AI 職能、DISC、識己性格原型、領導力羅盤（預設停用）、接班準備度（預設停用）、課後學習成效問卷（班級限定）。
- 核心原則：
  - **設定驅動**：每份評量一個設定檔，計分、報告、敘事都由設定決定；新增評量主要是新增設定檔。
  - **結果是快照**：作答送出時算好結果存起來；題庫文字更新會刷新舊結果的「顯示文字」，但不重算分數。
  - **隱私由伺服器強制**：匿名門檻、教練可見範圍等規則在後端實作，前端只負責呈現。
  - **報告不排名**：班級的客戶版報告不列個人排名；教練端只看彙總。

## 2. 系統架構

### 2.1 技術棧

| 層 | 技術 |
|---|---|
| 前端 | React 19、Vite 8、Tailwind CSS 3；PWA（`vite-plugin-pwa`，可加到主畫面，不上架商店） |
| 後端 | Node.js **≥ 22**（`better-sqlite3` 原生模組要求，Node 20 會在載入時當掉）、Express 4 |
| 認證 | JWT 放在 httpOnly cookie，密碼 bcryptjs；正式模式 cookie 為 Secure（需 HTTPS） |
| 儲存 | SQLite（`better-sqlite3`），單一檔案 `${DB_PATH}.sqlite3`，WAL 模式 |
| 測試 | Vitest（前端）、`node --test`（後端）、Playwright（端對端） |

### 2.2 部署拓撲

兩種方式，程式相同：

```
A. VPS（正式站）
Traefik（80/443，自動 TLS）
  └─> Nginx（127.0.0.1:8090，安全標頭／CSP、gzip）
        ├─ /      靜態前端（建置後的 dist/）
        └─ /api   反向代理 → Node 後端（127.0.0.1:3101）
        
B. 單一 Node 應用（例如 Hostinger Node.js 託管）
Node 後端設 STATIC_DIR=./public → 同一個程式提供前端與 /api；安全標頭由後端加（CSP_MODE）
```

- VPS 部署腳本 `deploy/deploy.sh`：備份資料庫 → 建前端 → 同步後端 → `npm ci --omit=dev` → 重啟 → `verify.sh` 驗證。
- 單一 Node 安裝包：`bash scripts/make-install-package.sh`，安裝說明 `deploy/hosting/INSTALL.md`。
- 手動觸發的 GitHub Actions 部署：`.github/workflows/deploy-vps.yml`（說明 `docs/AUTO_DEPLOY.md`）。

### 2.3 目錄

```
src/
  App.jsx, main.jsx               進入點、路由（?join= / ?invite= / ?followup= 等）
  survey/
    AppShell.jsx                  外框、導覽（手機底部導覽、桌機 SideNav）
    SurveyApp.jsx                 作答流程
    auth/ profile/ legal/         登入註冊、個人設定、隱私權政策與條款
    dashboard/ analysis/          學員的歷史與分析、360° 首頁
    coach/                        教練後台（班級、組織分析、評語、課堂模式、會談）
    admin/                        管理後台（題庫、使用者、批次上傳、專案範本、統計、稽核）
    components/                   報告與共用元件（ResultPanel、RadarChart、ThreeSixtyReport…）
    data/assessments/             題庫設定（每份評量一檔）
    utils/                        計分、敘事、360° 整理、檔名、格式…（純函式）
  test/                           前端測試
server/
  src/server.js                   進入點：種子管理員、排程（提醒信、健康檢查、刪除到期）
  src/app.js                      Express app（路由掛載、錯誤處理、選用的靜態檔）
  src/db.js                       SQLite 載入、遷移、KNOWN_ASSESSMENTS 種子
  src/routes/                     API 路由
  src/lib/                        商業邏輯（隱私、邀請、提醒、刪除、稽核…）
  test/                           後端測試
e2e/                              Playwright 端對端
deploy/                           部署設定與腳本
docs/                             規格、手冊、計畫
```

### 2.4 資料儲存方式

- 開機時把整個資料庫讀進記憶體陣列（`db.data.users` 等），寫入時 `db.persist()` 以單一交易整批覆寫。
  適合課程規模、低併發。**服務執行中不要直接改資料庫檔**（服務會用記憶體內容覆蓋）。
- 舊版純 JSON 檔開機時自動遷移，原檔保留不動。
- 備份用 `deploy/backup.sh`（線上備份＋完整性驗證），不要直接 `cp` 資料庫檔（WAL 模式會漏資料）。

## 3. 角色設計與權限

### 3.1 角色

帳號只有一個 `role` 欄位：`user`（學員）、`coach`（教練）、`admin`（管理員）。「評分者」不是角色，
而是某份作答的 `raterType`（`self` 以外）。

| 角色 | 是誰 | 主要能做的事 |
|---|---|---|
| 學員 `user` | 受評者本人 | 作答、看自己的報告與歷史、邀請他評、設定發展目標與微練習、下載或刪除自己的資料 |
| 評分者 | 任何有帳號、收到邀請的人 | 為受評者填他評（主管／同儕／部屬）；看不到受評者的報告 |
| 教練 `coach` | 講師、引導者 | 建班、管理自己班的成員與邀請、看自己班的報告與學員結果、留評語、發布班級報告、會談與反思 |
| 管理員 `admin` | 平台營運者 | 全部班級與使用者、題庫啟用與文字覆寫、批次上傳、專案範本、角色調整、統計、稽核、系統狀態 |

- 管理員帳號在第一次啟動、資料庫還沒有管理員時，由環境變數 `ADMIN_EMAIL`／`ADMIN_PASSWORD` 建立。之後改 `.env` 不會影響既有管理員。
- 角色調整：`PATCH /api/admin/users/:id/role`；停用帳號：`PATCH /api/admin/users/:id/disabled`。
- 中介層：`requireAuth`（登入）、`requireCoach`（教練或管理員）、`requireAdmin`（管理員），在 `server/src/lib/authContext.js`。

### 3.2 範圍規則（「本班教練」）

- 班級有單一 `coachId`。教練的權限**只限自己是 `coachId` 的班級**：看班級報告、改設定、發 QR、寄提醒、留評語都要符合
  `group.coachId === 我` 或我是管理員。
- 看某位受評者的全部作答（`GET /api/submissions/ratee/:rateeId`）：本人、管理員，或「受評者在我帶的某個班」的教練。
- 留評語（`POST /api/submissions/:id/comment`）：管理員，或該學員在我帶的班。
- 管理員可以把班級改派給其他教練（`PATCH /api/admin/groups/:id/coach`）。

### 3.3 權限矩陣（重點）

| 動作 | 學員 | 評分者 | 本班教練 | 其他教練 | 管理員 |
|---|---|---|---|---|---|
| 看自己的報告 | ✓ | — | — | — | — |
| 看學員的個人結果 | 本人 | ✗ | ✓ | ✗ | ✓ |
| 看 360° 他評分數 | 依匿名門檻呈現 | ✗ | 依匿名門檻呈現 | ✗ | ✓（嚴格隱私題庫去識別化） |
| 看評分者身分 | ✗ | — | ✗ | ✗ | 嚴格隱私題庫須填理由還原並留稽核 |
| 自己的 360° 多元視角報告（班級內） | 教練發布班級後才看得到 | ✗ | ✓ | ✗ | ✓ |
| 班級彙總報告 | ✗ | ✗ | ✓ | ✗ | ✓ |
| 課後問卷個人明細 | 本人 | — | ✗（只看彙總，<3 人不顯示） | ✗ | ✓ |
| 發展目標 | 本人（可選擇分享給教練） | — | 只看分享的、不含追蹤筆記 | ✗ | — |
| 「誰沒設目標」名單 | — | — | ✗（只有人數） | ✗ | — |
| 題庫啟用／文字覆寫 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 批次上傳作答 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 跨評量比較 | — | — | ✗（刻意不做） | ✗ | ✓ |

> 教練刻意不做跨班、跨評量比較：教練不應看到學員在別班或別份評量的結果。

### 3.4 帳號生命週期

- 註冊要勾同意隱私權政策（伺服器強制 `acceptPolicy: true`）；政策升版後既有使用者登入會先看到同意畫面。
- 入班方式：邀請碼（`memberInvites`，10 碼、14 天、單次、綁定 Email）、QR 報到碼（`joinCode`）、教練發班級邀請（`groupInvites`，本人接受才入班）。
  **不依 Email 自動入班**（未驗證信箱可能被搶先註冊）。
- 忘記密碼：管理員產生重設連結（`POST /api/admin/users/:id/reset-token`）；只有一位管理員時用 `server/scripts/reset-admin-password.mjs`（VPS 本機，先停服務）。
- 自助下載與刪除：`/api/me/export`、`/api/me/deletion`（有等待期，期間只能做少數動作，到期永久刪除；他評去識別化保留）。

## 4. 資料模型

集合（`server/src/db.js` 的 `COLLECTIONS`）：

| 集合 | 內容 |
|---|---|
| `users` | 帳號、角色、同意紀錄 `consent`、通知偏好、微練習 `practice`、回訪日期 `activeDays`、刪除暫存 `deletionHold` |
| `submissions` | 每份作答：`assessmentId`、`userId`（填答者）、`rateeId`（受評者）、`raterType`、`groupId`、`phase`（pre/post）、`answers`、`result`（快照）、教練評語 |
| `assessments` | 題庫 metadata：`enabled`、`hidden`、`classOnly`（種子來自 `KNOWN_ASSESSMENTS`） |
| `assessmentContent` | 管理員對題庫文字的覆寫（草稿／發佈／還原） |
| `groups` | 班級：`coachId`、`memberIds`、`assessmentId`、`startDate`/`endDate`、`publishedAt`、`joinCode`、`exclusive`、`extraAssessmentIds`、`templateId` |
| `projectTemplates` | 客戶專案範本（開班時鎖定評量） |
| `goals` | 發展目標、追蹤紀錄 `checkins`、延後 `snooze`、`sharedWithCoach` |
| `raterInvites` | 他評邀請（受評者或本班教練邀請同班成員） |
| `groupInvites`、`memberInvites` | 班級邀請、入班邀請碼 |
| `courseFollowUps` | 課後 30／60 天追蹤問卷答案 |
| `coachingSessions`、`sessionReflections` | 教練會談與會後反思 |
| `readingList`、`learningResourceClicks` | 延伸閱讀 |
| `auditLog` | 稽核紀錄（只增不改） |
| `systemStatus` | 外部依賴健康檢查狀態 |

> 新增任何「屬於某位使用者」的集合，要同步加進 `lib/accountDeletion.js` 的 `requestDeletion`／`cancelDeletion`／`exportUserData`。

## 5. 評量框架總覽

### 5.1 題庫清單

| id | 名稱 | 結構 | 預設 | 備註 |
|---|---|---|---|---|
| `leadership-9d` | 經贏® 領導力九大構面行為評量 | 9 構面、20 子能力、90 題（18 題反向） | 啟用 | 本文件第 6 節 |
| `leadership-360-70` | 經贏® 領導力八大構面行為評量（70 題） | 8 構面、70 題（無反向題） | 啟用、**hidden** | 客戶專案專用，第 7 節 |
| `ai-competency` | AI 全方位職能實戰課前評測 | 6 構面、48 題 | 啟用 | |
| `disc` | DISC 行為風格評測 | 4 構面、32 題 | 啟用 | 風格輪廓型 |
| `archetype` | 識己®性格原型評測 | 4 光譜、40 題 | 啟用 | |
| `leadership-compass` | 領導力羅盤八向評測 | 8 構面，32／69 題 | **停用** | 原創、獨立計分、嚴格隱私 |
| `succession-intent` | 接班準備度評測 | 4 面向、20 題 | **停用** | 啟用前須更新隱私政策 |
| `ai-course-post` | 課後學習成效問卷 | — | 啟用、**classOnly** | 只有附加的班級看得到；結果由伺服器計算 |

### 5.2 題庫旗標

- `enabled`：是否開放作答（管理後台切換）。`KNOWN_ASSESSMENTS` 的 `enabled` 只在資料庫還沒有該題庫時當初值。
- `hidden`（前端 `LIBRARY_HIDDEN`）：不出現在公開評測工具庫與一般學員清單；教練、管理員與「班級使用它」的成員看得到，可當班級主要評量。
  以 `KNOWN_ASSESSMENTS` 為準，開機時雙向同步。
- `classOnly`：只能當班級的「附加評量」（`extraAssessmentIds`），不能當主要評量。
- `SUPPORTS_360`：是否支援他評。`STRICT_RATER_PRIVACY`（目前只有領導力羅盤）：走更嚴格的隱私規則（第 9.4 節）。

### 5.3 一份題庫設定檔包含什麼

以 L9D 為例（`src/survey/data/assessments/leadership-9d.js`）：

| 匯出 | 用途 |
|---|---|
| `ID`、`NAME`、`NAME_EN`、`ABBR`、`DESCRIPTION` | 識別、顯示、報告檔名（`ABBR` 必填） |
| `ITEM_VERSION` | 題庫結構版本（第 13.1 節） |
| `SCALE_MIN`／`SCALE_MAX`／`SCALE_LABELS` | 量表（1–5） |
| `DIMENSIONS` | 構面 → `subDimensions` → `questions`（`id`、`text`、`reversed`、`subId`） |
| `LAYERS` | 三圈層 |
| `LEVELS` | 總分落點等級 |
| `dimensionRating(avg)` | 構面 5 級評等 |
| `COMMENTARY` | 子能力 × high/mid/low 評語 |
| `DIMENSION_COMMENTARY` | 構面 × high/mid/low 說明 |
| `DIMENSION_DEFINITIONS`、`SUB_DEFINITIONS` | 構面與子能力的一句話定義（360° 報告開頭與子能力旁） |
| `SUPPORTS_360`、`RATER_PROMPT` | 他評支援與他評版的題目語氣 |

## 6. L9D 九大構面（90 題）

### 6.1 構面結構

| # | 構面 id | 名稱 | 圈層 | 題號 | 子能力（題數） |
|---|---|---|---|---|---|
| 1 | `communication` | 溝通力 | 個人基礎 | l1–l10 | 聆聽他人(4)、處理訊息(3)、有效地溝通(3) |
| 2 | `collaboration` | 建立關係 | 人際協作 | l11–l20 | 建立人員關係(6)、引領團隊成功(4) |
| 3 | `task-management` | 任務管理 | 個人基礎 | l21–l30 | 工作效率(5)、勝任工作(5) |
| 4 | `execution` | 執行力 | 個人基礎 | l31–l40 | 採取行動(6)、創造結果(4) |
| 5 | `leadership-impact` | 領導影響力 | 組織領導 | l41–l50 | 讓人信任(3)、提供方向(4)、授權委責(3) |
| 6 | `developing-others` | 人才發展 | 人際協作 | l51–l60 | 培養個人才能(7)、激勵成功(3) |
| 7 | `critical-thinking` | 思辨與決策 | 組織領導 | l61–l70 | 分析判斷(5)、決策定見(5) |
| 8 | `self-development` | 自我成長 | 個人基礎 | l71–l80 | 展現承諾(4)、尋求改善(6) |
| 9 | `succession-readiness` | 接班成熟度 | 組織領導 | l81–l90 | 使命承諾(4)、世代協作與準備(6) |

- 每個構面 10 題，其中 2 題反向題，共 18 題反向。
- 構面名稱以系統名稱為準（例如第 2 構面已由「協作關係」改為「建立關係」）。名稱只在設定檔一處，報告與舊結果顯示都會跟著更新。
- 三圈層用於「瓶頸識別」：個人基礎薄弱先強化第一圈；第一圈穩健但人際弱聚焦協作與人才培育；前兩圈紮實時才看組織領導。

### 6.2 計分

1. 題目有效分：`effectiveScore = reversed ? (6 − raw) : raw`（量表 1–5）。
2. 子能力平均 → 構面平均 → 構面總分 → 全量表總分（90–450）。
3. 落點 4 級（總分）：

| 等級 | 總分 |
|---|---|
| 🌱 領導探索期 | 90–225 |
| 📈 領導發展期 | 226–315 |
| 🚀 領導精熟期 | 316–405 |
| 👑 卓越領導者 | 406–450 |

4. 構面 5 級（構面平均）：精熟 ≥ 4.2／熟練 3.4–4.19／發展中 2.6–3.39／萌芽 1.8–2.59／待啟蒙 < 1.8。
5. 子能力評語 3 段（`bandOf()`）：high ≥ 4.5／mid 3.5–4.49／low < 3.5。構面說明 `DIMENSION_COMMENTARY` 用同一組門檻。

### 6.3 敘事報告

- 有 `COMMENTARY` 的題庫才顯示敘事報告，沒有就不顯示也不報錯。
- 段落模板以 `seed = hash(總分 | 構面ID)` 選取：同一份報告穩定，不同人有變化（`utils/narrative.js`）。
- 「思辨與決策」「接班成熟度」的子能力語句是新撰，仍待顧問審核。

### 6.4 構面落差提示

- `utils/dimensionInsights.js`：兩個構面形成特定組合時給說明與建議課程。目前只有一條規則：「任務管理 < 3.5、執行力 ≥ 3.5、差距 ≥ 0.7」，門檻暫定。
- 新增規則要補測試（`src/test/dimension-text.test.js`）。

## 7. 八大構面（70 題）與待決問題

### 7.1 定位

- id `leadership-360-70`、簡稱 `L8D`、`ITEM_VERSION` `2026-11`、支援 360°、**hidden（客戶專案專用）**。
- 框架沿用 L9D：構面、子能力名稱、顏色、圈層、等級名稱、構面評等與子能力評語都取自 L9D，報告與 L9D 是同一套版型。
- 題目是客戶表單的 70 題（1–5 分、全部正向、無反向題），題號 l1–l70 與表單的 1–70 一一對應，表單匯出可直接批次上傳。
- 與 L9D 的差異：沒有「思辨與決策」「接班成熟度」，多了「應變與創新」。

### 7.2 構面與題號對照（系統目前）

| 構面 | 子能力：題號 | 題數 |
|---|---|---|
| 溝通力 | 聆聽他人 1–4／處理訊息 5–8／有效地溝通 9–12 | 12 |
| 領導影響力 | 讓人信任 13–17／提供方向 18–21／授權委責 22–26 | 14 |
| 應變與創新（L9D 沒有） | 因應環境變化 27–29／創新思考 30–33 | 7 |
| 建立關係 | 建立人員關係 34–38／引領團隊成功 39–43 | 10 |
| 任務管理 | 工作效率 44–47／勝任工作 48–50 | 7 |
| 執行力 | 採取行動 51–54／創造結果 55–57 | 7 |
| 人才發展 | 培養個人才能 58–61／激勵成功 62–64 | 7 |
| 自我成長 | 展現承諾 65–67／尋求改善 68–70 | 6 |

- 總分 70–350；落點 4 級：探索期 70–175／發展期 176–245／精熟期 246–315／卓越 316–350（依 L9D 比例換算）。
- 對照表放在設定檔的 `BLOCKS`，說明在 `docs/leadership-360-70-mapping.md`。改分組只要改 `BLOCKS`，但已匯入的結果是快照，**改分組後要移除並重新匯入**才會反映。

### 7.3 與顧問原表（V4.0）的差異：待決

拿顧問提供的原始題目表比對（題目文字 70 題完全一致），有以下差異尚未處理：

1. **4 題的歸屬不同**（會影響構面與子能力分數）：

| 題號 | 題目 | 顧問原表 | 系統目前 |
|---|---|---|---|
| 5 | 能總結他人意見，並確認理解是否正確 | 溝通／聆聽他人 | 溝通力／處理訊息 |
| 13 | 能夠準備好目前工作相關資訊，讓相關人員可以使用 | 溝通／有效地溝通 | 領導影響力／讓人信任 |
| 26 | 因著不同的工作型態彈性調整人員管理 | 適應力／因應環境變化 | 領導影響力／授權委責 |
| 38 | 公平地解決衝突 | 建立關係／引領團隊成功 | 建立關係／建立人員關係 |

   依原表，各構面題數應為：溝通 13、領導 12、適應力 8、建立關係 10（其餘相同）。
   要改：調整 `BLOCKS` → 升版 `ITEM_VERSION` → 更新結構指紋 → 已匯入的資料移除重匯。
2. **量表選項文字不同**：原表是行為程度（1 並非如此、2 有待改進、3 達到標準、4 表現優秀、5 非常卓越）；系統沿用 L9D 的同意程度（非常不同意…非常同意）。數字相同但語意不同，影響作答習慣。這是文字修改，不影響結構。
3. **評分者類型**：原表有「客戶」，系統只有自評、主管、同儕、部屬。加類型會牽動匿名門檻、報告配色與批次上傳格式。
4. **第 24 題錯字**：「給予他人權限去獨完成工作」應為「獨立」（原表備註已標）。文字修正。
5. **原表備註欄的措辭修訂**（第 15、58、59、60、65 題等）待顧問確認是否採納。
6. **原表的構面名稱**：溝通、領導力、適應力、建立關係、任務管理、生產力、發展他人、個人發展。系統採用系統名稱（只有「建立關係」與原表一致）。若要全部改用原表名稱需先與產品負責人確認，因為 L9D 共用同一組名稱。

### 7.4 授權

這套題目與公開的商用 360° 工具在架構與內容上高度相似，**授權與歸屬確認前維持專案專用（hidden），不要改成公開**。
要公開時：拿掉 `KNOWN_ASSESSMENTS` 與設定檔的 hidden／`LIBRARY_HIDDEN`，並補上首頁摘要 `ASSESSMENT_SUMMARIES` 與說明頁 `GUIDES`。

## 8. 核心 7 構面與跨評量規則

- 核心 7：溝通力、建立關係、任務管理、執行力、領導影響力、人才發展、自我成長（`utils/coreDimensions.js` 的 `CORE_DIMENSION_IDS`）。
- L9D ＝ 核心 7 ＋ 思辨與決策 ＋ 接班成熟度；八大構面 ＝ 核心 7 ＋ 應變與創新。**沒有任何一套是「十大構面」。**
- 兩套總分範圍不同（90–450／70–350），**不能比總分**；跨評量比較一律用核心構面平均（1–5）。
- 管理後台「各評量統計」底下有核心構面並排比較（`admin/CoreCompareSection.jsx`），每人每份評量取最新一次自評。教練端刻意不做。

## 9. 360° 多評分者機制

### 9.1 評分者類型與邀請

- 類型：`self`（自評）、`manager`（主管）、`peer`（同儕）、`subordinate`（部屬）；`others`（他評合計）是彙整項目，不是可選的類型。
- **他評須先有邀請**：受評者或本班教練邀請同班成員（`raterInvites`）。教練可寄提醒給「已邀請、未完成」的評分者。
- 每位評分者（類型＋填答者）只採計最新一次作答。

### 9.2 匿名門檻（`utils/report360.js` 的 `planVisibility`，A4 與手機閱讀版共用）

- 某一類（含主管）要 **≥ 3 位**才單獨呈現分數（`MIN_GROUP_SHOWN = 3`）。
- 不足 3 位的類別只併入「他評合計」。若併完後剩下的合計只有 1–2 位，會把人數最少的已呈現類別也併入，避免從合計減回個人分數。
- 他評合計 < 3 位：整份他評不顯示（`othersSuppressed`），報告只剩自評並說明原因。
- 改報告畫面時用 `r.shownTypes`／`r.hiddenTypes`，**不要自己用 `r.counts[t] > 0` 判斷**。
- 教練端的「他評不足」提示（`coverage360.js`、`coachWorkbench.js`）與這套規則同步。

### 9.3 分數與差距

- 各類分數＝該類評分者平均；他評合計＝所有他評評分者平均，**每位評分者等權重**（不因某類人多而偏重）。
- 差距＝自評 − 他評合計：≥ 0.5 為「自評高於他評（可能的盲點）」，≤ −0.5 為「他評高於自評（被低估的優勢）」（`GAP_THRESHOLD`）。
- 參考區間帶 `REF_BAND` 3.5–4.5（子能力語句的「中」段）；評分者群組間差距旗標：構面 ≥ 1.0、子能力 ≥ 1.5（`GROUP_GAP_DIM`、`GROUP_GAP_SUB`）。
- 強項、優先發展與子能力排名依「他人眼中」的分數，沒有他評時退回自評。

### 9.4 嚴格隱私（只有領導力羅盤）

`server/src/lib/compassPrivacy.js`：教練與一般使用者永遠看不到個別評分者身分或個別分數；
同儕／部屬同類 ≥ 3 位才單獨顯示、合計也須 ≥ 3 位；主管評分須受評者同意才顯示；
只有管理員能還原身分，須填理由並留稽核；管理員總覽也去識別化。

## 10. 班級與作答流程

- **每筆作答寫入 `groupId`**（提交當下所屬班級）。班級報告優先用 `groupId` 歸屬；舊資料 `groupId` 為 null 時才用當下成員名單反查。
  這讓同一學員可參加多梯課程不互相污染，移出班級也不會抹掉當時的作答。
- **重複提交**以「班級＋階段（課前／課後）」為鍵：同班同階段擋 409；同班課前→課後放行；不屬於任何班級不擋。
- **班級階段**（`getGroupPhase`）：未開始 → 進行中（`startDate` 到 `endDate`）→ 結束 → 已發布（`publishedAt`）。
  班級結束後、教練發布前，學員的 360° 多元視角報告顯示「教練審閱中」；發布後才開放（`POST /api/coach/groups/:id/publish`）。
- **QR 報到**：班級單一 `joinCode`（重新產生使舊碼失效、撤銷設 null）。公開查詢 `GET /api/public/join/:code` 免登入、不含成員或成績；
  帶有效代碼的註冊／登入限流放寬（5 分鐘 10 次 → 100 次）。
- **專屬班級** `exclusive`：一般學員只看到本班評量。**專案範本**：管理員維護，開班時鎖定評量，伺服器也拒絕另選或事後改。
- **一致性警告**（`lib/groupConsistency.js`）：班級總覽提示「幾乎一定有問題」的情況（例如匯入資料的評量和班級不符），不阻擋操作。
- **批次上傳**（管理員）：選填 `phase` 欄（pre／post／課前／課後，空白＝前測）；缺題的列預設不匯入；欄位和評量對不上整檔擋下；
  匯錯了用「移除已匯入的作答」（先預覽再確認）。驗證在 `admin/batchValidation.js`。
- **課後問卷**（`classOnly`）：提交寫 `surveyGroupId` 而非 `groupId`；結果與標準答案只在伺服器（`lib/courseSurvey.js`）；
  30／60 天追蹤信只寄給同意者（`lib/courseFollowUp.js`）。
- **學員端延伸**：報告一分鐘版、四週微練習、發展目標與提醒、成長時間軸、複測前回顧（細節見 `CLAUDE.md`）。

## 11. 報告

| 報告 | 元件 | 重點 |
|---|---|---|
| 個人報告 | `ResultPanel`、`PrintableReport` | 落點、雷達圖、構面說明、子能力評語、落差提示、發展建議 |
| 360° 報告 | `ThreeSixtyReport`、`threesixty/GroupCharts` | 封面（自評與各類分開）、目錄、評量項目與定義、評估方式、整體評價、雷達與群組橫條、子能力排名、構面詳述、討論題 |
| 班級報告 | `GroupPrintableReport` | 客戶版（預設，無排名與個別頁）／教練版；管理者摘要、課前課後比較、課後問卷 |
| 手機閱讀版 | `MobileReportViews` | 與 A4 版同步，改報告時兩邊都要改 |

- 列印與存 PDF：一律用 `useReportFilename(filename)` 設檔名，**不要直接 `window.print()`**。
  檔名規則 `[班級]_[評量簡稱]_[類型]_[對象]_[YYYYMMDD]`（`utils/reportFilename.js`，台北日期）；新評量要有 `ABBR`（有測試檢查）。

## 12. 隱私、同意與稽核

- 隱私權政策與條款在 `src/survey/legal/policy.js`（內容、版本、公開狀態），公開頁 `/privacy`、`/terms`。
- 前後端 `POLICY_VERSION`（`server/src/lib/policy.js` 與前端）**必須一致**，有測試檢查；升版後使用者登入先同意。
- 政策文字要對照程式行為：改了蒐集欄位、保存、第三方，就要回來改文字。
- 稽核：敏感操作呼叫 `auditLog(req, action, extra)`（`lib/helpers.js`），同時寫日誌與資料庫 `auditLog`，管理後台可查。
- 回訪紀錄只記登入日期（`activeDays`，不回傳給前端的使用者物件）。
- 教練看不到：評分者身分、課後問卷個人明細、「誰沒設定目標」名單、學員在別班或別份評量的結果。

## 13. 開發規範與防呆

### 13.1 改題庫

- **結構**（題數、題號、構面、子能力、反向題、量表、等級門檻）：先升版該題庫的 `ITEM_VERSION`，再執行
  `node scripts/print-fingerprints.mjs` 更新 `src/test/fixtures/assessment-fingerprints.json`；測試會擋未升版的結構變更。
- **文字**（題目、評語、名稱、定義）：不用升版。管理員也可在後台覆寫文字（草稿／發佈／還原），覆寫在前端載入後就地修改設定物件。
  **不要在模組載入時把這些文字複製到別處快取**，否則覆寫不會生效。
- 新增構面要補 `DIMENSION_DEFINITIONS`、`SUB_DEFINITIONS`、發展目標起手行動 `data/goal-starters.js`（都有測試）。

### 13.2 測試與提交

- 提交前：`npm test`、`npm run build`、`npm run lint`（0 problems）、`cd server && npm test`；改介面後跑 `npm run test:e2e`。
- 手機樣式只加在 `sm` 以下，桌機版面不變；手機與桌機不同元件用 `useIsMobile()`；頁首下方的元素用 `--app-header-h`。`e2e/mobile-layout.spec.js` 會擋。
- 走查：`npm run audit:mobile`（390 寬）、`npm run audit:desktop`（1280 寬），要逐屏看截圖。新增入口（信件連結、導覽）要補 `e2e/entry-links.spec.js`。

### 13.3 其他慣例

- 日期輸入用 `utils/format.js` 的 `toDateInputValue`，不要用 `toISOString().slice(0, 10)`（台灣會少一天）。
- 全站焦點構面用 `utils/focus.js` 的 `focusDimension`，不要自己排序。學員首頁待辦加進 `utils/thisWeek.js`。
- `TRUST_PROXY` 依反向代理層數設定，部署後要從外部網路確認 `req.ip` 是使用者的真實 IP。
- 金鑰、密碼、JWT 密鑰只放在主機環境變數，不寫進程式、提交、文件或對話。

## 14. 待決事項與已知問題

| 項目 | 狀態 | 影響 |
|---|---|---|
| 八大構面 4 題歸屬與顧問原表不一致（第 7.3 節） | 待決 | 改了要升版並重匯已匯入的資料 |
| 八大構面量表選項文字（同意程度 vs 行為程度） | 待決 | 作答語意 |
| 評分者類型「客戶」 | 待決 | 匿名門檻、報告、批次格式 |
| 第 24 題錯字 | 待修 | 文字 |
| 八大構面授權與歸屬 | 待確認 | 確認前維持 hidden |
| L9D「思辨與決策」「接班成熟度」語句、構面與子能力定義 | 待顧問審核 | 文字 |
| 構面落差提示門檻 | 暫定 | 試行後校準 |
| 隱私權政策「暫定版」旗標 | 待法務審閱 | 審閱後移除 `provisional` |
| 領導力羅盤、接班準備度 | 預設停用 | 啟用前要先部署新版政策並校準切分點 |

## 15. 文件與程式索引

| 主題 | 位置 |
|---|---|
| L9D 規格（題目、計分、評語） | `docs/leadership-9d-spec.md` |
| 八大構面對照 | `docs/leadership-360-70-mapping.md`、`src/survey/data/assessments/leadership-360-70.js` |
| 計分 | `src/survey/utils/scoring.js` |
| 敘事 | `src/survey/utils/narrative.js` |
| 360° 整理與門檻 | `src/survey/utils/report360.js` |
| 核心構面 | `src/survey/utils/coreDimensions.js` |
| 權限中介層 | `server/src/lib/authContext.js` |
| 嚴格隱私 | `server/src/lib/compassPrivacy.js` |
| 邀請 | `server/src/lib/memberInvites.js`、`server/src/routes/invites.js`、`docs/onboarding-invitations-spec.md` |
| 帳號刪除與匯出 | `server/src/lib/accountDeletion.js`、`server/src/routes/me.js` |
| 題庫種子與旗標 | `server/src/db.js`（`KNOWN_ASSESSMENTS`） |
| 批次上傳 | `src/survey/admin/batchValidation.js`、`docs/BATCH_IMPORT_SOP.md` |
| 客戶專案流程 | `docs/CUSTOMER_PROJECT_PLAYBOOK.md` |
| 維運手冊（API 路由表、SOP） | `docs/PLATFORM_MANUAL.md` |
| 部署 | `DEPLOYMENT.md`、`deploy/`、`docs/AUTO_DEPLOY.md`、`deploy/hosting/INSTALL.md` |
| 換品牌 | `docs/REBRAND_GUIDE.md` |
| 手機 App 化 | `docs/MOBILE_APP_PLAN.md` |
| 領導力羅盤規格 | `docs/leadership-new/04-platform-spec-v0.1.md` |
