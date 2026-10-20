import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { POLICY_VERSION } from '../src/lib/policy.js';
import * as compass from '../../src/survey/data/assessments/leadership-compass.js';

// 他評邀請制與班級邀請（2026-10-18 P0 隱私修補）。

const JWT_SECRET = 'test-secret-please-change';
const ID = 'leadership-compass';
const OPEN = { startDate: new Date(Date.now() - 864e5).toISOString(), endDate: new Date(Date.now() + 864e5).toISOString() };

function compassPayload(rater = 'peer') {
  const view = compass.selectForm('short');
  const answers = Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, 4]));
  return { answers, result: compass.SCORING.buildResult(answers, view, { rater }), assessmentId: ID };
}

async function setup({ enabled = true, consent = true } = {}) {
  const db = createDb(':memory:');
  db.data.assessments.find((a) => a.id === ID).enabled = enabled;
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({
    id: randomUUID(), name, email, role, passwordHash: pw,
    ...(consent && { consent: { version: POLICY_VERSION, acceptedAt: new Date().toISOString() } }),
  });
  const users = {
    admin: mk('管理員', 'admin@b.co', 'admin'),
    coach: mk('教練', 'coach@b.co', 'coach'),
    coach2: mk('別班教練', 'coach2@b.co', 'coach'),
    ratee: mk('受評者', 'ratee@b.co'),
    b: mk('乙', 'b@b.co'),
    c: mk('丙', 'c@b.co'),
    outsider: mk('外人', 'x@b.co'),
  };
  db.data.users.push(...Object.values(users));
  const group = {
    id: randomUUID(), name: '班', coachId: users.coach.id, coachName: '教練', assessmentId: ID,
    memberIds: [users.ratee.id, users.b.id, users.c.id], ...OPEN, publishedAt: null, pendingMembers: [],
  };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const agents = {};
  for (const [k, u] of Object.entries(users)) {
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ email: u.email, password: 'abcdef12' });
    agents[k] = a;
  }
  return { db, app, users, agents, group };
}

describe('提交的基本檢查：停用評量與同意', () => {
  test('停用的評量不能提交；不存在的評量也不行', async () => {
    const { agents } = await setup({ enabled: false });
    const res = await agents.ratee.post('/api/submissions').send(compassPayload('self'));
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ASSESSMENT_DISABLED');
    const unknown = await agents.ratee.post('/api/submissions').send({ ...compassPayload('self'), assessmentId: 'no-such' });
    assert.equal(unknown.status, 400);
  });

  test('高敏感評量要求已同意現行版政策（伺服器端）', async () => {
    const { agents } = await setup({ consent: false });
    const res = await agents.ratee.post('/api/submissions').send(compassPayload('self'));
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CONSENT_REQUIRED');
  });

  test('教練不能用停用的評量建班', async () => {
    const { agents } = await setup({ enabled: false });
    const res = await agents.coach.post('/api/coach/groups').send({ name: '新班', assessmentId: ID });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ASSESSMENT_DISABLED');
  });
});

