import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 黃金路徑 4／4（Sprint 7 驗收條件 7.4）：教練打開一個「已經有作答資料」的班級
// 總覽，作答進度、KPI、成員比較表都在。
//
// 為什麼需要這一條：Sprint 5 拆分班級工作台時漏搬了「作答進度」面板，前三條
// 黃金路徑沒有任何一條走到有資料的班級總覽，所以沒抓到。資料用 API 直接種
// （比從 UI 作答 37 題快、也更穩），畫面驗證才用真的瀏覽器。

const API = 'http://localhost:3001';
const ai = getAssessment('ai-competency');
const resultOf = (v) => buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, v])), ai);

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test('教練打開有作答資料的班級：作答進度、KPI、成員比較表都在', async ({ browser }) => {
  const suffix = Date.now();
  const coachEmail = `e2e-ov-coach-${suffix}@example.com`;
  const groupName = `E2E 總覽班 ${suffix}`;

  // ── 種資料 ──
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { name: 'E2E 總覽教練', email: coachEmail, password: 'abcdef12' } }), 'coach register');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: 'abcdef12' } }), 'coach login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency' } }), 'create group');
  const { group: withCode } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'join code');

  // 三位學員掃碼加入：兩位交了課前，一位還沒交。
  for (const [i, value] of [[1, 2], [2, 4], [3, null]]) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', {
      data: { name: `總覽學員${i}`, email: `e2e-ov-s${i}-${suffix}@example.com`, password: 'abcdef12', joinCode: withCode.joinCode },
    }), `student ${i}`);
    if (value !== null) {
      await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(value), answers: {} } }), `submit ${i}`);
    }
    await s.dispose();
  }

  // ── 教練的瀏覽器（沿用 API 登入的 cookie，不必再走一次登入畫面）──
  const context = await browser.newContext({ storageState: await coach.storageState() });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  await page.getByText(groupName, { exact: true }).click();

  // 作答進度（Sprint 4／6）：Sprint 5 漏搬的就是這一塊。
  await expect(page.getByText('作答進度')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('課前未完成（1）')).toBeVisible();
  await expect(page.getByRole('button', { name: /複製提醒訊息/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /寄送提醒信/ })).toBeVisible();

  // KPI 與成員比較表。
  const kpi = page.locator('.panel-primary');
  await expect(kpi).toContainText('已填答');
  await expect(kpi).toContainText('2');
  await expect(page.getByRole('heading', { name: '成員比較' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '總覽學員2' })).toBeVisible();

  // E2E 環境沒有設定 SMTP：寄信按鈕要優雅降級成明確的錯誤訊息，而不是壞掉。
  await page.getByRole('button', { name: /寄送提醒信/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '寄出' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '尚未設定寄信服務' })).toBeVisible();

  const scan = await new AxeBuilder({ page }).analyze();
  const critical = scan.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);

  await context.close();
  await admin.dispose();
  await coach.dispose();
});
