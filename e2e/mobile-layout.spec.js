import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 手機版面防護網（docs/MOBILE_APP_PLAN.md M1-1）：手機尺寸（390×844、觸控）下，主要畫面
// 不得水平溢出、底部導覽在該在的地方、主要按鈕夠大、AI 小幫手不蓋內容、作答進度列看得到。
// 會擋部署（跟其他 e2e 一樣在 CI 跑）。資料用 API 直接種，畫面驗證才用瀏覽器。

const API = 'http://localhost:3001';
const ai = getAssessment('ai-competency');
const resultOf = (v) => buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, v])), ai);
const MIN_TAP = 44;

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function expectNoHorizontalOverflow(page, label) {
  const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(m.doc, `${label}：整頁水平溢出（scrollWidth ${m.doc} > ${m.vw}）`).toBeLessThanOrEqual(m.vw);
}

async function expectMinHeight(locator, label) {
  const box = await locator.boundingBox();
  expect(box, `${label}：找不到`).not.toBeNull();
  expect(box.height, `${label}：高度 ${box.height}px 小於 ${MIN_TAP}px`).toBeGreaterThanOrEqual(MIN_TAP - 0.5);
}

// 捲到最底後，沒有任何「一般內容」的文字被固定在畫面上的 AI 小幫手按鈕蓋住。
async function expectNothingUnderAssistant(page, label) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const hit = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="開啟 AI 助手"], button[aria-label="關閉 AI 助手"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const inFixed = (el) => { for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false; };
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      if (inFixed(el)) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) bad.push((el.innerText || '').trim().slice(0, 20));
    }
    return bad;
  });
  expect(hit, `${label}：沒有 AI 小幫手按鈕`).not.toBeNull();
  expect(hit, `${label}：以下文字被 AI 小幫手按鈕蓋住`).toEqual([]);
}

async function newLearner(browser, name, { submit = true } = {}) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const api = await pwRequest.newContext({ baseURL: API });
  await ok(await api.post('/api/auth/register', { data: { acceptPolicy: true, name, email: `e2e-mobile-${suffix}@example.com`, password: 'abcdef12' } }), 'register');
  if (submit) {
    await ok(await api.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(3), answers: {} } }), 'submit');
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await api.storageState(),
  });
  return { context, page: await context.newPage() };
}

test('訪客：首頁與登入頁不水平溢出', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: '登入平台' }).first()).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, '公開首頁');
  await page.getByRole('button', { name: '登入平台' }).first().click();
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  await expectNoHorizontalOverflow(page, '登入頁');
  await expectMinHeight(page.getByRole('button', { name: '登入帳號' }), '登入帳號按鈕');
  await expectMinHeight(page.getByRole('tab', { name: '註冊' }), '註冊分頁');
});

test('學員首頁：不溢出、有底部導覽、按鈕夠大、小幫手不蓋內容', async ({ browser }) => {
  const { context, page } = await newLearner(browser, '手機學員甲');
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, '學員首頁');
  const nav = page.getByRole('navigation', { name: '主要導覽' });
  await expect(nav).toBeVisible();
  await expectMinHeight(page.getByRole('button', { name: /的帳號選單/ }), '帳號選單按鈕');
  await expectMinHeight(page.getByRole('button', { name: /開始作答|重新作答/ }).first(), '開始／重新作答按鈕');
  await expectMinHeight(nav.getByRole('button').first(), '底部導覽項目');
  await expectNothingUnderAssistant(page, '學員首頁');
  await context.close();
});

test('我的分析：不溢出、小幫手不蓋內容', async ({ browser }) => {
  const { context, page } = await newLearner(browser, '手機學員乙');
  await page.goto('/analysis');
  await expect(page.getByText('您的總得分')).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, '我的分析');
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toBeVisible();
  await expectNothingUnderAssistant(page, '我的分析');
  await context.close();
});

