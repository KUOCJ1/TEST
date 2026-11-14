# 正式站自動部署（GitHub Actions）

`.github/workflows/deploy-vps.yml`：在 GitHub 的 Actions 頁按「Run workflow」，由 GitHub 用 SSH 連到 VPS 執行 `deploy/deploy.sh`。
**不會在 push 時自動部署**，一定要有人手動觸發，且（建議）還要另一個人核准。

## 安全設計

- 只部署「CI 的 verify 已全部通過」的 commit，並用 `git reset --hard <sha>` 精確部署那一版。
- 主機金鑰釘在 `VPS_KNOWN_HOSTS`，不使用 `StrictHostKeyChecking=no`。
- 金鑰只存在 GitHub Secrets，任務結束後從 runner 刪除；**不要貼到對話、程式碼或文件**。
- 使用 GitHub Environment `production`，可設定 Required reviewers（核准後才連 VPS）。
- `deploy.sh` 本身會先備份資料庫、保留 `.env` 與資料檔，結尾跑 `verify.sh`；任何一步失敗整個流程就失敗。

## 一次性設定（你自己做，約 15 分鐘）

1. **在 VPS 建部署專用帳號**（不要用 root、也不要用你平常的帳號）：
   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   sudo -u deploy mkdir -p /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh
   ```
   讓它能操作 `/opt/ai-assessment/app`（例如 `sudo chown -R deploy: /opt/ai-assessment/app`），並用 `sudo visudo -f /etc/sudoers.d/deploy` 只開 `deploy.sh` 用到的指令 NOPASSWD（`systemctl restart ai-assessment-api`、`systemctl reload nginx`、`rsync`、`mkdir`、`tee`、`npm`、`bash deploy/backup.sh` 等，依 `deploy/deploy.sh` 實際內容逐項列出）。
2. **產生專用金鑰**（在你自己的電腦）：`ssh-keygen -t ed25519 -f deploy_key -C "github-actions-deploy"`。
   把 `deploy_key.pub` 的內容放到 VPS 的 `/home/deploy/.ssh/authorized_keys`（權限 600）。
3. **取得主機金鑰**：`ssh-keyscan -t ed25519 你的VPS位址`，輸出整行。
4. **GitHub → Settings → Secrets and variables → Actions** 新增：
   - `VPS_HOST`：VPS 位址
   - `VPS_USER`：`deploy`
   - `VPS_SSH_KEY`：`deploy_key`（私鑰全文）
   - `VPS_KNOWN_HOSTS`：第 3 步的輸出
5. **GitHub → Settings → Environments → New environment** 命名 `production`，勾選 Required reviewers。
6. 設定完成後刪除你電腦上的 `deploy_key` 私鑰檔（或妥善保管）。

## 使用

Actions → 「Deploy to VPS (production)」→ Run workflow → 確認分支 → （核准）→ 看結果。
失敗時 log 會顯示是哪一步；VPS 上的資料庫備份在 `deploy/backup.sh` 設定的位置，回退指令見 `DEPLOYMENT.md`。

## 已知取捨

- 部署期間 API 會短暫中斷（重啟服務），與手動部署相同。
- 第一次建議先在「部署一個沒有改動的 commit」上試跑，確認權限都對。
- 若 VPS 的 `deploy.sh` 需要互動輸入，這條流程會失敗；目前腳本是非互動的。
