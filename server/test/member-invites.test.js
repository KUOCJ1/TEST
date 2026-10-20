import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { buildInviteMail } from '../src/lib/inviteMail.js';
import { INVITE_CODE_LENGTH, INVITE_TTL_DAYS, inviteState, migratePendingMembers } from '../src/lib/memberInvites.js';

// 邀請制入班（Sprint 19）：後台先編班、發邀請連結，學員用連結註冊／登入後自動入班。

const JWT_SECRET = 'test-secret-please-change';
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];
let saved;
beforeEach(() => { saved = Object.fromEntries(SMTP_KEYS.map((k) => [k, process.env[k]])); delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS; process.env.APP_URL = 'https://assess.test'; });
afterEach(() => { for (const k of SMTP_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const coach = mk('王教練', 'coach@b.co', 'coach');
  const coach2 = mk('別班教練', 'coach2@b.co', 'coach');
  const admin = mk('管理員', 'admin@b.co', 'admin');
  const existing = mk('已有帳號', 'have@b.co');
  db.data.users.push(coach, coach2, admin, existing);
  const group = { id: randomUUID(), name: 'AI 實戰班', companyName: '榕耀', assessmentId: 'ai-competency', coachId: coach.id, coachName: coach.name, memberIds: [], pendingMembers: [], startDate: new Date(Date.now() - 864e5).toISOString(), endDate: null, publishedAt: null };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
  const agents = { coach: await login('coach@b.co'), coach2: await login('coach2@b.co'), admin: await login('admin@b.co') };
  const importRoster = async (entries, who = 'coach') => (await agents[who].post(`/api/coach/groups/${group.id}/roster`).send({ entries })).body;
  return { db, app, group, users: { coach, existing }, agents, importRoster };
}

const register = (app, body) => request(app).post('/api/auth/register').send({ acceptPolicy: true, password: 'abcdef12', ...body });
const quiet = (t) => { t.mock.method(console, 'log', () => {}); t.mock.method(console, 'error', () => {}); };

describe('建立邀請（匯入名單）', () => {
  test('未註冊的 Email 建立專屬邀請：10 碼、14 天、連結；重複匯入沿用，不重複建立', async (t) => {
    quiet(t);
    const { importRoster, db, group } = await setup();
    const r = await importRoster([{ name: '小明', email: 'Ming@B.co' }, { name: '壞格式', email: 'oops' }]);
    assert.equal(r.result.pending, 1);
    assert.equal(r.result.invalid.length, 1);
    const [inv] = r.memberInvites;
    assert.equal(inv.email, 'ming@b.co');
    assert.equal(inv.name, '小明');
    assert.equal(inv.code.length, INVITE_CODE_LENGTH);
    assert.equal(inv.state, 'invited');
    assert.equal(inv.link, `https://assess.test/?invite=${inv.code}`);
    const days = (new Date(inv.expiresAt) - Date.now()) / 864e5;
    assert.ok(days > INVITE_TTL_DAYS - 0.01 && days <= INVITE_TTL_DAYS);
    const again = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    assert.equal(again.result.pending, 0);
    assert.equal(again.result.existing, 1);
    assert.equal(db.data.memberInvites.filter((i) => i.groupId === group.id).length, 1);
    assert.deepEqual(group.pendingMembers, []);
  });

  test('班級詳情帶邀請清單與 SMTP 是否可用；別班教練看不到也不能管理', async (t) => {
    quiet(t);
    const { importRoster, agents, group } = await setup();
    await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    const d = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.equal(d.body.memberInvites.length, 1);
    assert.equal(d.body.mailConfigured, false);
    assert.equal((await agents.coach2.get(`/api/coach/groups/${group.id}`)).status, 403);
    const id = d.body.memberInvites[0].id;
    assert.equal((await agents.coach2.post(`/api/coach/groups/${group.id}/member-invites/${id}/regenerate`)).status, 403);
    assert.equal((await agents.coach2.delete(`/api/coach/groups/${group.id}/member-invites/${id}`)).status, 403);
    assert.equal((await agents.coach2.post(`/api/coach/groups/${group.id}/member-invites/send`)).status, 403);
  });
});

describe('公開查詢邀請（註冊頁用）', () => {
  test('有效邀請回班級、教練、被邀請的 Email 與姓名；不含成員或成績', async (t) => {
    quiet(t);
    const { importRoster, app } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    const r = await request(app).get(`/api/public/invite/${inv.code.toLowerCase()}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.groupName, 'AI 實戰班');
    assert.equal(r.body.email, 'ming@b.co');
    assert.equal(r.body.name, '小明');
    assert.equal(r.body.accountExists, false);
    assert.ok(!('memberIds' in r.body));
  });

  test('不存在、已使用、已撤銷、已過期各自回不同的錯誤碼', async (t) => {
    quiet(t);
    const { importRoster, app, db, agents, group } = await setup();
    const { memberInvites: [a, b, c] } = await importRoster([{ email: 'a@b.co' }, { email: 'b@b.co' }, { email: 'c@b.co' }]);
    assert.equal((await request(app).get('/api/public/invite/NOPE')).body.code, 'INVITE_NOT_FOUND');
    const rec = (id) => db.data.memberInvites.find((i) => i.id === id);
    rec(a.id).status = 'joined';
    rec(c.id).expiresAt = new Date(Date.now() - 1000).toISOString();
    await agents.coach.delete(`/api/coach/groups/${group.id}/member-invites/${b.id}`);
    const code = async (i) => { const r = await request(app).get(`/api/public/invite/${i.code}`); return [r.status, r.body.code]; };
    assert.deepEqual(await code(a), [410, 'INVITE_USED']);
    assert.deepEqual(await code(b), [410, 'INVITE_REVOKED']);
    assert.deepEqual(await code(c), [410, 'INVITE_EXPIRED']);
    assert.equal(inviteState(rec(c.id)), 'expired');
  });
});

describe('用邀請碼註冊', () => {
  test('Email 以邀請為準（不信任請求內容）、姓名可改；完成後自動入班並記信箱驗證；邀請只能用一次', async (t) => {
    quiet(t);
    const { importRoster, app, db, group } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    const res = await register(app, { name: '王小明', email: 'attacker@evil.co', inviteCode: inv.code });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'ming@b.co');
    assert.equal(res.body.user.name, '王小明');
    assert.equal(res.body.joinedGroup.id, group.id);
    const user = db.data.users.find((u) => u.email === 'ming@b.co');
    assert.ok(user.emailVerifiedAt);
    assert.ok(group.memberIds.includes(user.id));
    assert.equal(db.data.memberInvites[0].status, 'joined');
    assert.equal(db.data.memberInvites[0].joinedUserId, user.id);
    const reuse = await register(app, { name: '別人', email: 'x@b.co', inviteCode: inv.code });
    assert.equal(reuse.status, 410);
    assert.equal(reuse.body.code, 'INVITE_USED');
  });

  test('邀請無效就整個擋下（不會註冊成功但沒進班）；沒同意政策也擋', async (t) => {
    quiet(t);
    const { importRoster, app, db } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ email: 'ming@b.co' }]);
    const bad = await register(app, { name: 'x', email: 'ming@b.co', inviteCode: 'NOTACODE12' });
    assert.equal(bad.status, 404);
    assert.equal(db.data.users.some((u) => u.email === 'ming@b.co'), false);
    const noConsent = await request(app).post('/api/auth/register').send({ name: 'x', password: 'abcdef12', inviteCode: inv.code });
    assert.equal(noConsent.body.code, 'CONSENT_REQUIRED');
  });

  test('這個 Email 已經有帳號：回 409 並說明改用登入', async (t) => {
    quiet(t);
    const { importRoster, app } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ email: 'late@b.co' }]);
    assert.equal((await register(app, { name: '先註冊', email: 'late@b.co' })).status, 201);
    const res = await register(app, { name: '再註冊', inviteCode: inv.code });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'EMAIL_TAKEN');
    assert.match(res.body.error, /登入/);
    assert.equal((await request(app).get(`/api/public/invite/${inv.code}`)).body.accountExists, true);
  });

  test('只用 Email 註冊（沒有邀請碼）不會被編進任何班級', async (t) => {
    quiet(t);
    const { importRoster, app, group } = await setup();
    await importRoster([{ email: 'squatter@b.co' }]);
    const res = await register(app, { name: '搶先者', email: 'squatter@b.co' });
    assert.equal(res.status, 201);
    assert.equal(res.body.joinedGroup, null);
    assert.equal(group.memberIds.length, 0);
  });
});

describe('登入與兌換', () => {
  async function seedExistingInvite(ctx) {
    const { db, group, users } = ctx;
    const inv = {
      id: randomUUID(), groupId: group.id, email: users.existing.email, name: '已有帳號', code: 'EXISTCODE2', status: 'invited',
      expiresAt: new Date(Date.now() + 864e5).toISOString(), createdBy: users.coach.id, createdAt: new Date().toISOString(), sendCount: 0,
    };
    db.data.memberInvites.push(inv);
    return inv;
  }

  test('已有帳號的人帶邀請碼登入：Email 相符才入班', async (t) => {
    quiet(t);
    const ctx = await setup();
    const inv = await seedExistingInvite(ctx);
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'have@b.co', password: 'abcdef12', inviteCode: inv.code });
    assert.equal(res.status, 200);
    assert.equal(res.body.joinedGroup.id, ctx.group.id);
    assert.ok(ctx.group.memberIds.includes(ctx.users.existing.id));
    assert.equal(inv.status, 'joined');
  });

  test('邀請是寄給別的 Email：登入仍成功，但不入班，並說明原因（Email 遮罩）', async (t) => {
    quiet(t);
    const ctx = await setup();
    const { memberInvites: [inv] } = await ctx.importRoster([{ email: 'ming@b.co' }]);
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'have@b.co', password: 'abcdef12', inviteCode: inv.code });
    assert.equal(res.status, 200);
    assert.equal(res.body.joinedGroup, null);
    assert.equal(res.body.inviteError.code, 'INVITE_EMAIL_MISMATCH');
    assert.match(res.body.inviteError.error, /m\*\*\*@b\.co/);
    assert.ok(!res.body.inviteError.error.includes('ming@'));
    assert.equal(ctx.group.memberIds.length, 0);
  });

  test('已登入的人輸入邀請碼兌換；Email 不符 403、過期 410', async (t) => {
    quiet(t);
    const ctx = await setup();
    const inv = await seedExistingInvite(ctx);
    const user = request.agent(ctx.app);
    await user.post('/api/auth/login').send({ email: 'have@b.co', password: 'abcdef12' });
    const { memberInvites } = await ctx.importRoster([{ email: 'other@b.co' }]);
    const other = memberInvites.find((i) => i.email === 'other@b.co');
    const mismatch = await user.post('/api/invites/redeem').send({ code: other.code });
    assert.equal(mismatch.status, 403);
    assert.equal(mismatch.body.code, 'INVITE_EMAIL_MISMATCH');
    inv.expiresAt = new Date(Date.now() - 1000).toISOString();
    assert.equal((await user.post('/api/invites/redeem').send({ code: inv.code })).body.code, 'INVITE_EXPIRED');
    inv.expiresAt = new Date(Date.now() + 864e5).toISOString();
    const ok = await user.post('/api/invites/redeem').send({ code: inv.code.toLowerCase() });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.joinedGroup.id, ctx.group.id);
    assert.equal((await request(ctx.app).post('/api/invites/redeem').send({ code: inv.code })).status, 401);
  });
});

describe('重新產生、撤銷、寄信', () => {
  test('重新產生：舊碼立即失效、期限重設；已加入的不能重新產生', async (t) => {
    quiet(t);
    const { importRoster, agents, group, app, db } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ email: 'a@b.co' }]);
    db.data.memberInvites[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    const r = await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/${inv.id}/regenerate`);
    assert.equal(r.status, 200);
    assert.notEqual(r.body.memberInvite.code, inv.code);
    assert.equal(r.body.memberInvite.state, 'invited');
    assert.equal((await request(app).get(`/api/public/invite/${inv.code}`)).body.code, 'INVITE_NOT_FOUND');
    assert.equal((await request(app).get(`/api/public/invite/${r.body.memberInvite.code}`)).status, 200);
    db.data.memberInvites[0].status = 'joined';
    assert.equal((await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/${inv.id}/regenerate`)).status, 409);
  });

  test('撤銷：連結失效、名單不再顯示；刪班會一併清掉邀請', async (t) => {
    quiet(t);
    const { importRoster, agents, group, db } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ email: 'a@b.co' }, { email: 'b@b.co' }]);
    await agents.coach.delete(`/api/coach/groups/${group.id}/member-invites/${inv.id}`);
    const d = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.equal(d.body.memberInvites.length, 1);
    assert.equal(db.data.memberInvites.find((i) => i.id === inv.id).status, 'revoked');
    await agents.coach.delete(`/api/coach/groups/${group.id}`);
    assert.equal(db.data.memberInvites.filter((i) => i.groupId === group.id).length, 0);
  });

  test('SMTP 沒設定：寄送回 503，其餘功能不受影響', async (t) => {
    quiet(t);
    const { importRoster, agents, group } = await setup();
    await importRoster([{ email: 'a@b.co' }]);
    const r = await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/send`).send({});
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'CONFIG_ERROR');
  });

  test('SMTP 設定好：一人一封、記錄寄送次數與時間，失敗的列在 failed；只寄有效且未加入的', async (t) => {
    quiet(t);
    process.env.SMTP_HOST = 'smtp.example.com'; process.env.SMTP_USER = 'bot@example.com'; process.env.SMTP_PASS = 'secret';
    const sent = [];
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (m) => { if (m.to === 'bad@b.co') throw new Error('550'); sent.push(m); } }));
    const { importRoster, agents, group, db } = await setup();
    const { memberInvites } = await importRoster([{ name: '小明', email: 'ming@b.co' }, { email: 'bad@b.co' }, { email: 'joined@b.co' }, { email: 'old@b.co' }]);
    const byEmail = (e) => db.data.memberInvites.find((i) => i.email === e);
    byEmail('joined@b.co').status = 'joined';
    byEmail('old@b.co').expiresAt = new Date(Date.now() - 1000).toISOString();
    const r = await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/send`).send({});
    assert.equal(r.status, 200);
    assert.equal(r.body.sent, 1);
    assert.deepEqual(r.body.failed, ['bad@b.co']);
    assert.deepEqual(sent.map((m) => m.to), ['ming@b.co']);
    assert.match(sent[0].subject, /AI 實戰班/);
    assert.match(sent[0].text, /小明 您好/);
    assert.ok(sent[0].text.includes(`https://assess.test/?invite=${memberInvites.find((i) => i.email === 'ming@b.co').code}`));
    assert.equal(byEmail('ming@b.co').sendCount, 1);
    assert.ok(byEmail('ming@b.co').lastSentAt);
    assert.equal(byEmail('bad@b.co').sendCount, 0);
    // 只寄指定的人。
    const only = await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/send`).send({ inviteIds: [byEmail('ming@b.co').id] });
    assert.equal(only.body.sent, 1);
    assert.equal(byEmail('ming@b.co').sendCount, 2);
  });

  test('管理操作寫入稽核紀錄', async (t) => {
    quiet(t);
    const { importRoster, agents, group, db } = await setup();
    const { memberInvites: [inv] } = await importRoster([{ email: 'a@b.co' }]);
    await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/${inv.id}/regenerate`);
    await agents.coach.delete(`/api/coach/groups/${group.id}/member-invites/${inv.id}`);
    const actions = db.data.auditLog.map((e) => e.action);
    assert.ok(actions.includes('import_roster'));
    assert.ok(actions.includes('regenerate_member_invite'));
    assert.ok(actions.includes('revoke_member_invite'));
  });
});

