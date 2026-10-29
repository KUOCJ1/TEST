import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 教練總覽的「前測分布與前後測比較」：用 API 種好前測、後測資料，確認畫面有出現並可以匯出。

const API = 'http://localhost:3001';
const ai = getAssessment('ai-competency');
const resultOf = (v) => buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, v])), ai);

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test('教練總覽：前測分布與前後測比較', async ({ browser }) => {
  test.setTimeout(120000);
  const sfx = Date.now();
  const coachEmail = `pp-coach-${sfx}@example.com`;
  const groupName = `前後測班 ${sfx}`;
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '前後測教練', email: coachEmail, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: 'abcdef12' } }), 'login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency' } }), 'group');
  const { group: withCode } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'code');

  // 六位學員：前測 2–4，其中五位有後測。
  const plan = [[2, 4], [2, 3], [3, 5], [3, 3], [4, 4], [4, null]];
  for (const [i, [pre, post]] of plan.entries()) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', {
      data: { acceptPolicy: true, name: `比較學員${i + 1}`, email: `pp-s${i}-${sfx}@example.com`, password: 'abcdef12', joinCode: withCode.joinCode },
    }), `student ${i}`);
    await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(pre), answers: {} } }), `pre ${i}`);
    if (post !== null) await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'post', result: resultOf(post), answers: {} } }), `post ${i}`);
    await s.dispose();
  }

  const context = await browser.newContext({ storageState: await coach.storageState(), viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('前測分布與前後測比較')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('前測分布（6 人）')).toBeVisible();
  await expect(page.getByText('前後測比較（配對 5 人）')).toBeVisible();
  await expect(page.getByRole('table', { name: '落點等級變化矩陣' })).toBeVisible();
  await expect(page.getByRole('region', { name: '每位成員前後測變化' })).toContainText('比較學員3');
  await expect(page.getByText(/只做了前測 1 人/)).toBeVisible();
  if (process.env.PP_SHOT) await page.getByText('前測分布與前後測比較').locator('xpath=ancestor::div[contains(@class,"panel")]').first().screenshot({ path: process.env.PP_SHOT });
  await context.close();
  await coach.dispose();
  await admin.dispose();
});
