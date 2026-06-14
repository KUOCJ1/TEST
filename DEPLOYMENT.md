# 部署指南（Ubuntu / Debian + Nginx + HTTPS）

本系統分為兩部分，部署在**同一台 VPS、同一個網域**之下：

| 部分 | 內容 | 對外路徑 |
| --- | --- | --- |
| 前端 | Vite 打包的靜態檔（`dist/`） | `/`（由 Nginx 直接提供） |
| 後端 | Node/Express API（常駐 systemd 服務，監聽 `127.0.0.1:3001`） | `/api`（由 Nginx 反向代理） |

資料以單一 JSON 檔保存（`/var/lib/ai-assessment/db.json`），備份只要複製這個檔即可。

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
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git rsync
# HTTPS 憑證工具
sudo apt-get install -y certbot python3-certbot-nginx
node -v   # 應為 v20+
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
`.env` 至少要設定：`JWT_SECRET`（剛產生的隨機字串）、`ADMIN_EMAIL`、`ADMIN_PASSWORD`（請用強密碼）、`NODE_ENV=production`。

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
> `deploy.sh` 會：重建前端 → 同步 `dist/` 到 `/var/www/ai-assessment` → 同步後端 →
> `npm ci --omit=dev` → 重啟 `ai-assessment-api` 並 reload Nginx。

部署後快速驗證：
```bash
curl -s localhost:3101/api/health      # 應回 {"ok":true}（本站後端埠為 3101）
```
再開 `https://assess.rong-rise.com` 確認網站正常；若要驗證「整體組織敘事評論」，
進教練後台 → 選一個 `leadership-9d` 班別（需 ≥2 位成員已作答），確認雷達圖下方
出現「🏢 整體組織評語」區塊。

## 備份與還原
```bash
# 備份（建議排程 cron 每日）
cp /var/lib/ai-assessment/db.json ~/backup-$(date +%F).json
# 還原：停服務 → 覆蓋檔案 → 起服務
sudo systemctl stop ai-assessment-api
sudo cp ~/backup-YYYY-MM-DD.json /var/lib/ai-assessment/db.json
sudo chown www-data:www-data /var/lib/ai-assessment/db.json
sudo systemctl start ai-assessment-api
```

## 疑難排解
- 後端日誌：`sudo journalctl -u ai-assessment-api -f`
- Nginx 錯誤：`sudo tail -f /var/log/nginx/error.log`
- `502 Bad Gateway`：多半是後端沒啟動或埠不符 → 檢查服務狀態與 `.env` 的 `PORT`。
- 登入後一直登出：確認已啟用 HTTPS 且 `NODE_ENV=production`（Secure cookie 需要 HTTPS）。

## 安全備註
- 這是檔案型儲存，適合課程／中小規模；若要更高併發或多機，請改接 PostgreSQL 等資料庫。
- 務必設定強的 `ADMIN_PASSWORD` 與隨機 `JWT_SECRET`，且不要把 `.env` 提交到版本庫（已列入 `.gitignore`）。
- 建議定期 `sudo apt-get upgrade` 並保持憑證自動續期正常。
