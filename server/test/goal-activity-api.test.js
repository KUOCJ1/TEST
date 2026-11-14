import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

// Sprint 26：班級行動概況、提醒未設定目標者、回訪紀錄與管理端彙總。
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]]));
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'bot@example.com', SMTP_PASS: 'secret', APP_URL: 'https://assess.test' });
});
afterEach(() => { for (const k of SMTP_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

async function world(memberCount = 4) {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString(), preferences: {} });
  const coach = mk('王教練', 'coach@b.co', 'coach');
  const admin = mk('管理員', 'admin@b.co', 'admin');
  const members = Array.from({ length: memberCount }, (_, i) => mk(`學員${i}`, `m${i}@b.co`));
  db.data.users.push(coach, admin, ...members);
  const group = { id: randomUUID(), name: 'AI 班', assessmentId: 'ai-competency', coachId: coach.id, coachName: coach.name, memberIds: members.map((m) => m.id), excludedUserIds: [] };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
  return { db, group, members, coachAgent: await login('coach@b.co'), adminAgent: await login('admin@b.co'), login };
}
const mockSmtp = (t) => {
  const sent = [];
  t.mock.method(console, 'log', () => {});
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (m) => { sent.push(m); } }));
  return sent;
};

describe('班級行動概況與提醒', () => {
  test('group 詳情帶 goalSummary（只有人數）', async () => {
    const { db, group, members, coachAgent } = await world(4);
    db.data.goals.push({ id: randomUUID(), userId: members[0].id, assessmentId: 'ai-competency', text: 't', createdAt: new Date().toISOString(), checkins: [{ id: 'c', at: new Date().toISOString() }] });
    const res = await coachAgent.get(`/api/coach/groups/${group.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.goalSummary, { hidden: false, members: 4, withGoal: 1, recentCheckin: 1, noGoal: 3, recentDays: 14 });
    assert.doesNotMatch(JSON.stringify(res.body.goalSummary), /學員/);
  });

  test('提醒只寄給沒有目標、且沒關閉評測提醒的人；之後 1 小時冷卻；回應不含收件人', async (t) => {
    const { db, group, members, coachAgent } = await world(5);
    const sent = mockSmtp(t);
    db.data.goals.push({ id: randomUUID(), userId: members[0].id, assessmentId: 'ai-competency', text: 't', createdAt: new Date().toISOString(), checkins: [] });
    members[1].preferences = { notifyAssessment: false };
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind-goals`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { sent: 3 });
    assert.deepEqual(sent.map((m) => m.to).sort(), ['m2@b.co', 'm3@b.co', 'm4@b.co']);
    assert.match(sent[0].text, /就做這件事/);
    assert.equal((await coachAgent.post(`/api/coach/groups/${group.id}/remind-goals`)).status, 429);
  });

  test('成員少於 3 位：409；未設定 SMTP：503；別班教練：403', async (t) => {
    const small = await world(2);
    mockSmtp(t);
    assert.equal((await small.coachAgent.post(`/api/coach/groups/${small.group.id}/remind-goals`)).status, 409);
    const big = await world(4);
    const other = { id: randomUUID(), name: '別人', email: 'o@b.co', role: 'coach', passwordHash: await hashPassword('abcdef12'), preferences: {} };
    big.db.data.users.push(other);
    const otherAgent = await big.login('o@b.co');
    assert.equal((await otherAgent.post(`/api/coach/groups/${big.group.id}/remind-goals`)).status, 403);
    delete process.env.SMTP_HOST;
    assert.equal((await big.coachAgent.post(`/api/coach/groups/${big.group.id}/remind-goals`)).status, 503);
  });
});

describe('回訪紀錄', () => {
  test('登入後的請求會記下今天；publicUser 不外洩；管理端 retention 只有彙總', async () => {
    const { db, group, members, adminAgent, login } = await world(4);
    const agent = await login('m0@b.co');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.ok(members[0].activeDays?.length === 1);
    assert.doesNotMatch(JSON.stringify(me.body), /activeDays/);
    const res = await adminAgent.get('/api/admin/retention');
    assert.equal(res.status, 200);
    const row = res.body.groups.find((g) => g.id === group.id);
    assert.equal(row.d7.hidden, true);
    assert.doesNotMatch(JSON.stringify(res.body), /activeDays|m0@b\.co/);
    assert.equal(db.data.users.find((u) => u.id === members[0].id).activeDays.length, 1);
  });
});
