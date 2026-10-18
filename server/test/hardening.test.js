import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

const JWT_SECRET = 'test-secret-please-change';

describe('舊版 JSON 資料遷移', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-'));

  test('合法的舊檔會遷移進 SQLite，原檔保留不動', () => {
    const dir = tmp();
    const file = path.join(dir, 'db.json');
    fs.writeFileSync(file, JSON.stringify({ users: [{ id: 'u1', name: '舊用戶', email: 'old@b.co' }], submissions: [] }));
    const db = createDb(file);
    assert.equal(db.data.users.length, 1);
    assert.ok(fs.existsSync(file), '原檔保留');
    assert.ok(fs.existsSync(`${file}.sqlite3`));
    db.persist();
    assert.equal(createDb(file).data.users[0].name, '舊用戶', '重新開啟從 SQLite 讀回');
  });

  test('舊檔毀損時拒絕啟動，不會默默當成全新安裝', () => {
    const dir = tmp();
    const file = path.join(dir, 'db.json');
    fs.writeFileSync(file, '{ 這不是 JSON');
    assert.throws(() => createDb(file), /無法解析/);
    assert.ok(!fs.existsSync(`${file}.sqlite3`), '不會留下空的資料庫檔');
  });

  test('已經有 SQLite 檔時不再看舊檔（即使舊檔壞了）', () => {
    const dir = tmp();
    const file = path.join(dir, 'db.json');
    const first = createDb(file);
    first.persist();
    fs.writeFileSync(file, '{ 壞掉');
    assert.doesNotThrow(() => createDb(file));
  });
});

describe('API 回應標頭', () => {
  test('API 不被快取、不洩漏 x-powered-by', async () => {
    const app = createApp({ db: createDb(':memory:'), jwtSecret: JWT_SECRET });
    const res = await request(app).get('/api/health');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('深度健康檢查的快取', () => {
  test('30 秒內重複查詢不會再對外發請求', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls += 1; return { ok: true, status: 200 }; });
    const app = createApp({ db: createDb(':memory:'), jwtSecret: JWT_SECRET });
    const a = await request(app).get('/api/health?deep=1');
    const after1 = calls;
    const b = await request(app).get('/api/health?deep=1');
    assert.equal(a.status, 200);
    assert.deepEqual(b.body.deps, a.body.deps);
    assert.ok(after1 >= 1);
    assert.equal(calls, after1, '第二次直接用快取');
  });
});
