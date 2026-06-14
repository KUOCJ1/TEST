import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const JWT_SECRET = 'test-secret-please-change';

async function setup({ withAdmin = false } = {}) {
  const db = createDb(':memory:');
  if (withAdmin) {
    db.data.users.push({
      id: randomUUID(),
      name: '系統管理員',
      email: 'admin@demo.tw',
      passwordHash: await hashPassword('admin1234'),
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  }
  return createApp({ db, jwtSecret: JWT_SECRET });
}

function sampleResult(total = 124) {
  return {
    total,
    maxScore: 155,
    percent: Math.round((total / 155) * 100),
    level: { id: 'advanced', badge: '🚀 AI 數位高潛力股', color: '#805ad5' },
    dimensions: [{ id: 'foundation', subtitle: '基礎力', name: '工具認知', color: '#2b6cb0', percent: 80 }],
    strongest: { subtitle: '基礎力' },
    weakest: { subtitle: '基礎力' },
  };
}

describe('認證', () => {
  test('註冊後即帶有登入 cookie，且不外洩密碼雜湊', async () => {
    const app = await setup();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '小明', email: 'ming@example.com', password: 'abcdef' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'ming@example.com');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.match(res.headers['set-cookie']?.[0] ?? '', /aiassess_token=/);
  });

  test('擋下不合法 email、過短密碼與重複註冊', async () => {
    const app = await setup();
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'a', email: 'bad', password: 'abcdef' })).status, 400);
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'a', email: 'a@b.co', password: '123' })).status, 400);
    await request(app).post('/api/auth/register').send({ name: 'a', email: 'dup@b.co', password: 'abcdef' });
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'b', email: 'dup@b.co', password: 'abcdef' })).status, 409);
  });

  test('密碼錯誤回 401；正確則可登入並讀取 /me', async () => {
    const app = await setup();
    await request(app).post('/api/auth/register').send({ name: 'z', email: 'z@b.co', password: 'abcdef' });
    const agent = request.agent(app);
    assert.equal((await agent.post('/api/auth/login').send({ email: 'z@b.co', password: 'wrong' })).status, 401);
    assert.equal((await agent.post('/api/auth/login').send({ email: 'z@b.co', password: 'abcdef' })).status, 200);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'z@b.co');
  });

  test('未登入存取 /me 回 401；logout 後失效', async () => {
    const app = await setup();
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'z', email: 'z@b.co', password: 'abcdef' });
    assert.equal((await agent.get('/api/auth/me')).status, 200);
    await agent.post('/api/auth/logout');
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });
});

describe('個人檔案 / 密碼', () => {
  test('可更新姓名與偏好設定', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: '舊名', email: 'p@b.co', password: 'abcdef' });
    const res = await agent.patch('/api/auth/profile').send({ name: '新名', preferences: { darkMode: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, '新名');
    assert.equal(res.body.user.preferences.darkMode, true);
  });

  test('變更密碼需驗證目前密碼，成功後可用新密碼登入', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'pw@b.co', password: 'abcdef' });
    assert.equal((await agent.post('/api/auth/password').send({ currentPassword: 'wrong', newPassword: 'newpass' })).status, 401);
    assert.equal((await agent.post('/api/auth/password').send({ currentPassword: 'abcdef', newPassword: 'newpass' })).status, 200);
    const fresh = request.agent(app);
    assert.equal((await fresh.post('/api/auth/login').send({ email: 'pw@b.co', password: 'newpass' })).status, 200);
  });

  test('管理員產生重設 token，使用者可用其設定新密碼', async () => {
    const app = await setup({ withAdmin: true });
    const u = request.agent(app);
    const reg = await u.post('/api/auth/register').send({ name: 'u', email: 'r@b.co', password: 'abcdef' });

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const tok = await admin.post(`/api/admin/users/${reg.body.user.id}/reset-token`);
    assert.equal(tok.status, 200);
    assert.ok(tok.body.token);

    // 錯誤 token 應失敗
    assert.equal((await request(app).post('/api/auth/reset-password').send({ token: 'bad', newPassword: 'fresh1' })).status, 400);
    // 正確 token 可重設
    assert.equal((await request(app).post('/api/auth/reset-password').send({ token: tok.body.token, newPassword: 'fresh1' })).status, 200);
    // 用新密碼登入
    const fresh = request.agent(app);
    assert.equal((await fresh.post('/api/auth/login').send({ email: 'r@b.co', password: 'fresh1' })).status, 200);
  });
});