describe('邀請信內容', () => {
  test('說明誰邀請、怎麼進來、到期日與收錯信怎麼辦；連結用 APP_URL', () => {
    process.env.APP_URL = 'https://assess.test/';
    const mail = buildInviteMail({
      group: { name: 'AI 實戰班', companyName: '榕耀', coachName: '王教練' },
      invite: { name: '小明', code: 'ABCDE23456', expiresAt: '2026-11-02T00:00:00.000Z' },
    });
    assert.match(mail.subject, /AI 實戰班/);
    assert.match(mail.text, /小明 您好/);
    assert.match(mail.text, /王教練邀請你加入「AI 實戰班」（榕耀）/);
    assert.ok(mail.text.includes('https://assess.test/?invite=ABCDE23456'));
    assert.match(mail.text, /邀請碼：ABCDE23456/);
    assert.match(mail.text, /只能使用一次/);
    assert.match(mail.text, /沒有預期收到這封信，請忽略/);
  });
});

describe('舊的待加入名單轉成邀請', () => {
  test('migratePendingMembers 轉換並清空；同班同 Email 不重複', () => {
    const data = { groups: [{ id: 'g1', coachId: 'c', pendingMembers: [{ name: '甲', email: 'A@B.co' }, { name: '甲2', email: 'a@b.co' }, { email: '' }] }, { id: 'g2', pendingMembers: [] }], memberInvites: [] };
    assert.equal(migratePendingMembers(data), 1);
    assert.deepEqual(data.groups[0].pendingMembers, []);
    assert.equal(data.memberInvites[0].email, 'a@b.co');
    assert.equal(data.memberInvites[0].createdBy, 'c');
    assert.equal(migratePendingMembers(data), 0, '再跑一次不會重複');
  });

  test('啟動時（createDb）轉換並寫回資料庫', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'db.json');
    const first = createDb(file);
    first.data.groups.push({ id: 'g1', name: '舊班', coachId: 'c', memberIds: [], pendingMembers: [{ name: '甲', email: 'old@b.co' }] });
    first.persist();
    const second = createDb(file);
    assert.equal(second.data.memberInvites.length, 1);
    assert.equal(second.data.memberInvites[0].email, 'old@b.co');
    assert.deepEqual(second.data.groups[0].pendingMembers, []);
    assert.equal(createDb(file).data.memberInvites.length, 1, '重開不會再轉一次');
  });
});

