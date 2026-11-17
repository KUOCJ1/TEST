import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { acceptConsentIfAsked } from './helpers.js';

// Sprint 37–39：報告一分鐘版、四週微練習、下載我的資料、刪除帳號（7 天內可取消）。手機尺寸。

const API = 'http://localhost:3001';
const l9d = getAssessment('leadership-9d');
const resultOf = () => buildResult(Object.fromEntries(l9d.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, d.id === 'execution' ? 2 : 4]))), l9d);
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };

async function learner(tag) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const s = await pwRequest.newContext({ baseURL: API });
  await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name: `學員${tag}`, email, password: 'abcdef12' } }), 'register');
  await ok(await s.post('/api/submissions', { data: { assessmentId: 'leadership-9d', phase: 'pre', result: resultOf(), answers: {} } }), 'submit');
  return { s, email };
}

test('手機：分析頁有「一分鐘看懂」；開始四週微練習 → 首頁出現本週提示 → 我的學習勾選', async ({ browser }) => {
  const { s } = await learner('practice');
  const ctx = await browser.newContext({ storageState: await s.storageState(), viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/analysis');
  await acceptConsentIfAsked(page);
  const one = page.getByRole('region', { name: '一分鐘看懂' });
  await expect(one).toBeVisible({ timeout: 20000 });
  await expect(one).toContainText('最值得先練');
  await expect(one).toContainText('執行力');
  const practice = page.getByRole('region', { name: '四週微練習' });
  await practice.getByRole('button', { name: '開始四週微練習' }).click();
  await expect(practice).toContainText('第 1／4 週');

  await page.goto('/home');
  await page.getByRole('button', { name: /本週微練習（1／4）/ }).click();
  await expect(page).toHaveURL(/\/learning$/);
  const panel = page.getByRole('region', { name: '四週微練習' });
  await panel.getByRole('button', { name: '第 1 週標記為完成' }).click();
  await expect(panel.getByRole('button', { name: '第 1 週已完成，按一下取消' })).toBeVisible();
  await expect(panel.getByText('第 2 週開始時出現')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});

test('下載我的資料；刪除帳號 → 等待畫面（重新整理也在）→ 取消後恢復', async ({ browser }) => {
  const { s, email } = await learner('delete');
  const ctx = await browser.newContext({ storageState: await s.storageState(), acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/profile');
  await acceptConsentIfAsked(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /下載我的資料/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^my-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
  expect(data.account.email).toBe(email);
  expect(data.selfAssessments).toHaveLength(1);

  await page.getByRole('button', { name: /刪除我的帳號/ }).click();
  await page.getByLabel('輸入密碼確認').fill('abcdef12');
  await page.getByRole('checkbox', { name: /我了解 7 天後/ }).check();
  await page.getByRole('button', { name: '確定刪除' }).click();
  await expect(page.getByRole('heading', { name: '帳號已排定刪除' })).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '帳號已排定刪除' })).toBeVisible({ timeout: 15000 });
  // 等待期間其他功能被擋
  expect((await s.get('/api/goals')).status()).toBe(423);
  await page.getByRole('button', { name: '取消刪除，繼續使用' }).click();
  await expect(page.getByRole('heading', { name: '帳號已排定刪除' })).toHaveCount(0);
  expect((await s.get('/api/goals')).status()).toBe(200);
  await page.goto('/analysis');
  await expect(page.getByRole('region', { name: '一分鐘看懂' })).toBeVisible({ timeout: 20000 });
  await ctx.close();
});
