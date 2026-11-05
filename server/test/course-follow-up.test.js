import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sendDueCourseFollowUps, sanitizeFollowUpAnswers, followUpStatus, followUpProgress, MAX_LATE_DAYS } from '../src/lib/courseFollowUp.js';
import { COURSE_SURVEY_ID } from '../src/lib/courseSurvey.js';

const DAY = 864e5;
const T0 = Date.parse('2026-10-30T02:00:00Z');

function seed({ consent = true, email = 'a@b.co', disabled = false } = {}) {
  const db = createDb(':memory:');
  const user = { id: randomUUID(), name: '學員', email, role: 'user', disabled, passwordHash: null, createdAt: new Date(T0).toISOString() };
  db.data.users.push(user);
  const sub = { id: randomUUID(), userId: user.id, assessmentId: COURSE_SURVEY_ID, surveyGroupId: 'g1', createdAt: new Date(T0).toISOString(), answers: { d7: consent ? 'yes' : 'no' }, result: { course: { followUpConsent: consent } } };
  db.data.submissions.push(sub);
  return { db, user, sub };
}
const mailer = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return { ok: true }; } }; };

describe('追蹤信排程', () => {
  test('30 天到期才寄、每人每階段只寄一次；信裡有連結、不含個別答案承諾以外的內容', async () => {
    const { db } = seed(); const m = mailer();
    assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 29 * DAY, send: m.send, configured: true }), { sent: 0, failed: 0 });
    assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 30 * DAY, send: m.send, configured: true }), { sent: 1, failed: 0 });
    assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 30 * DAY + 3600e3, send: m.send, configured: true }), { sent: 0, failed: 0 });
    assert.equal(m.sent.length, 1);
    assert.match(m.sent[0].subject, /30 天追蹤/);
    assert.match(m.sent[0].text, /\?followup=30/);
    assert.match(m.sent[0].text, /取消勾選/);
    assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 60 * DAY, send: m.send, configured: true }), { sent: 1, failed: 0 });
    assert.match(m.sent[1].text, /\?followup=60/);
    assert.equal(db.data.courseFollowUps.length, 2);
  });
  test('沒同意、撤回後、停用帳號、占位 Email、沒設定 SMTP：都不寄', async () => {
    for (const opts of [{ consent: false }, { disabled: true }, { email: 'x@p.invalid' }]) {
      const { db } = seed(opts); const m = mailer();
      assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 31 * DAY, send: m.send, configured: true }), { sent: 0, failed: 0 });
      assert.equal(m.sent.length, 0);
    }
    const { db } = seed(); const m = mailer();
    assert.deepEqual(await sendDueCourseFollowUps(db, { now: T0 + 31 * DAY, send: m.send, configured: false }), { sent: 0, failed: 0 });
    // 撤回：已同意但之後改成不同意 → 不再寄
    const s = seed(); s.sub.result.course.followUpConsent = false;
    assert.deepEqual(await sendDueCourseFollowUps(s.db, { now: T0 + 31 * DAY, send: m.send, configured: true }), { sent: 0, failed: 0 });
  });
  test('寄失敗不留紀錄（下次再試）；到期太久（超過容許天數）不補寄', async () => {
    const { db } = seed();
    const bad = await sendDueCourseFollowUps(db, { now: T0 + 31 * DAY, send: async () => ({ ok: false }), configured: true });
    assert.deepEqual(bad, { sent: 0, failed: 1 });
    assert.equal(db.data.courseFollowUps.length, 0);
    const late = await sendDueCourseFollowUps(db, { now: T0 + (30 + MAX_LATE_DAYS + 1) * DAY, send: mailer().send, configured: true });
    assert.equal(late.sent, 0);
  });
});

describe('追蹤問卷答案清洗', () => {
  const ok30 = { f1: 'half', f2: ['time', 'time', 'data'], f3: 'built', f4: 'weekly12', f5: '1to3', f6: 'no', f7: '  很有幫助  ', evil: 'x' };
  test('只留白名單欄位、去重複、字串修剪；必填沒答、選項不認得、格式錯都丟錯', () => {
    const a = sanitizeFollowUpAnswers(30, ok30);
    assert.deepEqual(a, { f1: 'half', f2: ['time', 'data'], f3: 'built', f4: 'weekly12', f5: '1to3', f6: 'no', f7: '很有幫助' });
    assert.throws(() => sanitizeFollowUpAnswers(30, { ...ok30, f1: undefined }), /f1 必填/);
    assert.throws(() => sanitizeFollowUpAnswers(30, { ...ok30, f3: 'zzz' }), /不認得/);
    assert.throws(() => sanitizeFollowUpAnswers(30, { ...ok30, f2: 'time' }), /格式/);
    assert.throws(() => sanitizeFollowUpAnswers(99, ok30), /階段/);
    assert.equal(sanitizeFollowUpAnswers(30, { ...ok30, f7: 'x'.repeat(900) }).f7.length, 500);
  });
});

