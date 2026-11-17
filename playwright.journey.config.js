import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// 學員成長旅程走查（不擋部署）：npm run audit:journey，截圖輸出到 journey-out/。
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: /learner-journey\.spec\.js$/,
  timeout: 420000,
  retries: 0,
  use: { ...base.use, screenshot: 'off', trace: 'off' },
});
