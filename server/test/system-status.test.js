import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { isInternalIp } from '../src/routes/admin.js';

// 管理後台「系統狀態」（Sprint 7 驗收條件 7.1、7.3）。

const JWT_SECRET = 'test-secret-please-change';

async function setup({ trustProxy = 0 } = {}) {
  const db = createDb(':memory:');
  db.data.users.push(
    { id: randomUUID(), name: '管理員', email: 'admin@b.co', role: 'admin', passwordHash: await hashPassword('abcdef12') },
    { id: randomUUID(), name: '學員', email: 'u@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') },
  );
  const app = createApp({ db, jwtSecret: JWT_SECRET, trustProxy });
  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'abcdef12' });
    return agent;
  };
  return { db, admin: await login('admin@b.co'), user: await login('u@b.co') };
}

describe('isInternalIp()', () => {
  test('本機、內網、IPv4-mapped 位址視為內部', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.1', '192.168.1.10', '169.254.1.1', 'fd12:3456::1', 'fe80::1', '', undefined]) {
      assert.equal(isInternalIp(ip), true, String(ip));
    }
  });
  test('公網位址視為外部', () => {
    for (const ip of ['203.0.113.5', '::ffff:8.8.8.8', '172.32.0.1', '172.15.0.1', '2001:db8::1']) {
      assert.equal(isInternalIp(ip), false, ip);
    }
  });
});

describe('GET /api/admin/system-status', () => {
  test('一般使用者不能看（403）', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const { user } = await setup();
    assert.equal((await user.get('/api/admin/system-status')).status, 403);
  });

  test('回報版本、外部依賴、寄信設定、告警排程最後檢查時間', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const { db, admin } = await setup();
    db.data.systemStatus.push({ id: 'deepHealth', secondBrainOk: true, openRouterConfigured: false, checkedAt: '2026-09-26T03:00:00Z' });
    const res = await admin.get('/api/admin/system-status');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.version, { commit: null, builtAt: null });
    assert.equal(res.body.deps.secondBrain.ok, true);
    assert.equal(typeof res.body.mail.configured, 'boolean');
    assert.equal(res.body.healthWatch.lastCheckedAt, '2026-09-26T03:00:00Z');
  });

  test('TRUST_PROXY 為 0：就算帶了 X-Forwarded-For，伺服器看到的仍是本機位址，並標示為內部', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const { admin } = await setup({ trustProxy: 0 });
    const res = await admin.get('/api/admin/system-status').set('X-Forwarded-For', '203.0.113.5');
    assert.equal(res.body.connection.ipLooksInternal, true);
    assert.equal(res.body.connection.forwardedFor, '203.0.113.5');
    assert.equal(res.body.connection.trustProxy, 0);
  });

  test('TRUST_PROXY 設對時，伺服器看到的是代理轉過來的真實使用者 IP', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const { admin } = await setup({ trustProxy: 1 });
    const res = await admin.get('/api/admin/system-status').set('X-Forwarded-For', '203.0.113.5');
    assert.equal(res.body.connection.ip, '203.0.113.5');
    assert.equal(res.body.connection.ipLooksInternal, false);
  });
});
