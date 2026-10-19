# 部署指南（Ubuntu / Debian + Nginx + HTTPS）

本系統分為兩部分，部署在**同一台 VPS、同一個網域**之下：

| 部分 | 內容 | 對外路徑 |
| --- | --- | --- |
| 前端 | Vite 打包的靜態檔（`dist/`） | `/`（由 Nginx 直接提供） |
| 後端 | Node/Express API（常駐 systemd 服務，監聽 `127.0.0.1:3001`；本站 Traefik 方案為 `3101`，見附錄 A） | `/api`（由 Nginx 反向代理） |

資料以 SQLite 保存（`/var/lib/ai-assessment/db.json.sqlite3`），備份請用 `deploy/backup.sh`（線上備份；不要直接複製檔案，見「備份與還原」）。若是從舊版純 JSON 儲存升級上來，服務啟動時會自動偵測 `db.json` 並一次性遷移進 SQLite，原始 JSON 檔不會被刪除，可留著當作遷移前的快照。

> 本指南已套用你的網域。以下指令把網域設成變數，先執行一次再往下貼即可：
> ```bash
> export DOMAIN=assess.rong-rise.com
> ```

---

## 0. 前置作業
- 已有一台 Ubuntu 22.04/24.04（或 Debian）的 VPS，能用 `sudo`。
- 將 `assess.rong-rise.com` 的 **A 記錄**（以及 `AAAA`，若有 IPv6）指到 VPS 的公開 IP。
  用 `dig +short assess.rong-rise.com` 確認解析到正確 IP 後再往下做。
- 開放防火牆 80／443：
  ```bash
  sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
  ```

## 1. 安裝相依套件
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git rsync
# HTTPS 憑證工具
sudo apt-get install -y certbot python3-certbot-nginx
node -v   # 應為 v22+（後端的 better-sqlite3 原生模組要求 Node ≥22；Node 20 會在載入時當機）
```

## 2. 取得程式碼
```bash
sudo mkdir -p /opt/ai-assessment && sudo chown "$USER" /opt/ai-assessment
git clone <你的 repo 網址> /opt/ai-assessment/app
cd /opt/ai-assessment/app
git checkout claude/ai-assessment-survey-4vhjun
```

## 3. 設定後端環境變數
```bash
# 資料目錄（服務以 www-data 身分執行，需可寫）
sudo mkdir -p /var/lib/ai-assessment
sudo chown www-data:www-data /var/lib/ai-assessment

# 由範例建立 .env
cp server/.env.example server/.env
# 產生 JWT 密鑰並填入
echo "JWT_SECRET=$(openssl rand -hex 32)"   # 複製這行結果貼到 .env
nano server/.env
```
`.env` 至少要設定：`JWT_SECRET`（剛產生的隨機字串）、`ADMIN_EMAIL`、`ADMIN_PASSWORD`（請用強密碼）、`NODE_ENV=production`。正式環境在「資料庫裡還沒有管理員」時若沒設定 `ADMIN_PASSWORD`（或仍是預設值），服務會拒絕啟動——這同時能擋住資料庫路徑設錯、以空庫啟動的情況。

**選填：寄信服務（SMTP）**——設定後才會啟用「外部依賴異常時寄告警信給 `ADMIN_EMAIL`」與教練的「寄送提醒信」；
沒設定時這兩項自動停用，其他功能不受影響。在 `.env` 填入：
```
SMTP_HOST=smtp.gmail.com        # 或 SendGrid／Mailgun 等任何 SMTP relay
SMTP_PORT=587                   # 465 會走 implicit TLS
SMTP_USER=你的寄件帳號
SMTP_PASS=應用程式密碼            # Gmail 要用「應用程式密碼」，不是登入密碼
SMTP_FROM=評測平台 <noreply@你的網域>   # 選填
```
設定後重啟服務，再從教練後台對一個施測中的班級按一次「寄送提醒信」，確認收件人真的收到（也看一下垃圾信匣）。
沒有 SPF/DKIM 的寄件網域容易被判成垃圾信；VPS 若擋了對外 SMTP 埠（25/465/587）則會寄送失敗，
`sudo journalctl -u ai-assessment-api` 會看到 `[mailer] sendMail failed`。

## 4. 安裝後端服務（systemd）
```bash
# 後端程式放到 /opt/ai-assessment/server
sudo mkdir -p /opt/ai-assessment/server
sudo rsync -a --exclude node_modules server/ /opt/ai-assessment/server/
( cd /opt/ai-assessment/server && sudo npm ci --omit=dev )

