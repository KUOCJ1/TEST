import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sendReflectionReminders } from '../src/lib/notifications.js';
import { coachingSummaryForGroup } from '../src/lib/coaching.js';
import { requestDeletion, purgeUser, exportUserData } from '../src/lib/accountDeletion.js';

// 教練會談與會後反思（Sprint 40）。

const JWT_SECRET = 'test-secret-please-change';
const DAY = 864e5;

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const u = { a: mk('學員甲', 'a@b.co'), b: mk('學員乙', 'b@b.co'), c: mk('學員丙', 'c@b.co'), out: mk('別班學員', 'o@b.co'), coach: mk('教練', 'coach@b.co', 'coach'), coach2: mk('別班教練', 'coach2@b.co', 'coach') };
  db.data.users.push(...Object.values(u));
  db.data.groups.push({ id: 'g1', name: '領導力班', assessmentId: 'leadership-9d', coachId: u.coach.id, memberIds: [u.a.id, u.b.id, u.c.id], startDate: new Date(Date.now() - DAY).toISOString(), endDate: null });
  db.data.submissions.push({ id: 's1', userId: u.a.id, raterType: 'self', assessmentId: 'leadership-9d', groupId: 'g1', createdAt: new Date().toISOString(), result: { total: 300 }, comments: [{ id: 'c1', coachId: u.coach.id, coachName: '教練', text: '溝通很清楚，下一步練授權。', tips: ['每週交辦一件事'], createdAt: new Date().toISOString() }] });
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const ag = {};
  for (const [k, user] of Object.entries(u)) { ag[k] = request.agent(app); await ag[k].post('/api/auth/login').send({ email: user.email, password: 'abcdef12' }); }
  const create = (body = {}, who = 'coach') => ag[who].post('/api/coach/groups/g1/sessions').send({ type: 'team', title: '團隊教練第一次', sessionDate: new Date().toISOString(), participantIds: [u.a.id, u.b.id, u.c.id], ...body });
  const answer = { insight: '我發現自己太快給答案', action: '下次會議先問三個問題', support: '希望主管給我回饋', rating: 4, ratingNote: '節奏剛好' };
  return { db, u, ag, create, answer };
}

describe('建立會談', () => {
  test('教練建立：期限預設會後 3 天；一對一只能一位；參與者必須是本班成員；別班教練不行', async () => {
    const { ag, u, create } = await setup();
    const res = await create();
    assert.equal(res.status, 201);
    const s = res.body.session;
    assert.equal(Math.round((new Date(s.dueAt) - new Date(s.sessionDate)) / DAY), 3);
    assert.deepEqual(s.participants.map((p) => p.status), ['pending', 'pending', 'pending']);
    assert.equal((await create({ type: 'one-on-one' })).status, 400);
    assert.equal((await create({ participantIds: [u.out.id] })).status, 400);
    assert.equal((await create({}, 'coach2')).status, 403);
    assert.equal((await create({}, 'a')).status, 403);
    assert.equal((await ag.coach2.get('/api/coach/groups/g1/sessions')).status, 403);
  });
});

describe('學員繳交反思', () => {
  test('學員看得到自己的待填、教練的評語；繳交要收穫、行動與 1–5 分；可把行動變成目標（只建一次）', async () => {
    const { ag, u, create, answer, db } = await setup();
    const sid = (await create({ type: 'one-on-one', participantIds: [u.a.id] })).body.session.id;
    const list = (await ag.a.get('/api/reflections')).body.sessions;
    assert.equal(list.length, 1);
    assert.equal(list[0].coachComment.text, '溝通很清楚，下一步練授權。');
    assert.equal(list[0].reflection, null);
    assert.equal((await ag.b.get('/api/reflections')).body.sessions.length, 0);
    assert.equal((await ag.a.put(`/api/reflections/${sid}`).send({ ...answer, rating: 9 })).status, 400);
    assert.equal((await ag.a.put(`/api/reflections/${sid}`).send({ ...answer, action: '' })).status, 400);
    const ok = await ag.a.put(`/api/reflections/${sid}`).send({ ...answer, makeGoal: true });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.session.reflection.goalId);
    await ag.a.put(`/api/reflections/${sid}`).send({ ...answer, makeGoal: true });
    assert.equal(db.data.goals.filter((g) => g.userId === u.a.id).length, 1);
    assert.equal(db.data.goals[0].sharedWithCoach, false);
    assert.equal((await ag.b.put(`/api/reflections/${sid}`).send(answer)).status, 404, '不是參與者不能交');
  });

  test('教練看全文並可回覆；學員看得到回覆；有人繳交後不能刪除會談', async () => {
    const { ag, u, create, answer } = await setup();
    const sid = (await create()).body.session.id;
    await ag.a.put(`/api/reflections/${sid}`).send(answer);
    const s = (await ag.coach.get('/api/coach/groups/g1/sessions')).body.sessions[0];
    const pa = s.participants.find((p) => p.userId === u.a.id);
    assert.equal(pa.status, 'submitted');
    assert.equal(pa.reflection.insight, answer.insight);
    await ag.coach.post(`/api/coach/sessions/${sid}/reflections/${u.a.id}/reply`).send({ text: '很好的覺察，下次我們從第一個問題開始。' });
    const mine = (await ag.a.get('/api/reflections')).body.sessions[0];
    assert.equal(mine.reflection.coachReply.text, '很好的覺察，下次我們從第一個問題開始。');
    assert.equal((await ag.coach.delete(`/api/coach/sessions/${sid}`)).status, 409);
    assert.equal((await ag.coach2.post(`/api/coach/sessions/${sid}/reflections/${u.a.id}/reply`).send({ text: 'x' })).status, 404, '別班教練看不到這場會談（不透露是否存在）');
  });

  test('逾期仍可繳交但標示逾期', async () => {
    const { ag, create, answer } = await setup();
    const past = new Date(Date.now() - 10 * DAY).toISOString();
    const sid = (await create({ sessionDate: past })).body.session.id;
    assert.equal((await ag.a.get('/api/reflections')).body.sessions[0].overdue, true);
    const r = (await ag.a.put(`/api/reflections/${sid}`).send(answer)).body.session.reflection;
    assert.equal(r.late, true);
  });
});