describe('API：我的狀態與送出', () => {
  async function login(consent = true) {
    const pw = await hashPassword('abcdef12');
    const { db, user, sub } = seed({ consent, email: 'm@b.co' });
    user.passwordHash = pw;
    const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
    const ag = request.agent(app);
    await ag.post('/api/auth/login').send({ email: 'm@b.co', password: 'abcdef12' });
    return { db, ag, user, sub };
  }
  const ans30 = { f1: 'done', f3: 'reused', f4: 'daily', f5: 'gt5', f6: 'yes' };

  test('還沒到期 → 狀態 not_due、送出 403；到期後可送出一次，再送 409', async () => {
    const { db, ag, sub } = await login();
    let res = await ag.get('/api/course-follow-ups/me');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((i) => i.status), ['not_due', 'not_due']);
    assert.equal((await ag.post('/api/course-follow-ups/30').send({ answers: ans30 })).status, 403);
    // 把課後問卷的日期改到 31 天前
    sub.createdAt = new Date(Date.now() - 31 * DAY).toISOString();
    res = await ag.get('/api/course-follow-ups/me');
    assert.deepEqual(res.body.items.map((i) => i.status), ['available', 'not_due']);
    assert.equal((await ag.post('/api/course-follow-ups/30').send({ answers: ans30 })).status, 201);
    assert.equal((await ag.post('/api/course-follow-ups/30').send({ answers: ans30 })).status, 409);
    assert.equal((await ag.get('/api/course-follow-ups/me')).body.items[0].status, 'completed');
    assert.equal(db.data.courseFollowUps.length, 1);
    assert.equal(db.data.courseFollowUps[0].answers.f1, 'done');
  });
  test('答案不合法 400；沒有課後問卷紀錄的人 404；沒登入 401', async () => {
    const { ag, sub, db, user } = await login();
    sub.createdAt = new Date(Date.now() - 31 * DAY).toISOString();
    assert.equal((await ag.post('/api/course-follow-ups/30').send({ answers: { f1: 'done' } })).status, 400);
    assert.equal((await ag.post('/api/course-follow-ups/7').send({ answers: ans30 })).status, 400);
    db.data.submissions.length = 0;
    assert.equal((await ag.post('/api/course-follow-ups/30').send({ answers: ans30 })).status, 404);
    assert.deepEqual((await ag.get('/api/course-follow-ups/me')).body.items, []);
    assert.equal((await request(createApp({ db, jwtSecret: 'x' })).get('/api/course-follow-ups/me')).status, 401);
    assert.ok(user);
  });
  test('撤回同意後，已經到期的人仍可自己填，但狀態不會主動開放給沒紀錄的人', async () => {
    const { ag, sub, db, user } = await login(false);
    sub.createdAt = new Date(Date.now() - 31 * DAY).toISOString();
    assert.equal((await ag.get('/api/course-follow-ups/me')).body.items[0].status, 'not_due');
    assert.equal(followUpStatus(db, user.id)[0].status, 'not_due');
  });
});

describe('班級完成率（只有人數與比例）', () => {
  test('到期人數少於 3 人不顯示；3 人以上顯示完成人數與比例', () => {
    const db = createDb(':memory:');
    const subs = [1, 2, 3].map((i) => ({ userId: `u${i}`, createdAt: new Date(T0).toISOString(), answers: { d7: 'yes' } }));
    assert.deepEqual(followUpProgress(db, subs.slice(0, 2), T0 + 31 * DAY).stage30, { hidden: true });
    db.data.courseFollowUps = [{ userId: 'u1', stage: 30, completedAt: 'x' }, { userId: 'u2', stage: 30, completedAt: null }];
    assert.deepEqual(followUpProgress(db, subs, T0 + 31 * DAY).stage30, { due: 3, completed: 1, rate: 33 });
    assert.deepEqual(followUpProgress(db, subs, T0 + 31 * DAY).stage60, { hidden: true });
    // 沒同意的人不計入
    const mixed = [...subs.slice(0, 2), { userId: 'u9', createdAt: new Date(T0).toISOString(), answers: { d7: 'no' } }];
    assert.deepEqual(followUpProgress(db, mixed, T0 + 31 * DAY).stage30, { hidden: true });
  });
});
