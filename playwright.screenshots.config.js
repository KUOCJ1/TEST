import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// 使用手冊截圖專用設定（Sprint 9.5）。沿用 E2E 的伺服器設定（記憶體資料庫、
// 後端 3001／前端 5173），但獨立成一份：不混進 `npm run test:e2e`，截圖慢、也不該
// 擋住部署。執行：`npm run manual:screenshots`。
// 跟 E2E 一樣，本機若已有 dev server 在跑會被沿用（動到你的真實資料），先關掉。
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: /manual-screenshots\.spec\.js$/,
  timeout: 180000,
  retries: 0,
  use: { ...base.use, screenshot: 'off', trace: 'off' },
  // 前端注入跟模擬的後端版本相同的版本號，「系統狀態」那張圖才會呈現前後端一致的正常畫面。
  webServer: base.webServer.map((s) => (s.port === 5173
    ? { ...s, env: { VITE_BUILD_COMMIT: '6f3131a', VITE_BUILT_AT: '2026-09-26T13:43:00Z' } }
    : s)),
});