test('作答：無底部導覽、捲到第 10 題進度列仍看得到、送出後結果不溢出', async ({ browser }) => {
  const { context, page } = await newLearner(browser, '手機學員丙', { submit: false });
  await page.goto('/survey/ai-competency');
  await page.waitForSelector('fieldset[data-question-id]', { timeout: 20000 });
  await expectNoHorizontalOverflow(page, '作答頁');
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toHaveCount(0);

  const sets = page.locator('fieldset[data-question-id]');
  for (let i = 0; i < 9; i++) await sets.nth(i).locator('label').nth(3).click();
  await sets.nth(9).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(300);

  // 進度列要在畫面上，而且沒有被頁首蓋住（它的中心點取到的元素屬於進度列本身）。
  const bar = page.getByRole('progressbar', { name: '作答進度' });
  await expect(bar).toBeVisible();
  const state = await page.evaluate(() => {
    const el = document.querySelector('[role="progressbar"]');
    const header = document.querySelector('header');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { barTop: r.top, headerBottom: header.getBoundingClientRect().bottom, covered: !el.parentElement.parentElement.contains(top) };
  });
  expect(state.covered, '進度列被其他元素（頁首）蓋住').toBe(false);
  expect(state.barTop, '進度列貼在頁首上方或被頁首吃掉').toBeGreaterThanOrEqual(state.headerBottom - 1);

  // 作答到一半：「還有 N 題未作答」捷徑出現，點了捲到第一題沒答的（第 10 題）。
  const n = await sets.count();
  const pill = page.getByRole('button', { name: new RegExp(`還有 ${n - 9} 題未作答`) });
  await expect(pill).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await pill.click();
  await expect(sets.nth(9)).toBeInViewport({ timeout: 5000 });

  for (let i = 9; i < n; i++) await sets.nth(i).locator('label').nth(i % 2 ? 3 : 2).click();
  await expect(pill).toHaveCount(0);
  await page.getByRole('button', { name: /送出評測/ }).click();
  await expect(page.getByText('您的總得分')).toBeVisible({ timeout: 15000 });
  await expectNoHorizontalOverflow(page, '結果頁');
  // 結果頁不再接著整份題目：題目收在「查看我的作答」裡，整頁高度 < 6000px。
  await expect(page.getByText(/查看我的作答/)).toBeVisible();
  await expect(sets.first()).toBeHidden();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height, `結果頁高度 ${height}px 應小於 6000px`).toBeLessThan(6000);
  // 區段跳轉列固定在頁首下方：捲到下面後仍看得到，且沒被頁首蓋住。
  await page.evaluate(() => window.scrollTo(0, 1500));
  const jump = page.getByRole('navigation', { name: '報告章節導覽' });
  await expect(jump).toBeInViewport();
  const jumpState = await page.evaluate(() => {
    const r = document.querySelector('nav[aria-label="報告章節導覽"]').getBoundingClientRect();
    return { top: r.top, headerBottom: document.querySelector('header').getBoundingClientRect().bottom };
  });
  expect(jumpState.top).toBeGreaterThanOrEqual(jumpState.headerBottom - 1);
  await context.close();
});

test('教練總覽：整頁不水平溢出、底部導覽在、按鈕夠大', async ({ browser }) => {
  const suffix = `${Date.now()}`;
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '手機教練', email: `e2e-mobile-coach-${suffix}@example.com`, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `e2e-mobile-coach-${suffix}@example.com`, password: 'abcdef12' } }), 'coach login');
  const groupName = `手機版班 ${suffix}`;
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency' } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'join code');
  for (const [i, v] of [[1, 2], [2, 4]]) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name: `手機學員${i}`, email: `e2e-mobile-s${i}-${suffix}@example.com`, password: 'abcdef12', joinCode: g.joinCode } }), `student ${i}`);
    await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(v), answers: {} } }), `submit ${i}`);
    await s.dispose();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await coach.storageState() });
  const page = await context.newPage();
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('作答進度')).toBeVisible({ timeout: 15000 });
  await expectNoHorizontalOverflow(page, '教練總覽');
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toBeVisible();
  await expectMinHeight(page.getByRole('button', { name: /的帳號選單/ }), '帳號選單按鈕');
  await context.close();
});
