import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { register } from '../e2e/helpers.js';

// 使用手冊截圖產生器（Sprint 9.5）。用種子資料把學員／教練／管理者的關鍵畫面截下來，
// 存到 docs/images/，由 docs/user-manual.md 引用、並嵌進手冊 PDF。介面改版後重跑
// `npm run manual:screenshots` 即可更新，不必手動截圖。
// 種子資料全是虛構的示範姓名與 example.com 信箱，不含任何真實個資。

const API = 'http://localhost:3001';
const OUT = 'docs/images';
const ai = getAssessment('ai-competency');
// 每題在基準值上下浮動一點，熱力圖與雷達圖才不會是一條直線；固定的浮動模式讓每次產生的圖一致。
const JITTER = [0, 1, -1, 0, 1, 0, -1, 1];
const resultOf = (v) =>
  buildResult(
    Object.fromEntries(ai.ALL_QUESTIONS.map((q, i) => [q.id, Math.min(5, Math.max(1, v + JITTER[i % JITTER.length]))])),
    ai,
  );
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}
const shot = (page, name, opts = {}) =>
  page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, ...opts });

test('產生使用手冊截圖', async ({ browser }) => {
  
  // ── 種資料：管理者、教練、班級、三位示範學員 ──
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const coachEmail = 'coach@example.com';
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '陳教練', email: coachEmail, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: coachEmail, password: 'abcdef12' } }), 'coach login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: 'AI 職能實戰班 第 1 梯', companyName: '示範股份有限公司', assessmentId: 'ai-competency', targetHeadcount: 12 } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'join code');

  const EMAILS = ['mei', 'daming', 'yating', 'zhihao', 'yijun'];
  // 還沒加入任何班的已註冊用戶：給「成員搜尋」截圖有東西可搜。
  const outsider = await pwRequest.newContext({ baseURL: API });
  await ok(await outsider.post('/api/auth/register', { data: { acceptPolicy: true, name: '王小華', email: 'hua@example.com', password: 'abcdef12' } }), 'outsider');
  await outsider.dispose();

  const students = [['林小美', 2], ['王大明', 4], ['張雅婷', 3], ['李志豪', 5], ['黃怡君', null]];
  const ctxs = [];
  for (const [i, [name, value]] of students.entries()) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name, email: `${EMAILS[i]}@example.com`, password: 'abcdef12', joinCode: g.joinCode } }), `student ${i}`);
    if (value !== null) {
      await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(value), answers: {} } }), `submit ${i}`);
    }
    ctxs.push(s);
  }

  // ── 1. 登入頁（未登入）──
  const anon = await browser.newContext({ viewport: DESKTOP });
  const ap = await anon.newPage();
  await ap.goto('/');
  await ap.getByRole('button', { name: '登入平台' }).first().click({ timeout: 20000 });
  await ap.getByPlaceholder('you@example.com').waitFor();
  await shot(ap, 'login');
  await anon.close();

  // ── 2. 學員：首頁（已加入班級、課前已完成）、帳號選單 ──
  const home = await browser.newContext({ viewport: DESKTOP, storageState: await ctxs[1].storageState() });
  const hp = await home.newPage();
  await hp.goto('/');
  await expect(hp.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  await shot(hp, 'learner-home');
  await hp.getByRole('button', { name: /的帳號選單/ }).click();
  await expect(hp.getByRole('menu')).toBeVisible();
  await shot(hp, 'account-menu', { clip: { x: 800, y: 0, width: 480, height: 320 } });
  await home.close();

  // ── 3. 學員：作答（手機）→ 報告 → 我的分析 ──
  const learner = await browser.newContext({ viewport: MOBILE });
  const lp = await learner.newPage();
  await lp.goto('/');
  await register(lp, '示範學員', 'demo@example.com', 'abcdef12');
  await expect(lp.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  await lp.getByRole('button', { name: '開始作答' }).first().click();
  await lp.waitForSelector('fieldset[data-question-id]', { timeout: 15000 });
  const sets = lp.locator('fieldset[data-question-id]');
  for (let i = 0; i < 3; i++) await sets.nth(i).locator('label').nth(3).click();
  await sets.nth(1).scrollIntoViewIfNeeded();
  await shot(lp, 'survey-mobile');
  await lp.setViewportSize(DESKTOP);
  const n = await sets.count();
  for (let i = 3; i < n; i++) await sets.nth(i).locator('label').nth(i % 2 ? 3 : 2).click();
  await lp.getByRole('button', { name: /送出評測/ }).click();
  await expect(lp.getByText('您的總得分')).toBeVisible({ timeout: 15000 });
  await lp.getByText('您的總得分').scrollIntoViewIfNeeded();
  await lp.evaluate(() => window.scrollBy(0, -80));
  await shot(lp, 'result');
  await lp.getByRole('button', { name: /查看完整分析/ }).click();
  await expect(lp.getByText('我的能力分析')).toBeVisible({ timeout: 15000 });
  await shot(lp, 'analysis');
  await learner.close();

  // ── 4. 教練：班級總覽、成員與設定（QR Code）──
  const cc = await browser.newContext({ viewport: DESKTOP, storageState: await coach.storageState() });
  const cp = await cc.newPage();
  await cp.goto('/');
  await cp.getByRole('button', { name: '教練後台', exact: true }).click();
  // 進頁面會自動選取這個班（Sprint 11），標題列直接出現。
  await expect(cp.getByRole('heading', { name: group.name })).toBeVisible({ timeout: 20000 });
  await expect(cp.getByText('作答進度')).toBeVisible({ timeout: 20000 });
  await expect(cp.getByRole('heading', { name: '成員比較' })).toBeVisible();
  await shot(cp, 'coach-overview');
  await cp.getByRole('heading', { name: '成員比較' }).scrollIntoViewIfNeeded();
  await shot(cp, 'coach-members');
  await cp.getByRole('button', { name: '成員與設定' }).click();
  const qr = cp.getByRole('heading', { name: '報到 QR Code' });
  await qr.waitFor({ timeout: 15000 });
  await cp.locator('canvas, img[alt*="QR"], svg').first().waitFor({ timeout: 10000 }).catch(() => {});
  await qr.scrollIntoViewIfNeeded();
  await shot(cp, 'coach-qr');
  // 成員管理：目前成員＋搜尋加入（Sprint 11）。
  const searchBox = cp.getByLabel('搜尋並加入已註冊的用戶');
  await searchBox.fill('王小');
  await expect(cp.getByRole('button', { name: '加入 王小華' })).toBeVisible({ timeout: 10000 });
  await cp.getByRole('heading', { name: '成員管理' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await cp.evaluate(() => window.scrollBy(0, -90));
  await shot(cp, 'coach-members-search');
  await cc.close();

  // ── 5. 管理者：總覽、系統狀態 ──
  const ac = await browser.newContext({ viewport: DESKTOP, storageState: await admin.storageState() });
  const adp = await ac.newPage();
  await adp.goto('/');
  await adp.getByRole('button', { name: '管理後台', exact: true }).click();
  await expect(adp.getByRole('button', { name: '系統狀態' })).toBeVisible({ timeout: 20000 });
  await shot(adp, 'admin-overview');
  // 用戶與權限（Sprint 11）：角色篩選與每人的角色／停用操作。
  await adp.getByRole('button', { name: '用戶管理', exact: true }).click();
  await expect(adp.getByText('用戶與權限')).toBeVisible({ timeout: 20000 });
  await adp.waitForTimeout(500);
  await shot(adp, 'admin-users');

  // 題庫內容編輯器：改一題文字讓「已修改」標記與內建原文都出現（不儲存，只截圖）。
  await adp.getByRole('button', { name: '題庫內容', exact: true }).click();
  await expect(adp.getByText('不能在這裡修改')).toBeVisible({ timeout: 20000 });
  await adp.getByText('題目文字', { exact: true }).click();
  await adp.getByLabel('第 1 題', { exact: true }).fill('我能清楚說明 ChatGPT、Gemini、Claude 等主流 AI 模型各自適合的使用情境。');
  await adp.getByLabel('第 1 題', { exact: true }).scrollIntoViewIfNeeded();
  await adp.evaluate(() => window.scrollBy(0, 200));
  await shot(adp, 'admin-content');
  await adp.evaluate(() => window.scrollTo(0, 0));

  // 沙盒沒有對外網路，真實的系統狀態會顯示「第二大腦連不上」等異常，不適合放進手冊；
  // 這張圖用「全部正常」的模擬回應，只為了呈現畫面長相（IP 用文件保留網段 203.0.113.x）。
  await adp.route('**/api/admin/system-status', (route) => route.fulfill({
    json: {
      version: { commit: '6f3131a', builtAt: '2026-09-26T13:43:00Z' },
      deps: { secondBrain: { baseUrl: 'https://brain.rong-rise.com', ok: true }, openRouter: { configured: true } },
      mail: { configured: true },
      healthWatch: { intervalMinutes: 5, lastCheckedAt: new Date().toISOString() },
      connection: { ip: '203.0.113.7', ipLooksInternal: false, forwardedFor: '203.0.113.7', remoteAddress: '127.0.0.1', trustProxy: 2 },
    },
  }));
  await adp.getByRole('button', { name: '系統狀態' }).click();
  await expect(adp.getByText('伺服器看到的你的 IP')).toBeVisible({ timeout: 20000 });
  await adp.waitForTimeout(500); // 等分頁標籤的底色轉場結束，避免截到一半的狀態
  await shot(adp, 'admin-system-status');
  await ac.close();

  await Promise.all([admin.dispose(), coach.dispose(), ...ctxs.map((c) => c.dispose())]);
});
