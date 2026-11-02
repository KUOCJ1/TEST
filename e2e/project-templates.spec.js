import { test, expect, request as pwRequest } from '@playwright/test';
import { acceptConsentIfAsked } from './helpers.js';

// 專案範本：管理員建立 → 教練開班選範本 → 評量鎖定；伺服器也拒絕另選評量與事後改評量。

const API = 'http://localhost:3001';

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test('教練開班選專案範本：評量鎖定、不能另選或事後更改', async ({ browser }) => {
  test.setTimeout(90000);
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  const coachEmail = `tpl-coach-${sfx}@example.com`;
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '範本教練', email: coachEmail, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: 'abcdef12' } }), 'coach login');

  const { template } = await ok(await admin.post('/api/admin/project-templates', {
    data: { name: `森永範本 ${sfx}`, clientName: '森永', assessmentId: 'leadership-360-70', exclusive: false, extraAssessmentIds: [] },
  }), 'template');

  const context = await browser.newContext({ storageState: await coach.storageState() });
  const page = await context.newPage();
  await page.goto('/');
  await acceptConsentIfAsked(page);
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  await page.getByRole('button', { name: /建立班別/ }).click();
  await page.getByLabel('專案範本').selectOption(template.id);
  await expect(page.getByLabel('評量題庫')).toBeDisabled();
  await expect(page.getByLabel('評量題庫')).toHaveValue('leadership-360-70');
  await expect(page.getByPlaceholder('公司名稱（選填）')).toHaveValue('森永');
  await page.getByPlaceholder('班別名稱（必填）').fill(`範本班 ${sfx}`);
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.getByRole('heading', { name: `範本班 ${sfx}` })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('專案範本・評量已鎖定')).toBeVisible();

  // 伺服器端也鎖：直接打 API 另選評量、事後改評量都被拒絕。
  const groups = (await (await coach.get('/api/coach/groups')).json()).groups;
  const g = groups.find((x) => x.name === `範本班 ${sfx}`);
  expect(g.assessmentId).toBe('leadership-360-70');
  expect((await coach.post('/api/coach/groups', { data: { name: 'x', templateId: template.id, assessmentId: 'leadership-9d' } })).status()).toBe(400);
  expect((await coach.put(`/api/coach/groups/${g.id}`, { data: { assessmentId: 'leadership-9d' } })).status()).toBe(400);

  await context.close();
  await admin.dispose();
  await coach.dispose();
});
