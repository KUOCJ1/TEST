import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { register, login } from './helpers.js';

// 黃金路徑 2／3（Sprint 5 驗收條件 5.2）：教練建班 → 產生 QR 報到連結 →
// 學員透過報到連結加入班級。admin 帳號密碼對應 playwright.config.js
// webServer 起後端時餵的 ADMIN_EMAIL / ADMIN_PASSWORD。

test('教練建立班級、產生報到連結，學員可透過連結直接加入', async ({ page, browser }) => {
  const suffix = Date.now();
  const coachEmail = `e2e-coach-${suffix}@example.com`;
  const groupName = `E2E 測試班 ${suffix}`;

  // 1) 註冊一個未來要當教練的帳號。
  await page.goto('/');
  await register(page, 'E2E 教練', coachEmail, 'abcdef12');
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '登出' }).click();

  // 2) 管理員登入，把剛剛那個帳號升級成教練。
  // 上面才剛登出過，同一頁的 App.jsx view 狀態已經停在登入表單，不會再看到
  // 「登入平台」這顆進入鈕（見 helpers.js 開頭的說明）。
  await login(page, 'admin@e2e.test', 'E2eTest1234', { fromLanding: false });
  await expect(page.getByText('管理後台')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '管理後台' }).click();
  await page.getByRole('button', { name: '用戶管理', exact: true }).click();
  const coachRow = page.locator('tr', { hasText: coachEmail });
  await expect(coachRow).toBeVisible({ timeout: 10000 });
  await coachRow.getByRole('button', { name: '設為教練' }).click();
  await expect(coachRow.getByText('教練', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '登出' }).click();

  // 3) 教練登入、建班、產生報到 QR / 連結。
  await login(page, coachEmail, 'abcdef12', { fromLanding: false });
  await expect(page.getByText('教練後台')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  await page.getByRole('button', { name: '建立班別' }).click();
  await page.getByPlaceholder('班別名稱（必填）').fill(groupName);
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });

  // 無障礙檢查：教練工作台（班級總覽，Sprint 4 新增的作答進度／學習成效面板都在這頁）。
  const coachScan = await new AxeBuilder({ page }).analyze();
  const coachCritical = coachScan.violations.filter((v) => v.impact === 'critical');
  expect(coachCritical, JSON.stringify(coachCritical, null, 2)).toHaveLength(0);

  await page.getByRole('button', { name: '成員與設定' }).click();
  await page.getByRole('button', { name: '產生報到 QR Code' }).click();
  const joinLinkParagraph = page.locator('p.break-all');
  await expect(joinLinkParagraph).toBeVisible({ timeout: 10000 });
  const joinLink = await joinLinkParagraph.textContent();
  const joinCode = joinLink ? new URL(joinLink.trim()).searchParams.get('join') : null;
  expect(joinCode, '報到連結需帶有 join 參數').toBeTruthy();
  await page.getByRole('button', { name: '登出' }).click();

  // 4) 全新學員從報到連結進站，註冊後應直接被帶進這個班。用全新的瀏覽器
  // context（不是 context.newPage()）——同一個 context 開新分頁會共用 cookie，
  // 若教練剛好還沒登出，這個分頁會直接繼承教練的 session。
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`/?join=${joinCode}`);
  // 帶 join code 進站，App.jsx 會直接顯示登入表單（不經過行銷首頁），同樣不會
  // 出現「登入平台」按鈕。
  await register(studentPage, 'E2E 學員（掃碼加入）', `e2e-joined-${suffix}@example.com`, 'abcdef12', { fromLanding: false });
  // 帶 join code 註冊成功後，後端回應含 joinedGroup，前端會直接把使用者導去
  // 對應評量的作答頁（見 App.jsx 的 joinCode 導頁邏輯），不會停在「選擇評量」。
  await expect(studentPage.getByRole('button', { name: /送出評測/ })).toBeVisible({ timeout: 15000 });
});