describe('他評邀請（領導力羅盤）', () => {
  test('沒有邀請就不能評別人（含冒充上級、對不存在的人評分）', async () => {
    const { agents, users } = await setup();
    const own = await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer' });
    assert.equal(own.status, 403);
    assert.equal(own.body.code, 'NO_INVITE');
    const fakeManager = await agents.outsider.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'manager' });
    assert.equal(fakeManager.status, 403);
    const ghost = await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: 'no-such-user', raterType: 'peer' });
    assert.equal(ghost.status, 403);
  });

  test('受評者邀請同班成員後，對方可以評；類型以邀請為準，同階段不能重複', async () => {
    const { agents, users, db, group } = await setup();
    const inv = await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.b.id, raterType: 'peer' });
    assert.equal(inv.status, 201);

    const mine = await agents.b.get('/api/rater-invites/mine');
    assert.equal(mine.body.toRate.length, 1);
    assert.equal(mine.body.toRate[0].rateeName, '受評者');

    // 邀請的是同儕，不能改填「上級」。
    const wrongType = await agents.b.post('/api/submissions').send({ ...compassPayload('manager'), rateeId: users.ratee.id, raterType: 'manager' });
    assert.equal(wrongType.status, 403);

    const ok = await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer', phase: 'pre' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.submission.groupId, group.id);
    assert.equal(db.data.submissions.filter((s) => s.raterType === 'peer').length, 1);

    const again = await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer', phase: 'pre' });
    assert.equal(again.status, 409);
  });

  test('同一個人不能靠多次送出湊滿人數門檻（每個邀請每個階段一次）', async () => {
    const { agents, users, db } = await setup();
    await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.b.id, raterType: 'peer' });
    for (let i = 0; i < 3; i += 1) {
      await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer', phase: 'pre' });
    }
    assert.equal(db.data.submissions.filter((s) => s.raterType === 'peer').length, 1);
  });

  test('只有受評者本人或該班教練可以發邀請；不同班的人不能被邀請', async () => {
    const { agents, users } = await setup();
    const byOther = await agents.b.post('/api/rater-invites').send({ assessmentId: ID, rateeId: users.ratee.id, raterUserId: users.c.id, raterType: 'peer' });
    assert.equal(byOther.status, 403);
    const byOtherCoach = await agents.coach2.post('/api/rater-invites').send({ assessmentId: ID, rateeId: users.ratee.id, raterUserId: users.b.id, raterType: 'peer' });
    assert.equal(byOtherCoach.status, 403);
    const outside = await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.outsider.id, raterType: 'peer' });
    assert.equal(outside.status, 403);
    assert.equal(outside.body.code, 'NOT_SAME_GROUP');
    const self = await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.ratee.id, raterType: 'peer' });
    assert.equal(self.status, 400);
    const coachOk = await agents.coach.post('/api/rater-invites').send({ assessmentId: ID, rateeId: users.ratee.id, raterUserId: users.c.id, raterType: 'manager' });
    assert.equal(coachOk.status, 201);
  });

  test('重複邀請擋 409；撤回後評分者就不能再評', async () => {
    const { agents, users } = await setup();
    const first = await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.b.id, raterType: 'peer' });
    const dup = await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.b.id, raterType: 'subordinate' });
    assert.equal(dup.status, 409);
    const del = await agents.ratee.delete(`/api/rater-invites/${first.body.invite.id}`);
    assert.equal(del.status, 200);
    const res = await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer' });
    assert.equal(res.status, 403);
  });

  test('受評者看得到自己邀請了誰，但看不到誰已經評完（避免洩漏匿名）', async () => {
    const { agents, users } = await setup();
    await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.b.id, raterType: 'peer' });
    await agents.ratee.post('/api/rater-invites').send({ assessmentId: ID, raterUserId: users.c.id, raterType: 'peer' });
    await agents.b.post('/api/submissions').send({ ...compassPayload(), rateeId: users.ratee.id, raterType: 'peer' });
    const mine = await agents.ratee.get('/api/rater-invites/mine');
    assert.equal(mine.body.invited.length, 2);
    for (const i of mine.body.invited) {
      assert.deepEqual(Object.keys(i).sort(), ['assessmentId', 'groupId', 'id', 'raterName', 'raterType', 'raterUserId']);
    }
    const coach = await agents.coach.get(`/api/rater-invites/group/${mine.body.invited[0].groupId}`);
    assert.equal(coach.status, 200);
    assert.ok(coach.body.invites.every((i) => !('usedPhases' in i) && !('status' in i)));
    // 已用過的邀請撤回不會生效，也不會告知。
    const bInvite = mine.body.invited.find((i) => i.raterUserId === users.b.id);
    const revoke = await agents.ratee.delete(`/api/rater-invites/${bInvite.id}`);
    assert.deepEqual(revoke.body, { ok: true });
    const stillThere = await agents.ratee.get('/api/rater-invites/mine');
    assert.equal(stillThere.body.invited.length, 2);
  });

  test('其他評量（L9D）不受邀請規則影響', async () => {
    const { agents, users, db } = await setup();
    db.data.groups.push({ id: 'g9', name: '九', coachId: users.coach.id, assessmentId: 'leadership-9d', memberIds: [users.ratee.id, users.b.id], ...OPEN });
    const res = await agents.b.post('/api/submissions').send({
      assessmentId: 'leadership-9d', rateeId: users.ratee.id, raterType: 'peer',
      result: { total: 100, dimensions: [], assessmentId: 'leadership-9d' },
    });
    assert.notEqual(res.body.code, 'NO_INVITE');
  });
});

