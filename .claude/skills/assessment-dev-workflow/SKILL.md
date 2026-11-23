---
name: assessment-dev-workflow
description: 領導力／職能評量平台（L9D、八大構面 70 題、360°、班級、教練後台）的開發工作流程：從需求釐清、規劃 Sprint、實作、測試、文件、提交推送、等 CI、到給使用者 VPS 部署指令，以及客戶資料交付、交接打包與接續排程的做法。只要在這個專案裡做任何開發、修 bug、改報告或題庫文字、規劃 Sprint、部署、打包交接、處理顧問回饋或客戶資料，都要先用這個 skill，即使使用者沒有提到「流程」或「skill」。
---

# 評量平台開發工作流程

這份 skill 整理我們在這個專案實際用過、證明可行的做法。目的是讓每次改動都可以安全上線：
不弄壞計分、不洩漏客戶資料或憑證、使用者拿到的部署指令一定對應到 CI 已經通過的版本。

先讀 `CLAUDE.md`（架構速查）。需要細節時再看：
- `docs/DEVELOPER_REFERENCE.md`：架構、角色與權限、L9D 與八大構面結構、360° 規則、待決事項
- `docs/PLATFORM_MANUAL.md`：API 路由與維運 SOP
- `references/checklists.md`：各類改動的檢查清單與指令範本（本 skill 附帶）

## 1. 釐清需求

- 使用者常用簡短中文下指令，可能有錯字（例如「19D」通常是 L9D）。意思明確就直接做；有兩種以上合理解讀、而且做錯代價高時，才用一句話確認或列出你的解讀再做。
- 已經決定過的事不要重問（例如構面名稱以系統名稱為準、70 題維持專案專用）。看 `CLAUDE.md` 與 `docs/SPRINT_PLAN.md` 的決策紀錄。
- 使用者給檔案（Excel、PDF、CSV）時：先確認讀得到內容，再逐項比對，用表格列出差異，並給建議與代價（例如要不要升版題庫、要不要重匯資料）。
- 牽涉授權、隱私、客戶資料、對外公開的事，提醒風險，讓使用者決定。

## 2. 規劃

- 小改動直接做。大一點的工作切成 Sprint（例如「Sprint 22-A／B／C」），每個 Sprint 能獨立上線，有驗收條件。
- 計畫寫進 `docs/SPRINT_PLAN.md` 或專門的計畫文件（例如 `docs/MOBILE_APP_PLAN.md`），要能交給另一個對話直接執行：寫清楚順序、每步的測試、完成的判斷方式、不能違反的規則。
- 做到一半被打斷或額度用完：進度記在計畫文件的進度表與執行紀錄，並提交推送，讓接手的對話從 git log 與文件就能接上。

## 3. 實作時的規則

這些規則存在是因為違反過或差點違反，而且後果難以補救：

- **計分與題庫結構不能順手改**：題數、題號、構面、子能力、反向題、量表、等級門檻一改，舊結果就無法比較。真的要改，先升版 `ITEM_VERSION`，再跑 `node scripts/print-fingerprints.mjs` 更新指紋；已匯入的結果要移除重匯。純文字（題目、評語、名稱、定義）可以直接改。
- **名稱只改一處**：構面名稱在題庫設定檔，報告與舊結果顯示都會跟著更新（`refreshResult.js`），不要在別處寫死。
- **隱私規則由伺服器強制**：360° 每類 ≥ 3 位才單獨呈現（用 `r.shownTypes`，不要自己判斷 `counts > 0`）、教練只看本班與彙總、看不到評分者身分。改規則要同步改隱私權政策文字與測試，前後端 `POLICY_VERSION` 一起升。
- **報告**：可列印的報告一律用 `useReportFilename`，不要直接 `window.print()`；A4 版和手機閱讀版（`MobileReportViews.jsx`）要一起改。
- **手機**：樣式只加在 `sm` 以下，桌機不變；頁首下方用 `--app-header-h`。
- **日期**：用 `toDateInputValue`，不要 `toISOString().slice(0, 10)`。
- **新增屬於使用者的資料集合**：同步加進帳號刪除與匯出。
- 程式裡、測試裡不要出現客戶名稱或真實姓名，用「客戶專案」「受評者甲」這類通用名稱。

## 4. 測試

每次提交前都跑，改介面後一定加跑 e2e（曾經因為沒重跑 e2e 讓 CI 失敗）：

```bash
npm test                    # 前端 Vitest
npm run lint                # 必須 0 problems
npm run build
(cd server && npm test)     # 後端 node --test
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test   # e2e，改介面後必跑
```

