import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { issueVerifyToken, buildVerificationMail, VERIFY_TTL_MS } from '../src/lib/emailVerification.js';
import { newMemberInvite } from '../src/lib/memberInvites.js';

// 推廣期的試用帳號與 Email 驗證（見 lib/trial.js、lib/emailVerification.js）。

const JWT_SECRET = 'test-secret-please-change';
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]]));
  delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  process.env.APP_URL = 'https://assess.test';
});
afterEach(() => { for (const k of SMTP_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

function sampleResult(total = 124) {
  return {
    total, maxScore: 155, percent: Math.round((total / 155) * 100),
    level: { id: 'advanced', badge: '等級', color: '#805ad5' },
    dimensions: [{ id: 'foundation', subtitle: '基礎力', name: '工具認知', color: '#2b6cb0', score: 20, max: 25, average: 4, percent: 80, rating: { label: '熟練', tone: 'good' } }],
    strongest: { subtitle: '基礎力' }, weakest: { subtitle: '基礎力' },
  };
}

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const coach = { id: randomUUID(), name: '教練', email: 'coach@b.co', role: 'coach', passwordHash: pw, createdAt: new Date().toISOString() };
  const admin = { id: randomUUID(), name: '管理員', email: 'admin@b.co', role: 'admin', passwordHash: pw, createdAt: new Date().toISOString() };
  db.data.users.push(coach, admin);
  const group = {
    id: randomUUID(), name: 'L9D 班', assessmentId: 'leadership-9d', coachId: coach.id, memberIds: [],
    startDate: new Date(Date.now() - 864e5).toISOString(), endDate: null, publishedAt: null, joinCode: 'QRCODE12',
  };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const register = async (body) => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({ acceptPolicy: true, name: '試用者', password: 'abcdef12', ...body });
    return { agent, res };
  };
  const admAgent = request.agent(app);
  await admAgent.post('/api/auth/login').send({ email: 'admin@b.co', password: 'abcdef12' });
  return { db, app, group, coach, register, admAgent };
}

describe('試用帳號', () => {
  test('沒有邀請碼也沒有報到碼自行註冊 → 試用帳號；掃報到 QR 註冊 → 一般學員', async () => {
    const { register } = await setup();
    const t = await register({ email: 'trial@b.co' });
    assert.equal(t.res.status, 201);
    assert.equal(t.res.body.user.trial, true);
    assert.equal(t.res.body.user.emailVerified, false);
    const q = await register({ email: 'qr@b.co', joinCode: 'QRCODE12' });
    assert.equal(q.res.status, 201);
    assert.equal(q.res.body.user.trial, false);
  });

  test('帶了無效或已撤銷的報到碼註冊：沒有真的入班，仍是試用帳號（不能用假碼跳過限制）', async () => {
    const { register, group } = await setup();
    const fake = await register({ email: 'fake@b.co', joinCode: 'NOTAREALCODE' });
    assert.equal(fake.res.status, 201);
    assert.equal(fake.res.body.user.trial, true);
    assert.equal(fake.res.body.joinedGroup, null);
    const list = (await fake.agent.get('/api/assessments')).body.assessments.map((a) => a.id);
    assert.ok(!list.includes('leadership-9d'));
    group.joinCode = null; // 撤銷
    const revoked = await register({ email: 'revoked@b.co', joinCode: 'QRCODE12' });
    assert.equal(revoked.res.body.user.trial, true);
  });

  test('作答沒帶 assessmentId 視為 ai-competency：試用帳號可以送出', async () => {
    const { register } = await setup();
    const { agent } = await register({ email: 'noid@b.co' });
    const r = await agent.post('/api/submissions').send({ result: sampleResult() });
    assert.equal(r.status, 201);
  });

  test('只看得到、只能作答 AI 職能與 DISC；其他評量與他評都擋下', async () => {
    const { register } = await setup();
    const { agent } = await register({ email: 'trial@b.co' });
    const list = (await agent.get('/api/assessments')).body.assessments.map((a) => a.id).sort();
    assert.deepEqual(list, ['ai-competency', 'disc']);
    const ok = await agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult() });
    assert.equal(ok.status, 201);
    const l9d = await agent.post('/api/submissions').send({ assessmentId: 'leadership-9d', result: sampleResult() });
    assert.equal(l9d.status, 403);
    assert.equal(l9d.body.code, 'TRIAL_LOCKED');
    const asRater = await agent.post('/api/submissions').send({ assessmentId: 'disc', raterType: 'peer', rateeId: randomUUID(), result: sampleResult() });
    assert.equal(asRater.status, 403);
    // 之後回來看得到自己的紀錄
    const mine = await agent.get('/api/submissions/me');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.submissions.length, 1);
  });

  test('發展目標、微練習、邀請他評：看得到（讀取正常）但不能建立', async () => {
    const { register } = await setup();
    const { agent } = await register({ email: 'trial@b.co' });
    assert.equal((await agent.get('/api/goals')).status, 200);
    const goal = await agent.post('/api/goals').send({ assessmentId: 'ai-competency', text: '每週練習一次' });
    assert.equal(goal.status, 403);
    assert.equal(goal.body.feature, 'goals');
    const practice = await agent.post('/api/practice').send({ assessmentId: 'ai-competency', tasks: ['a', 'b', 'c', 'd'] });
    assert.equal(practice.status, 403);
    assert.equal(practice.body.feature, 'practice');
    const invite = await agent.post('/api/rater-invites').send({ assessmentId: 'leadership-compass', raterUserId: randomUUID(), raterType: 'peer' });
    assert.equal(invite.status, 403);
    assert.equal(invite.body.feature, '360');
  });

  test('試用者之後掃 QR 加入班級 → 自動轉為一般學員（永久）', async () => {
    const { register, db, group } = await setup();
    const { agent, res } = await register({ email: 'trial@b.co' });
    const id = res.body.user.id;
    assert.equal((await agent.post('/api/groups/join').send({ joinCode: 'QRCODE12' })).status < 300, true);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.trial, false);
    // 被移出班級也不會變回試用
    group.memberIds = group.memberIds.filter((m) => m !== id);
    assert.equal((await agent.get('/api/auth/me')).body.user.trial, false);
    assert.ok(db.data.users.find((u) => u.id === id).trialEndedAt);
    const list = (await agent.get('/api/assessments')).body.assessments.map((a) => a.id);
    assert.ok(list.includes('leadership-9d'));
  });

  test('管理員可以把試用帳號轉為一般學員，並留稽核紀錄；不能反向設成試用', async () => {
    const { register, admAgent, db } = await setup();
    const { res } = await register({ email: 'trial@b.co' });
    const id = res.body.user.id;
    assert.equal((await admAgent.patch(`/api/admin/users/${id}/trial`).send({ trial: true })).status, 400);
    const r = await admAgent.patch(`/api/admin/users/${id}/trial`).send({ trial: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.trial, false);
    assert.ok((db.data.auditLog ?? []).some((e) => e.action === 'end_trial'));
    assert.equal((await admAgent.patch(`/api/admin/users/${id}/trial`).send({ trial: false })).status, 400);
  });

  test('教練與管理員永遠不是試用；既有帳號（沒有旗標）不受影響', async () => {
    const { db, app } = await setup();
    const pw = await hashPassword('abcdef12');
    db.data.users.push({ id: randomUUID(), name: '舊學員', email: 'old@b.co', role: 'user', passwordHash: pw, createdAt: new Date().toISOString() });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ email: 'old@b.co', password: 'abcdef12' });
    assert.equal((await a.get('/api/auth/me')).body.user.trial, false);
    assert.ok((await a.get('/api/assessments')).body.assessments.some((x) => x.id === 'leadership-9d'));
  });
});