describe('管理員總覽的匿名處理', () => {
  test('admin overview 不含羅盤他評的評分者身分', async () => {
    const { agents, users, db, group } = await setup();
    db.data.submissions.push({
      id: randomUUID(), userId: users.b.id, userName: '乙', rateeId: users.ratee.id, raterType: 'peer',
      assessmentId: ID, groupId: group.id, phase: 'pre', createdAt: new Date().toISOString(), result: compassPayload().result,
    });
    const res = await agents.admin.get('/api/admin/overview');
    const peer = res.body.submissions.find((s) => s.raterType === 'peer');
    assert.equal(peer.userId, 'anonymous');
    assert.ok(!JSON.stringify(peer).includes('乙'));
  });
});

describe('班級邀請：教練不能直接把已有帳號的人加進班級', () => {
  test('教練以名單邀請 → 本人接受才入班；拒絕則不入班', async () => {
    const { agents, users, db, group } = await setup();
    const put = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ memberIds: [...group.memberIds, users.outsider.id] });
    assert.deepEqual(put.body.invitedIds, [users.outsider.id]);
    assert.ok(!put.body.group.memberIds.includes(users.outsider.id));

    // 教練仍看不到對方的成績或他評（沒入班）
    const list = await agents.outsider.get('/api/groups/invites');
    assert.equal(list.body.invites.length, 1);
    assert.equal(list.body.invites[0].groupName, '班');
    const decline = await agents.outsider.post(`/api/groups/invites/${list.body.invites[0].id}/decline`);
    assert.equal(decline.status, 200);
    assert.ok(!db.data.groups[0].memberIds.includes(users.outsider.id));

    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ memberIds: [...group.memberIds, users.outsider.id] });
    const list2 = await agents.outsider.get('/api/groups/invites');
    const accept = await agents.outsider.post(`/api/groups/invites/${list2.body.invites[0].id}/accept`);
    assert.equal(accept.status, 200);
    assert.ok(db.data.groups[0].memberIds.includes(users.outsider.id));
  });

  test('別人不能代為接受；教練可取消尚未接受的邀請；管理員仍可直接加入', async () => {
    const { agents, users, db, group } = await setup();
    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ memberIds: [...group.memberIds, users.outsider.id] });
    const inv = (await agents.outsider.get('/api/groups/invites')).body.invites[0];
    assert.equal((await agents.b.post(`/api/groups/invites/${inv.id}/accept`)).status, 404);
    const detail = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.equal(detail.body.invites.length, 1);
    await agents.coach.delete(`/api/coach/groups/${group.id}/invites/${detail.body.invites[0].id}`);
    assert.equal((await agents.outsider.get('/api/groups/invites')).body.invites.length, 0);

    const adminPut = await agents.admin.put(`/api/coach/groups/${group.id}`).send({ memberIds: [...group.memberIds, users.outsider.id] });
    assert.ok(adminPut.body.group.memberIds.includes(users.outsider.id));
    assert.ok(db.data.groups[0].memberIds.includes(users.outsider.id));
  });

  test('名單匯入：已有帳號者改為邀請', async () => {
    const { agents, group } = await setup();
    const res = await agents.coach.post(`/api/coach/groups/${group.id}/roster`).send({ entries: [{ name: '外人', email: 'x@b.co' }] });
    assert.equal(res.body.result.invited, 1);
    assert.equal(res.body.result.added, 0);
  });
});

