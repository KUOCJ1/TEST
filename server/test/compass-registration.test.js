import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import * as compass from '../../src/survey/data/assessments/leadership-compass.js';

// 雙環領導羅盤（S14）：後端登錄、預設停用、前端計分結果能通過後端驗證。

const JWT_SECRET = 'test-secret-please-change';
const ID = 'leadership-compass';

describe('題庫登錄', () => {
  test('全新資料庫會種入雙環領導羅盤，且預設停用', () => {
    const db = createDb(':memory:');
    const a = db.data.assessments.find((x) => x.id === ID);
    assert.ok(a);
    assert.equal(a.enabled, false);
    assert.equal(a.name, '雙環領導羅盤八大構面評測');
  });

  test('既有 L9D 等四個題庫維持啟用，完全不受影響', () => {
    const db = createDb(':memory:');
    for (const id of ['ai-competency', 'leadership-9d', 'disc', 'archetype']) {
      assert.equal(db.data.assessments.find((x) => x.id === id)?.enabled, true, id);
    }
  });

  test('停用時一般使用者的題庫清單看不到；管理者啟用後才出現', async () => {
    const db = createDb(':memory:');
    db.data.users.push(
      { id: randomUUID(), name: '管理員', email: 'admin@b.co', role: 'admin', passwordHash: await hashPassword('abcdef12') },
      { id: randomUUID(), name: '學員', email: 'u@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') },
    );
    const app = createApp({ db, jwtSecret: JWT_SECRET });
    const user = request.agent(app);
    await user.post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' });
    const before = await user.get('/api/assessments');
    assert.equal(before.status, 200);
    assert.ok(!JSON.stringify(before.body).includes(ID));

    db.data.assessments.find((x) => x.id === ID).enabled = true;
    const after = await user.get('/api/assessments');
    assert.ok(JSON.stringify(after.body).includes(ID));
  });
});

describe('前端計分結果可通過後端驗證', () => {
  test('精簡版自評結果可以成功送出並存下版本與張力', async () => {
    const db = createDb(':memory:');
    db.data.users.push({ id: randomUUID(), name: '學員', email: 'u@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') });
    const app = createApp({ db, jwtSecret: JWT_SECRET });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'u@b.co', password: 'abcdef12' });

    const view = compass.selectForm('short');
    const answers = Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, 4]));
    const result = compass.SCORING.buildResult(answers, view, { rater: 'self' });
    const res = await agent.post('/api/submissions').send({ answers, result, assessmentId: ID });
    assert.equal(res.status, 201);
    const stored = db.data.submissions.at(-1);
    assert.equal(stored.assessmentId, ID);
    assert.equal(stored.result.form, 'short');
    assert.equal(stored.result.itemVersion, compass.ITEM_VERSION);
    assert.equal(stored.result.tensions.length, 4);
  });
});

describe('接班準備度評測登錄', () => {
  test('預設停用；既有四個題庫不受影響', () => {
    const db = createDb(':memory:');
    const a = db.data.assessments.find((x) => x.id === 'succession-intent');
    assert.ok(a);
    assert.equal(a.enabled, false);
    for (const id of ['ai-competency', 'leadership-9d', 'disc', 'archetype']) {
      assert.equal(db.data.assessments.find((x) => x.id === id)?.enabled, true, id);
    }
  });
});

describe('評量改名的資料庫遷移', () => {
  test('舊的預設名稱會被換成新名稱；管理者自己改過的名稱不動', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'rename-'));
    const file = join(dir, 'db.sqlite3');

    // 模擬已上線的資料庫：羅盤還是舊名稱
    const first = createDb(file);
    first.data.assessments.find((x) => x.id === ID).name = '雙環領導羅盤';
    first.persist();

    const second = createDb(file);
    assert.equal(second.data.assessments.find((x) => x.id === ID).name, '雙環領導羅盤八大構面評測');

    // 管理者自訂的名稱不會被覆蓋
    second.data.assessments.find((x) => x.id === ID).name = '我們公司的領導力評測';
    second.persist();
    const third = createDb(file);
    assert.equal(third.data.assessments.find((x) => x.id === ID).name, '我們公司的領導力評測');
    // 種入的紀錄不帶多餘的 renamedFrom 欄位
    assert.equal('renamedFrom' in third.data.assessments.find((x) => x.id === ID), false);
  });
});

describe('接班評量改名的資料庫遷移', () => {
  test('舊名稱「接班補充問卷」會換成「接班準備度評測」；自訂名稱不動', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'rename2-')), 'db.sqlite3');
    const first = createDb(file);
    first.data.assessments.find((x) => x.id === 'succession-intent').name = '接班補充問卷';
    first.persist();
    const second = createDb(file);
    assert.equal(second.data.assessments.find((x) => x.id === 'succession-intent').name, '接班準備度評測');
    second.data.assessments.find((x) => x.id === 'succession-intent').name = '我們的接班評測';
    second.persist();
    assert.equal(createDb(file).data.assessments.find((x) => x.id === 'succession-intent').name, '我們的接班評測');
  });
});
