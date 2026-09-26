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
         ├── 第二大腦 API（外部，brain.rong-rise.com）── 延伸閱讀文章
         └── SMTP 寄信服務（外部，選配）────────── 告警信、催交提醒信
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
| E2E | Playwright（`@playwright/test` + `@axe-core/playwright`） | `e2e/`，`npm run test:e2e`，見第 12 節 |

### 前端目錄結構

```
src/
├── App.jsx, main.jsx, index.css       路由骨架、深色模式全域覆寫
├── survey/
│   ├── AppShell.jsx, SurveyApp.jsx    登入後主框架、作答流程
│   ├── admin/                         管理後台（AdminDashboard、批次匯入…）
│   ├── auth/                          登入/註冊/忘記密碼
│   ├── coach/                         教練後台（CoachDashboard、班級管理、360° 追蹤）
│   │                                   GroupWorkspace 拆成 GroupListPanel／
│   │                                   GroupOverviewSection／GroupSettingsSection
│   ├── components/                    ResultPanel、RadarChart、NarrativeReport、
│   │                                   LearningResources、GroupNarrativeReport…
│   │                                   printable-report/ 是 PrintableReport 依頁拆出的
│   │                                   子元件（CoverPage、LayerPage…）
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
│   ├── buildInfo.js         讀 deploy.sh 寫入的 build-info.json（目前跑的是哪一版）
│   ├── health.js            外部依賴深度健康檢查＋狀態變化告警（見第 10.4 節）
│   ├── helpers.js           asyncHandler、輸入清洗（sanitizeXxx）
│   ├── joinCode.js          QR 報到代碼產生邏輯
│   ├── mailer.js            寄信（nodemailer + SMTP 環境變數，未設定時優雅降級）
│   ├── notifications.js     學員通知信：複測提醒、教練評語通知（見第 10.4 節）
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

八個 collection 的角色：

| Collection | 內容 | 誰寫入 |
|---|---|---|
| `users` | 帳號（email、密碼雜湊、role: user/coach/admin、所屬 groupId、`preferences`——只收白名單鍵：`darkMode`／`defaultAssessmentId`／`notifyAssessment`／`notifyComment`） | 註冊/登入、管理者改角色、本人改設定 |
| `submissions` | 每一次評測作答（answers、算出來的 result、groupId、raterId/rateeId 用於 360°、教練評語、`commentNotifiedAt` 評語通知冷卻用） | 學員提交、教練留言 |
| `assessments` | 題庫 metadata（id/name/description/enabled），**不含題目本體**——題目在前端 `src/survey/data/assessments/*.js` | 開機自動種子（見下） |
| `groups` | 班級（成員名單、joinCode、startDate、發佈狀態、`lastReminderSentAt` 催交信冷卻用） | 教練建立/管理 |
| `goals` | 個人發展目標（含 `baselineAverage`、`reviewDate`，見第 10.2 節學習閉環；`reviewReminderSentAt` 記錄複測提醒信已寄） | 學員自己 |
| `readingList` | 學員從延伸閱讀加入的文章清單（url/title/excerpt/read…），只有本人讀得到（見 `routes/readingList.js`） | 學員自己 |
| `learningResourceClicks` | 延伸閱讀文章點擊事件（純計數用，供管理後台彙總，不對外曝光個人身分） | 前端 fire-and-forget 記錄 |
| `systemStatus` | 系統狀態（目前只有一筆 `deepHealth`：外部依賴上一次檢查的結果，供告警比對「有沒有變化」，見第 10.4 節） | 後端排程 |

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
- 首頁「下一步」卡片（`components/NextStepCard.jsx`，判斷邏輯在
  `utils/nextStep.js`，純函式、有獨立測試）：依優先序告訴學員現在該做什麼
  （課前未作答 → 課後未作答 → 還有 360° 他評待完成 → 有目標到期該複測 → 看報告
  → 新帳號開始第一次評測），下方接班級狀態條（`GroupStatusBar.jsx`）與目標
  進度摘要（`GoalProgressChip.jsx`）
- 首頁「我的評量」：列出可作答的題庫（依 `assessments.enabled` 過濾），每張
  卡片有狀態標籤（未作答／課前已完成／課後已完成／可重測）
- 作答：Likert 量表逐題填答，支援中途離開續答
- 360° 多元評測（支援的題庫）：除自評外可邀請他人對自己評分
- 通知信（需設定 SMTP，見第 10.4 節）：發展目標到了預計檢視日寄「複測提醒」、
  教練留評語時寄「有新評語」通知；可在「個人設定 → 通知偏好」各自關閉
- 提交後即時看到報告（`ResultPanel`）：雷達圖、構面落點、客製建議、
  （L9D）敘事報告、**延伸閱讀**（見第 10.2 節，放在報告最下方，可加入學習
  清單或發展目標）
- 「我的分析」（`UserDashboard`）：歷次作答趨勢、目標追蹤（含設定時 → 最新的
  構面分數變化，見第 10.2 節）
- 「我的學習」（`learning/MyLearningPage.jsx`）：彙整進行中目標與學習清單，
  可標記文章已讀／移除
- 個人設定：改密碼、基本資料
- AI 評測小幫手：浮動聊天按鈕，依角色帶不同 system prompt 上下文

### 教練
- 教練後台總覽：自己管理的班級列表
- 班級總覽與評語：整班雷達圖平均、落點分布、對個別學員最新一筆作答留言
- **作答進度追蹤**（`coach/ProgressPanel.jsx`，放在班級「總覽」分頁最上方）：
  課前／課後各自完成人數，未完成者名單，一鍵「複製提醒訊息」（含截止日、報到
  連結，可直接貼去 LINE／Email）；設定好 SMTP 後另有「寄送提醒信」直接寄出
  （見第 10.4 節）
- **班級學習成效**（`coach/GroupGainReport.jsx`，邏輯在
  `utils/analytics.js` 的 `computeGroupGain()`）：課前 vs 課後只計算「配對
  樣本」（同一人課前課後都做過才算），一般題庫顯示平均總分增益與各構面增益，
  PROFILE_MODE 題庫改顯示風格分布變化，不暗示分數有好壞
- **評語範本**（`coach/CommentEditor.jsx`）：儲存/套用個人範本（存在
  localStorage，不跨裝置同步），可一鍵插入學員最強／待強化構面名稱
- **比較梯次**（`coach/CohortCompare.jsx`）：選同一題庫的兩個班級，疊圖比較
  平均雷達圖與落點分布
- 匯出班級成績 CSV（`utils/csvExport.js`，純前端 Blob 產生，不依賴 Excel 解析套件）
- 成員與設定：加人/移除、設定課前課後階段、QR Code 報到（產生/撤銷/投影）
- 360° 進度追蹤：誰已評完誰還沒
- AI 教練助理：協助撰寫評語

### 管理者（含教練後台全部功能）
- 管理後台總覽：全站 KPI
- 評量開關：`enabled` 開關題庫是否對學員可見
- 整體統計：跨題庫/跨班級分析
- **跨班級／跨梯次比較**（`admin/CohortTrendSection.jsx`，邏輯在
  `utils/analytics.js` 的 `computeCohortTrend()`）：「數據分析」分頁下方，所選
  題庫的全部班級（不限教練）依開課日排序，一次只看課前或課後（混在一起會把
  「進來時的程度」跟「上完課的成果」攪在同一個平均），一般題庫顯示各梯平均
  達成率與「最新一梯比第一梯差幾個百分點」，PROFILE_MODE 題庫改列各梯風格
  分布、不算差距。跟教練端「比較梯次」的差別：那個一次選兩班、只限自己名下
  的班級；這個是全站所有梯次的長期趨勢
- 用戶角色管理：改 user/coach/admin
- 批次匯入：CSV/Excel（`.xlsx`，`read-excel-file` 套件解析）匯入名單，
  獨立 lazy chunk（`BatchUploadSection.jsx`，解析邏輯抽在
  `batchFileParsing.js`），避免拖慢一般管理後台載入；不支援舊版二進位 `.xls`
- 密碼重設連結：管理者可代發重設連結
- **系統狀態**（`admin/SystemStatusTab.jsx`，`GET /api/admin/system-status`）：
  前端／後端版本、外部依賴、寄信設定、告警排程最後執行時間、「伺服器看到的你的
  IP」（驗證 `TRUST_PROXY` 用，見第 8 節）。前後端版本不一致時管理後台頂端會
  出現警示——通常是只部署了一半，或瀏覽器的 PWA 快取還是舊版
- 風格型題庫（DISC／識己®）的「數據分析」不顯示總分、達成率，改為最常見風格、
  各構面傾向強度與風格人數分佈（沿用第 4.2 節「風格沒有高低」的原則）
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
| `goals.js` | `GET/POST/PATCH/DELETE /goals` | 個人發展目標 CRUD，`POST` 可帶 `baselineAverage`／`reviewDate`（見第 10.2 節） |
| `readingList.js` | `GET/POST /reading-list`、`PATCH/DELETE /reading-list/:id` | 「我的學習」清單 CRUD（見第 10.2 節） |
| `chat.js` | `POST /chat` | AI 小幫手，串流代理到 OpenRouter（見第 10 節） |
| `learning-resources` (`learningResources.js`) | `GET /learning-resources`、`POST /learning-resources/track-click` | 延伸閱讀，代理到第二大腦 API；後者記錄文章點擊供管理後台彙總（見第 10 節） |
| `public.js` | `GET /public/join/:code` | **免登入**，QR 報到落地頁查班級資訊，獨立 rate limit |
| `admin.js`（掛 `/api/admin`，`requireAdmin`） | `GET/PATCH /assessments`、`GET /overview`、`PATCH /users/:id/role`、`POST /users/:id/reset-token`、`POST /batch-import`、`GET /learning-resources/stats` | |
| `coach.js`（掛 `/api/coach`，`requireCoach`） | `GET /overview`、`/directory`、`GET/POST /groups`、`GET/PUT/DELETE /groups/:id`、`POST /groups/:id/publish`、`POST/DELETE /groups/:id/join-code`、`POST /groups/:id/roster`、`POST /groups/:id/remind` | admin 角色也滿足 `requireCoach`，故管理者能用教練後台全部功能 |

`admin`/`coach` 各自的 router 用 `router.use()` 統一掛驗證中介層，因此**必須**
掛在專屬前綴（`/api/admin`、`/api/coach`）下，否則會攔截其他掛在 `/api` 的
路由——這是 `app.js` 裡路由順序/前綴選擇的原因，改動時務必留意。

`GET /api/health` 不需認證，用於部署驗證與健康檢查；帶 `?deep=1` 時額外檢查
第二大腦 API 與 OpenRouter 的可達性/設定狀態（`lib/health.js` 的
`deepHealthCheck()`），供外部監控服務輪詢，一般部署驗證仍用不帶參數的版本。
後端自己也會定期跑這個檢查並在狀態變化時寄信告警（第 10.4 節）。兩種模式都會
回傳 `version: { commit, builtAt }`——`deploy.sh` 部署時寫入，本機開發為 `null`。

---

## 8. 認證、權限與流量控制

- **認證**：JWT 存在 httpOnly cookie（非 localStorage，防 XSS 竊取），
  `secureCookies` 在正式環境（`NODE_ENV=production`）開啟，要求 HTTPS 才會
  送出 cookie——這是「正式站沒開 HTTPS 就會一直被登出」的根因，見疑難排解。
- **權限中介層**（`lib/authContext.js`）：`requireAuth` / `requireAdmin` /
  `requireCoach` 三層，`requireCoach` 對 `admin` 角色也放行。
- **教練只能碰自己班上的學員**：成績可見範圍（`coach.js` 的 `visibleUserIds`）與
  寫評語（`submissions.js`，Sprint 7 補上——以前只檢查身分是教練，任何教練拿到
  作答 id 就能對別班學員留言，而且會觸發通知信寄給對方學員）都以「受評者在不在
  自己的班上」為準；管理者不受限。
- **密碼**：bcryptjs 雜湊，絕不明文儲存或記錄。
- **Rate limiting**（`express-rate-limit`）：
  - 註冊/登入：預設每 5 分鐘 10 次；帶有效 `joinCode` 時放寬到 100 次。
    `AUTH_RATE_LIMIT` 環境變數可改預設額度，**只給 E2E 用**（幾支測試共用同一個
    後端與來源 IP），正式環境不要設
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

**點擊追蹤**：每篇文章的標題連結 `onClick` 會 fire-and-forget 呼叫
`POST /api/learning-resources/track-click`（不等待回應、不擋文章開啟），寫進
`learningResourceClicks` collection。管理後台「延伸閱讀使用情形」
（`admin/LearningResourceStatsPanel.jsx` → `GET /api/admin/learning-resources/stats`）
依 `assessmentId + dimensionId` 彙總這張表的點擊數，加上 `readingList` 的
筆數當「加入清單數」——刻意只回傳彙總數字，不回傳是誰點的/存的，個人的
學習清單本身（第 10.3 節）設計上只有本人看得到。

### 10.3 學習閉環：目標 × 延伸閱讀 × 複測

把「看到推薦文章」接到「真的去學、排進目標、之後回來複測看有沒有變化」，串成
一條路徑（對應 docs/SPRINT_PLAN.md Sprint 3）：

- **加入學習清單**：`LearningResources.jsx` 每篇文章旁的「加入清單」呼叫
  `POST /api/reading-list`（`routes/readingList.js`）。同一篇文章重複加入是
  **冪等**的（用 `userId + url` 找既有記錄，不會產生重複項目），比對是否已加入
  只在前端做樂觀更新，不會先查一次再決定要不要送出。
- **加入目標**：`AddToGoalButton.jsx`（`LearningResources.jsx` 內嵌）可以把一
  篇文章變成既有目標的行動項目（`PATCH /goals/:id` 附加一條 `actions`），或
  直接建立一個新目標（`POST /goals`，`text` 預設「深化「{構面}」」，
  `actions[0].text` 是「閱讀：《標題》 網址」）。**刻意不跟 GoalPanel 共用
  goals 狀態**——兩者可能同時出現在同一頁，也可能只有其中一個出現（SurveyApp
  剛送出評測、還沒有 GoalPanel 的畫面），各自獨立抓自己的資料比硬湊一份共享
  state 更不容易互相牽制；已知的取捨是若兩者同時在畫面上，透過 `AddToGoalButton`
  加的行動要等重新整理才會反映在 `GoalPanel` 上。
- **baselineAverage（設定時的基準分）**：建立目標時，若指定了構面，會把
  `dimensions` prop 裡那個構面**當下**的 `average` 存進 `goal.baselineAverage`
  （`GoalPanel.jsx`／`AddToGoalButton.jsx` 建立時算好傳給後端，後端只負責存，
  不回頭查歷史作答）。之後 `GoalPanel` 的 `BaselineDelta` 子元件拿使用者
  **目前正在看的這次**報告的同一個構面 `average` 跟 `baselineAverage` 相比，
  顯示「設定目標時 X 分 → 最新 Y 分」。
- **reviewDate（建議複測日）**：建立目標時可調整（`<input type="date">`，
  預設今天 + 28 天）；沒帶的話後端（`routes/goals.js`）預設一樣是 4 週後。
  到期（且目標尚未達成）時，`utils/nextStep.js` 的 `computeNextStep()` 會在
  「下一步」卡片插入 `retest-reminder`，優先序排在「360° 待評分」之後、
  「看報告」之前（見第 6 節學員功能列表）。
- **「我的學習」頁**（`learning/MyLearningPage.jsx`，路由 `/learning`）：
  彙整進行中目標（含 reviewDate 提示）與整份學習清單（可標記已讀／移除），
  是目標與清單的**總覽 + 管理**入口；建立/編輯動作仍在各評量報告頁進行。

---

### 10.4 寄信：健康檢查告警與催交提醒信

`server/src/lib/mailer.js` 用 `nodemailer` 接任何提供 SMTP relay 的服務
（Gmail、SendGrid、Mailgun…），**不綁定廠商**，全部靠 `SMTP_*` 環境變數（見
第 11.3 節）。沒設定時 `sendMail()` 回 `{ ok:false, code:'CONFIG_ERROR' }`
而不是丟例外——寄信壞掉或沒設定，絕不能連帶讓評測本身壞掉，跟 `chat.js` 對
`OPENROUTER_API_KEY` 的處理方式一致。

**健康檢查告警**（`lib/health.js` 的 `checkAndAlert()`，由 `server.js` 排程呼叫）：
- 每 `HEALTH_CHECK_INTERVAL_MINUTES` 分鐘（預設 5，設 0 關閉）跑一次深度健康
  檢查，跟 `systemStatus` 裡的上次結果比對。第二大腦從「連得到」變「連不到」
  或 OpenRouter 金鑰被移除時寄「⚠️ 異常」信給 `ADMIN_EMAIL`，恢復時寄「✅ 已恢復」。
- **只在狀態變化時寄**：異常持續一小時不會寄 12 封一樣的信（那會很快被當成
  雜訊忽略）。第一次跑（全新安裝）只記錄基準、不寄。
- 上次狀態存在資料庫而不是記憶體：服務重啟後讀回來接著比，不會誤判成變化。
- 排程放在 `server.js` 而不是 `createApp()`：後者也給測試用，放進去會在每個
  測試檔留下計時器。
- ⚠️ 這個告警是**這支服務自己**在跑——如果整個後端掛掉，就沒有人會寄信。
  要涵蓋「整台服務掛掉」，仍建議另外用外部監控（UptimeRobot 等）定期打
  `GET /api/health`，見第 13 節。

**催交提醒信**（`POST /api/coach/groups/:id/remind`，前端是 `ProgressPanel` 的
「寄送提醒信」）：
- 對象判定跟「複製提醒訊息」一致：只看自評；還有人沒做課前就只催課前（含
  「待加入」名單——已登錄 Email、尚未註冊的人，信裡的連結帶報到代碼），
  全員課前完成後才改催課後。一人一封（個人化稱呼，也不會把全班信箱曝光在
  收件人欄）。
- 只能在施測期間寄（`getGroupPhase() === 'in_progress'`，否則 409）；同一班
  1 小時內只能寄一次（`lastReminderSentAt`，否則 429 並附剩餘秒數）；全部寄送
  失敗（通常是 SMTP 設定錯）時**不進冷卻**，修好設定可以馬上重試。
- 信裡的作答連結用 `APP_URL` 組出來（預設正式站網址）。

**學員通知信**（`lib/notifications.js`，Sprint 7）：
- **複測提醒**：`server.js` 每 `NOTIFY_INTERVAL_MINUTES` 分鐘（預設 60）找出
  「預計檢視日已過、未達成、還沒寄過」的目標寄信，寄出後記 `reviewReminderSentAt`，
  每個目標只寄一次。學員設定目標後已經重新做過同一套評量的就不寄（他已經複測了）。
  判斷條件跟首頁「下一步」卡片的複測提醒一致。
- **教練評語通知**：教練存評語（`POST /submissions/:id/comment`）後、回應送出之後
  才非同步寄信，教練不必等 SMTP。**信裡刻意不放評語內容**（評語可能含敏感的
  績效觀察，Email 可能被轉寄），只說「有新評語」附連結。同一份作答 1 小時內反覆
  修改只寄一次（`commentNotifiedAt`）；只通知「自評」作答的作答者。
- 兩者分別受 `preferences.notifyAssessment`、`notifyComment` 控制（個人設定的
  「評測提醒」「教練評語通知」，沒設定過＝開啟）。教練手動寄的課程催交信屬課程
  行政通知，**不受這兩個開關影響**，設定頁有寫明。
- 未設定 SMTP 時整個略過、不留紀錄；之後設定好了，已到期的複測提醒會照常補寄。

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
寄信（第 10.4 節）需要 `SMTP_HOST`／`SMTP_USER`／`SMTP_PASS`（缺一即停用寄信
功能，其他不受影響），選填 `SMTP_PORT`（預設 587；465 走 implicit TLS）、
`SMTP_FROM`（寄件者顯示，預設同 `SMTP_USER`）；`APP_URL` 也用於提醒信裡的
作答連結。`HEALTH_CHECK_INTERVAL_MINUTES` 調整告警排程間隔（預設 5，0 關閉）；
`NOTIFY_INTERVAL_MINUTES` 調整複測提醒的檢查間隔（預設 60，0 關閉）。

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
`deploy.sh` 會：記下目前 commit → 重建前端（把版本寫進打包）→ 同步 `dist/` 到
`/var/www/ai-assessment` → 同步後端 → 前後端各寫一份 `build-info.json` →
`npm ci --omit=dev` → 重啟 `ai-assessment-api` 並 reload Nginx → **自動執行
`deploy/verify.sh`**。`.env` 與資料檔**會保留**（不會被覆蓋或清空）。

`deploy/verify.sh`（也可以隨時單獨跑）逐項印出 PASS／WARN／FAIL：服務是否在跑、
健康檢查、**前後端版本是否等於目前 commit**、對外網址 200、第二大腦／OpenRouter、
SMTP 與 `TRUST_PROXY` 有沒有設、備份 cron 是否存在、26 小時內有沒有備份。
FAIL（服務沒正常運作）會讓結束代碼為 1；WARN（該補的設定）不會。手動確認：
```bash
curl -s localhost:3101/api/health     # 應回 {"ok":true,"version":{"commit":"<目前 commit>",...}}
bash deploy/verify.sh
```
最後從**外部網路**開「管理後台 → 系統狀態」，確認「伺服器看到的你的 IP」是你
真實的對外 IP（這是驗證 `TRUST_PROXY` 唯一可靠的方式，VPS 本機測不出來）。

> 這個部署腳本**必須在 VPS 本機執行**（內含 `sudo systemctl`、`rsync` 等
> 本機操作）。雲端開發容器（例如這個 Claude Code 工作環境）無法直接 SSH
> 部署到 VPS，只能準備好 commit 並推送，實際部署動作要在 VPS 上跑。

### 11.5 備份與還原

SQLite 是 WAL 模式，服務執行中直接 `cp` 主檔案可能漏掉尚未 checkpoint 的
內容，要用 `sqlite3` 線上備份指令才能拿到服務不停機情況下的一致快照。
`deploy/backup.sh` 把這個流程包成腳本：`.backup` + `PRAGMA integrity_check`
驗證備份檔完整、再依 `KEEP`（預設 14）份保留天數自動清掉更舊的備份：
```bash
bash deploy/backup.sh   # 可用 DB_FILE / BACKUP_DIR / KEEP 環境變數覆寫預設路徑與保留數
```
建議排程 cron 每日執行。還原步驟（需要短暫停機）見 `DEPLOYMENT.md`
「備份與還原」章節。

---

## 12. 測試與 CI

```bash
# 前端（專案根目錄）
npm test          # Vitest，CI 必須全綠
npm run lint       # ESLint，提交前應為 0 problems
npm run build      # 產出 dist/
npm run test:e2e   # Playwright，見下方「E2E」

# 後端（server/）
cd server && npm test   # node --test
```

**後端測試慣例**：用 `t.mock.method(globalThis, 'fetch', ...)` mock 對外
HTTP 呼叫（第二大腦整合、`chat.js`/OpenRouter 整合的測試都是這樣做的，見
`server/test/api.test.js`），不打真實網路。`chat.js` 的測試涵蓋未登入 401、
`OPENROUTER_API_KEY` 未設定時 503（並斷言 `fetch` 完全沒被呼叫）、訊息格式
錯誤 400、串流回應原樣轉發、OpenRouter 各種錯誤狀態碼對應到的錯誤代碼、
以及速率限制邊界。

**E2E（`e2e/`，Playwright + `@axe-core/playwright`）**：`playwright.config.js`
會自動起後端（記憶體 DB）與前端 dev server，跑 4 條黃金路徑並在關鍵頁面做
無障礙掃描（斷言 `violations.filter(v => v.impact === 'critical')` 為空）：
- `learner-golden-path.spec.js`：學員註冊 → 完成一次評測 → 看報告
- `coach-qr-join.spec.js`：教練建班 → 產生 QR 報到連結 → 學員用連結直接加入
- `admin-assessment-toggle.spec.js`：管理者停用某套題庫後學員看不到，重新
  啟用後恢復
- `coach-overview-with-data.spec.js`：用 API 種好一個有作答資料的班級，教練打開
  總覽，斷言作答進度、KPI、成員比較表都在、未設定 SMTP 時寄信按鈕優雅降級。
  Sprint 5 拆元件時漏搬「作答進度」面板，前三條都沒走到有資料的班級總覽才沒
  抓到——這條就是為此而加，已驗證拿掉面板時會失敗

這套測試會啟動真實 Chromium，能抓到 jsdom（Vitest 環境）測不出來的問題
（實際渲染、真實使用者互動時序）。跑的時候三支測試共用同一個後端／
記憶體 DB／rate limiter，因此 `playwright.config.js` 設 `workers: 1`
（依序執行，不用平行搶同一份狀態），並設 `AUTH_RATE_LIMIT=1000`（否則幾支
測試加起來會把正式額度 10 次用光）；每支測試若動到共用資料（例如停用
題庫），結尾都要自己復原，避免污染後面的測試。CI 環境沒有預裝的
Chromium 路徑時可用 `PLAYWRIGHT_CHROMIUM_PATH` 環境變數指定執行檔位置。

**快取是模組層級（module-level）的**，同一個 process 內的測試會共用同一份
快取 Map——寫多個測試涉及同一個快取 key（如同一個搜尋關鍵字）時，要留意
第二個測試可能拿到第一個測試留下的快取結果而非自己 mock 的回應。已知
曾因此踩過一次坑（見 `server/test/api.test.js` 學習資源測試裡刻意選用
不重複 dimension ID 的寫法）。

**CI**（`.github/workflows/deploy.yml`）：push 到功能分支時跑
`npm ci → lint → test`（前端）+ `npm ci → test`（後端）→ **E2E**（安裝
Chromium 後跑 `npm run test:e2e`，失敗時上傳 trace 當 artifact）→ `npm run build`
→ 部署到 **GitHub Pages**（`base: /TEST/`）。E2E 任何一條失敗就不會部署預覽站。
（Sprint 5 當時宣稱「E2E 可在 CI 執行」但其實沒接上，Sprint 7 才補齊。）

> ⚠️ **這個 GitHub Pages 部署只是預覽站，跟正式的 VPS 站
> （`assess.rong-rise.com`）完全獨立**——GitHub Pages 是純靜態託管，沒有
> 後端，评测提交、登入等需要 API 的功能在預覽站上不會正常運作（那裡連
> `dist/index.html` 複製成 `404.html` 純粹是為了讓 SPA 前端路由在重新整理
> 子路徑時不要 404，跟正式站的 Nginx `try_files` 設定是兩回事）。CI 綠燈
> 只代表 lint/test/build 通過，**不等於正式站已更新**——正式站更新永遠要
> 手動在 VPS 上跑第 11.4 節的部署步驟。

---

## 13. 已知限制與技術債

- **SQLite 單檔儲存，適合課程規模、低併發**。若使用規模明顯成長（更高
  併發、多機部署需求），需要評估改接 PostgreSQL 等真正的資料庫伺服器——
  目前 `db.js` 的抽象（`db.data.*` + `db.persist()`）刻意留了置換空間，
  但實際遷移仍是一項未做的工作。
- **第二大腦整合是單點外部依賴**：已用 5 秒逾時 + try/catch + 空狀態
  處理將風險降到「壞了看不到延伸閱讀，但不影響評測本身」，且後端會定期檢查、
  狀態變化時寄告警信（第 10.4 節）。**剩下的缺口**：這個告警是服務自己在跑，
  整個後端掛掉時不會有人通知——需要另外設一個外部監控（UptimeRobot 等）
  定期打 `GET /api/health`，這是 VPS 端的設定，程式碼這邊沒辦法代勞。告警
  管道目前也只有 Email（Slack/Discord webhook 列在待決 backlog）。
- **寄出的信可能進垃圾信匣**：沒有為寄件網域設定 SPF/DKIM 時，Gmail 等大型
  信箱有一定機率把告警信、催交信判成垃圾信。正式使用前建議用有設定 SPF/DKIM
  的自有網域寄信，並實際寄一封測試信確認收得到。
- **`TRUST_PROXY` 仍要人工從外部驗證一次**：`verify.sh` 會提醒有沒有設定，
  「管理後台 → 系統狀態」會顯示伺服器看到的 IP 並在看起來是內網位址時警示，
  但「設的層數對不對」只有從外部網路打開那一頁才看得出來，無法完全自動化。
  反向代理架構改變時要重看一次。

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

### 設定寄信服務（SMTP）

1. 在 VPS 的 `server/.env` 填 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、
   `SMTP_PASS`（選填 `SMTP_FROM`），格式與 Gmail 範例見 `server/.env.example`。
   Gmail 要用「應用程式密碼」，不是登入密碼。
2. `sudo systemctl restart ai-assessment-api`。啟動 log（`journalctl -u
   ai-assessment-api`）若還看得到「未設定 SMTP」的警告，代表三個必填項還沒
   填齊。
3. 驗證：教練後台找一個施測期間內、有人還沒作答的班級，按「寄送提醒信」，
   確認收件人真的收到（也檢查垃圾信匣）。
4. VPS 防火牆或雲端供應商若擋了對外 SMTP 埠（25/465/587），寄信會一直失敗
   ——`journalctl` 會看到 `[mailer] sendMail failed` 與錯誤訊息。

### 收到「⚠️ 異常」告警信

- 第二大腦：先 `curl -I https://brain.rong-rise.com` 看是不是對方服務掛了；
  期間學員報告頁的延伸閱讀會顯示空狀態，評測本身不受影響。恢復後會自動收到
  「✅ 已恢復」信，不需要手動解除。
- OpenRouter：檢查 `server/.env` 的 `OPENROUTER_API_KEY` 是否被移除或改壞，
  修好後重啟服務。
