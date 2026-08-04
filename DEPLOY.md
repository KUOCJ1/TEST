# 部署到 VPS

本專案是純前端 SPA（React + Vite，資料存於瀏覽器 localStorage，無後端），
以 Docker + Nginx 容器化，並透過 GitHub Actions 在 push 到 `claude/travel-planning-app-Z4Nx6`
時自動建置映像、推送到 GitHub Container Registry (GHCR)，再 SSH 到 VPS 拉取並重啟容器。

## 一、VPS 端一次性設定

1. 安裝 Docker（含 Compose plugin）：
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. 建立部署目錄，並放入 `docker-compose.yml`（本專案根目錄已附一份）：
   ```bash
   mkdir -p ~/apps/shared-calendar
   # 把 docker-compose.yml 複製到這個目錄（scp 或手動貼上）
   ```

3. 讓 VPS 能拉取 GHCR 映像：
   - **最簡單**：第一次 push 觸發 workflow 後，到 GitHub repo → Packages → 找到
     `test` 這個 package → Package settings → Change visibility → **Public**。
     這樣 VPS 端 `docker compose pull` 不需登入。
   - 或者：若要保持 private，在 VPS 上執行一次
     `echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin`
     （PAT 需要 `read:packages` 權限，登入資訊會被 Docker 記住，不用每次都做）。

4. 開放防火牆的對外連接埠（`docker-compose.yml` 預設對外開 `8080`）：
   ```bash
   ufw allow 8080/tcp   # 依你的防火牆工具調整
   ```

5. 先手動跑一次確認可行：
   ```bash
   cd ~/apps/shared-calendar
   docker compose pull
   docker compose up -d
   curl -I http://localhost:8080
   ```
   確認後用瀏覽器打 `http://<VPS_IP>:8080` 應該能看到登入畫面。

## 二、GitHub 端設定（啟用自動部署）

到 repo → Settings → Secrets and variables → Actions，新增以下 secrets：

| Secret | 說明 |
|---|---|
| `VPS_HOST` | VPS 的 IP 或網域 |
| `VPS_USER` | SSH 登入使用者名稱 |
| `VPS_SSH_KEY` | 對應的 SSH 私鑰全文（建議另開一組專用的 deploy key，不要用個人金鑰） |
| `VPS_PORT` | SSH port（選填，預設 22） |
| `VPS_DEPLOY_PATH` | VPS 上 `docker-compose.yml` 所在目錄，例如 `/root/apps/shared-calendar` |

設定完成後，push 到 `claude/travel-planning-app-Z4Nx6` 就會自動：
1. 建置 Docker image（`Dockerfile`，使用根路徑 `/`，與 GitHub Pages 的 `/TEST/` base path 不同，兩者互不影響）
2. 推送到 `ghcr.io/kuocj1/test:latest`
3. SSH 進 VPS 執行 `docker compose pull && docker compose up -d`

也可以到 Actions 頁面手動點 **Run workflow**（`workflow_dispatch`）測試整條流程。

## 三、之後要上網域 + HTTPS 時

目前先用 IP/子網域 + `:8080` 測試。之後若要正式網域＋HTTPS，建議在 VPS 上另外加一層
反向代理（Caddy 最簡單，會自動處理 Let's Encrypt；或 Nginx + Certbot），把
`example.com` 導到本容器的 `127.0.0.1:8080`，不需要改這個專案的映像。屆時再回來調整
`docker-compose.yml` 的 port 綁定即可，隨時可以問我協助設定。

## 檔案對照

- `Dockerfile` — 兩階段建置：`node:20-alpine` 建置 → `nginx:1.27-alpine` 提供靜態檔案
- `nginx.conf` — gzip、快取策略（`/assets/` 長期快取、`index.html` 不快取）、SPA fallback
- `docker-compose.yml` — VPS 上實際執行用，只需要這個檔案 + Docker 即可跑起來
- `.github/workflows/deploy-vps.yml` — CI/CD：build → push GHCR → SSH 部署
- `.github/workflows/deploy.yml` — 既有的 GitHub Pages 部署，兩者並存、互不影響
