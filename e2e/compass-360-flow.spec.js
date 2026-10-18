import { test, expect, request as pwRequest } from '@playwright/test';
import * as compass from '../src/survey/data/assessments/leadership-compass.js';

// 領導力羅盤 360° 的完整流程（端對端）：邀請 → 評分 → 人數門檻 → 彙整顯示 → 管理員還原與稽核。
// 作答用 API 直接送（37 題的填答畫面已由 learner-golden-path 覆蓋），畫面只驗證與隱私相關的部分。

const API = 'http://localhost:3001';
const PW = 'abcdef12';
const ID = 'leadership-compass';
const day = 864e5;

async function ok(res, label) {
  expect(res.ok(), `${label}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

function payload(rater, avgAnswer = 4) {
  const view = compass.selectForm('short');
  const answers = Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, avgAnswer]));
  return { answers, result: compass.SCORING.buildResult(answers, view, { rater }), assessmentId: ID, phase: 'pre' };
}

async function newUser(name, email) {
  const ctx = await pwRequest.newContext({ baseURL: API });
  const reg = await ok(await ctx.post('/api/auth/register', { data: { acceptPolicy: true, name, email, password: PW } }), name);
  return { ctx, id: reg.user.id, name, email };
}

test('羅盤 360°：沒有邀請不能評；同類滿 3 位才顯示；教練看不到身分；管理員還原要理由並留稽核', async ({ browser }) => {
  const sfx = Date.now();
  const admin = await pwRequest.newContext({ baseURL: API });
  await ok(await admin.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'E2eTest1234' } }), 'admin login');
  await ok(await admin.patch(`/api/admin/assessments/${ID}`, { data: { enabled: true } }), 'enable compass');

  try {
    // 教練與班級（作答期間先開著，結束後再關閉並發佈）。
    const coach = await newUser('羅盤教練', `c360-coach-${sfx}@example.com`);
    await ok(await admin.patch(`/api/admin/users/${coach.id}/role`, { data: { role: 'coach' } }), 'promote');
    await ok(await coach.ctx.post('/api/auth/login', { data: { email: coach.email, password: PW } }), 'coach login');

    const ratee = await newUser('受評者小明', `c360-ratee-${sfx}@example.com`);
    const peers = [];
    for (let i = 1; i <= 3; i += 1) peers.push(await newUser(`同儕${i}`, `c360-peer${i}-${sfx}@example.com`));
    const outsider = await newUser('局外人', `c360-out-${sfx}@example.com`);

    const g = await ok(await coach.ctx.post('/api/coach/groups', { data: { name: `羅盤班 ${sfx}`, assessmentId: ID } }), 'group');
    const gid = g.group.id;
    await ok(await coach.ctx.put(`/api/coach/groups/${gid}`, {
      data: { startDate: new Date(Date.now() - day).toISOString(), endDate: new Date(Date.now() + day).toISOString() },
    }), 'open window');
    // 管理員可直接調整成員（教練對已有帳號的人只能邀請）。
    await ok(await admin.put(`/api/coach/groups/${gid}`, { data: { memberIds: [ratee.id, ...peers.map((p) => p.id)] } }), 'members');

    // 沒有邀請：直接對受評者送他評 → 403。局外人不在班上，也不能被邀請。
    const noInvite = await peers[0].ctx.post('/api/submissions', { data: { ...payload('other'), rateeId: ratee.id, raterType: 'peer' } });
    expect(noInvite.status()).toBe(403);
    expect((await noInvite.json()).code).toBe('NO_INVITE');
    const notInGroup = await ratee.ctx.post('/api/rater-invites', { data: { assessmentId: ID, raterUserId: outsider.id, raterType: 'peer' } });
    expect(notInGroup.status()).toBe(403);

    // 受評者自評，並邀請兩位同儕。
    await ok(await ratee.ctx.post('/api/submissions', { data: payload('self') }), 'self');
    for (const p of peers.slice(0, 2)) {
      await ok(await ratee.ctx.post('/api/rater-invites', { data: { assessmentId: ID, raterUserId: p.id, raterType: 'peer' } }), 'invite');
    }

    // 畫面：受評者在「360° 評測」看得到邀請；被邀請的同儕看得到「等你評測的人」。
    const rateeCtx = await browser.newContext({ storageState: await ratee.ctx.storageState() });
    const rateePage = await rateeCtx.newPage();
    await rateePage.goto('/360');
    await rateePage.getByRole('tab', { name: '領導力羅盤八向評測' }).click({ timeout: 20000 });
    await expect(rateePage.getByRole('heading', { name: '邀請別人評我' })).toBeVisible({ timeout: 20000 });
    await expect(rateePage.getByRole('list', { name: '已發出的邀請' })).toContainText('同儕1');
    await expect(rateePage.getByRole('list', { name: '已發出的邀請' })).not.toContainText(/已完成/);

    const peerCtx = await browser.newContext({ storageState: await peers[0].ctx.storageState() });
    const peerPage = await peerCtx.newPage();
    await peerPage.goto('/360');
    await peerPage.getByRole('tab', { name: '領導力羅盤八向評測' }).click({ timeout: 20000 });
    await expect(peerPage.getByRole('heading', { name: '等你評測的人' })).toBeVisible({ timeout: 20000 });
    await expect(peerPage.locator('li', { hasText: '受評者小明' })).toBeVisible();
    await expect(peerPage.getByRole('button', { name: '開始評測' })).toBeVisible();

    // 兩位同儕評分；同一邀請不能重複送出。
    for (const p of peers.slice(0, 2)) {
      await ok(await p.ctx.post('/api/submissions', { data: { ...payload('other'), rateeId: ratee.id, raterType: 'peer' } }), 'peer submit');
    }
    const dup = await peers[0].ctx.post('/api/submissions', { data: { ...payload('other'), rateeId: ratee.id, raterType: 'peer' } });
    expect(dup.status()).toBe(409);

    // 教練看得到回收份數，但不是誰評的、也沒有分數。
    const coachView = await ok(await coach.ctx.get(`/api/coach/groups/${gid}`), 'coach view');
    const coachPeerRows = coachView.submissions.filter((s) => s.raterType === 'peer');
    expect(coachPeerRows).toHaveLength(2);
    expect(coachPeerRows.every((s) => s.userId === 'anonymous' && !s.result)).toBeTruthy();
    expect(JSON.stringify(coachView.submissions)).not.toContain('同儕1');

    // 第 3 位同儕被邀請並評分。
    await ok(await ratee.ctx.post('/api/rater-invites', { data: { assessmentId: ID, raterUserId: peers[2].id, raterType: 'peer' } }), 'invite 3');
    await ok(await peers[2].ctx.post('/api/submissions', { data: { ...payload('other', 2), rateeId: ratee.id, raterType: 'peer' } }), 'peer 3');

    // 結束作答並發佈後，受評者才看得到報告。
    await ok(await coach.ctx.put(`/api/coach/groups/${gid}`, { data: { endDate: new Date(Date.now() - 1000).toISOString() } }), 'close');
    await ok(await coach.ctx.post(`/api/coach/groups/${gid}/publish`), 'publish');

    const view = await ok(await ratee.ctx.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${ID}`), 'ratee view');
    const others = view.submissions.filter((s) => s.raterType !== 'self');
    expect(others.map((s) => s.raterType).sort()).toEqual(['others', 'peer']);
    expect(others.every((s) => s.aggregate && s.count === 3 && s.userId === 'anonymous')).toBeTruthy();
    expect(JSON.stringify(view)).not.toMatch(/同儕[123]/);

    await rateePage.goto('/360');
    await rateePage.getByRole('tab', { name: '領導力羅盤八向評測' }).click({ timeout: 20000 });
    await expect(rateePage.getByText(/依 3 位他評者的平均/)).toBeVisible({ timeout: 20000 });
    // 受評者自己邀請的名單看得到名字（那是他自己選的），但名單與報告都不會標示誰已經評完。
    await expect(rateePage.getByRole('list', { name: '已發出的邀請' })).not.toContainText(/已完成|已評/);

    // 管理員還原身分：沒理由不行、非管理員不行；有理由才看得到，並寫入稽核紀錄。
    const noReason = await admin.post(`/api/submissions/ratee/${ratee.id}/reveal`, { data: { assessmentId: ID, reason: '' } });
    expect(noReason.status()).toBe(400);
    expect((await coach.ctx.post(`/api/submissions/ratee/${ratee.id}/reveal`, { data: { assessmentId: ID, reason: '教練想看看是誰評的' } })).status()).toBe(403);
    const reveal = await ok(await admin.post(`/api/submissions/ratee/${ratee.id}/reveal`, { data: { assessmentId: ID, reason: 'E2E 驗證：確認稽核紀錄' } }), 'reveal');
    expect(reveal.submissions.filter((s) => s.raterType === 'peer').map((s) => s.userName).sort()).toEqual(['同儕1', '同儕2', '同儕3']);
    const audit = await ok(await admin.get('/api/admin/audit-log?action=view_rater_identity'), 'audit');
    expect(audit.entries.some((e) => e.rateeId === ratee.id && e.reason === 'E2E 驗證：確認稽核紀錄')).toBeTruthy();

    for (const c of [rateeCtx, peerCtx]) await c.close();
    for (const u of [coach, ratee, outsider, ...peers]) await u.ctx.dispose();
  } finally {
    await admin.patch(`/api/admin/assessments/${ID}`, { data: { enabled: false } });
    await admin.dispose();
  }
});
