# 檢查清單與指令範本

## 目錄
1. 部署指令範本
2. 改題庫的檢查清單
3. 改報告的檢查清單
4. 改權限或隱私的檢查清單
5. 顧問回饋與比對
6. 客戶資料交付
7. 乾淨版 bundle 的 filter-repo 範本
8. 接續排程的提示詞範本

## 1. 部署指令範本（CI 綠燈後給使用者）

把 `<COMMIT7>` 換成你驗證過的提交的前 7 碼。檢查不符時指令會停下，不會部署錯的版本。

```bash
cd /opt/ai-assessment/app \
 && sudo bash deploy/backup.sh \
 && git fetch origin claude/ai-assessment-survey-4vhjun \
 && git checkout claude/ai-assessment-survey-4vhjun \
 && git pull origin claude/ai-assessment-survey-4vhjun \
 && [ "$(git rev-parse --short=7 HEAD)" = "<COMMIT7>" ] \
 && bash deploy/deploy.sh
```

部署後驗證：`bash deploy/verify.sh`（PASS／WARN／FAIL）、`curl -s localhost:3101/api/health`（版本號應為 `<COMMIT7>`）。

## 2. 改題庫

- [ ] 是結構還是文字？結構：升 `ITEM_VERSION` → `node scripts/print-fingerprints.mjs` → 更新 `src/test/fixtures/assessment-fingerprints.json`
- [ ] 新構面：`DIMENSION_DEFINITIONS`、`SUB_DEFINITIONS`、`DIMENSION_COMMENTARY`、`COMMENTARY`、`data/goal-starters.js`
- [ ] 新題庫：`ABBR`、`server/src/db.js` 的 `KNOWN_ASSESSMENTS`、`data/assessments/index.js`、英文名稱
- [ ] 已匯入的結果是快照：結構改了要提醒使用者移除重匯
- [ ] L9D 與八大構面共用的文字（構面名稱、評語）改一處，兩套都會變

## 3. 改報告

- [ ] A4 版與手機閱讀版（`MobileReportViews.jsx`）同步
- [ ] 360° 用 `r.shownTypes`／`r.hiddenTypes`，匿名門檻不放寬
- [ ] 列印用 `useReportFilename`
- [ ] 跑 e2e（報告章節標題變動常讓 e2e 的文字斷言失敗）
- [ ] 必要時用 Playwright 截圖逐頁看，或轉 PDF 檢查頁數與分頁

## 4. 改權限或隱私

- [ ] 規則寫在伺服器端，不只在前端隱藏
- [ ] 教練範圍：`group.coachId === 我` 或管理員
- [ ] 稽核：敏感操作呼叫 `auditLog(req, action, extra)`
- [ ] 隱私權政策文字同步，前後端 `POLICY_VERSION` 一起升
- [ ] 新的使用者資料集合加進刪除與匯出

## 5. 顧問回饋與比對

- 先確認檔案內容讀得到（Excel 用 openpyxl，PDF 用文字擷取）。
- 逐題或逐項比對，差異用表格列出：題號、題目、對方的版本、系統的版本。
- 分清楚「文字差異」（可直接改）與「結構差異」（要升版、重匯）。
- 要給顧問審核的內容做成可編輯的 Excel：凸顯需要他們決定的欄位、留審核欄。

## 6. 客戶資料交付

- 檔案只放 scratchpad，不提交；用 `SendUserFile` 傳給使用者。
- 可編輯格式：Word 用 docx-js，Excel 用 openpyxl；轉 PDF 用 LibreOffice（`/usr/bin/soffice`）。
- 這個容器裡 openpyxl 要 `PYTHONPATH=/usr/local/lib/python3.13/dist-packages`；docx-js 用 `NODE_PATH=$(npm root -g)`。

## 7. 乾淨版 bundle（filter-repo）

```bash
W=<scratchpad>/clean-work && mkdir -p $W && cd $W
git clone --single-branch --branch claude/ai-assessment-survey-4vhjun /home/user/TEST repo
pip install -q git-filter-repo
cat > replace.txt <<'EOF'
<客戶名稱>==>客戶專案
<真實姓名>==>王大明
<個人信箱>==>contact@example.com
EOF
echo "Project Maintainer <noreply@example.com> <原作者> <原信箱>" > mailmap.txt
cd repo && git filter-repo --force \
  --invert-paths --path docs/internal --path docs/user-manual.pdf --path public/user-manual.pdf \
  --replace-text ../replace.txt --mailmap ../mailmap.txt
git branch -m main
# 驗證：歷史裡沒有殘留
git grep -nE "<客戶名稱>|<真實姓名>|<個人信箱>" $(git rev-list --all) | wc -l   # 應為 0
git log --format='%an <%ae>' | sort | uniq -c
# 跑完整測試（含 e2e）後打包
git bundle create ../handover.bundle main HEAD
git clone ../handover.bundle ../verify && (cd ../verify && git bundle verify ../handover.bundle)
sha256sum ../handover.bundle
```

另外檢查：`git bundle --all` 會帶進無關分支，不要用；`nginx -T` 的完整輸出含整台主機的設定，不要外流，給專案裡的 `deploy/nginx/*.conf` 就好。

## 8. 接續排程的提示詞範本

```text
【每小時接續檢查】請讀 docs/<計畫文件>.md 的進度表與執行紀錄以及 git log。
- 若還有未完成的 Sprint，且執行紀錄沒有標「等待使用者」→ 依執行協定，從第一個未完成的 Sprint 繼續（做到一半的先看 git status／git diff 接著做，不要重做已完成的項目）。
- 若全部完成，或正在等使用者做事 → 只回覆「閒置」兩個字，不要做任何事、不要推送。
- 全部完成時：用 update_trigger 把這個排程停用（排程 id 記在執行紀錄）。
```