# 安裝並啟動服務
sudo cp deploy/ai-assessment-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ai-assessment-api
sudo systemctl status ai-assessment-api --no-pager   # 應為 active (running)
curl -s localhost:3001/api/health                     # 應回 {"ok":true}
```

## 5. 建置並部署前端
```bash
cd /opt/ai-assessment/app
npm ci
npm run build                       # 產生 dist/（base=/、API 走 /api）
sudo mkdir -p /var/www/ai-assessment
sudo rsync -a --delete dist/ /var/www/ai-assessment/
```

## 6. 設定 Nginx
設定檔已內含 `server_name assess.rong-rise.com`，直接安裝即可：
```bash
sudo cp deploy/nginx/ai-assessment.conf /etc/nginx/sites-available/ai-assessment.conf
sudo ln -sf /etc/nginx/sites-available/ai-assessment.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # 視需要移除預設站台
sudo nginx -t && sudo systemctl reload nginx
```
此時用 `http://assess.rong-rise.com` 應已能開啟網站。

## 7. 啟用 HTTPS（Let's Encrypt）
```bash
sudo certbot --nginx -d "$DOMAIN"
# 依提示輸入 Email、同意條款，並選擇「將 HTTP 轉址到 HTTPS」。
# certbot 會自動修改 Nginx 設定並安裝憑證；之後會自動續期。
sudo certbot renew --dry-run    # 驗證自動續期
```
完成後以 `https://$DOMAIN` 開啟，並用 `.env` 設定的管理員帳號登入，即可看到管理後台。

---

## 附錄 A：VPS 已有 Traefik 佔用 80/443 時（本站採用此方案）

若伺服器上已有 **Traefik** 當反向代理（佔用 80/443），Nginx 無法再搶 80 埠。
此時改用「Traefik → Nginx(本機 8090) → 後端(3101)」的串接，TLS 交給 Traefik 自動處理，
**不需要 certbot**。本站實況：後端埠 `3101`（3001 已被佔用）、Nginx 用 `8090`
（8080 已被 bot 佔用）、Traefik 為 **host 網路模式**（故可用 `localhost` 直連）。

### A-1 後端（PORT=3101）
確認 `.env` 內 `PORT=3101`，並重啟服務：
```bash
sudo sed -i 's/^PORT=.*/PORT=3101/' /opt/ai-assessment/server/.env
sudo systemctl restart ai-assessment-api
curl -s localhost:3101/api/health      # 應回 {"ok":true}
```

### A-2 Nginx 只聽本機 8090（不對外、不處理 TLS）
```bash
sudo cp deploy/nginx/ai-assessment-behind-traefik.conf \
        /etc/nginx/sites-available/ai-assessment.conf
sudo ln -sf /etc/nginx/sites-available/ai-assessment.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default      # 移除會搶 80 埠的預設站台
sudo nginx -t && sudo systemctl restart nginx
curl -s -H 'Host: assess.rong-rise.com' http://127.0.0.1:8090/api/health   # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/            # 200
```
> 選埠前先用 `sudo ss -ltnp` 確認沒被佔用；本站 8080 已被既有 bot 使用，故改 8090。

### A-3 設定 Traefik 路由（file provider＝單一檔案，需「併入」）
本站 Traefik 的 file provider 指向單一檔 `/config/dynamic.yml`
（主機路徑 `/docker/traefik/config/dynamic.yml`），所以**不能丟新檔**，要把
`deploy/traefik/ai-assessment.yml` 內的 `routers.assess` 與 `services.assess-site`
兩個區塊併入既有檔案對應的 `http.routers` / `http.services` 之下：
```bash
sudo cp /docker/traefik/config/dynamic.yml /docker/traefik/config/dynamic.yml.bak
sudoedit /docker/traefik/config/dynamic.yml   # 貼入 assess 路由與 assess-site 服務
```
- `rule: Host("assess.rong-rise.com")`、`service: assess-site`、`tls.certResolver: letsencrypt`
- `assess-site` 的 `servers.url` 指向 `http://localhost:8090`
- Traefik 已開 `providers.file.watch=true`，存檔後自動重新載入並透過 Cloudflare
  DNS challenge 簽發憑證（resolver 名稱沿用既有的 `letsencrypt`）。

完成後以 `https://assess.rong-rise.com` 開啟即可，TLS 由 Traefik 自動簽發與續期。
（此情況請略過下方第 7 節的 certbot 步驟。）