describe('其他修補', () => {
  test('匯入帳號（沒有密碼雜湊）登入回 401，不是 500', async () => {
    const { app, db } = await setup();
    db.data.users.push({ id: randomUUID(), name: '匯入', email: 'imp@b.co', role: 'user', passwordHash: null });
    const res = await request(app).post('/api/auth/login').send({ email: 'imp@b.co', password: 'abcdef12' });
    assert.equal(res.status, 401);
  });

  test('班別名稱型別錯誤回 400（不再丟例外變成 500）', async () => {
    const { agents, group } = await setup();
    const res = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ name: 123 });
    assert.equal(res.status, 400);
    const create = await agents.coach.post('/api/coach/groups').send({ name: { x: 1 } });
    assert.equal(create.status, 400);
  });
});

describe('專屬班級（客戶專案）：成員只看得到本班的評量', () => {
  test('專屬班級的學員評量清單只剩本班評量；非專屬班與教練不受影響', async () => {
    const { agents, users, db, group } = await setup();
    db.data.assessments.find((a) => a.id === 'disc').enabled = true;
    group.assessmentId = 'ai-competency';
    const names = async (agent) => (await agent.get('/api/assessments')).body.assessments.map((a) => a.id);
    assert.ok((await names(agents.ratee)).includes('disc'), '非專屬班看得到全部啟用的評量');
    const put = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ exclusive: true });
    assert.equal(put.body.group.exclusive, true);
    assert.deepEqual(await names(agents.ratee), ['ai-competency']);
    assert.ok((await names(agents.coach)).length > 1, '教練不受限');
    assert.ok((await names(agents.admin)).length > 1, '管理員不受限');
    assert.ok((await names(agents.outsider)).includes('disc'), '不在專屬班的人不受影響');
    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ exclusive: false });
    assert.ok((await names(agents.ratee)).includes('disc'));
  });
});

