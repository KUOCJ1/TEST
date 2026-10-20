import { test, expect, request as pwRequest } from '@playwright/test';
import { login } from './helpers.js';

// Sprint 11 驗收條件 11.7：管理者停用帳號（對方立即被登出、無法登入、可重新啟用），
// 以及教練只能「搜尋」才找得到人（不會列出全站名單）。

const API = 'http://localhost:3001';
const PW = 'abcdef12';

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}
async function adminApi() {
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  return admin;
}

test('管理者停用帳號：對方立即被登出且無法登入，重新啟用後恢復', async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-disable-${suffix}@example.com`;
  const name = `E2E 停用對象 ${suffix}`;

  // 學員先註冊並登入（API）：稍後驗證「既有登入」會被立即踢掉。
  const student = await pwRequest.newContext({ baseURL: API });
  await ok(await student.post('/api/auth/register', { data: { acceptPolicy: true, name, email, password: PW } }), 'register');
  expect((await student.get('/api/auth/me')).status()).toBe(200);

  // 管理者在畫面上停用。
  await page.goto('/');
  await login(page, 'admin@e2e.test', 'E2eTest1234');
  await page.getByRole('button', { name: '管理後台', exact: true }).click();
  await page.getByRole('button', { name: '用戶管理', exact: true }).click();
  await page.getByLabel('搜尋姓名或 Email').fill(email);
  const row = page.getByRole('listitem').filter({ hasText: email });
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: `停用 ${name}` }).click();
  await expect(page.getByRole('alertdialog')).toContainText('立即被登出');
  await page.getByRole('alertdialog').getByRole('button', { name: '停用', exact: true }).click();
  await expect(row.getByText('已停用', { exact: true })).toBeVisible({ timeout: 10000 });

  // 既有登入立即失效；重新登入被擋並說明原因。
  expect((await student.get('/api/auth/me')).status()).toBe(401);
  const blocked = await student.post('/api/auth/login', { data: { email, password: PW } });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe('ACCOUNT_DISABLED');

  // 重新啟用後可以登入。
  await row.getByRole('button', { name: `重新啟用 ${name}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '重新啟用', exact: true }).click();
  await expect(row.getByText('已停用', { exact: true })).toHaveCount(0, { timeout: 10000 });
  expect((await student.post('/api/auth/login', { data: { email, password: PW } })).status()).toBe(200);
  await student.dispose();
});

test('管理者不能停用自己或降級自己（按鈕被停用）', async ({ page }) => {
  await page.goto('/');
  await login(page, 'admin@e2e.test', 'E2eTest1234');
  await page.getByRole('button', { name: '管理後台', exact: true }).click();
  await page.getByRole('button', { name: '用戶管理', exact: true }).click();
  await page.getByRole('button', { name: /^管理者（/ }).click();
  const me = page.getByRole('listitem').filter({ hasText: 'admin@e2e.test' });
  await expect(me).toBeVisible({ timeout: 15000 });
  await expect(me.getByText('（你自己）')).toBeVisible();
  await expect(me.getByLabel(/變更 .* 的角色/)).toBeDisabled();
  await expect(me.getByRole('button', { name: /^停用 / })).toBeDisabled();
});

