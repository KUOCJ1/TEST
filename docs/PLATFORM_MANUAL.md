# 平台維運手冊

> 版本：2026-09　|　適用對象：**接手本系統維運與後續開發的工程師**
>
> 這份手冊回答「這個系統為什麼長這樣、整體怎麼運作、我要怎麼在不搞壞既有東西的
> 前提下繼續開發與維運」。跟其他文件的分工：
>
> | 文件 | 回答什麼問題 |
> |------|------|
> | **本檔（`docs/PLATFORM_MANUAL.md`）** | 架構、功能全貌、維運機制、系統目的——給**接手工程師**看 |
> | [`docs/user-manual.md`](./user-manual.md) | 畫面上每個按鈕做什麼——給**最終使用者**（學員／教練／管理者）看 |
> | [`CLAUDE.md`](../CLAUDE.md) | 給 Claude Code 這類 AI 協作工具的精簡速查表（指令、目錄結構、已知陷阱） |
> | [`README.md`](../README.md) | 專案首頁，給第一次接觸的人 30 秒版本 |
> | [`DEPLOYMENT.md`](../DEPLOYMENT.md) | **從零開始**在一台全新 VPS 上架站的逐步操作手冊 |
> | [`docs/leadership-9d-spec.md`](./leadership-9d-spec.md) | L9D 評量的心理計量規格書（構面定義、計分公式、題目來源） |
>
> 本檔不重複 `DEPLOYMENT.md` 的逐行指令，而是解釋**為什麼**架構長這樣、各個環節
> **彼此的關係**，讓你在指令之外真正理解系統，也知道遇到沒寫在手冊裡的狀況時該
> 往哪裡查、往哪裡改。

---

## 目錄

