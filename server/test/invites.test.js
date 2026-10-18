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
