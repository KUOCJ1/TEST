import { test, expect, request as pwRequest } from '@playwright/test';

// 檢視日（Sprint 33 修正）：在台灣時區（UTC+8），「修改檢視日」顯示的日期必須和選的一致；
// 連續「打開 → 儲存」不能一次往前退一天。瀏覽器時區明確設成 Asia/Taipei。

const API = 'http://localhost:3001';
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };

test('台灣時區：修改檢視日顯示與選擇一致，重複儲存不會少一天', async ({ browser }) => {
  const sfx = Date.now();
  const s = await pwRequest.newContext({ baseURL: API });
  await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name: '日期測試', email: `e2e-date-${sfx}@example.com`, password: 'abcdef12' } }), 'register');
  // 與瀏覽器同一種寫法：當地（台北）2027-01-15 00:00
  const reviewDate = new Date('2027-01-15T00:00:00+08:00').toISOString();
  await ok(await s.post('/api/goals', { data: { text: '每週一次跨部門 check-in', assessmentId: 'leadership-9d', dimensionId: 'collaboration', dimensionName: '建立關係', reviewDate } }), 'goal');

  const ctx = await browser.newContext({ storageState: await s.storageState(), timezoneId: 'Asia/Taipei', locale: 'zh-TW', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/learning');
  await expect(page.getByText(/預計 2027\/01\/15/)).toBeVisible({ timeout: 20000 });

  const open = async () => { await page.getByRole('button', { name: '修改檢視日' }).click(); return page.getByLabel('預計檢視日'); };

  let input = await open();
  await expect(input).toHaveValue('2027-01-15');
  // 不改直接儲存兩次：日期不能往前退
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: '儲存日期' }).click();
    await expect(page.getByText(/預計 2027\/01\/15/)).toBeVisible();
    input = await open();
    await expect(input).toHaveValue('2027-01-15');
  }
  // 改成 2027-02-03：顯示、再打開都是 2/3
  await input.fill('2027-02-03');
  await page.getByRole('button', { name: '儲存日期' }).click();
  await expect(page.getByText(/預計 2027\/02\/03/)).toBeVisible();
  input = await open();
  await expect(input).toHaveValue('2027-02-03');
  await ctx.close();
  await s.dispose();
});

test('台灣時區：加入行事曆的檔案日期與畫面上的檢視日一致', async ({ browser }) => {
  const sfx = Date.now();
  const s = await pwRequest.newContext({ baseURL: API });
  await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name: '行事曆測試', email: `e2e-ics-${sfx}@example.com`, password: 'abcdef12' } }), 'register');
  await ok(await s.post('/api/goals', { data: { text: '練習傾聽', assessmentId: 'leadership-9d', dimensionId: 'communication', dimensionName: '溝通力', reviewDate: new Date('2027-03-10T00:00:00+08:00').toISOString() } }), 'goal');
  const ctx = await browser.newContext({ storageState: await s.storageState(), timezoneId: 'Asia/Taipei', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto('/learning');
  await expect(page.getByText(/預計 2027\/03\/10/)).toBeVisible({ timeout: 20000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '加入行事曆' }).click()]);
  expect(dl.suggestedFilename()).toBe('goal-review-2027-03-10.ics');
  const text = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8');
  expect(text).toContain('DTSTART;VALUE=DATE:20270310');
  expect(text).toContain('DTEND;VALUE=DATE:20270311');
  await ctx.close();
  await s.dispose();
});