1. [系統目的與商業脈絡](#1-系統目的與商業脈絡)
2. [架構總覽](#2-架構總覽)
3. [資料模型](#3-資料模型)
4. [評量引擎：設定驅動的核心設計](#4-評量引擎設定驅動的核心設計)
5. [四套評量題庫](#5-四套評量題庫)
6. [前端功能地圖（依角色）](#6-前端功能地圖依角色)
7. [後端 API 一覽](#7-後端-api-一覽)
8. [認證、權限與流量控制](#8-認證權限與流量控制)
9. [班級與 QR Code 報到機制](#9-班級與-qr-code-報到機制)
10. [第三方整合](#10-第三方整合)
11. [部署架構與維運](#11-部署架構與維運)
12. [測試與 CI](#12-測試與-ci)
13. [已知限制與技術債](#13-已知限制與技術債)
14. [常見維運情境 SOP](#14-常見維運情境-sop)

---

## 1. 系統目的與商業脈絡

「全方位職能評測」是**榕耀管理顧問**（RongRise Consulting，正式站
`https://assess.rong-rise.com`）用來支撐企業培訓與顧問業務的線上評測平台。
它不是一個通用問卷工具，而是圍繞著顧問公司實際的教學流程設計的：

1. **課前**：學員在正式課程開始前，先完成一份標準化評測，取得自己的職能／
   領導力／行為風格基準點。
2. **課中／課後**：教練（顧問公司的講師）透過教練後台查看整班的落點分布、
   針對個別學員或整班撰寫評語，並可要求同一批學員「課後」再測一次，
   系統自動比對課前 / 課後成績、量化學習成長。
3. **延伸學習**：報告頁最下方會依評測結果推薦「第二大腦」知識庫
   （`brain.rong-rise.com`）裡對應主題的文章，把「評測 → 診斷 → 學習」的
   閉環往下延伸一步，而不是評完測就結束（見第 10 節）。
4. **360° 多元評測**（部分題庫）：除了自評，也可以收集主管、同儕、部屬對
   同一人的評分，提供比自陳量表更立體的視角。

系統支援**多套題庫**（目前 4 套，見第 5 節），因為顧問公司針對不同課程／
不同客群設計了不同的評測工具，且未來會持續新增——這也是第 4 節「設定驅動」
架構存在的直接原因：新增一套題庫不需要改動計分引擎或報告元件本身。

三種角色、三種介面：

| 角色 | 是誰 | 主要任務 |
|------|------|---------|
| 學員 | 參加課程的企業員工/主管 | 填答評量、看個人報告與歷程 |
| 教練 | 顧問公司的講師 | 管理班級、看班級落點分析、撰寫評語、追蹤 360° 進度 |
| 管理者 | 顧問公司內部（CJ哥／營運） | 開關題庫、看全站統計、管理帳號角色、批次匯入名單 |

---

## 2. 架構總覽

單機部署、同網域，前後端分離但同源（省去 CORS 設定）：

```
瀏覽器
  │
  ├── /            React SPA 靜態檔（Vite build 產物）
  └── /api/*       Express REST API（JSON）
         │
         ├── SQLite（better-sqlite3，單一檔案）── 使用者／作答／題庫／班級／目標
         ├── OpenRouter API（外部）────────────── AI 聊天小幫手
         └── 第二大腦 API（外部，brain.rong-rise.com）── 延伸閱讀文章
```

正式站的實際反向代理層（VPS 上已有 Traefik 佔用 80/443，見第 11 節）：

```
Traefik (host 網路, 80/443, Cloudflare DNS challenge 自動簽 TLS)
   └─> Nginx (本機 127.0.0.1:8090, 不對外、不處理 TLS)
         ├─ /        靜態前端  /var/www/ai-assessment
         └─ /api     反向代理  →  後端 127.0.0.1:3101
```

### 技術棧

| 層 | 技術 | 備註 |
|----|------|------|
| 前端 | React 19 + Vite 8 + Tailwind CSS 3 | 手刻 SVG 圖表（雷達圖等），零圖表函式庫相依 |
| 前端路由 | react-router-dom 7 | `AppShell`／行銷頁皆 `lazy()` 拆分 chunk，見 `src/App.jsx` |
| 後端 | Node.js **≥22**（`better-sqlite3` 原生模組要求，Node 20 會在載入時 segfault）+ Express 4 | |
| 認證 | JWT（httpOnly cookie）+ bcryptjs | 見第 8 節 |
| 儲存 | SQLite（`better-sqlite3`，WAL 模式） | 每個 collection 的每筆記錄以 JSON 字串存一個 row，見第 3 節 |
| 前端測試 | Vitest + Testing Library | `src/test/` |
| 後端測試 | Node 內建 `node --test` + supertest | `server/test/` |
| E2E | Playwright（已安裝，`@playwright/test`） | |

### 前端目錄結構

```
src/
├── App.jsx, main.jsx, index.css       路由骨架、深色模式全域覆寫
├── survey/
│   ├── AppShell.jsx, SurveyApp.jsx    登入後主框架、作答流程
│   ├── admin/                         管理後台（AdminDashboard、批次匯入…）
│   ├── auth/                          登入/註冊/忘記密碼
│   ├── coach/                         教練後台（CoachDashboard、班級管理、360° 追蹤）
│   ├── components/                    ResultPanel、RadarChart、NarrativeReport、
│   │                                   LearningResources、GroupNarrativeReport…
│   ├── dashboard/                     UserDashboard（個人歷程/歷次趨勢）
│   ├── profile/                       個人設定
│   ├── data/assessments/              題庫設定（見第 4-5 節）
│   ├── marketing/                     行銷頁（About/HowItWorks/Showcase/FAQ）
│   ├── api/client.js                  唯一的後端 API 呼叫入口
│   └── utils/                         scoring.js（計分引擎）、narrative.js（敘事評語）、
│                                       suggestions.js（行動建議）
└── test/                              前端測試
```

### 後端目錄結構

```
server/src/
├── server.js                進入點（讀 .env、建立 db、監聽 PORT）
├── app.js                   createApp()：組裝所有 router，供正式環境與測試共用
├── db.js                    SQLite 初始化、collection 讀寫、KNOWN_ASSESSMENTS 種子
├── auth.js                  密碼雜湊、JWT 簽發/驗證
├── lib/
│   ├── authContext.js       requireAuth / requireAdmin / requireCoach 中介層
│   ├── helpers.js           asyncHandler、輸入清洗（sanitizeXxx）
│   ├── joinCode.js          QR 報到代碼產生邏輯
│   └── learningResourceTopics.js   構面 → 第二大腦搜尋關鍵字對照表
└── routes/                  各功能的 Express Router（見第 7 節）
```

---

## 3. 資料模型

SQLite 只有一張實體表，用「collection + id」當複合主鍵，每筆記錄整包存成
JSON 字串（見 `server/src/db.js`）：

```sql
CREATE TABLE records (
  collection TEXT NOT NULL,   -- 'users' | 'submissions' | 'assessments' | 'groups' | 'goals'
  id TEXT NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);
```

啟動時整批讀進記憶體陣列（`db.data.users`、`db.data.submissions` …），程式
邏輯全部對記憶體陣列操作，`db.persist()` 才用單一交易整批覆寫回 SQLite——
呼叫端介面因此跟舊版純 JSON 檔儲存完全相同，遷移對業務邏輯是透明的。這個
設計適合**課程規模、低併發**的使用情境（見第 13 節的規模限制）。

五個 collection 的角色：

| Collection | 內容 | 誰寫入 |
|---|---|---|
| `users` | 帳號（email、密碼雜湊、role: user/coach/admin、所屬 groupId 等） | 註冊/登入、管理者改角色 |
| `submissions` | 每一次評測作答（answers、算出來的 result、groupId、raterId/rateeId 用於 360°、教練評語） | 學員提交、教練留言 |
| `assessments` | 題庫 metadata（id/name/description/enabled），**不含題目本體**——題目在前端 `src/survey/data/assessments/*.js` | 開機自動種子（見下） |
| `groups` | 班級（成員名單、joinCode、startDate、發佈狀態） | 教練建立/管理 |
| `goals` | 個人發展目標（UserDashboard 的目標追蹤功能） | 學員自己 |

**新增題庫不需要寫遷移腳本**：`db.js` 開機時若 `assessments` 為空就用
`KNOWN_ASSESSMENTS` 陣列全新種子；若已非空（例如正式站既有資料庫），會逐一
比對，把「清單裡有、資料庫裡還沒有」的項目補進去（見第 14 節「新增一套
評量題庫」的 SOP，這是這個機制存在的原因）。

**舊版純 JSON 檔案自動遷移**：`DB_PATH` 若指向的檔案不是 SQLite（`.sqlite3`
不存在但原始 `DB_PATH` 存在），開機時會解析成 JSON、灌進新的 `${DB_PATH}.sqlite3`
檔案，原始檔案完全不動——不需要額外備份步驟就自帶「遷移前快照」。

---

## 4. 評量引擎：設定驅動的核心設計

這是整個系統最關鍵的架構決策，理解它才看得懂為什麼新增題庫這麼輕量：
**題庫是純資料設定，計分/報告邏輯完全共用一份程式碼**。

### 4.1 題庫設定檔的形狀

每套題庫是 `src/survey/data/assessments/` 底下一個檔案，匯出一組常數：

```js
ID, NAME, NAME_EN, ABBR, DESCRIPTION
SUPPORTS_360          // 是否開放 360° 多元評測
SCALE_MIN, SCALE_MAX  // 量表範圍（目前都是 1–5）
DIMENSIONS             // 構面陣列，每個構面帶自己的 questions
ALL_QUESTIONS, TOTAL_QUESTIONS, MIN_SCORE, MAX_SCORE   // 由 DIMENSIONS 衍生
LEVELS 或 PROFILES     // 落點/風格對照表（見 4.2）
dimensionRating(average)  // 單一構面平均分 → 評語標籤（依題庫語意客製）
PROFILE_MODE           // 選填，見 4.2
getProfileKey(dimensions)  // PROFILE_MODE 題庫選填，見 4.2
COMMENTARY             // 選填，有才顯示「敘事報告」章節
RATER_PROMPT           // 選填，SUPPORTS_360 題庫用；360° 他評頁「您正在評估
                        // 「王小明」＿＿」的語尾（見 SurveyApp.jsx），未提供時
                        // 用中性預設「的日常行為表現」。PROFILE_MODE 題庫尤其
                        // 該設，因為預設語氣（「行為表現」）暗示有優劣之分。
```

`src/survey/utils/scoring.js` 是**唯一**的計分引擎，`buildResult(answers, config)`
吃任何一份符合上述形狀的 config，跑出結構一致的 `result` 物件（`total`,
`dimensions`, `level`, `strongest`, `weakest`…）。`ResultPanel.jsx`、
`PrintableReport`、`GroupWorkspace`、`aggregateStats` 等所有報告相關元件都只認
這個 `result` 形狀，**完全不知道自己在渲染哪一套題庫**——這是「新增題庫不用
碰報告元件」的關鍵。

### 4.2 兩種計分模型：LEVELS vs PROFILES

系統裡有兩類本質不同的心理計量構念，共用同一個引擎但走不同分支：

**(A) 傳統「總分 → 成熟度」模型**（`ai-competency`、`leadership-9d`）：
構面有明確的「高分較好」語意，可以加總成一個有意義的總分，對照
`LEVELS`（`{min, max, badge, badgeEn, color, desc, advice}` 的陣列）判斷
整體落在哪個成熟度級距。`getLevel(total, config)`。

**(B) 「風格/原型輪廓」模型**（`disc`、`archetype`，`PROFILE_MODE: true`）：
構面之間**沒有優劣**，加總成單一總分沒有心理計量意義（例如 DISC 的四個
構面本來就可能同時都很高或都很低）。這類題庫不設 `LEVELS`，改設
`PROFILES`（物件，key 是某種構面組合、value 跟 `LEVELS` 條目同形狀）。

`getProfileLevel(dimensions, config)` 的推導邏輯是可插拔的：
```js
const key = typeof config.getProfileKey === 'function'
  ? config.getProfileKey(dimensions, config)   // 題庫自訂
  : defaultProfileKey(dimensions);             // 預設：分數最高兩個構面組合
return config.PROFILES[key] ?? config.PROFILES.default;
```
- **DISC** 的四個構面互相獨立（unipolar，各自可高可低），用預設邏輯：
  分數最高的兩個構面 key 化（如 `dominance+influence`）查表。
- **識己®** 的四組構面是**二元對立光譜**（bipolar，如「外向 vs 內向」），
  每一軸自己的分數落在哪一端才有意義，因此提供自己的 `getProfileKey()`：
  每一軸各自判斷 `average >= 3` 選哪一極，四軸端點組合成一個代碼（如
  `外念理序`），對照 16 種原創原型。

新增一套「風格輪廓型」題庫時，要先想清楚構面之間是 (A) 獨立可疊加、還是
(B) 二元對立，這決定要不要寫自己的 `getProfileKey`。

`ResultPanel.jsx` 依 `config.PROFILE_MODE` 切換呈現：PROFILE_MODE 不顯示
總分／達成率／百分位排名（顯示會誤導使用者以為有高低之分），「最強／
最弱構面」也改標成中性的「主要／次要風格」。

### 4.3 敘事報告與客製建議

- `COMMENTARY`（選填）：題庫若提供，`NarrativeReport` 元件才會渲染「敘事
  報告」章節，用 `seed = hash(總分 | 構面ID)` 選模板，確保同一份報告每次
  看到的文字穩定、但不同人之間有變化，避免罐頭感。目前只有 `leadership-9d`
  設了完整的 `COMMENTARY`（含三圈層 `LAYERS`：個人基礎/人際協作/組織領導）。
- `buildSuggestions(result, config)`（`utils/suggestions.js`）：依構面分數
  給「優先強化」「發揮優勢」的客製建議，不依賴 `COMMENTARY`，L9D 以外的
  題庫也有。

---

## 5. 四套評量題庫

| 題庫 ID | 名稱 | 模型 | 構面 | 題數 | 360° | 特色 |
|---|---|---|---|---|---|---|
| `ai-competency` | AI 全方位職能實戰課前評測 | LEVELS | 6 大構面 | 37 題（含反向題） | 否 | 課前評測，測 AI 工具使用職能 |
| `leadership-9d` | 經贏® 領導力九大構面行為評量（L9D） | LEVELS | 9 大構面 / 20 子能力 | 90 題（含反向題） | 是 | 行為錨定量表（BARS），三圈層分組，完整敘事報告；規格詳見 `docs/leadership-9d-spec.md` |
| `disc` | DISC 行為風格評測 | **PROFILE_MODE** | 4 大構面（互相獨立） | 32 題（含反向題） | 是 | 風格輪廓，6 種主流組合 + default，中性用語（無優劣） |
| `archetype` | 識己®性格原型評測 | **PROFILE_MODE** | 4 組性格光譜（二元對立） | 40 題（含反向題） | **否**（見下） | 16 種原創原型，自陳偏好量表 |

> 識己® 不開放 360°：測的是「天生比較自在的內在傾向」，屬自陳量表，讓
> 別人代填猜測的效度遠不如本人自陳，故 `SUPPORTS_360 = false`。

四套題庫的題目分數固定 1–5（`SCALE_MIN`/`SCALE_MAX`），皆支援 `reversed: true`
反向計分題（`effectiveScore = reversed ? (SCALE_MAX + SCALE_MIN - raw) : raw`）。

行銷頁的題庫摘要卡片資料在 `src/survey/marketing/assessmentSummary.js`，
新增題庫時記得同步更新（否則行銷頁不會顯示新題庫）。

---

## 6. 前端功能地圖（依角色）

### 學員
- 首頁「我的評量」：列出可作答的題庫（依 `assessments.enabled` 過濾）
- 作答：Likert 量表逐題填答，支援中途離開續答
- 360° 多元評測（支援的題庫）：除自評外可邀請他人對自己評分
- 提交後即時看到報告（`ResultPanel`）：雷達圖、構面落點、客製建議、
  （L9D）敘事報告、**延伸閱讀**（見第 10 節，放在報告最下方）
- 「我的分析」（`UserDashboard`）：歷次作答趨勢、目標追蹤
- 個人設定：改密碼、基本資料
- AI 評測小幫手：浮動聊天按鈕，依角色帶不同 system prompt 上下文

### 教練
- 教練後台總覽：自己管理的班級列表
- 班級總覽與評語：整班雷達圖平均、落點分布、對個別學員最新一筆作答留言
- 成員與設定：加人/移除、設定課前課後階段、QR Code 報到（產生/撤銷/投影）
- 360° 進度追蹤：誰已評完誰還沒
- AI 教練助理：協助撰寫評語

### 管理者（含教練後台全部功能）
- 管理後台總覽：全站 KPI
- 評量開關：`enabled` 開關題庫是否對學員可見
- 整體統計：跨題庫/跨班級分析
- 用戶角色管理：改 user/coach/admin
- 批次匯入：CSV/Excel（`xlsx` 套件，見第 13 節已知風險）匯入名單，
  獨立 lazy chunk（`BatchUploadSection.jsx`），避免拖慢一般管理後台載入
- 密碼重設連結：管理者可代發重設連結
- AI 平台助理

---

## 7. 後端 API 一覽

所有路徑前綴 `/api`（`createApp()` 統一掛載，見 `server/src/app.js`）。

| Router | 路徑範例 | 說明 |
|---|---|---|
| `assessments.js` | `GET /assessments`、`GET /assessments/:id/benchmark` | 題庫清單、跨使用者 benchmark 平均（有快取） |
| `auth.js` | `POST /auth/register`、`/login`、`/logout`、`GET /auth/me`、`PATCH /auth/profile`、`POST /auth/password`、`/reset-password` | 帳號生命週期，`register`/`login` 可帶 `joinCode` 自動入班 |
| `submissions.js` | `POST /submissions`、`GET /submissions/me`、`GET /submissions/ratee/:rateeId`、`POST/DELETE /submissions/:id/comment` | 提交作答、查詢自己或（360°）被評者的紀錄、教練留言 |
| `groups.js` | `POST /groups/join`、`GET /groups/mine`、`GET /groups/mine/members` | 學員視角的班級操作（已登入掃碼加入等） |
| `goals.js` | `GET/POST/PATCH/DELETE /goals` | 個人發展目標 CRUD |
| `chat.js` | `POST /chat` | AI 小幫手，串流代理到 OpenRouter（見第 10 節） |
| `learning-resources` (`learningResources.js`) | `GET /learning-resources` | 延伸閱讀，代理到第二大腦 API（見第 10 節） |
| `public.js` | `GET /public/join/:code` | **免登入**，QR 報到落地頁查班級資訊，獨立 rate limit |
| `admin.js`（掛 `/api/admin`，`requireAdmin`） | `GET/PATCH /assessments`、`GET /overview`、`PATCH /users/:id/role`、`POST /users/:id/reset-token`、`POST /batch-import` | |
| `coach.js`（掛 `/api/coach`，`requireCoach`） | `GET /overview`、`/directory`、`GET/POST /groups`、`GET/PUT/DELETE /groups/:id`、`POST /groups/:id/publish`、`POST/DELETE /groups/:id/join-code`、`POST /groups/:id/roster` | admin 角色也滿足 `requireCoach`，故管理者能用教練後台全部功能 |

`admin`/`coach` 各自的 router 用 `router.use()` 統一掛驗證中介層，因此**必須**
掛在專屬前綴（`/api/admin`、`/api/coach`）下，否則會攔截其他掛在 `/api` 的
路由——這是 `app.js` 裡路由順序/前綴選擇的原因，改動時務必留意。

`GET /api/health` 不需認證，用於部署驗證與健康檢查。

---

## 8. 認證、權限與流量控制

- **認證**：JWT 存在 httpOnly cookie（非 localStorage，防 XSS 竊取），
  `secureCookies` 在正式環境（`NODE_ENV=production`）開啟，要求 HTTPS 才會
  送出 cookie——這是「正式站沒開 HTTPS 就會一直被登出」的根因，見疑難排解。
- **權限中介層**（`lib/authContext.js`）：`requireAuth` / `requireAdmin` /
  `requireCoach` 三層，`requireCoach` 對 `admin` 角色也放行。
- **密碼**：bcryptjs 雜湊，絕不明文儲存或記錄。
- **Rate limiting**（`express-rate-limit`）：
  - 註冊/登入：預設每 5 分鐘 10 次；帶有效 `joinCode` 時放寬到 100 次
    （整班同時掃碼註冊不會互相卡到），仍有上限且綁定「持有教練發出的代碼」。
  - AI 聊天：每分鐘 20 次／IP。
  - 公開查詢（`/public/join/:code`）：獨立 rate limit，避免被拿來掃碼枚舉。
- **`trust proxy` 與真實 IP**：正式站是 Traefik → Nginx → Express 兩層反向
  代理、都走 loopback。Express 預設不信任代理標頭，`req.ip` 會固定拿到
  Nginx 自己的位址，導致所有使用者的請求在 rate limiter 眼中「共用同一份
  額度」。必須用 `TRUST_PROXY` 環境變數明確設定信任層數（本站是 `2`），
  **且部署後務必從外部網路實際驗證** `req.ip` 讀到的是使用者真實 IP——
  設太高會讓偽造的 `X-Forwarded-For` 被當真、形同繞過限流；設太低則限流
  依然全站共用。這不能單憑猜測層數就上線，一定要實測。

---

## 9. 班級與 QR Code 報到機制

（完整實作細節見 `CLAUDE.md` 對應段落，這裡摘要設計意圖給第一次接手的人。）

- 每筆作答提交都記錄提交當下所屬的 `groupId`，班級報告優先以 `groupId`
  精準歸屬；只有 `groupId` 為 `null` 的舊資料才退回「用當下成員名單反查」的
  相容邏輯。**目的**：同一學員可重複參加多梯課程互不污染成績，移出班級的
  成員也不會被抹掉當時的作答紀錄。
- 重複提交檢查以「班級 + 階段（課前/課後）」為鍵：同班同階段擋 409（防止
  誤觸重複送出），同班「課前 → 課後」放行（本來就該再測一次），不同梯次
  放行，不屬於任何班級時不擋（供「重新作答」與個人歷程趨勢功能使用）。
- QR Code 報到：班級的 `joinCode` 是單一代碼，重新產生會讓舊代碼立即失效
  （不可逆），撤銷則是設為 `null`（可逆，之後可再重新產生）。免登入的
  `GET /api/public/join/:code` 只回班級/評量顯示資訊，不含成員或成績。
  已登入使用者掃到另一班的 QR 會直接加入（`POST /api/groups/join`），
  不需要重新註冊/登入。

---

## 10. 第三方整合

### 10.1 AI 小幫手（OpenRouter）

`server/src/routes/chat.js`：`POST /api/chat` 代理到 OpenRouter
`chat/completions`（`stream: true`），依 `req.user.role` 組不同的
system prompt（管理者/教練/學員各自的上下文），若帶著當次評測結果
（`context.result`）會把構面分數摘要進 prompt。**未設定 `OPENROUTER_API_KEY`
時回 503**（`CONFIG_ERROR`），不會讓整個功能噴 500——這是「外部依賴不能拖垮
主功能」的設計原則，第二大腦整合也遵循同一原則（見下）。

### 10.2 延伸閱讀（第二大腦知識庫整合）

這是評測平台「學習閉環」的關鍵一環：學員看完報告，不是就此結束，而是能
直接點進顧問公司自己的知識庫（`brain.rong-rise.com`，內部代號「第二大腦」）
讀跟自己弱項/風格相關的深度文章。

**資料流**：
```
ResultPanel（挑出主要學習構面，PROFILE_MODE 用主/次要風格，
             一般題庫用分數最低的最多 3 個構面）
   │
   ▼
GET /api/learning-resources?assessmentId=xxx&dimensionId=a&dimensionId=b
   │  （前端：src/survey/api/client.js → api.learningResources()）
   ▼
server/src/routes/learningResources.js
   │  1. 每個 dimensionId 查 learningResourceTopics.js 的 DIMENSION_TOPICS
   │     對照表，取得搜尋關鍵字（如「溝通」）
   │  2. 關鍵字丟給第二大腦 GET /api/articles?q=關鍵字
   │     （注意：這個 API 是全站關鍵字搜尋，跨全部 357+ 篇文章比對
   │      標題/tags/摘要，不是預先依分類縮小範圍——分類過濾是我們
   │      自己在 normalizeArticle() 用 ALLOWED_CATEGORIES 白名單做的）
   │  3. In-memory Map 快取，1 小時 TTL（cache key = 關鍵字），
   │     跟 assessments.js 的 benchmark 快取用同一套慣例
   │  4. AbortController + 5 秒逾時：第二大腦掛掉或很慢，絕不能拖垮
   │     評測報告主頁面的載入
   ▼
LearningResources.jsx：每個構面一個小節，最多幾篇文章
（標題／摘要 excerpt／外部連結圖示），全部失敗則整個元件回傳 null
（報告其他部分正常顯示，不會因為這個附加功能掛掉而整頁壞掉）
```

**放置位置與說明文字**：整個延伸閱讀區塊放在報告**最下面**——雷達圖、
強弱項、敘事報告等主要內容都看完後，最後給一個「接下來可以怎麼學」的
收尾，而不是夾在中間打斷報告本身（`ResultPanel.jsx` 裡明確有這段設計
理由的註解）。區塊上方有說明文字解釋這是什麼、怎麼用。

**`url` 欄位是關鍵**：`normalizeArticle()` 直接使用第二大腦 API 回傳的
`raw.url`，**不會**自己用 `slug` 組 URL。歷史上踩過兩次坑：第二大腦網站
對中文標題的文章會把 `slug` 雜湊成完全不相關的隨機代碼（如
`a-sr7kgx`），前端自己組 URL 一律連不到正確頁面。唯一可靠的作法是要求
API 直接回傳可點擊的 `url`，往後**絕對不要**重新引入「用 slug 自己拼
URL」的邏輯，那是脆弱且已被證明會壞的做法。

**分類白名單**（`ALLOWED_CATEGORIES`，在 `learningResources.js`）：目前
只允許「技術深讀」「管理心理學」「人才策略」「人資與組織發展」四類文章
出現在延伸閱讀，避免推薦到跟職能發展無關的內容（如公司新聞、活動預告）。
新增允許分類要改這裡。

**構面 → 關鍵字對照表**（`server/src/lib/learningResourceTopics.js`）：
`${assessmentId}:${dimensionId}` 為 key，新增題庫或構面時記得補上對應
關鍵字，否則該構面查不到文章（`getTopicKeyword()` 回傳 `undefined` 時
直接跳過該構面的查詢，不會報錯，但學員也看不到任何延伸閱讀）。

**跨網域說明**：這是**伺服器對伺服器**的呼叫（Express 後端直接 fetch
第二大腦 API），完全不經過瀏覽器，因此不受 CORS 限制，第二大腦那邊不需要
為了這個整合另外開白名單。

**環境變數**：`BRAIN_API_BASE_URL`（預設 `https://brain.rong-rise.com`），
測試環境可覆寫指向 mock server。

---

## 11. 部署架構與維運

完整逐步指令見 [`DEPLOYMENT.md`](../DEPLOYMENT.md)，這裡整理「為什麼」與
「平常維運要注意什麼」。

### 11.1 正式站拓樸

```
Traefik（host 網路，80/443，Cloudflare DNS challenge 自動簽 TLS）
   └─> Nginx（127.0.0.1:8090，不對外、不處理 TLS）
         ├─ /        靜態前端  /var/www/ai-assessment
         └─ /api     反向代理  →  後端 127.0.0.1:3101
```
這個「多一層 Nginx」的設計是因為 VPS 上已經有 Traefik 佔用 80/443（給其他
服務用），Traefik 的 file provider 又是單一設定檔（需要「併入」而非新增
檔案，見 `DEPLOYMENT.md` 附錄 A-3）。埠號 `3101`/`8090` 是因為 `3001`/`8080`
在這台機器上已被其他服務佔用——**如果之後要換一台新機器部署，這兩個埠可以
用回預設的 `3001`/`8080`**，`3101`/`8090` 不是有特殊意義的固定值。

### 11.2 關鍵路徑

| 用途 | 路徑 |
|---|---|
| 前端原始碼（git clone，checkout 功能分支） | `/opt/ai-assessment/app` |
| 後端程式（由 `deploy.sh` rsync 同步） | `/opt/ai-assessment/server` |
| 前端靜態檔（build 產物） | `/var/www/ai-assessment` |
| 資料檔（SQLite） | `/var/lib/ai-assessment/db.json.sqlite3`，擁有者 `www-data` |
| systemd 服務 | `ai-assessment-api` |

### 11.3 環境變數（`server/.env`）

由 `server/.env.example` 複製。必填：`JWT_SECRET`、`PORT`、`DB_PATH`、
`ADMIN_EMAIL`、`ADMIN_PASSWORD`、`NODE_ENV=production`。選填但正式站
**必設**：`TRUST_PROXY=2`（見第 8 節）。AI 功能需要
`OPENROUTER_API_KEY`（未設定則該功能優雅降級為 503，不影響其他功能）。
第二大腦整合可選填 `BRAIN_API_BASE_URL`（預設已指向正式網址）。

> ⚠️ 安全守則：絕不在程式碼、提交訊息、文件或對話中索取或重現密碼、
> JWT 密鑰、SSH 金鑰等任何憑證。`.env` 已列入 `.gitignore`，只在 VPS 上
> 以實際值存在，僅存在於伺服器本機檔案系統。

### 11.4 更新版本（在 VPS 上執行）

```bash
cd /opt/ai-assessment/app
git fetch origin claude/ai-assessment-survey-4vhjun
git checkout claude/ai-assessment-survey-4vhjun
git pull origin claude/ai-assessment-survey-4vhjun
bash deploy/deploy.sh
```
`deploy.sh` 會：重建前端 → 同步 `dist/` 到 `/var/www/ai-assessment` →
同步後端 → `npm ci --omit=dev` → 重啟 `ai-assessment-api` 並 reload Nginx，
且**會保留** `.env` 與資料檔（不會被覆蓋或清空）。部署後驗證：
```bash
curl -s localhost:3101/api/health     # 應回 {"ok":true}
```

> 這個部署腳本**必須在 VPS 本機執行**（內含 `sudo systemctl`、`rsync` 等
> 本機操作）。雲端開發容器（例如這個 Claude Code 工作環境）無法直接 SSH
> 部署到 VPS，只能準備好 commit 並推送，實際部署動作要在 VPS 上跑。

### 11.5 備份與還原

SQLite 是 WAL 模式，服務執行中直接 `cp` 主檔案可能漏掉尚未 checkpoint 的
內容，要用 `sqlite3` 線上備份指令才能拿到服務不停機情況下的一致快照：
```bash
sqlite3 /var/lib/ai-assessment/db.json.sqlite3 ".backup '$HOME/backup-$(date +%F).sqlite3'"
```
建議排程 cron 每日備份。還原步驟（需要短暫停機）見 `DEPLOYMENT.md`
「備份與還原」章節。

---

## 12. 測試與 CI

```bash
# 前端（專案根目錄）
npm test          # Vitest，CI 必須全綠
npm run lint       # ESLint，提交前應為 0 problems
npm run build      # 產出 dist/

# 後端（server/）
cd server && npm test   # node --test
```

**後端測試慣例**：用 `t.mock.method(globalThis, 'fetch', ...)` mock 對外
HTTP 呼叫（第二大腦整合的測試就是這樣做的，`server/test/api.test.js`），
不打真實網路。若之後要幫 `chat.js`（OpenRouter 整合）補測試，可以沿用
同一個 mock 模式，目前這部分還沒有測試覆蓋。

**快取是模組層級（module-level）的**，同一個 process 內的測試會共用同一份
快取 Map——寫多個測試涉及同一個快取 key（如同一個搜尋關鍵字）時，要留意
第二個測試可能拿到第一個測試留下的快取結果而非自己 mock 的回應。已知
曾因此踩過一次坑（見 `server/test/api.test.js` 學習資源測試裡刻意選用
不重複 dimension ID 的寫法）。

**CI**（`.github/workflows/deploy.yml`）：push 到功能分支時跑
`npm ci → lint → test`（前端）+ `npm ci → test`（後端）→ `npm run build`
→ 部署到 **GitHub Pages**（`base: /TEST/`）。

> ⚠️ **這個 GitHub Pages 部署只是預覽站，跟正式的 VPS 站
> （`assess.rong-rise.com`）完全獨立**——GitHub Pages 是純靜態託管，沒有
> 後端，评测提交、登入等需要 API 的功能在預覽站上不會正常運作（那裡連
> `dist/index.html` 複製成 `404.html` 純粹是為了讓 SPA 前端路由在重新整理
> 子路徑時不要 404，跟正式站的 Nginx `try_files` 設定是兩回事）。CI 綠燈
> 只代表 lint/test/build 通過，**不等於正式站已更新**——正式站更新永遠要
> 手動在 VPS 上跑第 11.4 節的部署步驟。

---

## 13. 已知限制與技術債

- **`xlsx` 套件有未修補的高風險漏洞**（Prototype Pollution + ReDoS，
  官方目前無修復版本，`npm audit` 會持續顯示）。使用範圍僅限管理後台
  「批次匯入」功能解析使用者上傳的 CSV/Excel 檔（`BatchUploadSection.jsx`）。
  風險僅限**管理者主動上傳的檔案**，不是對外開放的攻擊面，但若之後要徹底
  排除，需要評估替換成其他 Excel 解析套件或改為只接受 CSV。
- **SQLite 單檔儲存，適合課程規模、低併發**。若使用規模明顯成長（更高
  併發、多機部署需求），需要評估改接 PostgreSQL 等真正的資料庫伺服器——
  目前 `db.js` 的抽象（`db.data.*` + `db.persist()`）刻意留了置換空間，
  但實際遷移仍是一項未做的工作。
- **第二大腦整合是單點外部依賴**：已用 5 秒逾時 + try/catch + 空狀態
  處理將風險降到「壞了看不到延伸閱讀，但不影響評測本身」，但目前沒有
  監控告警機制去偵測第二大腦 API 是否已經連續故障一段時間。
- **`chat.js`（OpenRouter 整合）沒有自動化測試**，是目前唯一缺測試覆蓋
  的對外 API 整合點。
- **`server/.env` 的 `TRUST_PROXY` 全靠人工在每次部署環境變動時正確設定
  並手動驗證**，沒有自動化檢查會在設錯時提醒維運人員（例如反向代理層數
  改變、但忘記同步更新這個值）。

---

## 14. 常見維運情境 SOP

### 新增一套評量題庫

1. 在 `src/survey/data/assessments/` 新增一個檔案，依第 4.1 節的形狀寫好
   `DIMENSIONS`/`LEVELS`（或 `PROFILES` + `PROFILE_MODE: true`，並想清楚
   要不要寫自己的 `getProfileKey`，見 4.2）。
2. 在 `src/survey/data/assessments/index.js` 註冊這個新題庫（讓
   `getAssessment(id)` 找得到）。
3. 在 `server/src/db.js` 的 `KNOWN_ASSESSMENTS` 陣列加一筆
   `{id, name, description, enabled}`——**不需要寫遷移腳本**，開機時的
   backfill 邏輯會自動幫既有資料庫（含正式站）補上這筆（見第 3 節）。
4. 在 `src/survey/marketing/assessmentSummary.js` 補上行銷頁摘要資料。
5. （建議）在 `server/src/lib/learningResourceTopics.js` 幫每個構面補上
   第二大腦搜尋關鍵字，否則延伸閱讀區塊該題庫會查不到任何文章。
6. 跑 `npm test`（前後端）、`npm run lint`、`npm run build` 全綠再提交。

### 開關某套題庫是否對學員可見

管理後台「評量開關」，或直接呼叫 `PATCH /api/admin/assessments/:id`
改 `enabled`。不需要重啟服務。

### 排查「登入後一直被登出」

先確認 HTTPS 是否真的生效、`NODE_ENV=production` 是否有設——secure cookie
要求 HTTPS 才會被瀏覽器送出，見第 8 節。

### 排查「整班掃 QR 註冊時出現『請求過於頻繁』」

檢查 `.env` 的 `TRUST_PROXY` 是否已正確設定（見第 8 節）。未設定時所有
使用者的請求都會被 rate limiter 當成同一個 IP，導致整班一起觸發限流。

### 排查延伸閱讀「顯示純文字、點了沒反應」

回去檢查第二大腦 API 回傳的文章物件是不是漏了 `url` 欄位——
`normalizeArticle()`（`server/src/routes/learningResources.js`）要求
`raw.url` 才會保留這篇文章，缺了會被直接濾掉（正常運作，但學員會覺得
「這個構面怎麼都沒有推薦文章」）。**不要**改成自己組 URL，見第 10.2 節。

### VPS 部署

見第 11.4 節，或 `CLAUDE.md`/`DEPLOYMENT.md` 的對應段落——三份文件內容
一致，可以看手邊剛好開著的那份。

### 資料庫備份/還原

見第 11.5 節。