describe('作答', () => {
  test('需登入才能建立作答，並可取回自己的紀錄', async () => {
    const app = await setup();
    assert.equal((await request(app).post('/api/submissions').send({ result: sampleResult() })).status, 401);

    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef' });
    const created = await agent.post('/api/submissions').send({ answers: { q1: 4 }, result: sampleResult(124) });
    assert.equal(created.status, 201);
    assert.equal(created.body.submission.result.total, 124);

    const mine = await agent.get('/api/submissions/me');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.submissions.length, 1);
  });

  test('作答結果格式不正確回 400', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef' });
    assert.equal((await agent.post('/api/submissions').send({ result: { total: 'x' } })).status, 400);
  });
});

describe('母體基準 / 百分位', () => {
  test('benchmark 回傳已排序的總分陣列與構面平均', async () => {
    const app = await setup();
    for (const [email, total] of [['a@b.co', 80], ['c@b.co', 155], ['d@b.co', 124]]) {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ name: email, email, password: 'abcdef' });
      await agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(total) });
    }
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'q', email: 'q@b.co', password: 'abcdef' });
    const res = await agent.get('/api/assessments/ai-competency/benchmark');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 3);
    assert.deepEqual(res.body.totals, [80, 124, 155]); // 已排序
  });
});

describe('教練 / 班別 / 名單', () => {
  async function makeCoach(app) {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const coach = request.agent(app);
    const reg = await coach.post('/api/auth/register').send({ name: '教練', email: 'coach@b.co', password: 'abcdef' });
    await admin.patch(`/api/admin/users/${reg.body.user.id}/role`).send({ role: 'coach' });
    return { admin, coach };
  }

  test('一般使用者無法存取教練 API（403）', async () => {
    const app = await setup({ withAdmin: true });
    const user = request.agent(app);
    await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef' });
    assert.equal((await user.get('/api/coach/overview')).status, 403);
  });

  test('教練可建立班別、寫評語', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    // 重新登入取得 coach 角色 cookie
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef' });

    const g = await coach.post('/api/coach/groups').send({ name: 'A 班', assessmentId: 'ai-competency' });
    assert.equal(g.status, 201);

    const u = request.agent(app);
    const ureg = await u.post('/api/auth/register').send({ name: '學員', email: 's@b.co', password: 'abcdef' });
    const sub = await u.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(124) });

    const c = await coach.post(`/api/submissions/${sub.body.submission.id}/comment`)
      .send({ text: '表現良好', tips: ['多練習提示詞'] });
    assert.equal(c.status, 200);
    assert.equal(c.body.comment.text, '表現良好');

    // 學員自己的紀錄應帶有評語
    const mine = await u.get('/api/submissions/me');
    assert.equal(mine.body.submissions[0].comments[0].text, '表現良好');
    assert.equal(ureg.body.user.role, 'user');
  });

  test('批量名單：現有用戶入班、未註冊者待加入並於註冊後自動入班', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef' });

    const existing = request.agent(app);
    const ereg = await existing.post('/api/auth/register').send({ name: '已註冊', email: 'have@b.co', password: 'abcdef' });

    const g = await coach.post('/api/coach/groups').send({ name: 'B 班', assessmentId: 'ai-competency' });
    const gid = g.body.group.id;

    const imp = await coach.post(`/api/coach/groups/${gid}/roster`).send({
      entries: [
        { name: '已註冊', email: 'have@b.co' },
        { name: '未註冊', email: 'new@b.co' },
        { name: '壞格式', email: 'not-an-email' },
      ],
    });
    assert.equal(imp.status, 200);
    assert.equal(imp.body.result.added, 1);
    assert.equal(imp.body.result.pending, 1);
    assert.equal(imp.body.result.invalid.length, 1);
    assert.ok(imp.body.group.memberIds.includes(ereg.body.user.id));

    // 未註冊者註冊後應自動成為成員
    const fresh = request.agent(app);
    const freg = await fresh.post('/api/auth/register').send({ name: '未註冊', email: 'new@b.co', password: 'abcdef' });
    const myGroups = await fresh.get('/api/groups/mine');
    assert.equal(myGroups.body.groups.length, 1);
    assert.ok(myGroups.body.groups[0].memberIds.includes(freg.body.user.id));
  });
});

describe('管理後台', () => {
  test('一般使用者無權限（403），管理員可取得總覽', async () => {
    const app = await setup({ withAdmin: true });

    const user = request.agent(app);
    await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef' });
    await user.post('/api/submissions').send({ result: sampleResult(93) });
    assert.equal((await user.get('/api/admin/overview')).status, 403);

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const overview = await admin.get('/api/admin/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.submissions.length, 1);
    // 不應外洩任何密碼雜湊。
    assert.ok(overview.body.users.every((u) => u.passwordHash === undefined));
  });
});
