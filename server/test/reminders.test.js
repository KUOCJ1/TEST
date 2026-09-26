import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { REMINDER_COOLDOWN_MS } from '../src/routes/coach.js';

// 教練「寄送提醒信」（Sprint 6 驗收條件 6.5、6.6）。

const JWT_SECRET = 'test-secret-please-change';
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]]));
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'bot@example.com';
  process.env.SMTP_PASS = 'secret';
  process.env.APP_URL = 'https://assess.test';
});
afterEach(() => {
  for (const k of SMTP_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

function user(name, email, role = 'user') {
  return { id: randomUUID(), name, email, role, createdAt: new Date().toISOString() };
}

function submission(userId, groupId, phase) {
  return {
    id: randomUUID(), userId, rateeId: userId, raterType: 'self', assessmentId: 'ai-competency',
    groupId, phase, createdAt: new Date().toISOString(), answers: {}, result: { total: 100 },
  };
}

/**
 * 一個進行中的班：三位成員（done 已做課前、todo1/todo2 還沒做）＋一位待加入。
 */
async function setupClass({ startDate = new Date(Date.now() - 86400000).toISOString(), pendingMembers = [] } = {}) {
  const db = createDb(':memory:');
  const coach = { ...user('王教練', 'coach@b.co', 'coach'), passwordHash: await hashPassword('abcdef12') };
  const other = { ...user('李教練', 'other@b.co', 'coach'), passwordHash: await hashPassword('abcdef12') };
  const done = user('已完成', 'done@b.co');
  const todo1 = user('小明', 'ming@b.co');
  const todo2 = user('小華', 'hua@b.co');
  db.data.users.push(coach, other, done, todo1, todo2);
  const group = {
    id: randomUUID(), name: 'AI 實戰班', companyName: '榕耀', assessmentId: 'ai-competency',
    coachId: coach.id, coachName: coach.name, memberIds: [done.id, todo1.id, todo2.id],
    pendingMembers, startDate, endDate: null, publishedAt: null, joinCode: 'ABC123',
  };
  db.data.groups.push(group);
  db.data.submissions.push(submission(done.id, group.id, 'pre'));

  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'abcdef12' });
    return agent;
  };
  return { db, app, group, users: { done, todo1, todo2 }, coachAgent: await login('coach@b.co'), otherAgent: await login('other@b.co') };
}

function mockSmtp(t, { failFor = [] } = {}) {
  const sent = [];
  t.mock.method(console, 'log', () => {}); // auditLog
  t.mock.method(console, 'error', () => {});
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (msg) => {
      if (failFor.includes(msg.to)) throw new Error('550 mailbox unavailable');
      sent.push(msg);
    },
  }));
  return sent;
}

