import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

// AUTH_RATE_LIMIT 只給 E2E 用（見 routes/auth.js）；沒設定時維持正式額度 10 次。
const attempt = (app) => request(app).post('/api/auth/login').send({ email: 'x@b.co', password: 'wrongpass' });

test('沒設定 AUTH_RATE_LIMIT 時第 11 次被擋', async () => {
  delete process.env.AUTH_RATE_LIMIT;
  const app = createApp({ db: createDb(':memory:'), jwtSecret: 'test-secret-please-change' });
  for (let i = 0; i < 10; i += 1) assert.notEqual((await attempt(app)).status, 429, `第 ${i + 1} 次`);
  assert.equal((await attempt(app)).status, 429);
});

test('AUTH_RATE_LIMIT 可調整額度', async () => {
  process.env.AUTH_RATE_LIMIT = '2';
  try {
    const app = createApp({ db: createDb(':memory:'), jwtSecret: 'test-secret-please-change' });
    assert.notEqual((await attempt(app)).status, 429);
    assert.notEqual((await attempt(app)).status, 429);
    assert.equal((await attempt(app)).status, 429);
  } finally {
    delete process.env.AUTH_RATE_LIMIT;
  }
});

test('GET /auth/session：未登入回 200 + null（不再用 401 表示「沒登入」）；登入後回使用者', async () => {
  const app = createApp({ db: createDb(':memory:'), jwtSecret: 'test-secret-please-change' });
  const anon = await request(app).get('/api/auth/session');
  assert.equal(anon.status, 200);
  assert.equal(anon.body.user, null);
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: '小明', email: 'm@b.co', password: 'abcdef12' });
  const me = await agent.get('/api/auth/session');
  assert.equal(me.body.user.email, 'm@b.co');
  assert.equal(me.body.user.passwordHash, undefined);
});