describe('Email 驗證', () => {
  test('驗證信內容：連結指向 APP_URL 的 ?verify=，不含密碼', () => {
    const mail = buildVerificationMail({ name: '甲', email: 'a@b.co' }, 'tok123');
    assert.equal(mail.to, 'a@b.co');
    assert.match(mail.text, /https:\/\/assess\.test\/\?verify=tok123/);
  });

  test('點連結驗證成功；同一連結不能再用；過期的連結無效', async () => {
    const { register, db } = await setup();
    const { agent, res } = await register({ email: 'trial@b.co' });
    const user = db.data.users.find((u) => u.id === res.body.user.id);
    const token = issueVerifyToken(db, user);
    const ok = await request(agent.app).post('/api/auth/verify-email').send({ token });
    assert.equal(ok.status, 200);
    assert.equal((await agent.get('/api/auth/me')).body.user.emailVerified, true);
    assert.equal((await request(agent.app).post('/api/auth/verify-email').send({ token })).status, 400);
    const other = (await register({ email: 'late@b.co' })).res.body.user;
    const u2 = db.data.users.find((u) => u.id === other.id);
    const old = issueVerifyToken(db, u2, Date.now() - VERIFY_TTL_MS - 1000);
    assert.equal((await request(agent.app).post('/api/auth/verify-email').send({ token: old })).status, 400);
    assert.equal((await request(agent.app).post('/api/auth/verify-email').send({ token: 'nope' })).status, 400);
  });

  test('驗證完成時，寄到這個 Email 的入班邀請自動兌換：加入班級、轉為一般學員', async () => {
    const { register, db, group, coach } = await setup();
    db.data.memberInvites.push(newMemberInvite(db.data, { groupId: group.id, email: 'invited@b.co', name: '受邀者', createdBy: coach.id }));
    const { agent, res } = await register({ email: 'invited@b.co' });
    assert.equal(res.body.user.trial, true); // 沒帶邀請碼：先是試用
    const user = db.data.users.find((u) => u.id === res.body.user.id);
    const token = issueVerifyToken(db, user);
    const v = await request(agent.app).post('/api/auth/verify-email').send({ token });
    assert.equal(v.status, 200);
    assert.deepEqual(v.body.joinedGroups.map((g) => g.id), [group.id]);
    assert.ok(group.memberIds.includes(user.id));
    assert.equal(db.data.memberInvites[0].status, 'joined');
    assert.equal((await agent.get('/api/auth/me')).body.user.trial, false);
  });

  test('寄信失敗不啟動重寄冷卻：可以馬上再試（不會被誤告知「剛寄出」）', async () => {
    const { register, db } = await setup();
    process.env.SMTP_HOST = 'smtp.invalid'; process.env.SMTP_USER = 'u'; process.env.SMTP_PASS = 'p';
    const { agent, res } = await register({ email: 'smtpfail@b.co' });
    await new Promise((r) => setTimeout(r, 50)); // 註冊時背景寄信（失敗）
    const user = db.data.users.find((u) => u.id === res.body.user.id);
    assert.equal(user.emailVerifySentAt, undefined);
    const again = await agent.post('/api/auth/verify-email/send');
    assert.notEqual(again.status, 429);
  });

  test('下載我的資料含信箱驗證時間與試用狀態', async () => {
    const { register, db } = await setup();
    const { agent, res } = await register({ email: 'export@b.co' });
    db.data.users.find((u) => u.id === res.body.user.id).emailVerifiedAt = '2026-11-24T00:00:00.000Z';
    const out = await agent.get('/api/me/export');
    assert.equal(out.status, 200);
    assert.equal(out.body.account.emailVerifiedAt, '2026-11-24T00:00:00.000Z');
    assert.equal(out.body.account.trial, true);
  });

  test('重寄驗證信：沒有設定寄信服務回 503；已驗證回 alreadyVerified', async () => {
    const { register, db } = await setup();
    const { agent, res } = await register({ email: 'trial@b.co' });
    const r = await agent.post('/api/auth/verify-email/send');
    assert.equal(r.status, 503);
    db.data.users.find((u) => u.id === res.body.user.id).emailVerifiedAt = new Date().toISOString();
    const again = await agent.post('/api/auth/verify-email/send');
    assert.equal(again.status, 200);
    assert.equal(again.body.alreadyVerified, true);
  });
});
