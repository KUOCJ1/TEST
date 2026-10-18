import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { createLoginGuard } from '../src/lib/loginGuard.js';

const JWT_SECRET = 'test-secret-please-change';

async function setup() {
  const db = createDb(':memory:');
  db.data.users.push({ id: randomUUID(), name: '學員', email: 'u@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') });
  db.data.groups.push({ id: 'g1', name: '班', coachId: 'c', assessmentId: 'ai-competency', memberIds: [], joinCode: 'TESTCODE', startDate: '2020-01-01' });
  return { db, app: createApp({ db, jwtSecret: JWT_SECRET }) };
}

describe('loginGuard（純函式）', () => {
  test('連續失敗達上限就鎖定，到期或成功後解除', () => {
    const g = createLoginGuard({ maxFailures: 3, windowMs: 1000, lockMs: 500 });
    for (let i = 0; i < 2; i += 1) g.fail('a', 0);
    assert.equal(g.lockedFor('a', 0), 0);
    g.fail('a', 0);
    assert.equal(g.lockedFor('a', 100), 400);
    assert.equal(g.lockedFor('a', 600), 0, '到期自動解除');
    g.fail('b', 0); g.fail('b', 0); g.success('b');
    g.fail('b', 0); g.fail('b', 0);
    assert.equal(g.lockedFor('b', 0), 0, '成功登入會清掉失敗次數');
  });
  test('失敗次數超出時間窗就重新計算', () => {
    const g = createLoginGuard({ maxFailures: 2, windowMs: 1000, lockMs: 500 });
    g.fail('a', 0);
    g.fail('a', 5000);
    assert.equal(g.lockedFor('a', 5000), 0);
  });
});

describe('登入防猜密碼', () => {
  test('同一個帳號連續輸錯 5 次就被鎖定，之後連正確密碼也不行', async () => {
    const { app } = await setup();
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'wrong-pass' });
      assert.equal(r.status, 401, `第 ${i + 1} 次`);
    }
    const locked = await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' });
    assert.equal(locked.status, 429);
    assert.equal(locked.body.code, 'ACCOUNT_LOCKED');
    assert.ok(locked.body.retryAfterSeconds > 0);
  });

  test('不存在的 Email 也一樣處理（不洩漏哪些 Email 有註冊）', async () => {
    const { app } = await setup();
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/login').send({ email: 'nobody@b.co', password: 'x' });
    const r = await request(app).post('/api/auth/login').send({ email: 'nobody@b.co', password: 'x' });
    assert.equal(r.status, 429);
    assert.equal(r.body.code, 'ACCOUNT_LOCKED');
  });

  test('成功登入會清掉失敗次數', async () => {
    const { app } = await setup();
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'wrong-pass' });
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' })).status, 200);
    for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'wrong-pass' });
    assert.equal((await request(app).post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' })).status, 200);
  });

  test('帶有效報到代碼的放寬，不能變成猜密碼的額度：失敗登入每個 IP 最多 30 次', async () => {
    const { app } = await setup();
    let last;
    for (let i = 1; i <= 31; i += 1) {
      last = await request(app).post('/api/auth/login').send({ email: `x${i}@b.co`, password: 'nope', joinCode: 'TESTCODE' });
      if (i <= 30) assert.equal(last.status, 401, `第 ${i} 次`);
    }
    assert.equal(last.status, 429);
    assert.equal(last.body.code, 'RATE_LIMIT');
  });

  test('整班用同一個 IP 掃碼「成功」登入不受失敗額度影響', async () => {
    const { app, db } = await setup();
    const pw = await hashPassword('abcdef12');
    for (let i = 0; i < 40; i += 1) db.data.users.push({ id: randomUUID(), name: `s${i}`, email: `s${i}@b.co`, role: 'user', passwordHash: pw });
    for (let i = 0; i < 40; i += 1) {
      const r = await request(app).post('/api/auth/login').send({ email: `s${i}@b.co`, password: 'abcdef12', joinCode: 'TESTCODE' });
      assert.equal(r.status, 200, `第 ${i + 1} 位`);
    }
  });

  test('改密碼：目前密碼連續輸錯也會鎖定', async () => {
    const { app } = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' });
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await agent.post('/api/auth/password').send({ currentPassword: 'bad', newPassword: 'newpass123' })).status, 401);
    }
    const r = await agent.post('/api/auth/password').send({ currentPassword: 'abcdef12', newPassword: 'newpass123' });
    assert.equal(r.status, 429);
  });
});
