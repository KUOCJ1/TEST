import { test, expect, request as pwRequest } from '@playwright/test';
import fs from 'fs';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { register } from '../e2e/helpers.js';

// 手機介面走查（docs/MOBILE_APP_PLAN.md）：用手機尺寸（390×844）走過訪客、學員、教練、管理者的主要畫面，
// 每個畫面截兩張圖（整頁、第一屏），並量測：整頁水平溢出、需要左右滑的區塊、過小的觸控目標（短邊 < 40px）、
// 過小的文字（< 12px）。結果寫到 mobile-audit-out/findings.json（不進版控）。
// 執行：`npm run audit:mobile`（先關掉本機 dev server）。這不是會擋部署的測試，是改版前後比較用的量測工具；
// 會擋部署的手機檢查在 e2e/mobile-layout.spec.js（計畫 Sprint M1 建立）。
// 種子資料全是虛構的示範姓名與 example.com 信箱。
const API = 'http://localhost:3001';
const OUT = process.env.AUDIT_OUT || 'mobile-audit-out';
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const MOBILE = { width: 390, height: 844 };
const ai = getAssessment('ai-competency');
const l9d = getAssessment('leadership-9d');
const JITTER = [0, 1, -1, 0, 1, 0, -1, 1];
const resultOf = (cfg, v) => buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q, i) => [q.id, Math.min(5, Math.max(1, v + JITTER[i % JITTER.length]))])), cfg);
const findings = [];

async function ok(res, label) { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); }

async function audit(page, name, role) {
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
    const desc = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
    const inPortal = (el) => !!el.closest('#report-portal');
    const all = [...document.querySelectorAll('body *')].filter((el) => vis(el));
    const scrollers = all.filter((el) => { const s = getComputedStyle(el); return ['auto', 'scroll'].includes(s.overflowX) && el.scrollWidth > el.clientWidth + 4; })
      .map((el) => ({ what: el.tagName.toLowerCase() + (el.querySelector('table') ? '（表格）' : ''), text: desc(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    const interactive = [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea, [role=button], [role=tab], summary')].filter((el) => vis(el) && !el.closest('.sr-only'));
    const small = interactive.filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 40 && r.top < document.documentElement.scrollHeight; })
      .map((el) => { const r = el.getBoundingClientRect(); return { text: desc(el), w: Math.round(r.width), h: Math.round(r.height) }; });
    const tiny = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(el).fontSize) < 12 && !inPortal(el))
      .map((el) => ({ text: desc(el), px: parseFloat(getComputedStyle(el).fontSize) }));
    const fixedBottom = all.filter((el) => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().bottom >= window.innerHeight - 2 && el.getBoundingClientRect().height < 200).length;
    return {
      vw, docWidth: document.documentElement.scrollWidth, pageOverflowPx: Math.max(0, document.documentElement.scrollWidth - vw),
      pageHeight: document.documentElement.scrollHeight,
      scrollers, interactiveCount: interactive.length, smallTargets: small.length, smallSamples: small.slice(0, 40),
      tinyText: tiny.length, tinySamples: tiny.slice(0, 6), hasBottomNav: fixedBottom > 0,
    };
  });
  await page.screenshot({ path: `${OUT}/shots/${name}.jpg`, type: 'jpeg', quality: 55, fullPage: true });
  await page.screenshot({ path: `${OUT}/shots/${name}.fold.jpg`, type: 'jpeg', quality: 60 });
  findings.push({ name, role, url: new URL(page.url()).pathname, ...m });
  fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 1));
}
const step = async (label, fn) => { try { await fn(); } catch (e) { findings.push({ name: label, error: String(e.message).split('\n')[0].slice(0, 200) }); fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 1)); } };

