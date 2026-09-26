import { test, describe } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { deepHealthCheck, checkAndAlert } from '../src/lib/health.js';

const JWT_SECRET = 'test-secret-please-change';

function setup() {
  return createApp({ db: createDb(':memory:'), jwtSecret: JWT_SECRET });
}

describe('GET /api/health', () => {
  test('沒有 ?deep 時維持原本輕量檢查，不打外部網路', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('不該被呼叫'); });
    const res = await request(setup()).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.deps, undefined);
    // 測試環境沒有 deploy.sh 寫的 build-info.json：版本欄位存在但為 null。
    assert.deepEqual(res.body.version, { commit: null, builtAt: null });
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

describe('checkAndAlert()：狀態變化才寄告警（Sprint 6 驗收條件 6.1、6.2）', () => {
  const healthy = () => ({ secondBrain: { baseUrl: 'https://brain.test', ok: true, status: 200 }, openRouter: { configured: true } });
  const brainDown = () => ({ secondBrain: { baseUrl: 'https://brain.test', ok: false, error: 'ECONNREFUSED' }, openRouter: { configured: true } });

  function harness() {
    const db = createDb(':memory:');
    const sent = [];
    const send = async (msg) => { sent.push(msg); return { ok: true }; };
    const run = (check) => checkAndAlert(db, { adminEmail: 'ops@b.co', check, send });
    return { db, sent, run };
  }

  test('第一次只記錄基準狀態、不寄信（即使當下就是異常）', async () => {
    const { db, sent, run } = harness();
    const r = await run(brainDown);
    assert.equal(r.baseline, true);
    assert.equal(sent.length, 0);
    assert.equal(db.data.systemStatus[0].secondBrainOk, false);
  });

  test('狀態沒變就不寄；正常→異常寄一封告警、異常→正常寄一封恢復', async () => {
    const { sent, run } = harness();
    await run(healthy);
    await run(healthy);
    assert.equal(sent.length, 0, '狀態沒變不該寄信');

    const down = await run(brainDown);
    assert.deepEqual(down.changes.map((c) => [c.key, c.ok]), [['secondBrainOk', false]]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ops@b.co');
    assert.match(sent[0].subject, /異常/);
    assert.match(sent[0].text, /ECONNREFUSED/);

    await run(brainDown);
    await run(brainDown);
    assert.equal(sent.length, 1, '持續異常不該重複寄信');

    await run(healthy);
    assert.equal(sent.length, 2);
    assert.match(sent[1].subject, /已恢復/);
  });

  test('OpenRouter 金鑰被移除也會告警', async () => {
    const { sent, run } = harness();
    await run(healthy);
    await run(() => ({ ...healthy(), openRouter: { configured: false } }));
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /OpenRouter/);
  });

  test('狀態真的寫進資料庫檔案：重啟（重新從檔案載入）後不會誤判成變化而多寄', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-watch-'));
    const file = path.join(dir, 'db.json');
    const sent = [];
    const send = async (msg) => { sent.push(msg); return { ok: true }; };
    try {
      await checkAndAlert(createDb(file), { adminEmail: 'ops@b.co', check: healthy, send });
      await checkAndAlert(createDb(file), { adminEmail: 'ops@b.co', check: brainDown, send });
      assert.equal(sent.length, 1, '重啟後讀回「正常」基準，偵測到變異常應寄一封');
      // 再「重啟」一次，仍是異常：讀回的上次狀態已是異常，不該再寄。
      const reloaded = createDb(file);
      assert.equal(reloaded.data.systemStatus[0].secondBrainOk, false);
      await checkAndAlert(reloaded, { adminEmail: 'ops@b.co', check: brainDown, send });
      assert.equal(sent.length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('寄信失敗（例如 SMTP 沒設定）仍更新狀態，不會每一輪都重判成變化', async () => {
    const db = createDb(':memory:');
    let attempts = 0;
    const send = async () => { attempts += 1; return { ok: false, code: 'CONFIG_ERROR' }; };
    await checkAndAlert(db, { adminEmail: 'ops@b.co', check: healthy, send });
    await checkAndAlert(db, { adminEmail: 'ops@b.co', check: brainDown, send });
    await checkAndAlert(db, { adminEmail: 'ops@b.co', check: brainDown, send });
    assert.equal(attempts, 1);
    assert.equal(db.data.systemStatus[0].secondBrainOk, false);
  });
});