---

## 之後要更新版本
把新 commit 拉下來後，一鍵重新部署。**在 VPS 上**於專案根目錄執行：
```bash
cd /opt/ai-assessment/app
git fetch origin claude/ai-assessment-survey-4vhjun
git checkout claude/ai-assessment-survey-4vhjun
git pull origin claude/ai-assessment-survey-4vhjun
bash deploy/deploy.sh        # 重新 build 前端、同步後端、重啟服務（保留 .env 與資料）
```
> `deploy.sh` 會：重建前端（寫入目前 commit 版本）→ 同步 `dist/` 到 `/var/www/ai-assessment` →
> 同步後端 → `npm ci --omit=dev` → 重啟 `ai-assessment-api` 並 reload Nginx →
> **自動執行 `deploy/verify.sh` 部署驗證**。

`verify.sh` 會逐項印出 **PASS／WARN／FAIL**：
- **FAIL**（要立刻處理，結束代碼為 1）：服務沒在跑、健康檢查失敗、前後端版本不等於剛拉下來的
  commit（例如服務沒重啟成功）、對外網址打不開。
- **WARN**（功能可用、但有設定該補）：沒設定 SMTP 或 `TRUST_PROXY`、沒有備份 cron、26 小時內沒有
  備份、第二大腦連不到、沒設定 OpenRouter 金鑰。

隨時都可以再單獨跑一次：
```bash
bash deploy/verify.sh
curl -s localhost:3101/api/health      # {"ok":true,"version":{"commit":"<目前 commit>",...}}（本站後端埠為 3101）
```
**最後一步要從 VPS 以外的網路做**：用瀏覽器登入管理員 →「管理後台 → 系統狀態」，確認「伺服器
看到的你的 IP」跟 whatismyip 之類網站顯示的一致，才代表 `TRUST_PROXY` 設對了（VPS 本機測不出來）。

再開 `https://assess.rong-rise.com` 確認網站正常；若要驗證「整體組織敘事評論」，
進教練後台 → 選一個 `leadership-9d` 班別（需 ≥2 位成員已作答），確認雷達圖下方
出現「🏢 整體組織評語」區塊。

## 上線檢查清單（每次部署照著勾）

> 這是 Sprint 6–8 第一次實際上線時走過的流程。**所有指令都在 VPS 上執行**，
> 密碼與金鑰只寫在 VPS 的 `server/.env`，不要貼到對話、文件或提交訊息。

**A. 部署前**
- [ ] 手動備份一次：`bash deploy/backup.sh`，看到「備份成功」與完整性檢查通過。
- [ ] `server/.env` 有必填鍵（`JWT_SECRET`、`PORT`、`DB_PATH`、`ADMIN_EMAIL`、`ADMIN_PASSWORD`、`NODE_ENV=production`）；
      只列名稱檢查：`sudo grep -oE '^[A-Z_]+=' /opt/ai-assessment/server/.env`
- [ ] 本次新增的設定鍵都補了（例如 SMTP 的五個鍵、`TRUST_PROXY=2`、`APP_URL`）。**不要**設 `AUTH_RATE_LIMIT`（只給 E2E 用）。
- [ ] GitHub 上這個 commit 的 CI 是綠的。

**B. 部署**
- [ ] `git fetch` → `git checkout` → `git pull` 分支，`git log --oneline -1` 確認是要上線的 commit。
- [ ] `bash deploy/deploy.sh` 跑完，結尾 `verify.sh` 結果為 **FAIL 0**。
- [ ] 每個 **WARN** 都看過：該補的補（如 SMTP），可接受的記下原因。

**C. 從 VPS 以外的網路驗收**
- [ ] 「管理後台 → 系統狀態」前後端版本都等於剛部署的 commit。
- [ ] 用**手機行動網路**開同一頁，「伺服器看到的你的 IP」是外部 IP（不是 `127.0.0.1` 或 `10.`／`172.`／`192.168.` 開頭）。
- [ ] 設定了 SMTP 的話：教練後台挑測試班按「寄送提醒信」，信收得到、不在垃圾信匣。
- [ ] 手機：登入、開始作答（選項一排五格、選完自動跳下一題）。
- [ ] 切換深色模式，首頁與一份報告都看得清楚。
- [ ] 用一個學員帳號與一個教練帳號各登入一次，頁首帳號選單可開啟、可登出。
- [ ] （Sprint 12 起）隱私權政策已於 2026-10-17 公開（`status: 'published'`）：**每位既有用戶（包含管理者與管理者匯入的帳號）第一次登入
      都會先看到一次「請閱讀並同意」畫面**，同意後才能進系統，之後不會再問，除非調高 `POLICY_VERSION`。
      修改政策文字前先想：是「實質修改」（蒐集的資料、用途、第三方、保存期限）嗎？是的話前後端的 `POLICY_VERSION` 一起調高
      （`server/src/lib/policy.js`、`src/survey/legal/policy.js`，有測試檢查兩邊一致），並先通知教練與學員。
