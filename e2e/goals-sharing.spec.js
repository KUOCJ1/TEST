import { test, expect, request as pwRequest } from '@playwright/test';
import { login } from './helpers.js';

// 發展閉環（Sprint 20）：目標預設私密；學員在「我的學習」記錄進度、選擇分享給教練；
// 教練只看得到「分享的目標」，看不到追蹤筆記；取消分享立即生效。

const API = 'http://localhost:3001';
const PW = 'abcdef12';
const day = 864e5;

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

test('發展目標預設私密；分享給教練後教練看得到（不含筆記），取消後消失', async ({ browser }) => {
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const creg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '發展教練', email: `goal-coach-${sfx}@example.com`, password: PW } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${creg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `goal-coach-${sfx}@example.com`, password: PW } }), 'coach login');
  const g = await ok(await coach.post('/api/coach/groups', { data: { name: `發展班 ${sfx}`, assessmentId: 'ai-competency' } }), 'group');
  const gid = g.group.id;

  const email = `goal-learner-${sfx}@example.com`;
  const learner = await pwRequest.newContext({ baseURL: API });
  const lreg = await ok(await learner.post('/api/auth/register', { data: { acceptPolicy: true, name: '發展學員', email, password: PW } }), 'learner');
  await ok(await admin.put(`/api/coach/groups/${gid}`, { data: { memberIds: [lreg.user.id], startDate: new Date(Date.now() - day).toISOString(), endDate: new Date(Date.now() + day).toISOString() } }), 'members');
  await ok(await learner.post('/api/goals', { data: { assessmentId: 'ai-competency', dimensionId: 'communication', dimensionName: '提示詞溝通', text: '每週用 AI 完成一份分析', actions: [{ text: '先寫好角色與任務再提問' }] } }), 'goal');

  // 預設私密：教練看不到。
  let view = await ok(await coach.get(`/api/coach/groups/${gid}`), 'coach view');
  expect(view.sharedGoals).toHaveLength(0);

  // 學員在「我的學習」記錄進度並選擇分享。
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await login(page, email, PW);
  await page.goto('/learning');
  await expect(page.getByText('每週用 AI 完成一份分析')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /記錄這段時間的進度/ }).click();
  await page.getByLabel(/這段時間發生了什麼/).fill('這是只給我自己看的筆記');
  await page.getByRole('radio', { name: /4 大多有做/ }).click();
  await page.getByRole('button', { name: '儲存紀錄' }).click();
  await expect(page.getByRole('list', { name: '追蹤紀錄' })).toContainText('這是只給我自己看的筆記');

  const share = page.getByRole('checkbox', { name: /分享給我的教練/ });
  await expect(share).not.toBeChecked();
  await share.check();
  await expect(page.getByText(/教練現在看得到這個目標/)).toBeVisible();

  // 開關是樂觀更新（畫面先翻轉），伺服器稍後才寫入：用輪詢等教練端看到。
  await expect.poll(async () => (await (await coach.get(`/api/coach/groups/${gid}`)).json()).sharedGoals.length, { timeout: 10000 }).toBe(1);
  view = await ok(await coach.get(`/api/coach/groups/${gid}`), 'coach view 2');
  expect(view.sharedGoals).toHaveLength(1);
  expect(view.sharedGoals[0].text).toBe('每週用 AI 完成一份分析');
  expect(view.sharedGoals[0].checkinCount).toBe(1);
  expect(view.sharedGoals[0].lastCheckin.rating).toBe(4);
  expect(JSON.stringify(view.sharedGoals)).not.toContain('只給我自己看的筆記');

  // 取消分享立即生效。
  await share.uncheck();
  await expect(page.getByText(/目前只有你看得到/)).toBeVisible();
  await expect.poll(async () => (await (await coach.get(`/api/coach/groups/${gid}`)).json()).sharedGoals.length, { timeout: 10000 }).toBe(0);

  await ctx.close();
  for (const c of [admin, coach, learner]) await c.dispose();
});