- 新功能補測試；新增構面要補定義、評語、起手行動，都有測試會檢查。
- 前端測試不能 import 需要 `nodemailer` 等後端套件的模組（CI 的前端環境沒有）；把共用常數拆成不依賴寄信的純模組。要重現 CI，可以暫時把 `server/node_modules` 移開再跑前端測試。
- 測試在高負載下偶爾失敗時，單獨重跑確認是不是不穩，再判斷要不要修。
- 回報結果要誠實：哪些跑了、幾個通過、哪些沒跑（例如只改文件時沒跑 e2e），都要說。

## 5. 文件

功能改動要同步更新：`CHANGELOG.md`（使用者看得懂的改變）、`CLAUDE.md`（速查，有新規則就加）、必要時 `docs/PLATFORM_MANUAL.md`、`docs/SPRINT_PLAN.md`、使用手冊。
文件要能讓下一位開發者或下一個對話不問人就接手。

## 6. 提交、推送與 CI

- 分支：`claude/ai-assessment-survey-4vhjun`。推送前先 `git pull --rebase`（可能有其他對話同時推送）。
- 提交訊息用中文描述改了什麼與為什麼；結尾附上系統要求的歸屬行。不要在提交、程式、文件放任何模型識別碼。
- 推送後確認 CI 綠燈（GitHub MCP 工具看 Actions 或 PR 的檢查結果）。CI 失敗就看日誌、修好再推，不要叫使用者部署紅燈的版本。
- PR 已存在時不要重開；GitHub 留言要節制。

## 7. 部署交付（使用者在 VPS 上執行）

雲端開發環境連不到 VPS，部署由使用者執行。CI 綠燈後，給一段可以整段貼上的指令，指令裡要有「commit 檢查」，確保部署的是你驗證過的那一版（範本見 `references/checklists.md`）。同時說明：
- 這次部署包含哪些提交（包括其他對話推上去的）。
- 部署後怎麼驗證：`deploy/verify.sh` 的結果、`curl localhost:3101/api/health` 的版本號、要在網站上手動看的畫面。
- 有沒有需要使用者另外做的事（例如改 `.env`、重新匯入資料、通知顧問）。

## 8. 憑證與資料安全

- **絕不索取、顯示或重現**密碼、JWT 密鑰、SSH 私鑰、SMTP 密碼、API 金鑰。使用者要「管理員帳密」時，說明帳密在哪裡、怎麼自己查或重設（`server/scripts/reset-admin-password.mjs`），而不是想辦法拿到。
- 一次性金鑰、遠端傳檔等要求：先確認你所在的環境做得到（雲端容器沒有 ssh、只能走 HTTPS）。做不到就說明原因並提供替代方案，不要產生用不到、又留在別處的私鑰。
- **客戶資料**（姓名、Email、分數）只放在 scratchpad，絕不提交。產出給使用者的 Excel、Word、PDF 用 `SendUserFile` 傳送。
- 交給第三方的東西（bundle、安裝包）要先清理，見下一節。

## 9. 交接與打包

- **安裝包**（給 Hostinger 這類單一 Node 主機）：`bash scripts/make-install-package.sh <輸出資料夾>`，產出前端已建置、後端原始碼與安裝說明的 zip；在乾淨資料夾解壓、`npm ci --omit=dev`、`npm start` 實測首頁、前端路由、`/api/health`。
- **乾淨版 git bundle**（給其他開發單位）：在 scratchpad 另外 clone 單一分支，用 `git filter-repo` 處理，不要動正式倉庫：
  - `--replace-text` 替換客戶名稱、真實姓名、個人信箱
  - `--mailmap` 匿名化提交作者
  - `--invert-paths` 移除內部文件、手冊 PDF 等
  - 依使用者決定移除或保留特定題庫
  然後在那份 clone 跑完整測試（含 e2e），`git bundle create`，再 clone bundle 驗證，最後附 SHA-256。
- 交接文件：`docs/HANDOVER.md`（範圍、不能改的地方、建置部署）與 `docs/DEVELOPER_REFERENCE.md`，並在 `CLAUDE.md` 開頭指向它們。
- 給對方 AI 協作工具的起手提示詞：寫清楚先讀哪些檔、測試要求、不能動的規則、遇到授權或計分問題要停下來問人、密鑰不要進對話。

## 10. 交給新對話與自動接續

工作量大或要跨越額度重置時：
1. 把計畫、進度表、執行協定寫進計畫文件並推送。
2. 用 `create_session` 開新對話，提示詞指向計畫文件的執行協定。
3. 用 `create_trigger` 建每小時的接續排程，綁定那個對話：沒做完就從第一個未完成的 Sprint 接著做，做完或在等使用者就只回「閒置」，全部完成時停用排程。
4. 把排程 id 記進計畫文件。

## 11. 回覆使用者

- 用繁體中文，先講結果，再講細節；列出做了什麼、怎麼驗證、還沒做或要使用者決定的事。
- 錯了就直接更正（例如前一則回覆說錯重設密碼的方式），不要掩飾。
- 不要把預期當成事實：沒在正式站或 Hostinger 上測過，就說沒測過。