- [ ] （Sprint 12 起）開 `/privacy`、`/terms`（不登入）能看到內容；註冊頁不勾選會顯示提示、勾選後才能建立帳號。
- [ ] （Sprint 11 起）管理後台「用戶管理」：篩選與角色下拉可用、自己那一列的下拉與停用是灰的；
      「班別與發佈」每班顯示負責教練。**不要在正式站亂改別人的角色**，驗證時可用自己建的測試帳號
      （升教練 → 確認對方被登出 → 停用 → 重新啟用）。
- [ ] （Sprint 11 起）用教練帳號建立／打開班別：進頁面自動選班、有班別標題列；「成員與設定」的成員搜尋輸入 1 個字不會搜尋、
      2 個字才有結果；**用手機點班別，畫面會自動捲到詳情**（這項自動化測試涵蓋不到，請實機確認）。
- [ ] （Sprint 10 起）管理後台「題庫內容」可以開啟、能看到各題庫的文字；**不要在正式站亂改**，
      要驗證流程時挑一個沒人在用的題庫改一個字 → 預覽 → 發佈 → 立刻「全部還原成內建原文」。

**C2. 領導力羅盤與接班準備度評測（本批更新；兩個新評量預設停用）**
- [ ] **這次部署會調高隱私權政策版本（`2026-10-18.2`，暫定版，尚待法務審閱）**：部署後每位用戶（含管理者）第一次登入都會再看到一次「請閱讀並同意」。
      部署前先通知教練與學員；`src/survey/legal/policy.js` 的 `effectiveDate` 若與實際部署日不同，部署前先改成部署當天。
- [ ] 部署後到「管理後台 → 評量」：確認「領導力羅盤」「接班準備度評測」存在且**是停用狀態**（一般使用者看不到）。
- [ ] 驗收（管理者帳號）：先啟用領導力羅盤 → 建一個**測試班**選它 → 用測試學員作答精簡版與完整版各一次 → 看報告、列印、複製摘要。
- [ ] 360° 驗收（他評需要邀請）：同班建 1 位受評者＋3 位同儕測試帳號。受評者在「360° 評測 → 領導力羅盤八向評測 → 邀請別人評我」邀請同儕；
      被邀請的人在「等你評測的人」開始評測。確認：沒被邀請的人不能評、教練看不到評分者身分（只有份數）、
      同類不足 3 位時受評者看不到他評、滿 3 位才顯示、上級評分在受評者同意前不顯示（「同意顯示上級評分」開關）。
      ⚠️ 啟用評量會讓**所有用戶**的「選擇評量」都出現這張卡片：請在人少的時段驗收，驗收完立刻停用，或確認沒有真實學員會誤作答。
- [ ] 組織診斷：測試班完成人數 2／4／5 位時，「組織診斷」分頁分別只顯示完成率／只有平均／完整內容。
- [ ] 接班準備度評測：**啟用前確認政策已公開新版**（「職涯意向資料」「去留想法」已揭露）、與客戶說明結果的用途與可見對象
      （本人、所屬班級教練、管理員）；長期意向的題目可選「不想回答」。
- [ ] 各評測說明頁：不登入開 `/guide/ai-competency`、`/guide/leadership-9d`、`/guide/disc`、`/guide/archetype`，能看到構面、題數與結果說明；首頁評測工具庫每張卡片有「了解這份評測 →」。
- [ ] 框架說明：開 `/framework`（不登入）能看到八構面與四組張力；作答頁最上方有「先認識這份評測」；報告的構面名稱點得開對應段落。
      （`/framework` 是公開網址，評量啟用前就打得開；首頁導覽與頁尾沒有放連結，到正式推出再決定要不要放。）
