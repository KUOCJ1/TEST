import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 手機版面防護網（docs/MOBILE_APP_PLAN.md M1-1）：手機尺寸（390×844、觸控）下，主要畫面
// 不得水平溢出、底部導覽在該在的地方、主要按鈕夠大、AI 小幫手不蓋內容、作答進度列看得到。
// 會擋部署（跟其他 e2e 一樣在 CI 跑）。資料用 API 直接種，畫面驗證才用瀏覽器。

const API = 'http://localhost:3001';
const ai = getAssessment('ai-competency');
const l9d = getAssessment('leadership-9d');
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

test('教練：切換班級、總覽第一屏、成員卡片、QR 置頂、刪除收進選單', async ({ browser }) => {
  const suffix = `${Date.now()}`;
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '手機教練', email: `e2e-mobile-coach-${suffix}@example.com`, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `e2e-mobile-coach-${suffix}@example.com`, password: 'abcdef12' } }), 'coach login');
  const groupName = `手機版班 ${suffix}`;
  const otherName = `手機第二班 ${suffix}`;
  const { group: other } = await ok(await coach.post('/api/coach/groups', { data: { name: otherName, assessmentId: 'ai-competency' } }), 'group2');
  expect(other.id).toBeTruthy();
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: groupName, assessmentId: 'ai-competency', targetHeadcount: 3 } }), 'group');
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

  // 第一屏：班級名稱與完成率（四個數字）在畫面內，班別列表沒有佔滿第一屏。
  await expect(page.getByRole('heading', { name: groupName })).toBeInViewport();
  const kpis = page.getByRole('group', { name: '班級關鍵數字' }).or(page.locator('dl[aria-label="班級關鍵數字"]'));
  await expect(kpis.getByText('完成率')).toBeInViewport();
  await expect(kpis.getByText('未完成')).toBeInViewport();

  // 成員比較改成卡片：不需要左右滑，姓名、分數、落點都看得到。
  await expect(page.getByRole('region', { name: '成員比較表' })).toHaveCount(0);
  const card = page.getByRole('listitem').filter({ hasText: '手機學員2' });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText(/分/)).toBeVisible();
  await expectMinHeight(card.getByRole('button', { name: /查看/ }), '成員卡片「查看」');
  await expectNoHorizontalOverflow(page, '成員卡片');
  // 熱力圖預設收合。
  await expect(page.getByText(/構面 × 成員熱力圖（展開後/)).toBeVisible();
  // 打開一位成員的結果。
  await card.getByRole('button', { name: /查看/ }).click();
  await expect(page.getByRole('dialog', { name: /手機學員2 的評測報告/ })).toBeVisible();
  await page.getByRole('button', { name: '關閉', exact: true }).click();

  // 切換班級：頂部「目前班級」→ 底部清單 → 選第二班。
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: /目前班級/ }).click();
  const sheet = page.getByRole('dialog', { name: '切換班級' });
  await expect(sheet).toBeVisible();
  // 刪除收進「⋯」：預設看不到刪除，展開才出現（只看不刪）。
  await expect(sheet.getByRole('button', { name: '刪除班別' })).toHaveCount(0);
  await sheet.getByRole('button', { name: `${otherName} 的更多操作` }).click();
  await expect(sheet.getByRole('button', { name: '刪除班別' })).toBeVisible();
  await sheet.getByRole('button', { name: new RegExp(otherName) }).first().click();
  await expect(page.getByRole('heading', { name: otherName })).toBeVisible();

  // 回到有成員的班，開 QR：置頂、可全螢幕。
  await page.getByRole('button', { name: /目前班級/ }).click();
  await page.getByRole('dialog', { name: '切換班級' }).getByRole('button', { name: new RegExp(groupName) }).first().click();
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
  await page.getByRole('button', { name: '成員與設定' }).click();
  const qr = page.getByRole('heading', { name: '報到 QR Code' });
  await expect(qr).toBeVisible();
  const tl = await page.getByRole('heading', { name: '報到 QR Code' }).boundingBox();
  const timeline = await page.getByRole('heading', { name: '施測時間軸' }).boundingBox();
  expect(tl.y, 'QR Code 應該排在「施測時間軸」上面').toBeLessThan(timeline.y);
  expect(tl.y, 'QR Code 應該在第一屏內').toBeLessThan(500);
  await expectMinHeight(page.getByRole('button', { name: /複製連結/ }), '複製連結');
  await expectMinHeight(page.getByRole('button', { name: /^重新產生/ }), '重新產生');
  await page.getByRole('button', { name: /全螢幕投影/ }).click();
  await expect(page.getByRole('button', { name: '關閉全螢幕' })).toBeVisible();
  await page.getByRole('button', { name: '關閉全螢幕' }).click();

  // 班級報告：手機閱讀版（關鍵數字、成員排名），不水平溢出。
  await page.getByRole('button', { name: '總覽' }).click();
  await page.getByRole('button', { name: /產出班級專業分析報告/ }).click();
  const gread = page.locator('#report-portal .report-read');
  await expect(gread).toBeVisible();
  await expect(gread.getByText('班級整體分析報告')).toBeVisible();
  await expect(gread.getByRole('region', { name: '班級關鍵數字' }).or(gread.locator('dl[aria-label="班級關鍵數字"]'))).toBeVisible();
  // 預設是客戶版：有管理者摘要、沒有個人排名；切到教練版才有成員排名（Sprint 24）。
  await expect(gread.locator('section[aria-label="管理者摘要"]')).toBeVisible();
  await expect(gread.locator('section[aria-label="成員排名"]')).toHaveCount(0);
  await page.locator('#report-portal .report-toolbar').getByRole('button', { name: /切到教練版/ }).click();
  await expect(gread.locator('section[aria-label="成員排名"]')).toBeVisible();
  await expectNoHorizontalOverflow(page, '班級報告閱讀版');
  await context.close();
});

