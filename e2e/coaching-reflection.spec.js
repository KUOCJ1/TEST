import { test, expect, request as pwRequest } from '@playwright/test';
import { buildResult } from '../src/survey/utils/scoring.js';
import { getAssessment } from '../src/survey/data/assessments/index.js';
import { acceptConsentIfAsked } from './helpers.js';

// 教練會談與會後反思（Sprint 40）：教練寫評語 → 從成員抽屜安排一對一會談 → 學員在我的學習看到評語並填反思
// （行動變成目標）→ 教練看全文並回覆 → 學員看到回覆。

const API = 'http://localhost:3001';
const l9d = getAssessment('leadership-9d');
const resultOf = () => buildResult(Object.fromEntries(l9d.ALL_QUESTIONS.map((q) => [q.id, 4])), l9d);
const ok = async (res, label) => { expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy(); return res.json(); };

test('一對一會談 → 會後反思 → 教練回覆', async ({ browser }) => {
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin');
  const coach = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await coach.post('/api/auth/register', { data: { acceptPolicy: true, name: '會談教練', email: `e2e-sess-coach-${sfx}@example.com`, password: 'abcdef12' } }), 'coach');
  await ok(await admin.patch(`/api/admin/users/${reg.user.id}/role`, { data: { role: 'coach' } }), 'promote');
  await ok(await coach.post('/api/auth/login', { data: { email: `e2e-sess-coach-${sfx}@example.com`, password: 'abcdef12' } }), 'coach login');
  const { group } = await ok(await coach.post('/api/coach/groups', { data: { name: `會談班 ${sfx}`, assessmentId: 'leadership-9d' } }), 'group');
  const { group: g } = await ok(await coach.post(`/api/coach/groups/${group.id}/join-code`), 'code');
  const learner = await pwRequest.newContext({ baseURL: API });
  await ok(await learner.post('/api/auth/register', { data: { acceptPolicy: true, name: '會談學員', email: `e2e-sess-s-${sfx}@example.com`, password: 'abcdef12', joinCode: g.joinCode } }), 'learner');
  const { submission } = await ok(await learner.post('/api/submissions', { data: { assessmentId: 'leadership-9d', phase: 'pre', result: resultOf(), answers: {} } }), 'submit');
  await ok(await coach.post(`/api/submissions/${submission.id}/comment`, { data: { text: '溝通很清楚，下一步練授權。', tips: ['每週交辦一件事'] } }), 'comment');

  // 教練：成員抽屜 → 安排一對一會談
  const cctx = await browser.newContext({ storageState: await coach.storageState(), viewport: { width: 1280, height: 900 } });
  const cp = await cctx.newPage();
  await cp.goto('/');
  await acceptConsentIfAsked(cp);
  await cp.getByRole('button', { name: '教練後台', exact: true }).click();
  await expect(cp.getByRole('heading', { name: `會談班 ${sfx}` })).toBeVisible({ timeout: 20000 });
  await cp.getByRole('button', { name: '查看 會談學員 的報告' }).first().click();
  await cp.getByRole('button', { name: /安排一對一會談/ }).click();
  await expect(cp.getByRole('radio', { name: '一對一教練' })).toBeChecked();
  await cp.getByRole('button', { name: '建立會談' }).click();
  await expect(cp.getByText('已繳 0／1')).toBeVisible();

  // 學員：首頁提示 → 我的學習 → 看到教練評語 → 填反思（行動變成目標）
  const lctx = await browser.newContext({ storageState: await learner.storageState(), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const lp = await lctx.newPage();
  await lp.goto('/home');
  await acceptConsentIfAsked(lp);
  await lp.getByRole('button', { name: /待填會後反思 1 份/ }).click();
  const panel = lp.getByRole('region', { name: '會後反思' });
  await expect(panel).toContainText('溝通很清楚，下一步練授權。');
  await panel.getByLabel(/最大的收穫/).fill('我習慣自己做完，沒有交出去');
  await panel.getByLabel(/一個行動/).fill('這週交辦一份週報給小王，週五一起看');
  await panel.getByRole('radio', { name: '5' }).check({ force: true });
  await panel.getByRole('checkbox', { name: /變成我的發展目標/ }).check();
  await panel.getByRole('button', { name: '送出反思' }).click();
  await expect(panel).toContainText('已設成發展目標');
  const overflow = await lp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // 教練：看全文並回覆
  await cp.reload();
  await cp.getByRole('button', { name: '會談', exact: true }).click();
  await expect(cp.getByText('已繳 1／1')).toBeVisible({ timeout: 15000 });
  await cp.getByText(/看反思內容/).click();
  await expect(cp.getByText('我習慣自己做完，沒有交出去')).toBeVisible();
  await cp.getByLabel('回覆 會談學員').fill('很好的開始，週五見。');
  await cp.getByRole('button', { name: /^回覆$/ }).click();
  await expect(cp.getByRole('button', { name: '更新回覆' })).toBeVisible();

  // 學員看到回覆
  await lp.reload();
  await expect(lp.getByRole('region', { name: '會後反思' })).toContainText('很好的開始，週五見。');
  await cctx.close();
  await lctx.close();
});