- [ ] 驗收完成後才對真實班級啟用；啟用前不要讓真實學員看到這兩個評量。
- [ ] 還原評分者身分只有管理員可用，且必須填理由並留下稽核紀錄：管理後台「身分還原」分頁操作，「稽核紀錄」分頁可查。

**C3. 全站審查第二批（Nginx 設定要手動更新）**
- [ ] `deploy.sh` **不會**更新 Nginx 設定。這批新增了安全標頭、`index.html`／`sw.js` 不快取與 gzip 設定，要手動套用：
  ```bash
  cd /opt/ai-assessment/app && git pull origin claude/ai-assessment-survey-4vhjun
  sudo cp /etc/nginx/sites-enabled/ai-assessment.conf /root/ai-assessment.conf.live-backup   # 備份要放在 sites-enabled 之外（那個資料夾的檔案全都會被載入）
  sudo cp deploy/nginx/ai-assessment-behind-traefik.conf /etc/nginx/sites-available/ai-assessment.conf
  sudo ln -sf ../sites-available/ai-assessment.conf /etc/nginx/sites-enabled/ai-assessment.conf   # 確保 sites-enabled 是指向 sites-available 的連結
  sudo nginx -t && sudo systemctl reload nginx
  ```
  ⚠️ **曾經踩到的坑**：`sites-enabled/ai-assessment.conf` 在本站是一份「獨立的檔案」而不是連結，只改 `sites-available` 不會生效。
  用 `ls -l /etc/nginx/sites-enabled/` 確認它是 `->` 指向 `../sites-available/...`；
  用 `sudo nginx -T | grep -n "configuration file"` 看 Nginx 實際載入了哪些檔案。驗證：`curl -sI https://assess.rong-rise.com/ | grep -i -E "x-frame|nosniff|content-security|cache-control"`。
- [ ] CSP 目前是 **Report-Only**（只在瀏覽器主控台回報、不會擋）。上線後把作答、報告列印、QR Code、AI 小幫手、管理後台都走一遍，確認主控台沒有 `Content-Security-Policy-Report-Only` 的違規訊息，再把 nginx 設定裡的 `Content-Security-Policy-Report-Only` 改成 `Content-Security-Policy`。
- [ ] Traefik 若已經加了 HSTS，可以移除 nginx 裡那一行，避免重複。
- [ ] 管理後台新增「身分還原」與「稽核紀錄」兩個分頁：用管理員帳號各開一次確認可用（稽核紀錄應該看得到你剛才的操作）。
- [ ] 想調整 AI 小幫手每日次數，在 `server/.env` 加 `CHAT_DAILY_LIMIT=數字`（預設 100）。

**D. 出問題時**
- 服務起不來或 502：`sudo journalctl -u ai-assessment-api -n 50`，多半是 `.env` 缺鍵或埠不符。
- 要回到上一版：`git checkout <上一個 commit>` 後再跑 `bash deploy/deploy.sh`。**注意**：新版對資料庫的遷移（改名、補評量、新集合）是單向的，
  舊程式碼不保證能讀新資料。若新版已經寫入過資料才發現要回滾，請「程式與資料一起回滾」：停服務 → 還原**部署前那份備份**
  （`deploy.sh` 每次部署前都會自動備份，見下方「備份與還原」）→ 切回舊 commit → `SKIP_BACKUP=1 bash deploy/deploy.sh`。
- 資料有疑慮：照下方「備份與還原」，用部署前那份備份還原。
- 設定寄信後仍收不到：先看「管理後台 → 系統狀態」的寄信設定，再看 `journalctl` 有沒有 SMTP 錯誤；
  VPS 可能擋了對外 SMTP 埠，改用 587 或換寄信服務。

## 備份與還原
資料庫是 SQLite（WAL 模式），服務執行中直接 `cp` 主檔案可能漏掉尚未 checkpoint
的 WAL 內容；用 `sqlite3` CLI 的線上備份指令才能在服務不停機的情況下拿到一致的
快照（Ubuntu/Debian 沒有內建的話先 `sudo apt install -y sqlite3`）。

**自動化每日備份**：repo 內 `deploy/backup.sh` 會備份、驗證完整性（`PRAGMA
integrity_check`）、並自動清掉超過保留份數（預設 14 份）的舊備份：
```bash
# 手動跑一次（預設備份 /var/lib/ai-assessment/db.json.sqlite3 到 /var/backups/ai-assessment）
bash /opt/ai-assessment/app/deploy/backup.sh

# 排進 cron，每天凌晨 3 點自動備份：
sudo crontab -e
# 加入這行：
0 3 * * * /opt/ai-assessment/app/deploy/backup.sh >> /var/log/ai-assessment-backup.log 2>&1
```
可用環境變數覆寫路徑與保留份數，例如 `KEEP=30 bash deploy/backup.sh`；細節見
腳本內註解。備份檔權限固定為只有擁有者可讀寫（內含學員姓名、Email、密碼雜湊、作答與職涯意向）。

