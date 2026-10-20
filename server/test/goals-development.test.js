import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

// 發展閉環（Sprint 20）：可改的檢視日、延後、追蹤紀錄、分享給教練（預設私密）、漏斗指標。

const JWT_SECRET = 'test-secret-please-change';
const DAY = 864e5;

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const u = { a: mk('學員甲', 'a@b.co'), b: mk('學員乙', 'b@b.co'), c: mk('學員丙', 'c@b.co'), coach: mk('教練', 'coach@b.co', 'coach'), coach2: mk('別班教練', 'coach2@b.co', 'coach'), admin: mk('管理員', 'admin@b.co', 'admin') };
  db.data.users.push(...Object.values(u));
  const group = { id: 'g1', name: '班', assessmentId: 'ai-competency', coachId: u.coach.id, memberIds: [u.a.id, u.b.id], startDate: new Date(Date.now() - DAY).toISOString(), endDate: null };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const agents = {};
  for (const [k, user] of Object.entries(u)) {
    const ag = request.agent(app);
    await ag.post('/api/auth/login').send({ email: user.email, password: 'abcdef12' });
    agents[k] = ag;
  }
  const mkGoal = async (who = 'a', body = {}) => (await agents[who].post('/api/goals').send({ assessmentId: 'ai-competency', text: '每週用 AI 做一份分析', actions: [{ text: '行動一' }], ...body })).body.goal;
  return { db, app, u, agents, group, mkGoal };
}

describe('預計檢視日可修改、可延後', () => {
  test('PATCH reviewDate：格式要正確；改了之後提醒信可以再寄', async () => {
    const { agents, db, mkGoal } = await setup();
    const g = await mkGoal();
    db.data.goals[0].reviewReminderSentAt = new Date().toISOString();
    const date = new Date(Date.now() + 10 * DAY).toISOString();
    const res = await agents.a.patch(`/api/goals/${g.id}`).send({ reviewDate: date });
    assert.equal(res.status, 200);
    assert.equal(res.body.goal.reviewDate, date);
    assert.equal(db.data.goals[0].reviewReminderSentAt, undefined);
    assert.equal((await agents.a.patch(`/api/goals/${g.id}`).send({ reviewDate: 'not-a-date' })).status, 400);
  });

  test('延後：預設 7 天，從「今天與原定日期較晚者」起算；次數有紀錄、天數有上限', async () => {
    const { agents, db, mkGoal } = await setup();
    const g = await mkGoal();
    db.data.goals[0].reviewDate = new Date(Date.now() - 3 * DAY).toISOString(); // 已逾期 3 天
    db.data.goals[0].reviewReminderSentAt = 'x';
    const r = await agents.a.post(`/api/goals/${g.id}/snooze`).send({});
    const days = (Date.parse(r.body.goal.reviewDate) - Date.now()) / DAY;
    assert.ok(days > 6.99 && days < 7.01, `逾期的目標從今天起算 7 天，得到 ${days}`);
    assert.equal(db.data.goals[0].snoozeCount, 1);
    assert.equal(db.data.goals[0].reviewReminderSentAt, undefined);
    const far = await agents.a.post(`/api/goals/${g.id}/snooze`).send({ days: 9999 });
    assert.ok((Date.parse(far.body.goal.reviewDate) - Date.parse(r.body.goal.reviewDate)) / DAY <= 60.01);
    assert.equal((await agents.b.post(`/api/goals/${g.id}/snooze`).send({})).status, 404, '別人的目標不能動');
  });
});

describe('追蹤紀錄', () => {
  test('一句話＋自評 1–5；至少要有其一；本人才能新增與刪除', async () => {
    const { agents, mkGoal } = await setup();
    const g = await mkGoal();
    const url = `/api/goals/${g.id}/checkins`;
    assert.equal((await agents.a.post(url).send({})).status, 400);
    assert.equal((await agents.a.post(url).send({ rating: 9 })).status, 400);
    const one = await agents.a.post(url).send({ text: '這週試了一次，主管給了回饋', rating: 4 });
    assert.equal(one.status, 201);
    const two = await agents.a.post(url).send({ rating: 2 });
    assert.equal(two.body.goal.checkins.length, 2);
    assert.equal(two.body.goal.checkins[0].text, '這週試了一次，主管給了回饋');
    assert.equal((await agents.b.post(url).send({ text: '偷寫' })).status, 404);
    const del = await agents.a.delete(`${url}/${one.body.goal.checkins[0].id}`);
    assert.equal(del.body.goal.checkins.length, 1);
  });
});

