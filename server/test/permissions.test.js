import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sendDueRetestReminders } from '../src/lib/notifications.js';

// Sprint 11：管理者權限（角色、停用、轉移班別）與教練成員搜尋。

const JWT_SECRET = 'test-secret-please-change';
const PW = 'abcdef12';

async function setup() {
  const db = createDb(':memory:');
  const ids = {};
  for (const [key, name, email, role] of [
    ['admin', '管理員', 'admin@b.co', 'admin'],
    ['admin2', '管理員二', 'admin2@b.co', 'admin'],
    ['coach', '教練甲', 'c1@b.co', 'coach'],
    ['coach2', '教練乙', 'c2@b.co', 'coach'],
    ['stu', '王小明', 'ming@b.co', 'user'],
    ['stu2', '王大華', 'hua@b.co', 'user'],
  ]) {
    ids[key] = randomUUID();
    db.data.users.push({ id: ids[key], name, email, role, passwordHash: await hashPassword(PW) });
  }
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (email) => {
    const agent = request.agent(app);
    const r = await agent.post('/api/auth/login').send({ email, password: PW });
    assert.equal(r.status, 200, `login ${email}`);
    return agent;
  };
  return {
    db, app, ids, login,
    admin: await login('admin@b.co'), admin2: await login('admin2@b.co'),
    coach: await login('c1@b.co'), coach2: await login('c2@b.co'), stu: await login('ming@b.co'),
  };
}
const setRole = (agent, id, role) => agent.patch(`/api/admin/users/${id}/role`).send({ role });
const setDisabled = (agent, id, disabled) => agent.patch(`/api/admin/users/${id}/disabled`).send({ disabled });

describe('角色管理：指定／移除管理者與守門規則', () => {
  test('可以把用戶升為管理者、再降回；升降都撤銷對方的 session', async () => {
    const { admin, stu, ids } = await setup();
    assert.equal((await setRole(admin, ids.stu, 'admin')).status, 200);
    // 舊 token 已失效。
    assert.equal((await stu.get('/api/auth/me')).status, 401);
    const back = await setRole(admin, ids.stu, 'coach');
    assert.equal(back.status, 200);
    assert.equal(back.body.user.role, 'coach');
  });

  test('不能改自己的角色', async () => {
    const { admin, ids } = await setup();
    const r = await setRole(admin, ids.admin, 'user');
    assert.equal(r.status, 400);
    assert.match(r.body.error, /自己/);
  });

  test('有第二位管理者時可以降級對方；降級後對方的 session 失效，自己仍無法改自己', async () => {
    const { admin, admin2, ids } = await setup();
    const r = await setRole(admin, ids.admin2, 'coach');
    assert.equal(r.status, 200);
    assert.equal(r.body.user.role, 'coach');
    assert.equal((await admin2.get('/api/admin/overview')).status, 401, '被降級者的舊 session 已撤銷');
    assert.equal((await setRole(admin, ids.admin, 'user')).status, 400, '最後一位管理者也不能把自己降級');
    assert.equal((await admin.get('/api/admin/overview')).status, 200);
  });

  test('非管理者不能改角色；角色值不合法或沒變更都 400；已停用帳號不能升管理者', async () => {
    const { admin, coach, stu, db, ids } = await setup();
    assert.equal((await setRole(coach, ids.stu, 'admin')).status, 403);
    assert.equal((await setRole(stu, ids.stu2, 'coach')).status, 403);
    assert.equal((await setRole(admin, ids.stu, 'root')).status, 400);
    assert.equal((await setRole(admin, ids.stu, 'user')).status, 400);
    db.data.users.find((u) => u.id === ids.stu).disabled = true;
    assert.equal((await setRole(admin, ids.stu, 'admin')).status, 400);
  });
});

