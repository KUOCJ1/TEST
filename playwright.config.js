import { defineConfig } from '@playwright/test';

// E2E 黃金路徑測試（Sprint 5 驗收條件 5.2）。刻意沿用一般本機開發的埠號
// （後端 3001、前端 5173，跟 README/CLAUDE.md 的 `npm run dev` 慣例一致）——
// vite.config.js 的 `server.proxy['/api']` 是寫死指向 http://localhost:3001，
// 換成別的埠反而要多一層設定才能讓前端打得到後端。
//
// 本機執行時若剛好已經有 dev server 在跑，會直接沿用（reuseExistingServer），
// 但那樣測試會動到你本機開發用的真實資料庫——要跑乾淨的 E2E，先關掉手動啟動
// 的 dev server再執行 `npm run test:e2e`。CI 上一定是全新啟動、全新的暫存
// SQLite 檔案，不會有這個問題。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // 這幾支測試共用同一個後端 process（同一份資料庫、同一組 rate limiter），
  // 平行跑很容易互相干擾（例如同時大量註冊/登入會一起撞到 5 分鐘內 10 次的
  // 限流）；測試數量目前也不多，序列執行換取穩定性是划算的。
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 這個環境預先裝好的 Chromium 版本跟 @playwright/test 內建預期的 revision
    // 對不上（環境設定就是這樣），要明確指到實際安裝的執行檔，不能靠內建的
    // revision 自動比對，否則會回報「執行檔不存在」。
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node src/server.js',
      cwd: './server',
      port: 3001,
      env: {
        DB_PATH: process.env.E2E_DB_PATH || ':memory:',
        JWT_SECRET: 'e2e-test-secret-key-at-least-32-characters-long',
        // 所有測試共用一個後端與來源 IP，正式的註冊／登入額度（10 次／5 分鐘）不夠用。
        AUTH_RATE_LIMIT: '1000',
        // 排程會去打外部網路的第二大腦，E2E 不需要。
        HEALTH_CHECK_INTERVAL_MINUTES: '0',
        ADMIN_EMAIL: 'admin@e2e.test',
        ADMIN_PASSWORD: 'E2eTest1234',
        PORT: '3001',
        NODE_ENV: 'production',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --port 5173',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