test('教練只能搜尋才找得到人：1 個字不搜尋、不會列出全站名單；搜尋後加入並儲存', async ({ browser }) => {
  const suffix = Date.now();
  const admin = await adminApi();
  const coach = await pwRequest.newContext({ baseURL: API });
  const coachEmail = `e2e-search-coach-${suffix}@example.com`;
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '搜尋教練', email: coachEmail, password: PW } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: PW } }), 'coach login');
  const groupName = `E2E 搜尋班 ${suffix}`;
  await ok(await coach.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency' } }), 'group');

  const target = `搜尋對象${suffix}`;
  const bystander = `路人${suffix}`;
  let targetApi;
  for (const [n, e] of [[target, `target-${suffix}@example.com`], [bystander, `bystander-${suffix}@example.com`]]) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name: n, email: e, password: PW } }), n);
    if (n === target) targetApi = s; else await s.dispose();
  }

  const ctx = await browser.newContext({ storageState: await coach.storageState() });
  const page = await ctx.newPage();
  await page.goto('/coach');
  // 進頁面自動選到這個班（只有一個班），標題列出現。
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '成員與設定' }).click();

  // 沒搜尋時看不到任何其他用戶（也沒有全站名單）。
  await expect(page.getByText(bystander)).toHaveCount(0);
  await expect(page.getByText(target)).toHaveCount(0);

  const box = page.getByLabel('搜尋並加入已註冊的用戶');
  await box.fill('搜');
  await page.waitForTimeout(600);
  await expect(page.getByText(/不會列出全部用戶/)).toBeVisible();
  await expect(page.getByText(target)).toHaveCount(0);

  await box.fill(target);
  await page.getByRole('button', { name: `加入 ${target}` }).click();
  await expect(page.getByText('目前成員（1）')).toBeVisible();
  await expect(page.getByText(bystander)).toHaveCount(0);
  await page.getByRole('button', { name: '儲存成員名單' }).click();
  await expect(page.getByRole('button', { name: '儲存成員名單' })).toBeDisabled({ timeout: 10000 });

  // 教練不能直接把已有帳號的人加進班級：這時只是「邀請」，對方接受前不是成員。
  await expect(page.getByText('等待對方接受邀請')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('目前成員（0）')).toBeVisible();
  const invites = await (await targetApi.get('/api/groups/invites')).json();
  expect(invites.invites).toHaveLength(1);
  await ok(await targetApi.post(`/api/groups/invites/${invites.invites[0].id}/accept`), 'accept');
  await targetApi.dispose();

  // 對方接受、重新整理後成員在班上。
  await page.reload();
  await page.getByRole('button', { name: '成員與設定' }).click();
  await expect(page.getByText('目前成員（1）')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(target).first()).toBeVisible();
  await ctx.close();
  await admin.dispose();
  await coach.dispose();
});

test('管理者轉移班別：原教練看不到、新教練看得到', async ({ page }) => {
  const suffix = Date.now();
  const admin = await adminApi();
  const mk = async (label) => {
    const c = await pwRequest.newContext({ baseURL: API });
    const email = `e2e-transfer-${label}-${suffix}@example.com`;
    const reg = await ok(await c.post('/api/auth/register', { data: { acceptPolicy: true, name: `轉移教練${label}${suffix}`, email, password: PW } }), label);
    await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
    await ok(await c.post('/api/auth/login', { data: { email, password: PW } }), 'login');
    return { c, name: `轉移教練${label}${suffix}` };
  };
  const from = await mk('甲');
  const to = await mk('乙');
  const groupName = `E2E 轉移班 ${suffix}`;
  await ok(await from.c.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency' } }), 'group');

  await page.goto('/');
  await login(page, 'admin@e2e.test', 'E2eTest1234');
  await page.getByRole('button', { name: '管理後台', exact: true }).click();
  await page.getByRole('button', { name: '班別與發佈', exact: true }).click();
  const select = page.getByLabel(`把「${groupName}」轉給`);
  await expect(select).toBeVisible({ timeout: 15000 });
  const optionValue = await select.locator('option', { hasText: to.name }).getAttribute('value');
  await select.selectOption(optionValue);
  const card = select.locator('xpath=ancestor::div[contains(@class,"mt-2")][1]');
  await card.getByRole('button', { name: '轉移班別' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '轉移', exact: true }).click();
  await expect(card.locator('p', { hasText: `負責教練：${to.name}` })).toBeVisible({ timeout: 10000 });

  const fromGroups = await (await from.c.get('/api/coach/groups')).json();
  const toGroups = await (await to.c.get('/api/coach/groups')).json();
  expect(fromGroups.groups.map((g) => g.name)).not.toContain(groupName);
  expect(toGroups.groups.map((g) => g.name)).toContain(groupName);

  await admin.dispose();
  await from.c.dispose();
  await to.c.dispose();
});
