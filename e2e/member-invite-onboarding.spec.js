import { test, expect, request as pwRequest } from '@playwright/test';
import { login } from './helpers.js';

// 邀請制入班（Sprint 19）：後台先編班 → 學員用專屬連結註冊並自動入班；失效、沒邀請碼自行註冊、登入後輸入邀請碼。

const API = 'http://localhost:3001';
const PW = 'abcdef12';
const day = 864e5;

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function setupClass(sfx) {
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '邀請教練', email: `inv-coach-${sfx}@example.com`, password: PW } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `inv-coach-${sfx}@example.com`, password: PW } }), 'coach login');
  const g = await ok(await coach.post('/api/coach/groups', { data: { name: `邀請班 ${sfx}`, assessmentId: 'ai-competency' } }), 'group');
  await ok(await coach.put(`/api/coach/groups/${g.group.id}`, {
    data: { startDate: new Date(Date.now() - day).toISOString(), endDate: new Date(Date.now() + day).toISOString() },
  }), 'window');
  await admin.dispose();
  return { coach, gid: g.group.id, groupName: `邀請班 ${sfx}` };
}

test('用邀請連結註冊：Email 鎖定、姓名預填、完成後自動入班；連結只能用一次', async ({ browser }) => {
  const sfx = Date.now();
  const { coach, gid, groupName } = await setupClass(sfx);
  const email = `inv-learner-${sfx}@example.com`;
  const roster = await ok(await coach.post(`/api/coach/groups/${gid}/roster`, { data: { entries: [{ name: '小明', email }] } }), 'roster');
  const [invite] = roster.memberInvites;
  expect(invite.link).toContain('?invite=');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/?invite=${invite.code}`);
  await expect(page.getByText('邀請你加入班級')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(groupName)).toBeVisible();
  const emailInput = page.getByPlaceholder('you@example.com');
  await expect(emailInput).toHaveValue(email);
  await expect(emailInput).toHaveAttribute('readonly', '');
  await expect(page.getByPlaceholder('您的姓名')).toHaveValue('小明');

  await page.getByPlaceholder('至少 8 碼').fill(PW);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '完成註冊並加入班級' }).click();
  // 自動入班並導向該班的評量作答頁。
  await expect(page).toHaveURL(/\/survey\/ai-competency/, { timeout: 20000 });

  // 教練端：邀請狀態變成已加入，學員在班上。
  const detail = await ok(await coach.get(`/api/coach/groups/${gid}`), 'detail');
  expect(detail.members.map((m) => m.email)).toContain(email);
  expect(detail.memberInvites.find((i) => i.email === email).state).toBe('joined');

  // 同一個連結再用：顯示已使用。
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`/?invite=${invite.code}`);
  await expect(page2.getByText('這個邀請無法使用')).toBeVisible({ timeout: 20000 });
  await expect(page2.getByText(/已經使用過/)).toBeVisible();
  await ctx.close();
  await ctx2.close();
  await coach.dispose();
});

test('沒有邀請碼、只用 Email 自行註冊的人不會被編進班級；之後登入輸入邀請碼才加入', async ({ browser }) => {
  const sfx = Date.now() + 1;
  const { coach, gid } = await setupClass(sfx);
  const email = `inv-late-${sfx}@example.com`;
  const roster = await ok(await coach.post(`/api/coach/groups/${gid}/roster`, { data: { entries: [{ email }] } }), 'roster');
  const [invite] = roster.memberInvites;

  // 先自己註冊（沒有邀請碼）：不會自動入班。
  const learner = await pwRequest.newContext({ baseURL: API });
  await ok(await learner.post('/api/auth/register', { data: { acceptPolicy: true, name: '先註冊', email, password: PW } }), 'register');
  expect((await (await learner.get('/api/groups/mine')).json()).groups).toHaveLength(0);

  // 登入後在首頁輸入邀請碼才加入。
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await login(page, email, PW);
  await page.getByRole('button', { name: '有教練給的邀請碼？' }).click({ timeout: 20000 });
  await page.getByLabel('邀請碼或邀請連結').fill(invite.link);
  await page.getByRole('button', { name: '加入班級' }).click();
  await expect.poll(async () => {
    const d = await (await coach.get(`/api/coach/groups/${gid}`)).json();
    return d.members.map((m) => m.email);
  }, { timeout: 15000 }).toContain(email);
  await ctx.close();
  await learner.dispose();
  await coach.dispose();
});
