import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { purgeDueDeletions, DELETION_GRACE_MS } from '../src/lib/accountDeletion.js';

// 學員自助下載資料與刪除帳號（Sprint 39）。

const JWT_SECRET = 'test-secret-please-change';
const result = (total) => ({ total, percent: 60, level: { id: 'x', badge: 'x' }, dimensions: [{ id: 'd', name: 'd', average: 3, subs: [] }] });

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const a = mk('學員甲', 'a@b.co');
  const b = mk('學員乙', 'b@b.co');
  const coach = mk('教練', 'coach@b.co', 'coach');
  db.data.users.push(a, b, coach);
  const group = { id: 'g1', name: '示範班', assessmentId: 'leadership-360-70', coachId: coach.id, memberIds: [a.id, b.id], startDate: new Date(Date.now() - 864e5).toISOString(), endDate: null };
  db.data.groups.push(group);
  const sub = (o) => ({ id: randomUUID(), assessmentId: 'leadership-360-70', groupId: 'g1', createdAt: new Date().toISOString(), result: result(200), answers: { q1: 3 }, ...o });
  db.data.submissions.push(
    sub({ userId: a.id, userName: a.name, raterType: 'self', comments: [{ id: 'c1', coachId: coach.id, coachName: '教練', text: '做得好', tips: [] }] }),
    sub({ userId: b.id, userName: b.name, raterType: 'self' }),
    sub({ userId: a.id, userName: a.name, rateeId: b.id, raterType: 'peer' }), // 甲 評 乙
    sub({ userId: b.id, userName: b.name, rateeId: a.id, raterType: 'peer' }), // 乙 評 甲
  );
  db.data.goals.push({ id: 'goal1', userId: a.id, text: '目標', actions: [], createdAt: new Date().toISOString() });
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const agent = async (u) => { const ag = request.agent(app); await ag.post('/api/auth/login').send({ email: u.email, password: 'abcdef12' }); return ag; };
  return { db, a, b, coach, group, A: await agent(a), C: await agent(coach) };
}

describe('下載我的資料', () => {
  test('只含本人的資料：自評（含教練評語）、我給別人的評分、目標；不含別人對我的個別評分', async () => {
    const { A } = await setup();
    const res = await A.get('/api/me/export');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /attachment; filename="my-data-\d{4}-\d{2}-\d{2}\.json"/);
    const d = res.body;
    assert.equal(d.account.email, 'a@b.co');
    assert.equal(d.selfAssessments.length, 1);
    assert.equal(d.selfAssessments[0].coachComments[0].text, '做得好');
    assert.equal(d.ratingsGivenToOthers.length, 1);
    assert.equal(d.ratingsGivenToOthers[0].rateeId, undefined);
    assert.equal(d.goals.length, 1);
    assert.doesNotMatch(JSON.stringify(d), /學員乙/);
  });
});

describe('申請刪除帳號', () => {
  test('要密碼；教練不能自助刪除', async () => {
    const { A, C } = await setup();
    assert.equal((await A.post('/api/me/deletion').send({ password: 'wrong' })).status, 400);
    assert.equal((await C.post('/api/me/deletion').send({ password: 'abcdef12' })).status, 409);
  });

  test('申請後：立刻從班級報告消失（含別人對他的評分），他給別人的評分還在；只能看帳號、下載、取消', async () => {
    const { A, C, db, a, b } = await setup();
    const res = await A.post('/api/me/deletion').send({ password: 'abcdef12' });
    assert.equal(res.status, 200);
    const when = new Date(res.body.user.deletionScheduledFor).getTime();
    assert.ok(Math.abs(when - (Date.now() + DELETION_GRACE_MS)) < 60000);
    const detail = (await C.get('/api/coach/groups/g1')).body;
    assert.ok(!detail.members.some((m) => m.id === a.id));
    const subs = detail.submissions;
    assert.ok(!subs.some((s) => s.userId === a.id && (s.raterType ?? 'self') === 'self'));
    assert.ok(!subs.some((s) => s.rateeId === a.id));
    assert.ok(subs.some((s) => s.rateeId === b.id && s.raterType === 'peer'), '甲給乙的評分仍在乙的報告裡');
    assert.equal(db.data.goals.length, 0);
    // 等待期間：其他功能 423；帳號、下載、取消可以
    assert.equal((await A.get('/api/goals')).status, 423);
    assert.equal((await A.get('/api/auth/me')).status, 200);
    assert.equal((await A.get('/api/me/export')).body.selfAssessments.length, 1, '等待期間仍可下載（從暫存區）');
  });

  test('取消：原封回到班級與報告', async () => {
    const { A, C, db, a } = await setup();
    const before = db.data.submissions.length;
    await A.post('/api/me/deletion').send({ password: 'abcdef12' });
    const res = await A.post('/api/me/deletion/cancel');
    assert.equal(res.body.user.deletionScheduledFor, null);
    assert.equal(db.data.submissions.length, before);
    assert.equal(db.data.goals.length, 1);
    assert.ok(db.data.groups[0].memberIds.includes(a.id));
    assert.ok((await C.get('/api/coach/groups/g1')).body.members.some((m) => m.id === a.id));
    assert.equal((await A.get('/api/goals')).status, 200);
  });

  test('到期永久刪除：帳號與本人資料消失；給別人的評分去識別化保留；稽核紀錄不留 Email', async () => {
    const { A, db, a, b } = await setup();
    await A.post('/api/me/deletion').send({ password: 'abcdef12' });
    assert.equal(purgeDueDeletions(db, Date.now()), 0, '還沒到期不刪');
    assert.equal(purgeDueDeletions(db, Date.now() + DELETION_GRACE_MS + 1000), 1);
    assert.ok(!db.data.users.some((u) => u.id === a.id));
    const json = JSON.stringify(db.data.submissions);
    assert.doesNotMatch(json, new RegExp(a.id));
    assert.doesNotMatch(json, /學員甲/);
    const kept = db.data.submissions.find((s) => s.rateeId === b.id && s.raterType === 'peer');
    assert.ok(kept, '甲給乙的評分保留');
    assert.match(kept.userId, /^deleted-/);
    assert.equal(kept.answers, undefined);
    assert.ok(!db.data.groups[0].memberIds.includes(a.id));
    assert.ok(!db.data.auditLog.some((e) => e.actorEmail === 'a@b.co'));
    assert.ok(db.data.auditLog.some((e) => e.action === 'account_purged'));
    // 刪除後的 cookie 失效
    assert.equal((await A.get('/api/auth/me')).status, 401);
  });
});