describe('彙總、提醒、工作台', () => {
  test('班級彙總只有數字；回饋少於 3 份不給平均', async () => {
    const { ag, db, create, answer } = await setup();
    const sid = (await create()).body.session.id;
    await ag.a.put(`/api/reflections/${sid}`).send(answer);
    await ag.b.put(`/api/reflections/${sid}`).send({ ...answer, rating: 2 });
    let sum = coachingSummaryForGroup(db, 'g1');
    assert.deepEqual({ ...sum }, { sessions: 1, oneOnOne: 0, team: 1, assigned: 3, submitted: 2, rate: 67, avgRating: null, ratingCount: 2 });
    await ag.c.put(`/api/reflections/${sid}`).send({ ...answer, rating: 3 });
    sum = coachingSummaryForGroup(db, 'g1');
    assert.equal(sum.avgRating, 3);
    const detail = (await ag.coach.get('/api/coach/groups/g1')).body;
    assert.deepEqual(detail.coachingSummary.submitted, 3);
    assert.doesNotMatch(JSON.stringify(detail.coachingSummary), /學員|insight|收穫/);
  });

  test('第 2 天提醒還沒交的人，每人一次；已交的不寄；工作台有待繳份數', async () => {
    const { ag, db, create, answer } = await setup();
    const sid = (await create({ sessionDate: new Date(Date.now() - 2 * DAY - 60000).toISOString() })).body.session.id;
    await ag.a.put(`/api/reflections/${sid}`).send(answer);
    const sent = [];
    const send = async (m) => { sent.push(m); return { ok: true }; };
    await sendReflectionReminders(db, { send, configured: true });
    await sendReflectionReminders(db, { send, configured: true });
    assert.equal(sent.length, 2);
    assert.ok(sent.every((m) => /會後反思還沒填/.test(m.subject)));
    assert.ok(!sent.some((m) => m.to === 'a@b.co'));
    const w = (await ag.coach.get('/api/coach/workbench')).body.groups.find((g) => g.id === 'g1');
    assert.equal(w.reflectionsPending, 2);
  });

  test('還沒到第 2 天不寄', async () => {
    const { db, create } = await setup();
    await create();
    const sent = [];
    await sendReflectionReminders(db, { send: async (m) => { sent.push(m); return { ok: true }; }, configured: true });
    assert.equal(sent.length, 0);
  });
});

describe('與刪除帳號、下載資料的整合', () => {
  test('下載資料包含自己的反思；刪除時反思一起移出，取消後回來，永久刪除後從會談移除', async () => {
    const { ag, db, u, create, answer } = await setup();
    const sid = (await create()).body.session.id;
    await ag.a.put(`/api/reflections/${sid}`).send(answer);
    const user = db.data.users.find((x) => x.id === u.a.id);
    assert.equal(exportUserData(db, user).coachingReflections[0].insight, answer.insight);
    requestDeletion(db, user);
    assert.equal(db.data.sessionReflections.length, 0);
    const s = (await ag.coach.get('/api/coach/groups/g1/sessions')).body.sessions[0];
    assert.ok(!s.participants.some((p) => p.userId === u.a.id), '等待刪除的人不出現在會談名單');
    purgeUser(db, user);
    assert.ok(!db.data.coachingSessions[0].participantIds.includes(u.a.id));
    assert.equal(db.data.sessionReflections.length, 0);
  });
});
