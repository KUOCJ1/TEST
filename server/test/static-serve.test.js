import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

// 單一 Node 主機（如 Hostinger Node.js 託管）：由 API 程式一併提供前端靜態檔。
describe('STATIC_DIR 選用的前端靜態檔服務', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>spa</title>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-abc.js'), 'console.log(1)');
  const mk = (staticDir, cspMode) => createApp({ db: createDb(':memory:'), jwtSecret: 'test-secret-please-change', staticDir, cspMode });

  test('沒設定 staticDir：不提供前端（行為與 VPS 正式站相同）', async () => {
    const res = await request(mk('')).get('/privacy');
    assert.equal(res.status, 404);
  });

  test('有設定：首頁、前端路由回退到 index.html，資產可長期快取', async () => {
    const app = mk(dir);
    const home = await request(app).get('/');
    assert.equal(home.status, 200);
    assert.match(home.text, /spa/);
    assert.equal(home.headers['cache-control'], 'no-cache');
    const route = await request(app).get('/privacy');
    assert.equal(route.status, 200);
    assert.match(route.text, /spa/);
    const asset = await request(app).get('/assets/app-abc.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers['cache-control'], /immutable/);
  });

  test('API 路徑不會被前端回退吃掉：不存在的 /api 路徑仍是 404 而不是 index.html', async () => {
    const app = mk(dir);
    const health = await request(app).get('/api/health');
    assert.equal(health.status, 200);
    const missing = await request(app).get('/api/not-a-route');
    assert.notEqual(missing.status, 200);
    assert.doesNotMatch(missing.text, /spa/);
  });

  test('資料夾沒有 index.html 時忽略設定，不丟例外', async () => {
    const res = await request(mk(os.tmpdir())).get('/privacy');
    assert.equal(res.status, 404);
  });

  test('安全標頭：預設 CSP 只回報不擋；enforce 才正式啟用；off 不加', async () => {
    const rep = await request(mk(dir)).get('/');
    assert.match(rep.headers['content-security-policy-report-only'], /default-src 'self'/);
    assert.equal(rep.headers['content-security-policy'], undefined);
    assert.equal(rep.headers['x-content-type-options'], 'nosniff');
    assert.equal(rep.headers['x-frame-options'], 'DENY');
    const enf = await request(mk(dir, 'enforce')).get('/');
    assert.match(enf.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(enf.headers['content-security-policy-report-only'], undefined);
    const off = await request(mk(dir, 'off')).get('/');
    assert.equal(off.headers['content-security-policy'], undefined);
    assert.equal(off.headers['content-security-policy-report-only'], undefined);
  });
});