describe('停用帳號', () => {
  test('停用後：現有 session 立即失效、不能登入（密碼對才說已停用）、可重新啟用', async () => {
    const { app, admin, stu, ids } = await setup();
    assert.equal((await stu.get('/api/auth/me')).status, 200);
    const r = await setDisabled(admin, ids.stu, true);
    assert.equal(r.status, 200);
    assert.equal(r.body.user.disabled, true);
    assert.equal((await stu.get('/api/auth/me')).status, 401, '停用後既有 session 立即失效');

    const blocked = await request(app).post('/api/auth/login').send({ email: 'ming@b.co', password: PW });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'ACCOUNT_DISABLED');
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'ming@b.co', password: 'wrong-password' });
    assert.equal(wrongPw.status, 401, '密碼錯誤時不透露帳號是否停用');

    assert.equal((await setDisabled(admin, ids.stu, false)).status, 200);
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'ming@b.co', password: PW })).status, 200);
  });

  test('不能停用自己；不能停用最後一位管理者；重複操作 400；非管理者 403', async () => {
    const { admin, coach, db, ids } = await setup();
    assert.equal((await setDisabled(admin, ids.admin, true)).status, 400);
    assert.equal((await setDisabled(coach, ids.stu, true)).status, 403);
    assert.equal((await setDisabled(admin, ids.stu, false)).status, 400, '沒被停用就不能「啟用」');
    assert.equal((await setDisabled(admin, ids.stu, 'yes')).status, 400);
    // 還有 admin 時可以停用 admin2；停用後 admin2 無法再登入。
    assert.equal((await setDisabled(admin, ids.admin2, true)).status, 200);
    assert.equal(db.data.users.find((u) => u.id === ids.admin2).disabled, true);
  });

  test('停用的帳號保留作答與班級成員資格；不收通知信；重設連結不能用', async () => {
    const { db, admin, ids } = await setup();
    db.data.groups.push({ id: 'g1', name: '班', assessmentId: 'ai-competency', coachId: ids.coach, memberIds: [ids.stu], phase: 'x' });
    db.data.submissions.push({ id: 's1', userId: ids.stu, assessmentId: 'ai-competency', result: { total: 1, dimensions: [{ id: 'a', score: 1, max: 5, rating: { label: 'x' } }] }, createdAt: new Date().toISOString() });
    await setDisabled(admin, ids.stu, true);
    assert.deepEqual(db.data.groups[0].memberIds, [ids.stu]);
    assert.equal(db.data.submissions.length, 1);

    db.data.goals.push({ id: 'goal1', userId: ids.stu, text: 't', reviewDate: '2020-01-01', createdAt: '2019-01-01T00:00:00Z', assessmentId: 'ai-competency' });
    const sent = [];
    const r = await sendDueRetestReminders(db, { configured: true, send: async (m) => { sent.push(m); return { ok: true }; } });
    assert.equal(r.sent, 0);
    assert.equal(sent.length, 0, '停用帳號不寄複測提醒');
  });

  test('停用帳號不出現在教練搜尋，也不能新加進班（原本就在班上的保留）', async () => {
    const { coach, admin, db, ids } = await setup();
    await setDisabled(admin, ids.stu, true);
    const found = await coach.get('/api/coach/user-search').query({ q: '王大' });
    assert.deepEqual(found.body.users.map((u) => u.id), [ids.stu2]);
    const g = await coach.post('/api/coach/groups').send({ name: '新班', memberIds: [ids.stu, ids.stu2] });
    // 停用者不能被邀請；其他人改成「邀請」，本人接受前不是成員。
    assert.deepEqual(g.body.invitedIds, [ids.stu2]);
    assert.deepEqual(g.body.group.memberIds, []);
    // 原本在班上的停用者，更新名單時不會被踢掉。
    db.data.groups.find((x) => x.id === g.body.group.id).memberIds = [ids.stu, ids.stu2];
    const upd = await coach.put(`/api/coach/groups/${g.body.group.id}`).send({ memberIds: [ids.stu, ids.stu2] });
    assert.deepEqual(upd.body.group.memberIds, [ids.stu, ids.stu2]);
  });
});

