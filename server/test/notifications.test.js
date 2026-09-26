import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sendDueRetestReminders, notifyNewComment, COMMENT_NOTIFY_COOLDOWN_MS } from '../src/lib/notifications.js';
import { sanitizePreferences } from '../src/routes/auth.js';

// 學員通知信（Sprint 7 驗收條件 7.5、7.6、7.7）。

const DAY = 86400000;
const NOW = Date.parse('2026-10-01T00:00:00Z');

function world() {
  const db = createDb(':memory:');
  const learner = { id: randomUUID(), name: '小明', email: 'ming@b.co', role: 'user', preferences: {} };
  db.data.users.push(learner);
  const sent = [];
  const send = async (msg) => { sent.push(msg); return { ok: true }; };
  return { db, learner, sent, send };
}

function goal(userId, extra = {}) {
  return {
    id: randomUUID(), userId, assessmentId: 'ai-competency', text: '每週和團隊做一次一對一',
    dimensionName: '溝通協作', createdAt: new Date(NOW - 30 * DAY).toISOString(),
    reviewDate: new Date(NOW - DAY).toISOString(), ...extra,
  };
}

describe('sendDueRetestReminders()', () => {
  test('到期的目標寄一封；同一個目標再跑一次不重寄', async () => {
    const { db, learner, sent, send } = world();
    db.data.goals.push(goal(learner.id));
    assert.deepEqual(await sendDueRetestReminders(db, { now: NOW, send, configured: true }), { sent: 1, failed: 0 });
    assert.equal(sent[0].to, 'ming@b.co');
    assert.match(sent[0].subject, /回來複測/);
    assert.match(sent[0].text, /每週和團隊做一次一對一/);
    assert.match(sent[0].text, /AI 全方位職能實戰課前評測/);
    assert.match(sent[0].text, /通知偏好/);
    await sendDueRetestReminders(db, { now: NOW + DAY, send, configured: true });
    assert.equal(sent.length, 1);
  });

  test('還沒到期、已達成、已經複測過、關閉通知的都不寄', async () => {
    const { db, learner, sent, send } = world();
    const other = { id: randomUUID(), name: '關通知', email: 'off@b.co', role: 'user', preferences: { notifyAssessment: false } };
    db.data.users.push(other);
    db.data.goals.push(
      goal(learner.id, { reviewDate: new Date(NOW + DAY).toISOString() }),
      goal(learner.id, { achievedAt: new Date(NOW - 2 * DAY).toISOString() }),
      goal(other.id),
    );
    const retestedGoal = goal(learner.id, { assessmentId: 'disc' });
    db.data.goals.push(retestedGoal);
    db.data.submissions.push({ id: 's1', userId: learner.id, raterType: 'self', assessmentId: 'disc', createdAt: new Date(NOW - 5 * DAY).toISOString() });
    assert.deepEqual(await sendDueRetestReminders(db, { now: NOW, send, configured: true }), { sent: 0, failed: 0 });
    assert.equal(sent.length, 0);
  });

  test('未設定 SMTP 時整個略過、不做記號，之後設定好了照常寄', async () => {
    const { db, learner, sent, send } = world();
    const g = goal(learner.id);
    db.data.goals.push(g);
    await sendDueRetestReminders(db, { now: NOW, send, configured: false });
    assert.equal(sent.length, 0);
    assert.equal(g.reviewReminderSentAt, undefined);
    await sendDueRetestReminders(db, { now: NOW, send, configured: true });
    assert.equal(sent.length, 1);
  });

  test('寄送失敗不做記號，下一輪重試', async () => {
    const { db, learner } = world();
    const g = goal(learner.id);
    db.data.goals.push(g);
    const failing = async () => ({ ok: false, code: 'SEND_ERROR' });
    assert.deepEqual(await sendDueRetestReminders(db, { now: NOW, send: failing, configured: true }), { sent: 0, failed: 1 });
    assert.equal(g.reviewReminderSentAt, undefined);
  });
});

