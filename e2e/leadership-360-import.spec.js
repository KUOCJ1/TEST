import { test, expect, request as pwRequest } from '@playwright/test';
import { acceptConsentIfAsked } from './helpers.js';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';

// 客戶專案（森永高階教練 360）：管理員批次匯入 70 題 360 → 建班、加入成員 → 教練後台看得到班級、成員與 360° 結果。
// 資料是合成的（不含任何真實客戶資料）。

const API = 'http://localhost:3001';
const ID = 'leadership-360-70';
const cfg = getAssessment(ID);

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

const answers = (base, jitter = 0) => Object.fromEntries(cfg.ALL_QUESTIONS.map((q, i) => [q.id, Math.max(1, Math.min(5, base + ((i + jitter) % 3 === 0 ? -1 : 0)))]));
const row = (ratee, rateeName, raterType, rater, raterName, base, jitter) => {
  const a = answers(base, jitter);
  return { rateeEmail: ratee, rateeName, raterType, raterEmail: rater, raterName, answers: a, result: buildResult(a, cfg) };
};

test('批次匯入 70 題 360 → 建班加入成員 → 教練後台看得到結果', async ({ browser }) => {
  test.setTimeout(120000);
  const sfx = Date.now();
  const e = (n) => `e2e-360-${n}-${sfx}@placeholder.invalid`;
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');

  const rows = [
    row(e('a'), '受評者甲', 'self', '', '', 5, 0),
    row(e('a'), '受評者甲', 'manager', e('m'), '主管乙', 3, 1),
    row(e('a'), '受評者甲', 'subordinate', e('s1'), '部屬一', 4, 2),
    row(e('a'), '受評者甲', 'subordinate', e('s2'), '部屬二', 4, 0),
    row(e('a'), '受評者甲', 'subordinate', e('s3'), '部屬三', 3, 1),
  ];
  const imp = await ok(await admin.post('/api/admin/batch-import', { data: { assessmentId: ID, rows } }), 'import');
  expect(imp.added).toBe(5);
  expect(imp.usersCreated).toBe(5);

  // 管理員建班（班級使用這份 360 評量），直接加入匯入的帳號。
  const { group } = await ok(await admin.post('/api/coach/groups', { data: { name: `森永 360 ${sfx}`, companyName: '森永', assessmentId: ID } }), 'group');
  const users = (await ok(await admin.get('/api/admin/overview'), 'overview')).users ?? [];
  const ids = ['a', 'm', 's1', 's2', 's3'].map((n) => users.find((u) => u.email === e(n))?.id).filter(Boolean);
  expect(ids).toHaveLength(5);
  await ok(await admin.put(`/api/coach/groups/${group.id}`, { data: { memberIds: ids } }), 'members');

  // 故意開一個用 L9D 的班、成員一樣：模擬「評量選錯」，總覽要提醒。
  const { group: wrong } = await ok(await admin.post('/api/coach/groups', { data: { name: `用錯評量 ${sfx}`, companyName: '森永', assessmentId: 'leadership-9d' } }), 'wrong group');
  await ok(await admin.put(`/api/coach/groups/${wrong.id}`, { data: { memberIds: ids } }), 'wrong members');

  const context = await browser.newContext({ storageState: await admin.storageState(), viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  // 管理員帳號第一次登入要先同意隱私權政策。
  await acceptConsentIfAsked(page);
  await page.getByRole('button', { name: '教練後台', exact: true }).click();
  // 管理員看得到所有班級（CI 上前面的測試也建過班），不會自動選取：自己點這個班。
  await page.getByText(`森永 360 ${sfx}`, { exact: true }).first().click({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: `森永 360 ${sfx}` })).toBeVisible({ timeout: 20000 });
  // 自評結果在班級總覽的成員表裡，落點用 L9D 的等級名稱。
  await expect(page.getByText('受評者甲').first()).toBeVisible({ timeout: 15000 });
  // 成員比較表只列「有自評的受評者」；評分者（部屬一、主管乙…）不會被當成拿到成績的成員，
  // 受評者那一列顯示他收到的他評摘要（人數與各類評分者）。
  const table = page.getByRole('region', { name: '成員比較表' });
  await expect(table).toContainText('受評者甲');
  await expect(table).not.toContainText('部屬一');
  await expect(table).not.toContainText('主管乙');
  await expect(table).toContainText('4 人');
  await expect(table).toContainText('主管 1');
  await expect(table).toContainText('部屬 3');
  await expect(page.getByText(/領導/).first()).toBeVisible();
  // 360° 完整報告：從成員表開啟，有各頁內容（整體評價、自評 vs 他評、構面詳述、發展建議）。
  await page.getByRole('button', { name: '產出 受評者甲 的 360° 完整報告' }).click();
  const doc = page.locator('#report-portal');
  await expect(doc.getByText('360° 完整回饋報告').first()).toBeVisible({ timeout: 15000 });
  await expect(doc.getByText('整體評價').first()).toBeVisible();
  await expect(doc.getByText('各構面：自評與各類評分者')).toBeVisible();
  await expect(doc.getByText('構面與子能力詳述')).toBeVisible();
  await expect(doc.getByText('發展建議').first()).toBeVisible();
  await expect(doc.getByText('部屬 3 位', { exact: false }).first()).toBeVisible();
  // 評分者只以類別呈現，不出現姓名。
  await expect(doc).not.toContainText('部屬一');
  await expect(doc).not.toContainText('主管乙');
  // 對的班級沒有警告；選到用錯評量的班，總覽最上方提醒「成員的匯入作答屬於別份評量」。
  await page.getByRole('button', { name: '✕ 關閉' }).click();
  await expect(page.getByText('請先確認這個班的資料')).toHaveCount(0);
  await page.getByText(`用錯評量 ${sfx}`, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: `用錯評量 ${sfx}` })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('請先確認這個班的資料')).toBeVisible();
  await expect(page.getByText(/批次匯入的作答屬於/)).toBeVisible();
  await context.close();
  await admin.dispose();
});
