import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { register } from './helpers.js';

// 黃金路徑 1／3（Sprint 5 驗收條件 5.2）：註冊 → 作答 → 看報告。
// 每個測試各自用帶時間戳記的 email 注意獨立，跑在同一個共用（in-memory）
// 資料庫上不會互相污染。

test('學員可以註冊、完成一次評測、並看到報告', async ({ page }) => {
  const email = `e2e-learner-${Date.now()}@example.com`;

  await page.goto('/');
  await register(page, 'E2E 學員', email, 'abcdef12');

  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 15000 });

  // 無障礙檢查：首頁（登入後、含「下一步」卡片）不該有 critical 等級的問題。
  const homeScan = await new AxeBuilder({ page }).analyze();
  const homeCritical = homeScan.violations.filter((v) => v.impact === 'critical');
  expect(homeCritical, JSON.stringify(homeCritical, null, 2)).toHaveLength(0);

  await page.getByRole('button', { name: '開始作答' }).first().click();
  await page.waitForSelector('fieldset[data-question-id]', { timeout: 10000 });

  const fieldsets = page.locator('fieldset[data-question-id]');
  const count = await fieldsets.count();
  for (let i = 0; i < count; i++) {
    await fieldsets.nth(i).locator('label').nth(2).click();
  }
  await page.getByRole('button', { name: /送出評測/ }).click();

  await expect(page.getByText('您的總得分')).toBeVisible({ timeout: 10000 });

  // 無障礙檢查：報告頁（含雷達圖、延伸閱讀等最複雜的畫面之一）。
  const reportScan = await new AxeBuilder({ page }).analyze();
  const reportCritical = reportScan.violations.filter((v) => v.impact === 'critical');
  expect(reportCritical, JSON.stringify(reportCritical, null, 2)).toHaveLength(0);

  await page.getByRole('button', { name: /查看完整分析/ }).click();
  await expect(page.getByText('我的能力分析')).toBeVisible({ timeout: 10000 });
});
