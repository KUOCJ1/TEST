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
