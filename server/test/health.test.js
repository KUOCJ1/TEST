import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { deepHealthCheck } from '../src/lib/health.js';

const JWT_SECRET = 'test-secret-please-change';

function setup() {
  return createApp({ db: createDb(':memory:'), jwtSecret: JWT_SECRET });
}

describe('GET /api/health', () => {
  test('沒有 ?deep 時維持原本輕量檢查，不打外部網路', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('不該被呼叫'); });
    const res = await request(setup()).get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  test('?deep=1 會回報第二大腦與 OpenRouter 的狀態', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
    const res = await request(setup()).get('/api/health?deep=1');
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.deps.secondBrain.ok, true);
    assert.equal(res.body.deps.openRouter.configured, true);
  });
});

describe('deepHealthCheck()', () => {
  test('第二大腦連得到時回傳 ok:true 與狀態碼', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const result = await deepHealthCheck();
    assert.equal(result.secondBrain.ok, true);
    assert.equal(result.secondBrain.status, 200);
  });

  test('第二大腦連不到（逾時/網路錯誤）時回傳 ok:false 與錯誤訊息，不丟例外', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
    const result = await deepHealthCheck();
    assert.equal(result.secondBrain.ok, false);
    assert.match(result.secondBrain.error, /network down/);
  });

  test('OPENROUTER_API_KEY 沒設定時 configured 為 false', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }));
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const result = await deepHealthCheck();
    if (original !== undefined) process.env.OPENROUTER_API_KEY = original;
    assert.equal(result.openRouter.configured, false);
  });
});