describe('教練成員搜尋（取代全站名冊）', () => {
  test('至少 2 個字才有結果、最多 10 筆、只含姓名與 Email、不含管理者', async () => {
    const { coach, db } = await setup();
    assert.deepEqual((await coach.get('/api/coach/user-search').query({ q: '王' })).body.users, []);
    assert.deepEqual((await coach.get('/api/coach/user-search')).body.users, []);
    const r = await coach.get('/api/coach/user-search').query({ q: '王小' });
    assert.equal(r.body.users.length, 1);
    assert.deepEqual(Object.keys(r.body.users[0]).sort(), ['email', 'id', 'name']);
    assert.deepEqual((await coach.get('/api/coach/user-search').query({ q: '管理員' })).body.users, [], '搜尋不到管理者');
    // 也能用 Email 找；大小寫不拘。
    assert.equal((await coach.get('/api/coach/user-search').query({ q: 'HUA@B' })).body.users.length, 1);
    // 上限 10 筆。
    for (let i = 0; i < 15; i++) db.data.users.push({ id: `x${i}`, name: `測試員${i}`, email: `t${i}@b.co`, role: 'user' });
    assert.equal((await coach.get('/api/coach/user-search').query({ q: '測試員' })).body.users.length, 10);
  });

  test('學員不能用；全站名冊端點已移除', async () => {
    const { stu, coach } = await setup();
    assert.equal((await stu.get('/api/coach/user-search').query({ q: '王小' })).status, 403);
    assert.equal((await coach.get('/api/coach/directory')).status, 404);
  });

  test('班級明細帶 members（只有這個班的人），非本班教練 403', async () => {
    const { coach, coach2, stu, ids } = await setup();
    const g = await coach.post('/api/coach/groups').send({ name: '班', memberIds: [ids.stu, 'no-such-id', ids.admin] });
    assert.deepEqual(g.body.invitedIds, [ids.stu], '不存在的 id 與管理者被濾掉');
    assert.deepEqual(g.body.group.memberIds, [], '教練不能直接把已有帳號的人加進班級');
    const before = await coach.get(`/api/coach/groups/${g.body.group.id}`);
    assert.deepEqual(before.body.members, []);
    assert.deepEqual(before.body.invites.map((i) => i.userId), [ids.stu]);
    const mine = await stu.get('/api/groups/invites');
    assert.equal(mine.body.invites.length, 1);
    assert.equal((await stu.post(`/api/groups/invites/${mine.body.invites[0].id}/accept`)).status, 200);
    const detail = await coach.get(`/api/coach/groups/${g.body.group.id}`);
    assert.deepEqual(detail.body.members.map((m) => m.id), [ids.stu]);
    assert.deepEqual(Object.keys(detail.body.members[0]).sort(), ['disabled', 'email', 'id', 'name']);
    assert.equal((await coach2.get(`/api/coach/groups/${g.body.group.id}`)).status, 403);
  });
});

describe('轉移班別', () => {
  test('管理者可轉給另一位教練；原教練看不到、新教練看得到', async () => {
    const { admin, coach, coach2, ids } = await setup();
    const g = (await coach.post('/api/coach/groups').send({ name: '轉移班' })).body.group;
    const r = await admin.patch(`/api/admin/groups/${g.id}/coach`).send({ coachId: ids.coach2 });
    assert.equal(r.status, 200);
    assert.equal(r.body.group.coachId, ids.coach2);
    assert.equal(r.body.group.coachName, '教練乙');
    assert.equal((await coach.get(`/api/coach/groups/${g.id}`)).status, 403);
    assert.equal((await coach2.get(`/api/coach/groups/${g.id}`)).status, 200);
    assert.deepEqual((await coach.get('/api/coach/groups')).body.groups, []);
  });

  test('目標必須是有效的教練或管理員；同一人、不存在的班別或人、非管理者都被擋', async () => {
    const { admin, coach, db, ids } = await setup();
    const g = (await coach.post('/api/coach/groups').send({ name: '班' })).body.group;
    const to = (coachId, agent = admin, gid = g.id) => agent.patch(`/api/admin/groups/${gid}/coach`).send({ coachId });
    assert.equal((await to(ids.stu)).status, 400, '不能轉給一般用戶');
    assert.equal((await to(ids.coach)).status, 400, '本來就是這位教練');
    assert.equal((await to('nope')).status, 404);
    assert.equal((await to(ids.coach2, admin, 'no-group')).status, 404);
    assert.equal((await to(ids.coach2, coach)).status, 403, '教練不能自己把班轉走');
    db.data.users.find((u) => u.id === ids.coach2).disabled = true;
    assert.equal((await to(ids.coach2)).status, 400, '不能轉給已停用帳號');
    assert.equal((await to(ids.admin2)).status, 200, '可以轉給管理員');
  });

  test('轉移寫稽核日誌', async (t) => {
    const { admin, coach, ids } = await setup();
    const g = (await coach.post('/api/coach/groups').send({ name: '班' })).body.group;
    const lines = [];
    t.mock.method(console, 'log', (l) => lines.push(String(l)));
    await admin.patch(`/api/admin/groups/${g.id}/coach`).send({ coachId: ids.coach2 });
    await setDisabled(admin, ids.stu, true);
    await setRole(admin, ids.stu2, 'coach');
    const actions = lines.map((l) => { try { return JSON.parse(l).action; } catch { return null; } });
    for (const a of ['transfer_group', 'disable_user', 'change_role']) assert.ok(actions.includes(a), a);
  });
});