test('報告預覽：工具列兩列、按鈕 ≥44px 單行、內容縮放到符合寬度；列印頁數不變', async ({ browser }) => {
  const suffix = `${Date.now()}`;
  const api = await pwRequest.newContext({ baseURL: API });
  await ok(await api.post('/api/auth/register', { data: { acceptPolicy: true, name: '手機報告學員', email: `e2e-mobile-report-${suffix}@example.com`, password: 'abcdef12' } }), 'register');
  const result = buildResult(Object.fromEntries(l9d.ALL_QUESTIONS.map((q) => [q.id, 4])), l9d);
  await ok(await api.post('/api/submissions', { data: { assessmentId: 'leadership-9d', phase: 'pre', result, answers: {} } }), 'submit');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await api.storageState() });
  const page = await context.newPage();
  await page.goto('/analysis/leadership-9d');
  await page.getByRole('button', { name: /產出 PDF 報告/ }).click({ timeout: 20000 });
  const toolbar = page.locator('#report-portal .report-toolbar');
  await expect(toolbar).toBeVisible();

  const printBtn = toolbar.getByRole('button', { name: /列印/ });
  const closeBtn = toolbar.getByRole('button', { name: /關閉/ });
  for (const [btn, label] of [[printBtn, '列印／存為 PDF'], [closeBtn, '關閉']]) {
    await expectMinHeight(btn, `報告工具列「${label}」`);
    const box = await btn.boundingBox();
    expect(box.height, `「${label}」文字被擠成多行（高 ${box.height}px）`).toBeLessThan(60);
  }
  // 報告名稱單行（沒有被擠成一字一行）。
  const title = toolbar.getByText('個人評測報告');
  expect((await title.boundingBox()).height).toBeLessThan(30);
  // 報告本體寬度＝螢幕寬度（等比縮放，不是 820px 塞進 390px 或橫向溢出）。
  const w = await page.evaluate(() => document.querySelector('#report-portal > .report-toolbar + div').getBoundingClientRect().width);
  expect(w, `報告本體寬 ${w}px，應約等於螢幕寬 390px`).toBeGreaterThan(380);
  expect(w).toBeLessThanOrEqual(392);

  // 手機閱讀版（M6）：預設是單欄、正常字級的閱讀版，不是縮小的 A4。
  const read = page.locator('#report-portal .report-read');
  await expect(read).toBeVisible();
  await expect(page.locator('#report-portal .report-a4')).toBeHidden();
  const fs = await read.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs, `閱讀版文字 ${fs}px 太小`).toBeGreaterThanOrEqual(12);
  const bodyFs = await read.getByText('不確定怎麼讀這份結果').or(read.locator('p.leading-relaxed').first()).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(bodyFs, `閱讀版內文 ${bodyFs}px，應為正常字級（≥14px），不是縮到一半的 A4`).toBeGreaterThanOrEqual(14);
  await expectNoHorizontalOverflow(page, '報告閱讀版');
  await expect(read.getByText('指導教練回饋')).toHaveCount(0);

  // 列印結果不能變：這份資料（L9D 全 4 分、Chromium A4）的個人報告轉成 PDF 是 11 頁——
  // 這個數字是在改版前（還原 M3 的程式後）用同樣方式量到的基準，不是計畫書的 10 頁（資料與量法不同）。
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '15mm', right: '15mm' } });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages, `個人報告（L9D）列印頁數 ${pages}，改版前基準是 11 頁（閱讀版開著時也一樣印 A4 原版）`).toBe(11);

  // 切到 A4 原版：縮放到螢幕寬（M3 的行為），再切回閱讀版。
  await toolbar.getByRole('button', { name: '看 A4 原版' }).click();
  await expect(page.locator('#report-portal .report-a4')).toBeVisible();
  await expect(read).toBeHidden();
  const a4w = await page.evaluate(() => document.querySelector('#report-portal > .report-a4').getBoundingClientRect().width);
  expect(a4w).toBeGreaterThan(380);
  expect(a4w).toBeLessThanOrEqual(392);
  await toolbar.getByRole('button', { name: '看閱讀版' }).click();
  await expect(read).toBeVisible();
  await context.close();
});