describe('掃碼報到的保護：限定 Email 網域、人數上限、排除不列入統計', () => {
  const reg = (app, body) => request(app).post('/api/auth/register').send({ acceptPolicy: true, password: 'abcdef12', ...body });

  test('限定網域：網域不符在註冊時就被擋（不建立帳號）；符合的才進班；公開頁面先說明', async () => {
    const { agents, app, db, group } = await setup();
    // 注意：PUT 會用新物件取代陣列裡的班級，所以報到代碼要在第一次 PUT 之前設定。
    group.joinCode = 'QRCODE12';
    const put = await agents.coach.put(`/api/coach/groups/${group.id}`).send({ joinEmailDomains: '@Weineng.com.tw, bad domain, weineng.com.tw' });
    assert.deepEqual(put.body.group.joinEmailDomains, ['weineng.com.tw']);
    const info = await request(app).get('/api/public/join/QRCODE12');
    assert.deepEqual(info.body.emailDomains, ['weineng.com.tw']);
    const bad = await reg(app, { name: '外人', email: 'x@gmail.com', joinCode: 'QRCODE12' });
    assert.equal(bad.status, 403);
    assert.equal(bad.body.code, 'JOIN_EMAIL_NOT_ALLOWED');
    assert.match(bad.body.error, /@weineng\.com\.tw/);
    assert.equal(db.data.users.some((u) => u.email === 'x@gmail.com'), false, '沒有建立帳號');
    const good = await reg(app, { name: '員工', email: 'a@weineng.com.tw', joinCode: 'QRCODE12' });
    assert.equal(good.status, 201);
    assert.ok(good.body.joinedGroup);
  });

  test('人數上限：額滿後新的人不能報到，已在班上的不受影響；登入與已登入報到也一樣', async (t) => {
    // setup 本身已經登入 7 個帳號，加上這個測試的請求會超過每 IP 每 5 分鐘 10 次的登入／註冊額度。
    process.env.AUTH_RATE_LIMIT = '1000';
    t.after(() => { delete process.env.AUTH_RATE_LIMIT; });
    const { agents, app, db, group, users } = await setup();
    group.joinCode = 'QRCODE12';
    group.memberIds = [];
    await agents.coach.put(`/api/coach/groups/${group.id}`).send({ maxMembers: 1 });
    assert.equal((await reg(app, { name: '甲', email: 'a@b.co', joinCode: 'QRCODE12' })).status, 201);
    const full = await reg(app, { name: '乙', email: 'b2@b.co', joinCode: 'QRCODE12' });
    assert.equal(full.status, 409);
    assert.equal(full.body.code, 'CLASS_FULL');
    assert.equal((await request(app).get('/api/public/join/QRCODE12')).body.full, true);
    // 已登入的另一個人掃碼：被擋；原本的成員再掃不受影響。
    const other = request.agent(app);
    await other.post('/api/auth/login').send({ email: users.coach.email, password: 'abcdef12' });
    assert.equal((await other.post('/api/groups/join').send({ joinCode: 'QRCODE12' })).body.code, 'CLASS_FULL');
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'a@b.co', password: 'abcdef12' });
    assert.equal((await member.post('/api/groups/join').send({ joinCode: 'QRCODE12' })).status, 200);
    // 已有帳號的人用登入帶碼：登入成功但不入班，並回報原因。
    db.data.users.push({ id: randomUUID(), name: '丙', email: 'c3@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') });
    const login = await request(app).post('/api/auth/login').send({ email: 'c3@b.co', password: 'abcdef12', joinCode: 'QRCODE12' });
    assert.equal(login.status, 200);
    assert.equal(login.body.joinedGroup, null);
    assert.equal(login.body.joinError.code, 'CLASS_FULL');
    assert.equal((await agents.coach.put(`/api/coach/groups/${group.id}`).send({ maxMembers: 0 })).body.group.maxMembers, null, '無效值＝不限');
  });

  test('排除不列入統計：作答從班級報告消失、成員標記、不再被催交；恢復後回來；移出班級後仍然有效', async (t) => {
    t.mock.method(console, 'log', () => {});
    const { agents, db, group, users } = await setup();
    const a = users.ratee; const b = users.b;
    const sub = (u) => ({ id: randomUUID(), userId: u.id, userName: u.name, rateeId: u.id, raterType: 'self', assessmentId: ID, groupId: group.id, phase: 'pre', createdAt: new Date().toISOString(), result: compassPayload('self').result });
    db.data.submissions.push(sub(a), sub(b));
    const count = async () => (await agents.coach.get(`/api/coach/groups/${group.id}`)).body.submissions.length;
    assert.equal(await count(), 2);
    const ex = await agents.coach.put(`/api/coach/groups/${group.id}/exclusions`).send({ userId: b.id, excluded: true });
    assert.deepEqual(ex.body.group.excludedUserIds, [b.id]);
    assert.equal(await count(), 1);
    const d = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.equal(d.body.members.find((m) => m.id === b.id).excluded, true);
    assert.equal(d.body.members.find((m) => m.id === a.id).excluded, false);
    // 移出班級後排除仍然有效（作答仍歸在這個班，但不列入統計）。
    await agents.admin.put(`/api/coach/groups/${group.id}`).send({ memberIds: group.memberIds.filter((id) => id !== b.id) });
    assert.equal(await count(), 1);
    await agents.coach.put(`/api/coach/groups/${group.id}/exclusions`).send({ userId: b.id, excluded: false });
    assert.equal(await count(), 2);
    assert.ok(db.data.auditLog.some((e) => e.action === 'exclude_member'));
    assert.ok(db.data.auditLog.some((e) => e.action === 'restore_member'));
  });

  test('排除：型別錯誤 400、不認識的人 404、別班教練 403', async (t) => {
    t.mock.method(console, 'log', () => {});
    const { agents, group, users } = await setup();
    const url = `/api/coach/groups/${group.id}/exclusions`;
    assert.equal((await agents.coach.put(url).send({ userId: users.b.id, excluded: 'yes' })).status, 400);
    assert.equal((await agents.coach.put(url).send({ userId: users.outsider.id, excluded: true })).status, 404);
    assert.equal((await agents.coach2.put(url).send({ userId: users.b.id, excluded: true })).status, 403);
  });
});