`deploy/deploy.sh` **每次部署前會自動備份**（失敗就中止部署）；第一次部署、還沒有資料庫時會略過，也可用 `SKIP_BACKUP=1` 明確略過。

**備份的保留與目標**：每天一份（凌晨 3 點），最多可能遺失最近一天的資料；本機保留 14 份，**異地副本保留 180 天（半年）**。

**異地備份（rclone＋加密）**：備份和資料庫在同一台主機，整機或磁碟損毀時會一起消失，所以要有異地副本。
做法是 `rclone` 的 crypt 遠端——上傳前先加密，雲端服務商看不到學員資料。目的地可以選你已有的雲端空間：
Cloudflare R2（有免費額度，本站已使用 Cloudflare）、Backblaze B2、其他 S3 相容服務，或 Google Drive 之類的雲端硬碟。
```bash
sudo apt install -y rclone
sudo rclone config        # 1) 建一個儲存空間遠端（例如 r2）  2) 再建一個 crypt 遠端（例如 r2crypt）指向 r2:你的bucket/backups，並設定加密密碼
# 把 crypt 密碼與 rclone 設定另外安全保管（沒有密碼就解不開備份）；不要放進 repo 或貼到對話中
sudo rclone lsd r2crypt:  # 確認連得上
# cron 改成帶上異地目的地：
0 3 * * * OFFSITE_REMOTE=r2crypt:db-backups /opt/ai-assessment/app/deploy/backup.sh >> /var/log/ai-assessment-backup.log 2>&1
```
**政策與異地備份**：隱私權政策的保存期限已先寫成「主機約 14 天，另可能存放加密的異地副本，最長 180 天」（政策版本 `2026-10-18.2`，暫定版）。**請在上線後盡快完成上面的異地備份設定**，讓實際做法與政策一致；法務審閱後若再有實質修改，再升一次版並移除 `POLICY_META.provisional`。

`deploy.sh` 觸發的部署前備份只留本機即可（不用帶 `OFFSITE_REMOTE`）。每季請做一次「從異地副本還原」的演練
（`rclone copy r2crypt:db-backups/<檔名> /tmp/restore-test/`，再用 `sqlite3` 檢查完整性）。

**備份還原演練**（建議每月一次，以及重大改版前）：`deploy/restore-drill.sh` 把最新備份複製到暫存目錄，檢查完整性、
資料筆數與正式庫的差距，**不會動到正式資料庫**，結束代碼 0＝通過、1＝失敗：
```bash
bash /opt/ai-assessment/app/deploy/restore-drill.sh
```
只有「演練通過」的備份才算可靠；真正還原的步驟如下。

**還原**：
```bash
sudo systemctl stop ai-assessment-api
sudo cp /var/backups/ai-assessment/db-YYYY-MM-DD-HHMMSS.sqlite3 /var/lib/ai-assessment/db.json.sqlite3
sudo rm -f /var/lib/ai-assessment/db.json.sqlite3-wal /var/lib/ai-assessment/db.json.sqlite3-shm
sudo chown www-data:www-data /var/lib/ai-assessment/db.json.sqlite3
sudo systemctl start ai-assessment-api
```

## 疑難排解
- 後端日誌：`sudo journalctl -u ai-assessment-api -f`
- Nginx 錯誤：`sudo tail -f /var/log/nginx/error.log`
- `502 Bad Gateway`：多半是後端沒啟動或埠不符 → 檢查服務狀態與 `.env` 的 `PORT`。
- 登入後一直登出：確認已啟用 HTTPS 且 `NODE_ENV=production`（Secure cookie 需要 HTTPS）。

## 安全備註
- 資料存在單一 SQLite 檔案，適合課程／中小規模；若要更高併發或多機，請改接 PostgreSQL 等資料庫。
- 務必設定強的 `ADMIN_PASSWORD` 與隨機 `JWT_SECRET`，且不要把 `.env` 提交到版本庫（已列入 `.gitignore`）。
- 建議定期 `sudo apt-get upgrade` 並保持憑證自動續期正常。