describe('POST /api/coach/groups/:id/remind', () => {
  test('只寄給課前還沒完成的成員（含待加入名單），一人一封、內容個人化並附報到連結', async (t) => {
    const { group, coachAgent } = await setupClass({ pendingMembers: [{ name: '新同學', email: 'new@b.co' }] });
    const sent = mockSmtp(t);

    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 200);
    assert.equal(res.body.phase, 'pre');
    assert.equal(res.body.sent, 3);
    assert.deepEqual(res.body.failed, []);
    assert.ok(res.body.group.lastReminderSentAt);

    assert.deepEqual(sent.map((m) => m.to).sort(), ['hua@b.co', 'ming@b.co', 'new@b.co']);
    const ming = sent.find((m) => m.to === 'ming@b.co');
    assert.match(ming.subject, /AI 實戰班.*課前/);
    assert.match(ming.text, /小明 您好/);
    assert.match(ming.text, /https:\/\/assess\.test\/\?join=ABC123/);
    assert.match(ming.text, /王教練/);
  });

  test('全員課前都完成後改催課後，只寄給課前已完成、課後還沒做的人', async (t) => {
    const { db, group, users, coachAgent } = await setupClass();
    db.data.submissions.push(
      submission(users.todo1.id, group.id, 'pre'),
      submission(users.todo2.id, group.id, 'pre'),
      submission(users.done.id, group.id, 'post'),
    );
    const sent = mockSmtp(t);

    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.body.phase, 'post');
    assert.deepEqual(sent.map((m) => m.to).sort(), ['hua@b.co', 'ming@b.co']);
    assert.match(sent[0].subject, /課後/);
  });

  test('1 小時內再按一次回 429 並附剩餘秒數，不會重複寄', async (t) => {
    const { group, coachAgent } = await setupClass();
    const sent = mockSmtp(t);
    await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    const again = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(again.status, 429);
    assert.equal(again.body.code, 'REMINDER_COOLDOWN');
    assert.ok(again.body.retryAfterSeconds > 0 && again.body.retryAfterSeconds <= REMINDER_COOLDOWN_MS / 1000);
    assert.equal(sent.length, 2, '第二次不該再寄');
  });

  test('冷卻時間過了可以再寄', async (t) => {
    const { db, group, coachAgent } = await setupClass();
    mockSmtp(t);
    db.data.groups[0].lastReminderSentAt = new Date(Date.now() - REMINDER_COOLDOWN_MS - 1000).toISOString();
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 200);
  });

  test('全部寄送失敗（通常是 SMTP 設定錯）時不進冷卻，修好後可以馬上重試', async (t) => {
    const { db, group, coachAgent } = await setupClass();
    mockSmtp(t, { failFor: ['ming@b.co', 'hua@b.co'] });
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sent, 0);
    assert.deepEqual(res.body.failed.sort(), ['hua@b.co', 'ming@b.co']);
    assert.equal(db.data.groups[0].lastReminderSentAt, undefined);
  });

  test('部分失敗時回報失敗名單，成功的仍進冷卻', async (t) => {
    const { db, group, coachAgent } = await setupClass();
    mockSmtp(t, { failFor: ['hua@b.co'] });
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.body.sent, 1);
    assert.deepEqual(res.body.failed, ['hua@b.co']);
    assert.ok(db.data.groups[0].lastReminderSentAt);
  });

  test('沒有人需要提醒時回 sent:0，不進冷卻', async (t) => {
    const { db, group, users, coachAgent } = await setupClass();
    for (const u of [users.todo1, users.todo2]) db.data.submissions.push(submission(u.id, group.id, 'pre'));
    for (const u of Object.values(users)) db.data.submissions.push(submission(u.id, group.id, 'post'));
    const sent = mockSmtp(t);
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sent, 0);
    assert.equal(sent.length, 0);
    assert.equal(db.data.groups[0].lastReminderSentAt, undefined);
  });

  test('未設定 SMTP 時回 503 CONFIG_ERROR，完全不嘗試寄信', async (t) => {
    const { group, coachAgent } = await setupClass();
    delete process.env.SMTP_HOST;
    const create = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('不該被呼叫'); });
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 503);
    assert.equal(res.body.code, 'CONFIG_ERROR');
    assert.equal(create.mock.callCount(), 0);
  });

  test('不在施測期間（尚未開始）時回 409，不寄信', async (t) => {
    const { group, coachAgent } = await setupClass({ startDate: null });
    const sent = mockSmtp(t);
    const res = await coachAgent.post(`/api/coach/groups/${group.id}/remind`);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'NOT_IN_PROGRESS');
    assert.equal(sent.length, 0);
  });

  test('非本班教練回 403；班級不存在回 404', async (t) => {
    const { group, otherAgent, coachAgent } = await setupClass();
    const sent = mockSmtp(t);
    assert.equal((await otherAgent.post(`/api/coach/groups/${group.id}/remind`)).status, 403);
    assert.equal((await coachAgent.post('/api/coach/groups/nope/remind')).status, 404);
    assert.equal(sent.length, 0);
  });
});