test('手機介面走查', async ({ browser }) => {
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  await ok(await admin.post('/api/auth/consent', { data: { accept: true } }), 'admin consent');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '陳教練', email: 'coach@example.com', password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: 'coach@example.com', password: 'abcdef12' } }), 'coach login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: 'AI 職能實戰班 第 1 梯', companyName: '示範股份有限公司', assessmentId: 'ai-competency', targetHeadcount: 12 } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'join code');
  const { group: g2 } = await ok(await coach.post('/api/coach/groups', { data: { name: '領導力九大構面班', companyName: '示範股份有限公司', assessmentId: 'leadership-9d' } }), 'group2');
  const { group: g2c } = await ok(await coach.post(`/api/coach/groups/${g2.id}/join-code`), 'join code2');

  const students = [['林小美', 2], ['王大明', 4], ['張雅婷', 3], ['李志豪', 5], ['黃怡君', null]];
  const ctxs = [];
  for (const [i, [name, value]] of students.entries()) {
    const s = await pwRequest.newContext({ baseURL: API });
    await ok(await s.post('/api/auth/register', { data: { acceptPolicy: true, name, email: `s${i}@example.com`, password: 'abcdef12', joinCode: g.joinCode } }), `student ${i}`);
    if (value !== null) await ok(await s.post('/api/submissions', { data: { assessmentId: 'ai-competency', phase: 'pre', result: resultOf(ai, value), answers: {} } }), `submit ${i}`);
    ctxs.push(s);
  }
  // 王大明另外加入 L9D 班並完成自評，讓「我的分析」「360°」有領導力的內容。
  await ok(await ctxs[1].post('/api/groups/join', { data: { joinCode: g2c.joinCode } }), 'join l9d');
  await ok(await ctxs[1].post('/api/submissions', { data: { assessmentId: 'leadership-9d', phase: 'pre', result: resultOf(l9d, 4), answers: {} } }), 'l9d submit');
  await ok(await ctxs[1].post('/api/goals', { data: { text: '每週一次跨部門 check-in', assessmentId: 'leadership-9d', dimensionId: 'collaboration', dimensionName: '協作關係', reviewDate: '2027-01-15' } }), 'goal').catch(() => {});

  // ── 公開頁與登入 ──
  const anon = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const ap = await anon.newPage();
  await step('public-landing', async () => { await ap.goto('/welcome'); await ap.waitForLoadState('networkidle'); await audit(ap, '01-public-landing', '訪客'); });
  await step('public-login', async () => { await ap.getByRole('button', { name: '登入平台' }).first().click({ timeout: 15000 }); await ap.getByPlaceholder('you@example.com').waitFor(); await audit(ap, '02-login', '訪客'); });
  await step('public-join', async () => { await ap.goto(`/?join=${g.joinCode}`); await ap.getByPlaceholder('you@example.com').waitFor({ timeout: 15000 }); await audit(ap, '03-join-qr', '訪客'); });
  await anon.close();

  // ── 學員：已有資料的人（王大明）──
  const lc = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true, storageState: await ctxs[1].storageState() });
  const lp = await lc.newPage();
  await step('learner-home', async () => { await lp.goto('/home'); await expect(lp.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 }); await audit(lp, '10-learner-home', '學員'); });
  await step('learner-analysis', async () => { await lp.goto('/analysis'); await lp.waitForLoadState('networkidle'); await audit(lp, '11-learner-analysis', '學員'); });
  await step('learner-360', async () => { await lp.goto('/360'); await lp.waitForLoadState('networkidle'); await audit(lp, '12-learner-360', '學員'); });
  await step('learner-learning', async () => { await lp.goto('/learning'); await lp.waitForLoadState('networkidle'); await audit(lp, '13-learner-learning', '學員'); });
  await step('learner-profile', async () => { await lp.goto('/profile'); await lp.waitForLoadState('networkidle'); await audit(lp, '14-learner-profile', '學員'); });
  await step('learner-menu', async () => { await lp.goto('/home'); await lp.getByRole('button', { name: /的帳號選單/ }).click({ timeout: 15000 }); await expect(lp.getByRole('menu')).toBeVisible(); await audit(lp, '15-learner-account-menu', '學員'); });
  await lc.close();

  // ── 學員：新註冊 → 作答 → 結果 → 列印報告 ──
  const nc = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
  const np = await nc.newPage();
  await step('survey', async () => {
    await np.goto('/');
    await register(np, '示範學員', 'demo@example.com', 'abcdef12');
    await expect(np.getByRole('heading', { name: '選擇評量' })).toBeVisible({ timeout: 20000 });
    await audit(np, '20-new-learner-home', '學員');
    await np.getByRole('button', { name: '開始作答' }).first().click();
    await np.waitForSelector('fieldset[data-question-id]', { timeout: 15000 });
    const sets = np.locator('fieldset[data-question-id]');
    for (let i = 0; i < 3; i++) await sets.nth(i).locator('label').nth(3).click();
    await audit(np, '21-survey-answering', '學員');
    const n = await sets.count();
    for (let i = 3; i < n; i++) await sets.nth(i).locator('label').nth(i % 2 ? 3 : 2).click();
    await audit(np, '22-survey-end', '學員');
    await np.getByRole('button', { name: /送出評測/ }).click();
    await expect(np.getByText('您的總得分')).toBeVisible({ timeout: 15000 });
    await audit(np, '23-result', '學員');
  });
  await step('result-print', async () => {
    await np.getByRole('button', { name: /查看完整分析/ }).click({ timeout: 8000 });
    await np.getByRole('button', { name: /產出 PDF 報告/ }).click({ timeout: 10000 });
    await np.locator('#report-portal .report-toolbar').waitFor({ timeout: 10000 });
    await audit(np, '24-printable-report-overlay', '學員');
  });
  await nc.close();

  // ── 教練 ──
  const cc = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true, storageState: await coach.storageState() });
  const cp = await cc.newPage();
  await step('coach-overview', async () => { await cp.goto('/coach'); await expect(cp.getByText('作答進度')).toBeVisible({ timeout: 25000 }); await audit(cp, '30-coach-overview', '教練'); });
  await step('coach-members', async () => { await cp.getByRole('heading', { name: '成員比較' }).scrollIntoViewIfNeeded(); await audit(cp, '31-coach-members-table', '教練'); });
  await step('coach-member-drawer', async () => { await cp.getByRole('button', { name: /查看/ }).first().click({ timeout: 8000 }); await cp.waitForTimeout(800); await audit(cp, '32-coach-member-detail', '教練'); await cp.keyboard.press('Escape'); });
  await step('coach-settings', async () => { await cp.goto('/coach'); await cp.getByRole('button', { name: '成員與設定' }).click({ timeout: 20000 }); await cp.getByRole('heading', { name: '報到 QR Code' }).waitFor({ timeout: 15000 }); await audit(cp, '33-coach-settings-qr', '教練'); });
  await step('coach-multirater', async () => { await cp.goto('/coach'); await cp.getByRole('button', { name: '360° 進度' }).click({ timeout: 20000 }); await cp.waitForTimeout(1200); await audit(cp, '34-coach-360-progress', '教練'); });
  await step('coach-group-report', async () => { await cp.goto('/coach'); await cp.getByRole('button', { name: /班級專業分析報告/ }).click({ timeout: 20000 }); await cp.locator('#report-portal .report-toolbar').waitFor({ timeout: 10000 }); await audit(cp, '35-coach-group-report-overlay', '教練'); });
  await cc.close();

  // ── 管理者 ──
  const ac = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true, storageState: await admin.storageState() });
  const adp = await ac.newPage();
  await step('admin-home', async () => { await adp.goto('/admin'); await expect(adp.getByRole('combobox', { name: '管理分頁' })).toBeVisible({ timeout: 25000 }); await audit(adp, '40-admin-overview', '管理者'); });
  for (const [i, tab] of ['班級分析', '用戶管理', '班別與發佈', '專案範本', '題庫內容', '批次上傳', '稽核紀錄', '系統狀態'].entries()) {
    await step(`admin-${tab}`, async () => { await adp.getByRole('combobox', { name: '管理分頁' }).selectOption({ label: tab }); await adp.waitForTimeout(1200); await audit(adp, `4${i + 1}-admin-${tab}`, '管理者'); });
  }
  await ac.close();
  await Promise.all([admin.dispose(), coach.dispose(), ...ctxs.map((c) => c.dispose())]);
});
