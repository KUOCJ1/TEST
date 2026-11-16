import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('教練評語範本（Sprint 28）', () => {
  async function world() {
    const db = createDb(':memory:');
    const pw = await hashPassword('abcdef12');
    const mk = (name, email, role) => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString(), preferences: {} });
    db.data.users.push(mk('教練甲', 'a@b.co', 'coach'), mk('教練乙', 'b@b.co', 'coach'), mk('學員', 's@b.co', 'user'));
    const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
    const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
    return { db, a: await login('a@b.co'), b: await login('b@b.co'), s: await login('s@b.co') };
  }

  test('存取自己的範本；每位教練各自獨立；跨裝置（重新登入）仍在', async () => {
    const { a, b } = await world();
    const put = await a.put('/api/coach/comment-templates').send({ templates: [{ name: '穩健開場', text: '整體穩健', tips: ['建議一', '', '建議二'] }] });
    assert.equal(put.status, 200);
    assert.equal(put.body.templates.length, 1);
    assert.deepEqual(put.body.templates[0].tips, ['建議一', '建議二']);
    assert.ok(put.body.templates[0].id);
    assert.equal((await a.get('/api/coach/comment-templates')).body.templates.length, 1);
    assert.equal((await b.get('/api/coach/comment-templates')).body.templates.length, 0);
  });

  test('清洗：沒名稱或沒內容的丟掉、上限 30 個、長度截斷；學員不能用', async () => {
    const { a, s } = await world();
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `範本${i}`, text: 'x'.repeat(5000), tips: [] }));
    many.push({ name: '', text: '沒名稱' }, { name: '沒內容', text: '  ' });
    const res = await a.put('/api/coach/comment-templates').send({ templates: many });
    assert.equal(res.body.templates.length, 30);
    assert.equal(res.body.templates[0].text.length, 2000);
    assert.equal((await s.get('/api/coach/comment-templates')).status, 403);
    assert.equal((await s.put('/api/coach/comment-templates').send({ templates: [] })).status, 403);
  });
});