test('管理者：任何分頁一步切得到、後台入口合併、電腦限定提示', async ({ browser }) => {
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  await ok(await admin.post('/api/auth/consent', { data: { accept: true } }), 'consent');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await admin.storageState() });
  const page = await context.newPage();
  await page.goto('/admin');
  const select = page.getByRole('combobox', { name: '管理分頁' });
  await expect(select).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, '管理後台');
  await expectMinHeight(select, '管理分頁下拉');

  // 底部導覽：管理員只有一個「後台」入口（不是 教練＋管理 兩項），點開選擇。
  const nav = page.getByRole('navigation', { name: '主要導覽' });
  await expect(nav.getByRole('button', { name: '教練後台' })).toHaveCount(0);
  await nav.getByRole('button', { name: '後台' }).click();
  await expect(page.getByRole('menuitem', { name: '教練後台' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '管理後台' })).toBeVisible();
  await page.getByRole('menuitem', { name: '教練後台' }).click();
  await expect(page).toHaveURL(/\/coach/);
  await page.goto('/admin');
  await expect(select).toBeVisible({ timeout: 20000 });

  // 十個分頁每一頁都切得到，整頁不水平溢出。
  const labels = await select.locator('option').allTextContents();
  expect(labels.length).toBe(10);
  for (const label of labels) {
    await page.getByRole('combobox', { name: '管理分頁' }).selectOption({ label });
    await page.waitForTimeout(150);
    await expectNoHorizontalOverflow(page, `管理後台「${label}」`);
  }
  // 題庫啟用狀態預設收合在分頁選單之後；展開後每個題庫一列，開關可點（手機不被長清單擠到畫面外）。
  const toggleBox = page.locator('details', { has: page.getByText('題庫啟用狀態') });
  await expect(toggleBox).toBeVisible();
  expect(await toggleBox.evaluate((el) => el.open)).toBe(false);
  expect((await toggleBox.boundingBox()).y).toBeLessThan(500);
  // 電腦限定的分頁有提示。
  await page.getByRole('combobox', { name: '管理分頁' }).selectOption({ label: '批次上傳' });
  await expect(page.getByRole('note').filter({ hasText: '建議用電腦操作' })).toBeVisible();
  await page.getByRole('combobox', { name: '管理分頁' }).selectOption({ label: '用戶管理' });
  await expect(page.getByRole('note').filter({ hasText: '建議用電腦操作' })).toHaveCount(0);
  await context.close();
});

test('斷線：作答頁出現提示，恢復連線後消失，作答進度還在', async ({ browser }) => {
  const { context, page } = await newLearner(browser, '手機斷線學員', { submit: false });
  await page.goto('/survey/ai-competency');
  await page.waitForSelector('fieldset[data-question-id]', { timeout: 20000 });
  await page.locator('fieldset[data-question-id]').first().locator('label').nth(3).click();
  const banner = page.getByRole('status').filter({ hasText: '沒有網路連線' });
  await expect(banner).toHaveCount(0);
  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('連線後再送出');
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
  await expect(page.getByText(/1 \/ \d+ 題/)).toBeVisible();
  await context.close();
});


test('字級：個人設定可切到特大，基準字放大且首頁不溢出；重新整理後仍保留', async ({ browser }) => {
  const { context, page } = await newLearner(browser, '手機字級學員', { submit: false });
  await page.goto('/profile');
  const group = page.getByRole('radiogroup', { name: '字級' });
  await expect(group).toBeVisible({ timeout: 20000 });
  const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(await size()).toBe(18);
  await group.getByRole('radio', { name: '特大' }).click();
  await expect.poll(size).toBe(22);
  await page.goto('/home');
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toBeVisible({ timeout: 20000 });
  expect(await size()).toBe(22);
  await expectNoHorizontalOverflow(page, '特大字級的首頁');
  await page.goto('/profile');
  await page.getByRole('radiogroup', { name: '字級' }).getByRole('radio', { name: '標準' }).click();
  await expect.poll(size).toBe(18);
  await context.close();
});
