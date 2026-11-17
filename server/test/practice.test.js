import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sendPracticeNudges } from '../src/lib/notifications.js';
import { WEEK_MS } from '../src/routes/practice.js';

// 課後四週微練習（Sprint 38）。

const JWT_SECRET = 'test-secret-please-change';
const TASKS = ['第一週：請同事複述', '第二週：先聽完再說', '第三週：會後寫一句回顧', '第四週：回頭看哪個做法最有效'];

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const a = mk('學員甲', 'a@b.co');
  const b = mk('學員乙', 'b@b.co');
  db.data.users.push(a, b);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const agent = async (u) => { const ag = request.agent(app); await ag.post('/api/auth/login').send({ email: u.email, password: 'abcdef12' }); return ag; };
  return { db, a, b, A: await agent(a), B: await agent(b) };
}
const start = (ag, body = {}) => ag.post('/api/practice').send({ assessmentId: 'leadership-9d', dimensionId: 'communication', dimensionName: '溝通力', tasks: TASKS, ...body });

describe('微練習 API', () => {
  test('開始：要 4 週的內容；第 1 週才看得到內容，後面週次只有編號；同時只能一組', async () => {
    const { A } = await setup();
    assert.equal((await A.get('/api/practice')).body.practice, null);
    assert.equal((await start(A, { tasks: TASKS.slice(0, 3) })).status, 400);
    const res = await start(A);
    assert.equal(res.status, 201);
    const p = res.body.practice;
    assert.equal(p.currentWeek, 1);
    assert.equal(p.active, true);
    assert.deepEqual(p.weeks.map((w) => w.task), [TASKS[0], null, null, null]);
    assert.equal((await start(A)).status, 409);
  });

  test('勾選：只能勾已經開始的週；可以取消；只有本人看得到', async () => {
    const { A, B, db, a } = await setup();
    await start(A);
    assert.equal((await A.post('/api/practice/weeks/2').send({})).status, 400);
    const done = await A.post('/api/practice/weeks/1').send({});
    assert.ok(done.body.practice.weeks[0].doneAt);
    const undo = await A.post('/api/practice/weeks/1').send({ done: false });
    assert.equal(undo.body.practice.weeks[0].doneAt, null);
    // 往回撥 8 天＝第 2 週
    db.data.users.find((u) => u.id === a.id).practice.startedAt = new Date(Date.now() - 8 * 864e5).toISOString();
    const p = (await A.get('/api/practice')).body.practice;
    assert.equal(p.currentWeek, 2);
    assert.equal(p.weeks[1].task, TASKS[1]);
    assert.equal((await A.post('/api/practice/weeks/2').send({})).status, 200);
    assert.equal((await B.get('/api/practice')).body.practice, null);
  });

  test('結束：之後不能勾、可以重新開始新的一組；四週後自動結束', async () => {
    const { A, db, a } = await setup();
    await start(A);
    const stopped = (await A.delete('/api/practice')).body.practice;
    assert.equal(stopped.active, false);
    assert.equal((await A.post('/api/practice/weeks/1').send({})).status, 404);
    assert.equal((await start(A)).status, 201);
    db.data.users.find((u) => u.id === a.id).practice.startedAt = new Date(Date.now() - 29 * 864e5).toISOString();
    const p = (await A.get('/api/practice')).body.practice;
    assert.equal(p.finished, true);
    assert.equal(p.active, false);
    assert.equal((await start(A)).status, 201);
  });
});

describe('微練習提醒信', () => {
  const now = Date.now();
  const world = async (startedDaysAgo, extra = {}) => {
    const { db, a, A } = await setup();
    await start(A);
    const u = db.data.users.find((x) => x.id === a.id);
    u.practice.startedAt = new Date(now - startedDaysAgo * 864e5).toISOString();
    Object.assign(u, extra);
    return { db, u };
  };
  const mail = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return { ok: true }; } }; };

  test('第 1 週不寄；第 2 週寄一次本週內容、不重複寄', async () => {
    const w1 = await world(2);
    const m1 = mail();
    assert.equal((await sendPracticeNudges(w1.db, { now, send: m1.send, configured: true })).sent, 0);
    const w2 = await world(8);
    const m2 = mail();
    await sendPracticeNudges(w2.db, { now, send: m2.send, configured: true });
    await sendPracticeNudges(w2.db, { now, send: m2.send, configured: true });
    assert.equal(m2.sent.length, 1);
    assert.match(m2.sent[0].subject, /第 2 週/);
    assert.match(m2.sent[0].text, /先聽完再說/);
    assert.doesNotMatch(m2.sent[0].text, /分數|平均/);
  });

  test('跳過的週不補寄：直接到第 3 週只寄第 3 週', async () => {
    const { db } = await world(15);
    const m = mail();
    await sendPracticeNudges(db, { now, send: m.send, configured: true });
    assert.equal(m.sent.length, 1);
    assert.match(m.sent[0].subject, /第 3 週/);
  });

  test('結束、關閉提醒、未設定 SMTP、超過四週：都不寄', async () => {
    const stopped = await world(8);
    stopped.u.practice.stoppedAt = new Date().toISOString();
    const off = await world(8, { preferences: { notifyAssessment: false } });
    const over = await world(30);
    for (const { db } of [stopped, off, over]) {
      const m = mail();
      await sendPracticeNudges(db, { now, send: m.send, configured: true });
      assert.equal(m.sent.length, 0);
    }
    const nosmtp = await world(8);
    const m = mail();
    await sendPracticeNudges(nosmtp.db, { now, send: m.send, configured: false });
    assert.equal(m.sent.length, 0);
    assert.ok(WEEK_MS > 0);
  });
});
