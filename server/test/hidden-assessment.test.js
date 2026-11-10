import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

// 客戶專案專用題庫（hidden）：教練與管理員看得到；一般學員只有在班級使用它時才看得到。
// 八大構面（70 題）是目前唯一的 hidden 題庫（授權確認前先維持客戶專案專用）。

const ID = 'leadership-360-70';

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const member = mk('成員', 'm@b.co'); const outsider = mk('外人', 'o@b.co');
  const coach = mk('教練', 'c@b.co', 'coach'); const admin = mk('管理員', 'a@b.co', 'admin');
  db.data.users.push(member, outsider, coach, admin);
  db.data.groups.push({ id: 'g1', name: '森永高階教練 360', assessmentId: ID, coachId: coach.id, memberIds: [member.id], startDate: new Date(Date.now() - 864e5).toISOString(), endDate: null });
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const ids = async (u) => {
    const ag = request.agent(app);
    await ag.post('/api/auth/login').send({ email: u.email, password: 'abcdef12' });
    return (await ag.get('/api/assessments')).body.assessments.map((a) => a.id);
  };
  return { db, member, outsider, coach, admin, ids };
}

describe('hidden 題庫的可見範圍', () => {
  test('八大構面標為 hidden、預設啟用（題目授權確認前，先維持客戶專案專用）', async () => {
    const s = await setup();
    const rec = s.db.data.assessments.find((a) => a.id === ID);
    assert.equal(rec.enabled, true);
    assert.equal(rec.hidden, true);
    assert.equal(rec.name, '經贏® 領導力八大構面行為評量（70 題）');
  });

  test('曾經公開過的舊資料庫（沒有 hidden、或用舊名稱）啟動時會被設回 hidden 並更名（正式站遷移）', async () => {
    const os = await import('node:os'); const fs = await import('node:fs'); const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidden-migrate-'));
    const file = path.join(dir, 'db.json');
    try {
      const first = createDb(file);
      const rec = first.data.assessments.find((a) => a.id === ID);
      delete rec.hidden; rec.name = '經贏® 領導力 360° 行為評量（70 題）';
      first.persist();
      const second = createDb(file);
      const after = second.data.assessments.find((a) => a.id === ID);
      assert.equal(after.hidden, true);
      assert.equal(after.name, '經贏® 領導力八大構面行為評量（70 題）');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('班級使用它的成員、教練、管理員看得到；沒有加入的一般學員看不到', async () => {
    const s = await setup();
    assert.ok((await s.ids(s.member)).includes(ID));
    assert.ok((await s.ids(s.coach)).includes(ID));
    assert.ok((await s.ids(s.admin)).includes(ID));
    assert.ok(!(await s.ids(s.outsider)).includes(ID));
  });

  test('其他評量（AI 職能）不受影響，仍然對所有人可見', async () => {
    const s = await setup();
    assert.ok((await s.ids(s.outsider)).includes('ai-competency'));
  });
});