describe('邀請信可自訂主旨與內文（例如由客戶承辦窗口署名寄出）', () => {
  const BODY = '{{姓名}} 您好：\n\n公司安排 {{講師}} 老師的課程，請於 10/28 前完成評測：\n{{連結}}\n（邀請碼 {{邀請碼}}，{{期限}} 前有效）\n\n人資部 王小姐 敬上';

  test('用寄信者自己的口吻與署名；欄位換成每個人自己的；每筆邀請附上完整信件', async (t) => {
    quiet(t);
    const { importRoster, agents, group } = await setup();
    const put = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ inviteSubject: '【{{公司}}】請於上課前完成線上評測', inviteBody: BODY });
    assert.equal(put.status, 200);
    const { memberInvites } = await importRoster([{ name: '小明', email: 'ming@b.co' }, { name: '小華', email: 'hua@b.co' }]);
    const ming = memberInvites.find((i) => i.email === 'ming@b.co');
    assert.equal(ming.mailSubject, '【榕耀】請於上課前完成線上評測');
    assert.match(ming.mailText, /^小明 您好：/);
    assert.match(ming.mailText, /王教練 老師的課程/);
    assert.ok(ming.mailText.includes(ming.link) && ming.mailText.includes(`邀請碼 ${ming.code}`));
    assert.match(ming.mailText, /人資部 王小姐 敬上$/, '署名是承辦單位，不是平台');
    assert.doesNotMatch(ming.mailText, /邀請你加入「/, '不會夾帶預設信的句子');
    const hua = memberInvites.find((i) => i.email === 'hua@b.co');
    assert.match(hua.mailText, /^小華 您好：/);
    assert.ok(!hua.mailText.includes(ming.link), '不會夾帶別人的連結');
  });

  test('內文忘了放 {{連結}} 時，會在最後補上專屬連結與邀請碼；沒有的欄位原樣保留', async (t) => {
    quiet(t);
    const { importRoster, agents, group } = await setup();
    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ inviteBody: '{{姓名}} 您好，請完成評測。{{不存在的欄位}}' });
    const { memberInvites: [inv] } = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    assert.ok(inv.mailText.includes(`專屬連結：${inv.link}`));
    assert.ok(inv.mailText.includes('{{不存在的欄位}}'));
    assert.equal(inv.mailSubject, '【AI 實戰班】邀請你加入線上評測', '沒設主旨就用預設主旨');
  });

  test('沒有自訂時維持預設的信；長度有上限、非字串清掉、空字串改回預設', async (t) => {
    quiet(t);
    const { importRoster, agents, group } = await setup();
    const { memberInvites } = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    assert.match(memberInvites[0].mailText, /邀請你加入「AI 實戰班」/);
    const long = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ inviteBody: 'a'.repeat(9000), inviteSubject: 'b'.repeat(500) });
    assert.equal(long.body.group.inviteBody.length, 4000);
    assert.equal(long.body.group.inviteSubject.length, 150);
    const bad = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ inviteBody: { x: 1 }, inviteSubject: 5 });
    assert.equal(bad.body.group.inviteBody, '');
    assert.equal(bad.body.group.inviteSubject, '');
    const detail = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.match(detail.body.memberInvites[0].mailText, /邀請你加入「AI 實戰班」/);
  });

  test('系統寄出的信就是教練看到的那一份', async (t) => {
    quiet(t);
    process.env.SMTP_HOST = 'smtp.example.com'; process.env.SMTP_USER = 'bot@example.com'; process.env.SMTP_PASS = 'secret';
    const sent = [];
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async (m) => { sent.push(m); } }));
    const { importRoster, agents, group } = await setup();
    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ inviteSubject: '請完成評測', inviteBody: BODY });
    const { memberInvites } = await importRoster([{ name: '小明', email: 'ming@b.co' }]);
    await agents.coach.post(`/api/coach/groups/${group.id}/member-invites/send`).send({});
    assert.equal(sent[0].text, memberInvites[0].mailText);
    assert.equal(sent[0].subject, '請完成評測');
  });
});
