import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const DAY = 86400000;
async function world(assessmentId = 'ai-competency') {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString(), preferences: {} });
  const coach = mk('王教練', 'coach@b.co', 'coach');
  const other = mk('別人', 'o@b.co', 'coach');
  const ms = Array.from({ length: 5 }, (_, i) => mk(`學員${i}`, `m${i}@b.co`));
  db.data.users.push(coach, other, ...ms);
  const group = { id: randomUUID(), name: '工作台班', assessmentId, coachId: coach.id, coachName: coach.name, memberIds: ms.map((m) => m.id), excludedUserIds: [], startDate: new Date(Date.now() - DAY).toISOString(), endDate: null };
  db.data.groups.push(group);
  const sub = (m, extra = {}) => ({ id: randomUUID(), userId: m.id, rateeId: m.id, raterType: 'self', assessmentId, groupId: group.id, phase: 'pre', createdAt: new Date().toISOString(), result: { total: 100 }, comments: [], ...extra });
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
  return { db, group, ms, sub, coachAgent: await login('coach@b.co'), otherAgent: await login('o@b.co') };
}

describe('GET /api/coach/workbench', () => {
  test('每班待辦只有人數：未作答、未寫評語、沒設定目標；沒有任何姓名', async () => {
    const { db, group, ms, sub, coachAgent } = await world();
    db.data.submissions.push(sub(ms[0]), sub(ms[1], { comments: [{ id: 'c', coachId: db.data.users.find((u) => u.role === 'coach').id, text: 'x' }] }));
    db.data.goals.push({ id: randomUUID(), userId: ms[0].id, assessmentId: 'ai-competency', text: 't', createdAt: new Date().toISOString(), checkins: [] });
    const res = await coachAgent.get('/api/coach/workbench');
    assert.equal(res.status, 200);
    const w = res.body.groups.find((g) => g.id === group.id);
    assert.equal(w.notDone, 3);
    assert.equal(w.uncommented, 1);
    assert.equal(w.noGoal, 4);
    assert.equal(w.ratersLow, null);
    assert.doesNotMatch(JSON.stringify(res.body), /學員\d|m\d@b\.co/);
  });

  test('360° 題庫：他評不足的受評者人數；別班教練看不到這個班', async () => {
    const { db, group, ms, sub, coachAgent, otherAgent } = await world('leadership-360-70');
    db.data.submissions.push(sub(ms[0]), sub(ms[1]));
    const rate = (rater, ratee, type) => ({ ...sub(rater), userId: rater.id, rateeId: ratee.id, raterType: type });
    db.data.submissions.push(rate(ms[2], ms[0], 'manager'), rate(ms[3], ms[0], 'peer')); // 甲：同儕只有 1 位 → 不足；乙：沒有他評 → 不足
    const w = (await coachAgent.get('/api/coach/workbench')).body.groups.find((g) => g.id === group.id);
    assert.equal(w.ratersLow, 2);
    assert.equal((await otherAgent.get('/api/coach/workbench')).body.groups.length, 0);
  });

  test('排除名單不影響「沒設定目標」人數（差分攻擊）', async () => {
    const { group, ms, coachAgent, db } = await world();
    const before = (await coachAgent.get('/api/coach/workbench')).body.groups.find((g) => g.id === group.id).noGoal;
    db.data.groups[0].excludedUserIds = [ms[0].id];
    const after = (await coachAgent.get('/api/coach/workbench')).body.groups.find((g) => g.id === group.id).noGoal;
    assert.equal(after, before);
  });
});