describe('分享給教練（預設私密）', () => {
  test('預設不分享；只接受布林值', async () => {
    const { agents, mkGoal } = await setup();
    const g = await mkGoal();
    assert.equal(g.sharedWithCoach, false);
    assert.equal((await agents.a.patch(`/api/goals/${g.id}`).send({ sharedWithCoach: 'yes' })).status, 400);
    assert.equal((await agents.a.patch(`/api/goals/${g.id}`).send({ sharedWithCoach: true })).body.goal.sharedWithCoach, true);
  });

  test('教練只看得到「本班成員、本班評量、已分享」的目標，且沒有追蹤筆記', async () => {
    const { agents, mkGoal, group } = await setup();
    const shared = await mkGoal('a', { text: '分享的目標' });
    await mkGoal('a', { text: '私密的目標' });
    await mkGoal('a', { text: '別的評量', assessmentId: 'disc' });
    const outsider = await mkGoal('c', { text: '不在班上的人' });
    await agents.a.patch(`/api/goals/${shared.id}`).send({ sharedWithCoach: true });
    const other = (await agents.a.get('/api/goals')).body.goals.find((g) => g.text === '別的評量');
    await agents.a.patch(`/api/goals/${other.id}`).send({ sharedWithCoach: true });
    await agents.c.patch(`/api/goals/${outsider.id}`).send({ sharedWithCoach: true });
    await agents.a.post(`/api/goals/${shared.id}/checkins`).send({ text: '這是只給自己看的筆記', rating: 3 });

    const view = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.deepEqual(view.body.sharedGoals.map((g) => g.text), ['分享的目標']);
    const g = view.body.sharedGoals[0];
    assert.equal(g.userName, '學員甲');
    assert.equal(g.checkinCount, 1);
    assert.equal(g.lastCheckin.rating, 3);
    assert.ok(!JSON.stringify(view.body.sharedGoals).includes('只給自己看的筆記'));
    assert.equal((await agents.coach2.get(`/api/coach/groups/${group.id}`)).status, 403, '別班教練看不到');
    assert.ok((await agents.admin.get(`/api/coach/groups/${group.id}`)).body.sharedGoals.length === 1);

    await agents.a.patch(`/api/goals/${shared.id}`).send({ sharedWithCoach: false });
    assert.equal((await agents.coach.get(`/api/coach/groups/${group.id}`)).body.sharedGoals.length, 0, '取消分享立即生效');
  });
});

describe('發展閉環漏斗（管理員）', () => {
  test('只有彙總數字；每一步各自計數', async () => {
    const { agents, db, mkGoal, u } = await setup();
    const g1 = await mkGoal('a');
    await mkGoal('b');
    await agents.a.patch(`/api/goals/${g1.id}`).send({ actions: [{ text: '行動一', done: true }], achieved: true, sharedWithCoach: true });
    await agents.a.post(`/api/goals/${g1.id}/checkins`).send({ text: 'x' });
    db.data.goals[0].reviewDate = new Date(Date.now() + DAY).toISOString();
    db.data.submissions.push({ id: 's1', userId: u.a.id, rateeId: u.a.id, raterType: 'self', assessmentId: 'ai-competency', createdAt: new Date(Date.now() + 2 * DAY).toISOString(), result: {} });
    const r = await agents.admin.get('/api/admin/development-funnel');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      assessedUsers: 1, usersWithGoal: 2, goals: 2, goalsWithDoneAction: 1, goalsWithCheckin: 1,
      goalsAchieved: 1, goalsRetestedInTime: 1, goalsShared: 1, goalsSnoozed: 0,
    });
    assert.equal((await agents.coach.get('/api/admin/development-funnel')).status, 403);
  });
});
