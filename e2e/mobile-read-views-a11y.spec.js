import { test, expect, request as pwRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { acceptConsentIfAsked } from './helpers.js';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 手機報告閱讀版（360°、批次）在淺色／深色模式下的無障礙（對比）檢查。合成資料，不含真實客戶資料。
const API = 'http://localhost:3001';
const ID = 'leadership-360-70';
const cfg = getAssessment(ID);
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };
const answers = (base, jitter = 0) => Object.fromEntries(cfg.ALL_QUESTIONS.map((q, i) => [q.id, Math.max(1, Math.min(5, base + ((i + jitter) % 3 === 0 ? -1 : 0)))]));
const row = (ratee, rateeName, raterType, rater, raterName, base, jitter) => {
  const a = answers(base, jitter);
  return { rateeEmail: ratee, rateeName, raterType, raterEmail: rater, raterName, answers: a, result: buildResult(a, cfg) };
};

async function scan(page, label) {
  const res = await new AxeBuilder({ page }).include('#report-portal').analyze();
  const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)).join(' | ')}`), label).toEqual([]);
}

for (const dark of [false, true]) {
  test(`手機閱讀版 axe（${dark ? '深色' : '淺色'}）：360° 與批次報告`, async ({ browser }) => {
    test.setTimeout(120000);
    const sfx = `${Date.now()}${dark ? 'd' : 'l'}`;
    const e = (n) => `e2e-rv-${n}-${sfx}@placeholder.invalid`;
    const admin = await pwRequest.newContext({ baseURL: API });
    await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
    const rows = [
      row(e('a'), '受評者甲', 'self', '', '', 5, 0),
      row(e('a'), '受評者甲', 'manager', e('m'), '主管乙', 3, 1),
      row(e('a'), '受評者甲', 'subordinate', e('s1'), '部屬一', 4, 2),
    ];
    await ok(await admin.post('/api/admin/batch-import', { data: { assessmentId: ID, rows } }), 'import');
    const { group } = await ok(await admin.post('/api/coach/groups', { data: { name: `閱讀版 ${sfx}`, companyName: '測試', assessmentId: ID } }), 'group');
    const users = (await ok(await admin.get('/api/admin/overview'), 'overview')).users ?? [];
    const ids = ['a', 'm', 's1'].map((n) => users.find((u) => u.email === e(n))?.id).filter(Boolean);
    await ok(await admin.put(`/api/coach/groups/${group.id}`, { data: { memberIds: ids } }), 'members');

    const context = await browser.newContext({ storageState: await admin.storageState(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript((d) => { try { localStorage.setItem('aiassess_dark', d ? '1' : '0'); } catch { /* ignore */ } }, dark);
    const page = await context.newPage();
    await page.goto('/');
    await acceptConsentIfAsked(page);
    await page.goto('/coach');
    const sheet = page.getByRole('dialog', { name: '切換班級' });
    const groupName = `閱讀版 ${sfx}`;
    if (await sheet.isVisible().catch(() => false)) await sheet.getByText(groupName, { exact: true }).first().dispatchEvent('click', undefined, { timeout: 20000 });
    else await page.getByText(groupName, { exact: true }).first().dispatchEvent('click', undefined, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20000 });
    if (await sheet.isVisible().catch(() => false)) await sheet.getByRole('button', { name: '關閉', exact: true }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: '產出 受評者甲 的 360° 完整報告' }).click({ timeout: 20000 });
    const read = page.locator('#report-portal .report-read');
    await expect(read.getByText('各構面詳述')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(dark);
    await scan(page, `360° 閱讀版（${dark ? '深色' : '淺色'}）`);
    await page.locator('#report-portal .report-toolbar').getByRole('button', { name: /關閉/ }).click();
    // 批次報告閱讀版：展開一位成員（個人閱讀版）後掃描。
    await page.getByRole('button', { name: '批次匯出個人報告' }).click({ timeout: 20000 });
    const batch = page.locator('#report-portal .report-read');
    await expect(batch.getByText('整班個人報告（批次）').first()).toBeVisible({ timeout: 20000 });
    await batch.getByRole('button', { name: /受評者甲/ }).click();
    await expect(batch.getByText('個人評測報告')).toBeVisible();
    await scan(page, `批次閱讀版（${dark ? '深色' : '淺色'}）`);
    await context.close();
  });
}
