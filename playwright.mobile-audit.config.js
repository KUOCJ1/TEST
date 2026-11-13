import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// 手機介面走查專用設定（docs/MOBILE_APP_PLAN.md）。沿用 E2E 的伺服器設定，但獨立成一份：
// 不混進 `npm run test:e2e`，也不擋部署。執行：`npm run audit:mobile`。
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: /mobile-audit\.spec\.js$/,
  timeout: 420000,
  retries: 0,
  use: { ...base.use, screenshot: 'off', trace: 'off' },
});
