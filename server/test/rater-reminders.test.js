import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

// Sprint 27：提醒尚未完成的評分者；批次匯出稽核。
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]]));
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'bot@example.com', SMTP_PASS: 'secret', APP_URL: 'https://assess.test' });
});
afterEach(() => { for (const k of SMTP_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

async function world(assessmentId = 'leadership-360-70') {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString(), preferences: {} });
  const coach = mk('王教練', 'coach@b.co', 'coach');
  const other = mk('別班教練', 'other@b.co', 'coach');
  const ratee = mk('受評者', 'ratee@b.co');
  const r1 = mk('評分者一', 'r1@b.co');
  const r2 = mk('評分者二', 'r2@b.co');
  const r3 = mk('評分者三', 'r3@b.co');
  db.data.users.push(coach, other, ratee, r1, r2, r3);
  const group = { id: randomUUID(), name: '森永班', assessmentId, coachId: coach.id, coachName: coach.name, memberIds: [ratee.id, r1.id, r2.id, r3.id], excludedUserIds: [] };
  db.data.groups.push(group);
  const inv = (rater, used = []) => ({ id: randomUUID(), assessmentId, groupId: group.id, rateeId: ratee.id, raterUserId: rater.id, raterType: 'peer', status: 'pending', usedPhases: used });
  db.data.raterInvites.push(inv(r1), inv(r2, ['pre']), inv(r3));
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
  return { db, group, coachAgent: await login('coach@b.co'), otherAgent: await login('other@b.co') };
}
const mockSmtp = (t) => {
  const sent = [];
  t.mock.method(console, 'log', () => {});
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (m) => { sent.push(m); } }));
  return sent;
};

describe('POST /api/coach/groups/:id/remind-raters', () => {
  test('只寄給尚未完成的評分者；回應只有人數；信裡不含受評者姓名；之後 1 小時冷卻', async (t) => {
    const { group, coachAgent } = await world();
    const sent = mockSmtp(t);
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind-raters`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { sent: 2 });
    assert.deepEqual(sent.map((m) => m.to).sort(), ['r1@b.co', 'r3@b.co']);
    assert.doesNotMatch(sent[0].text, /受評者/);
    assert.equal((await coachAgent.post(`/api/coach/groups/${group.id}/remind-raters`)).status, 429);
  });

  test('嚴格隱私題庫（領導力羅盤）拒絕；別班教練 403；未設定 SMTP 503', async (t) => {
    mockSmtp(t);
    const strict = await world('leadership-compass');
    assert.equal((await strict.coachAgent.post(`/api/coach/groups/${strict.group.id}/remind-raters`)).status, 409);
    const w = await world();
    assert.equal((await w.otherAgent.post(`/api/coach/groups/${w.group.id}/remind-raters`)).status, 403);
    delete process.env.SMTP_HOST;
    assert.equal((await w.coachAgent.post(`/api/coach/groups/${w.group.id}/remind-raters`)).status, 503);
  });
});

describe('POST /api/coach/groups/:id/report-export', () => {
  test('記錄稽核；份數被限制範圍；別班教練 403', async (t) => {
    t.mock.method(console, 'log', () => {});
    const { db, group, coachAgent, otherAgent } = await world();
    assert.equal((await coachAgent.post(`/api/coach/groups/${group.id}/report-export`).send({ count: 12 })).status, 200);
    const entry = (db.data.auditLog ?? []).find((e) => e.action === 'export_360_batch');
    assert.ok(entry);
    assert.equal(entry.groupId ?? entry.extra?.groupId, group.id);
    assert.equal((await otherAgent.post(`/api/coach/groups/${group.id}/report-export`).send({ count: 3 })).status, 403);
  });
});
