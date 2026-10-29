import { test, expect, request as pwRequest } from '@playwright/test';
import { login } from './helpers.js';

// 課後學習成效問卷：教練把問卷附加到班級 → 學員在「我的評量」看到並填寫 → 教練只看到完成率與彙總
// （少於 3 人不顯示彙總）。設計稿：docs/post-course-survey-design.md。

const API = 'http://localhost:3001';
const PW = 'abcdef12';
const day = 864e5;
const SJT_KEY = { c1: 'b', c2: 'c', c3: 'a', c4: 'b', c5: 'c', c6: 'a' };

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

function answers(extra = {}) {
  const a = {};
  for (let i = 1; i <= 8; i++) a[`a${i}`] = 4;
  a.a9 = 9;
  for (let i = 1; i <= 6; i++) a[`a10_${i}`] = 4;
  for (let i = 1; i <= 12; i++) { a[`b${i}_before`] = 2; a[`b${i}_now`] = 4; }
  Object.assign(a, SJT_KEY);
  for (let i = 1; i <= 4; i++) a[`d${i}`] = 4;
  a.d7 = 'yes';
  return { ...a, ...extra };
}

test('課後問卷：附加到班級、學員填寫、教練看完成率與彙總；未附加的人與外人看不到', async ({ browser }) => {
  test.setTimeout(180000); // 畫面填 50 個欄位，比一般測試久。
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coachEmail = `post-coach-${sfx}@example.com`;
  const coach = await pwRequest.newContext({ baseURL: API });
  const creg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '課後教練', email: coachEmail, password: PW } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${creg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: PW } }), 'coach login');
  const g = await ok(await coach.post('/api/coach/groups', { data: { name: `課後班 ${sfx}`, assessmentId: 'ai-competency' } }), 'group');
  const gid = g.group.id;

  const learners = [];
  for (let i = 1; i <= 3; i++) {
    const ctx = await pwRequest.newContext({ baseURL: API });
    const email = `post-learner-${i}-${sfx}@example.com`;
    const reg = await ok(await ctx.post('/api/auth/register', { data: { acceptPolicy: true, name: `課後學員${i}`, email, password: PW } }), `learner ${i}`);
    learners.push({ ctx, email, id: reg.user.id });
  }
  const outsider = await pwRequest.newContext({ baseURL: API });
  await ok(await outsider.post('/api/auth/register', { data: { acceptPolicy: true, name: '外人', email: `post-out-${sfx}@example.com`, password: PW } }), 'outsider');

  await ok(await admin.put(`/api/coach/groups/${gid}`, {
    data: { memberIds: learners.map((l) => l.id), startDate: new Date(Date.now() - day).toISOString(), endDate: new Date(Date.now() + day).toISOString() },
  }), 'members');

  // 還沒附加：學員清單裡沒有、也不能交。
  const listed = async (ctx) => (await (await ctx.get('/api/assessments')).json()).assessments.map((a) => a.id);
  expect(await listed(learners[0].ctx)).not.toContain('ai-course-post');
  expect((await learners[0].ctx.post('/api/submissions', { data: { assessmentId: 'ai-course-post', answers: answers() } })).status()).toBe(403);

  // 教練附加。
  await ok(await coach.put(`/api/coach/groups/${gid}`, { data: { extraAssessmentIds: ['ai-course-post'] } }), 'attach');
  expect(await listed(learners[0].ctx)).toContain('ai-course-post');
  expect(await listed(outsider)).not.toContain('ai-course-post');
  // 專屬班級（客戶專案）：只看到主要評量與附加的問卷。
  await ok(await coach.put(`/api/coach/groups/${gid}`, { data: { exclusive: true } }), 'exclusive');
  expect((await listed(learners[0].ctx)).sort()).toEqual(['ai-competency', 'ai-course-post']);
  // 課後問卷不能被設成班級的主要評量（會繞過彙總規則）。
  expect((await coach.put(`/api/coach/groups/${gid}`, { data: { assessmentId: 'ai-course-post' } })).status()).toBe(400);
  expect((await outsider.post('/api/submissions', { data: { assessmentId: 'ai-course-post', answers: answers() } })).status()).toBe(403);

  // 學員 1 用畫面填寫。
  const lctx = await browser.newContext();
  const page = await lctx.newPage();
  await page.goto('/');
  await login(page, learners[0].email, PW);
  await page.goto('/survey/ai-course-post');
  await expect(page.getByRole('heading', { name: 'A 課程體驗' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '送出問卷' }).click();
  await expect(page.getByRole('alert')).toContainText('還有 50 題沒有作答');
  for (const [k, v] of Object.entries(answers())) {
    // 點選項的標籤（真人也是點標籤；選項的 input 本身是視覺隱藏的）。
    await page.locator('label').filter({ has: page.locator(`input[name="${k}"][value="${v}"]`) }).click();
  }
  await page.getByLabel('這堂工作坊對我最有價值的一個收穫是什麼？').fill('OAR 拆解很有用');
  await page.getByRole('button', { name: '送出問卷' }).click();
  await expect(page.getByText('感謝您的填答')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('情境檢核 6 / 6')).toBeVisible();

  // 學員 2、3 用 API 交；學員 1 不能重複交。
  expect((await learners[1].ctx.post('/api/submissions', { data: { assessmentId: 'ai-course-post', answers: answers() } })).status()).toBe(201);
  expect((await learners[0].ctx.post('/api/submissions', { data: { assessmentId: 'ai-course-post', answers: answers() } })).status()).toBe(409);

  // 兩人完成：彙總不顯示。
  let summary = await ok(await coach.get(`/api/coach/groups/${gid}/course-survey`), 'summary 2');
  expect(summary.completed).toBe(2);
  expect(summary.hidden).toBe(true);
  expect(summary.openText).toBeUndefined();

  expect((await learners[2].ctx.post('/api/submissions', { data: { assessmentId: 'ai-course-post', answers: answers({ e1: '收穫三' }) } })).status()).toBe(201);
  summary = await ok(await coach.get(`/api/coach/groups/${gid}/course-survey`), 'summary 3');
  expect(summary.completionRate).toBe(100);
  expect(summary.hidden).toBe(false);
  expect(summary.openText.e1).toEqual(['OAR 拆解很有用', '收穫三'].sort((x, y) => x.localeCompare(y, 'zh-Hant')));

  // 班級原本的課前／課後統計不受影響。
  const detail = await ok(await coach.get(`/api/coach/groups/${gid}`), 'detail');
  expect(detail.submissions).toHaveLength(0);

  // 教練在畫面上看到完成率。
  const cctx = await browser.newContext();
  const cpage = await cctx.newPage();
  await cpage.goto('/');
  await login(cpage, coachEmail, PW);
  await cpage.goto('/coach');
  // 只有一個班時會自動選取；班級原本的課前／課後進度不受影響。
  await expect(cpage.getByText(`課後班 ${sfx}`).first()).toBeVisible({ timeout: 20000 });
  await expect(cpage.getByText('3 / 3 人（100%）')).toBeVisible({ timeout: 20000 });
  await expect(cpage.getByText(/最有價值的收穫（2 則，不附姓名）/)).toBeVisible();
  await expect(cpage.getByText('課前未完成（3）')).toBeVisible();

  await lctx.close();
  await cctx.close();
  for (const c of [admin, coach, outsider, ...learners.map((l) => l.ctx)]) await c.dispose();
});