describe('notifyNewComment()', () => {
  function sub(userId, extra = {}) {
    return { id: randomUUID(), userId, raterType: 'self', assessmentId: 'ai-competency', createdAt: new Date(NOW - DAY).toISOString(), ...extra };
  }

  test('通知作答者有新評語，但信裡不含評語內容', async () => {
    const { db, learner, sent, send } = world();
    const s = sub(learner.id, { comments: [{ text: '你在會議中常打斷同事，要注意' }] });
    assert.equal(await notifyNewComment(db, s, '王教練', { now: NOW, send, configured: true }), 'sent');
    assert.equal(sent[0].to, 'ming@b.co');
    assert.match(sent[0].subject, /王教練給了您新的評語/);
    assert.doesNotMatch(sent[0].text, /打斷同事/);
    assert.match(sent[0].text, /我的分析/);
  });

  test('1 小時內反覆修改只通知一次；過了冷卻時間再通知', async () => {
    const { db, learner, sent, send } = world();
    const s = sub(learner.id);
    await notifyNewComment(db, s, '王教練', { now: NOW, send, configured: true });
    assert.equal(await notifyNewComment(db, s, '王教練', { now: NOW + 10 * 60 * 1000, send, configured: true }), 'skipped');
    assert.equal(sent.length, 1);
    await notifyNewComment(db, s, '王教練', { now: NOW + COMMENT_NOTIFY_COOLDOWN_MS + 1, send, configured: true });
    assert.equal(sent.length, 2);
  });

  test('關閉教練評語通知、他評作答、未設定 SMTP 時不寄', async () => {
    const { db, learner, sent, send } = world();
    learner.preferences.notifyComment = false;
    assert.equal(await notifyNewComment(db, sub(learner.id), '王教練', { now: NOW, send, configured: true }), 'skipped');
    learner.preferences.notifyComment = true;
    assert.equal(await notifyNewComment(db, sub(learner.id, { raterType: 'peer' }), '王教練', { now: NOW, send, configured: true }), 'skipped');
    assert.equal(await notifyNewComment(db, sub(learner.id), '王教練', { now: NOW, send, configured: false }), 'skipped');
    assert.equal(sent.length, 0);
  });

  test('寄送失敗時還原記號，下次存評語可以重試', async () => {
    const { db, learner } = world();
    const s = sub(learner.id);
    const failing = async () => ({ ok: false, code: 'SEND_ERROR' });
    assert.equal(await notifyNewComment(db, s, '王教練', { now: NOW, send: failing, configured: true }), 'failed');
    assert.equal('commentNotifiedAt' in s, false);
  });
});

describe('教練存評語時通知學員（路由整合）', () => {
  test('POST /submissions/:id/comment 會寄一封通知信給作答者', async (t) => {
    const saved = { SMTP_HOST: process.env.SMTP_HOST, SMTP_USER: process.env.SMTP_USER, SMTP_PASS: process.env.SMTP_PASS };
    Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_USER: 'bot@test', SMTP_PASS: 'x' });
    t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
    t.mock.method(console, 'log', () => {});
    const sent = [];
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (m) => { sent.push(m); } }));

    const db = createDb(':memory:');
    const coach = { id: randomUUID(), name: '王教練', email: 'coach@b.co', role: 'coach', passwordHash: await hashPassword('abcdef12') };
    const learner = { id: randomUUID(), name: '小明', email: 'ming@b.co', role: 'user' };
    db.data.users.push(coach, learner);
    db.data.groups.push({ id: 'g1', coachId: coach.id, memberIds: [learner.id], assessmentId: 'ai-competency' });
    db.data.submissions.push({ id: 's1', userId: learner.id, raterType: 'self', assessmentId: 'ai-competency', createdAt: new Date().toISOString(), result: {} });
    const agent = request.agent(createApp({ db, jwtSecret: 'test-secret-please-change' }));
    await agent.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });

    const res = await agent.post('/api/submissions/s1/comment').send({ text: '很有進步' });
    assert.equal(res.status, 200);
    await new Promise((r) => setTimeout(r, 50)); // 通知是回應後才非同步寄出
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ming@b.co');
    assert.doesNotMatch(sent[0].text, /很有進步/);
  });
});

describe('sanitizePreferences()（偏好設定白名單）', () => {
  test('只留已知鍵且型別正確；未知鍵與錯誤型別丟掉', () => {
    assert.deepEqual(
      sanitizePreferences({ darkMode: true, notifyComment: false, notifyAssessment: 'no', evil: 'x'.repeat(1000), defaultAssessmentId: 'disc' }),
      { darkMode: true, notifyComment: false, defaultAssessmentId: 'disc' },
    );
    assert.deepEqual(sanitizePreferences({ defaultAssessmentId: null }), { defaultAssessmentId: null });
  });

  test('PATCH /auth/profile 不會存入未知鍵', async () => {
    const db = createDb(':memory:');
    const agent = request.agent(createApp({ db, jwtSecret: 'test-secret-please-change' }));
    await agent.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    const res = await agent.patch('/api/auth/profile').send({ preferences: { notifyComment: false, junk: 1 } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user.preferences, { notifyComment: false });
  });
});
