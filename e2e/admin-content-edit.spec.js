import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { register, login } from './helpers.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { buildResult } from '../src/survey/utils/scoring.js';

// Sprint 10 驗收條件 10.5：管理者在後台改一題文字 → 預覽 → 發佈 → 學員在作答頁看到新文字
// → 還原成內建原文後學員看到原文。結尾一定要還原，避免污染同一個後端上的其他測試。

const ai = getAssessment('ai-competency');
const q1 = ai.DIMENSIONS[0].questions[0].text;
const dim1 = ai.DIMENSIONS[0].name;

async function firstQuestionText(page) {
  await page.getByRole('button', { name: '開始作答' }).first().click();
  await page.waitForSelector('fieldset[data-question-id]', { timeout: 15000 });
  return page.locator('fieldset[data-question-id]').first().locator('legend').innerText();
}

test('管理者改題庫文字並發佈，學員看到新文字；還原後恢復', async ({ page, browser }) => {
  const stamp = Date.now();
  const newText = `E2E 改過的第一題 ${stamp}`;
  const newDimName = `E2E 新構面名 ${stamp}`;

  // 先有一位學員在「改文字之前」就送出過作答（舊紀錄、快照裡存的是舊構面名稱）。
  const old = await pwRequest.newContext({ baseURL: 'http://localhost:3001' });
  const oldEmail = `e2e-old-report-${stamp}@example.com`;
  expect((await old.post('/api/auth/register', { data: { name: 'E2E 舊報告學員', email: oldEmail, password: 'abcdef12' } })).ok()).toBeTruthy();
  const result = buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 4])), ai);
  expect((await old.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result, answers: {} } })).ok()).toBeTruthy();

  await page.goto('/');
  await login(page, 'admin@e2e.test', 'E2eTest1234');
  await page.getByRole('button', { name: '管理後台', exact: true }).click();
  await page.getByRole('button', { name: '題庫內容', exact: true }).click();
  await expect(page.getByText('不能在這裡修改')).toBeVisible({ timeout: 15000 });

  // 無障礙：編輯器本身。
  const scan = await new AxeBuilder({ page }).analyze();
  const critical = scan.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);

  // 改第一題 → 儲存草稿。
  await page.getByText('題目文字', { exact: true }).click();
  const box = page.getByLabel('第 1 題', { exact: true });
  await expect(box).toHaveValue(q1);
  await box.fill(newText);
  await page.getByLabel('構面名稱', { exact: true }).first().fill(newDimName);
  await page.getByRole('button', { name: '儲存草稿' }).click();
  await expect(page.getByRole('button', { name: '發佈…' })).toBeEnabled({ timeout: 10000 });

  // 預覽：只有管理者自己的畫面套用，頂端有橫幅；結束後恢復。
  await page.getByRole('button', { name: '預覽草稿' }).click();
  const banner = page.getByRole('status').filter({ hasText: '預覽草稿中' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: '結束預覽' }).click();
  await expect(banner).toHaveCount(0);

  // 發佈（要備註）。
  await page.getByRole('button', { name: '發佈…' }).click();
  await page.getByLabel(/發佈備註/).fill('E2E：改第一題');
  await page.getByRole('button', { name: '確認發佈' }).click();
  await expect(page.getByText(/版本 1（/)).toBeVisible({ timeout: 10000 });

  // 學員（全新 context）在作答頁看到新文字。
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await student.goto('/');
  await register(student, 'E2E 題庫學員', `e2e-content-${Date.now()}@example.com`, 'abcdef12');
  await expect(student.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  expect(await firstQuestionText(student)).toContain(newText);

  // 舊報告（改文字前就送出的作答）：構面名稱也跟著更新，分數不變。
  const oldCtx = await browser.newContext({ storageState: await old.storageState() });
  const oldPage = await oldCtx.newPage();
  await oldPage.goto('/analysis');
  await expect(oldPage.getByText('我的能力分析')).toBeVisible({ timeout: 20000 });
  await expect(oldPage.getByText(newDimName).first()).toBeVisible();
  await expect(oldPage.getByText(dim1, { exact: true })).toHaveCount(0);
  await oldCtx.close();

  // 還原成內建原文。
  await page.getByText('發佈歷史', { exact: true }).click();
  await page.getByRole('button', { name: '全部還原成內建原文' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '還原', exact: true }).click();
  await expect(page.getByText('內建原文（還沒有發佈過任何修改）')).toHaveCount(0); // 還原是新版本發佈，不是回到「沒發佈過」
  await expect(page.getByText(/版本 2（/)).toBeVisible({ timeout: 10000 });

  await student.goto('/');
  await expect(student.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  expect(await firstQuestionText(student)).toContain(q1);
  await studentContext.close();
  await old.dispose();
});
