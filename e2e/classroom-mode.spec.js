import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 課堂模式（Sprint 34）：教練在班級總覽按「課堂模式」→ 全螢幕彙總畫面，沒有姓名；人數不足不顯示數字。

const API = 'http://localhost:3001';
const ai = getAssessment('ai-competency');
const resultOf = (v) => buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, v])), ai);
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };

async function setup(n, tag) {
  const sfx = `${Date.now()}${tag}`;
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '課堂教練', email: `e2e-room-${sfx}@example.com`, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `e2e-room-${sfx}@example.com`, password: 'abcdef12' } }), 'login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: `課堂班 ${sfx}`, assessmentId: 'ai-competency' } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'code');
  const names = [];
  for (let i = 1; i <= n; i += 1) {
    const s = await pwRequest.newContext({ baseURL: API });
    const name = `課堂學員${tag}${i}`;
    names.push(name);
    await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name, email: `e2e-room-s${i}-${sfx}@example.com`, password: 'abcdef12', joinCode: g.joinCode } }), `s${i}`);
    await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(2 + (i % 3)), answers: {} } }), `sub${i}`);
    await s.dispose();
  }
  return { coach, groupName: `課堂班 ${sfx}`, names };
}

for (const [label, viewport] of [['桌機', { width: 1280, height: 800 }], ['手機', { width: 390, height: 844 }]]) {
  test(`${label}：課堂模式只有彙總，沒有學員姓名；無障礙無嚴重問題；Esc 離開`, async ({ browser }) => {
    const { coach, groupName, names } = await setup(4, label === '桌機' ? 'd' : 'm');
    const ctx = await browser.newContext({ storageState: await coach.storageState(), viewport });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: '教練後台', exact: true }).click();
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: '課堂模式' }).click();
    const room = page.getByRole('dialog', { name: '課堂模式' });
    await expect(room).toBeVisible();
    await expect(room).toContainText('4 位同學完成');
    await expect(room.getByLabel('討論題')).toBeVisible();
    for (const n of names) await expect(room).not.toContainText(n);
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)), JSON.stringify(axe.violations.map((v) => v.id))).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expect(room).toHaveCount(0);
    await ctx.close();
  });
}

test('完成人數不足 3 人：課堂模式只顯示說明', async ({ browser }) => {
  const { coach, groupName } = await setup(2, 'few');
  const ctx = await browser.newContext({ storageState: await coach.storageState(), viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '課堂模式' }).click();
  const room = page.getByRole('dialog', { name: '課堂模式' });
  await expect(room.getByRole('status')).toContainText('至少要有 3 位同學完成');
  await expect(room.getByLabel('班級整體能力雷達')).toHaveCount(0);
  await ctx.close();
});
