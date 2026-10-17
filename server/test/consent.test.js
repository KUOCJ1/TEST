import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { POLICY_VERSION } from '../src/lib/policy.js';

// Sprint 12：隱私權政策與註冊同意（伺服器端強制、有紀錄）。

const JWT_SECRET = 'test-secret-please-change';
const PW = 'abcdef12';

async function setup() {
  const db = createDb(':memory:');
  // 一個「舊帳號」：沒有 consent 欄位（模擬 Sprint 12 之前就註冊的用戶）。
  db.data.users.push({ id: randomUUID(), name: '舊用戶', email: 'old@b.co', role: 'user', passwordHash: await hashPassword(PW) });
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  return { db, app };
}
const reg = (app, body) => request(app).post('/api/auth/register').send({ name: '新人', email: 'new@b.co', password: PW, ...body });

describe('註冊必須同意隱私權政策與服務條款', () => {
  test('沒帶 acceptPolicy → 400 CONSENT_REQUIRED，而且不會建立帳號', async () => {
    const { app, db } = await setup();
    const r = await reg(app, {});
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'CONSENT_REQUIRED');
    assert.equal(db.data.users.some((u) => u.email === 'new@b.co'), false);
  });

  test('acceptPolicy 不是布林 true（false、字串、1）一律不算同意', async () => {
    const { app } = await setup();
    for (const v of [false, 'true', 1, null, 'yes']) {
      const r = await reg(app, { acceptPolicy: v });
      assert.equal(r.status, 400, String(v));
      assert.equal(r.body.code, 'CONSENT_REQUIRED');
    }
  });

  test('同意後註冊成功，並記下版本與時間；回傳的使用者帶 consent', async () => {
    const { app, db } = await setup();
    const before = Date.now();
    const r = await reg(app, { acceptPolicy: true });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.consent.version, POLICY_VERSION);
    assert.ok(new Date(r.body.user.consent.acceptedAt).getTime() >= before - 1000);
    const stored = db.data.users.find((u) => u.email === 'new@b.co');
    assert.equal(stored.consent.version, POLICY_VERSION);
  });

  test('表單其他欄位有誤時照原本的驗證訊息回應（不因缺同意而蓋掉）', async () => {
    const { app } = await setup();
    const r = await reg(app, { password: 'short' });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'VALIDATION_ERROR');
  });
});

describe('既有用戶補同意', () => {
  async function loginOld(app) {
    const agent = request.agent(app);
    const r = await agent.post('/api/auth/login').send({ email: 'old@b.co', password: PW });
    assert.equal(r.status, 200);
    return { agent, user: r.body.user };
  }

  test('沒有同意紀錄的舊用戶登入後 consent 為 null（前端據此顯示同意畫面）', async () => {
    const { app } = await setup();
    const { agent, user } = await loginOld(app);
    assert.equal(user.consent, null);
    assert.equal((await agent.get('/api/auth/session')).body.user.consent, null);
  });

  test('POST /auth/consent：accept=true 才記錄；其他值 400；未登入 401', async () => {
    const { app, db } = await setup();
    assert.equal((await request(app).post('/api/auth/consent').send({ accept: true })).status, 401);
    const { agent } = await loginOld(app);
    for (const v of [undefined, false, 'true']) {
      assert.equal((await agent.post('/api/auth/consent').send(v === undefined ? {} : { accept: v })).status, 400);
    }
    assert.equal(db.data.users.find((u) => u.email === 'old@b.co').consent, undefined);

    const ok = await agent.post('/api/auth/consent').send({ accept: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.consent.version, POLICY_VERSION);
    assert.equal(db.data.users.find((u) => u.email === 'old@b.co').consent.version, POLICY_VERSION);
    // 之後重新登入看到的就是已同意。
    const again = await request.agent(app).post('/api/auth/login').send({ email: 'old@b.co', password: PW });
    assert.equal(again.body.user.consent.version, POLICY_VERSION);
  });

  test('版本落後的同意紀錄在補同意後更新到目前版本', async () => {
    const { app, db } = await setup();
    db.data.users[0].consent = { version: '2020-01-01', acceptedAt: '2020-01-01T00:00:00Z' };
    const { agent, user } = await loginOld(app);
    assert.equal(user.consent.version, '2020-01-01');
    const ok = await agent.post('/api/auth/consent').send({ accept: true });
    assert.equal(ok.body.user.consent.version, POLICY_VERSION);
  });

  test('同意寫稽核日誌', async (t) => {
    const { app } = await setup();
    const { agent } = await loginOld(app);
    const lines = [];
    t.mock.method(console, 'log', (l) => lines.push(String(l)));
    await agent.post('/api/auth/consent').send({ accept: true });
    const actions = lines.map((l) => { try { return JSON.parse(l).action; } catch { return null; } });
    assert.ok(actions.includes('accept_policy'));
  });

  test('停用帳號不能補同意（session 已失效）', async () => {
    const { app, db } = await setup();
    const { agent } = await loginOld(app);
    db.data.users[0].disabled = true;
    assert.equal((await agent.post('/api/auth/consent').send({ accept: true })).status, 401);
  });
});

describe('學員端班級資料不外洩教練專用欄位', () => {
  test('GET /groups/mine 不含待加入名單（Email）、報到代碼與催交信時間；其餘班級資訊照舊', async () => {
    const { app, db } = await setup();
    const student = db.data.users[0];
    db.data.groups.push({
      id: 'g1', name: '班', coachId: 'c1', coachName: '教練', assessmentId: 'ai-competency', memberIds: [student.id],
      pendingMembers: [{ name: '還沒註冊', email: 'secret@x.co' }], joinCode: 'ABCD2345', joinCodeCreatedAt: 'x', lastReminderSentAt: 'y',
      groupComment: '整班評語', startDate: null, endDate: null, publishedAt: null,
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'old@b.co', password: PW });
    const r = await agent.get('/api/groups/mine');
    assert.equal(r.status, 200);
    const g = r.body.groups[0];
    assert.equal(g.name, '班');
    assert.equal(g.coachName, '教練');
    assert.equal(g.groupComment, '整班評語');
    assert.ok(g.phase);
    for (const k of ['pendingMembers', 'joinCode', 'joinCodeCreatedAt', 'lastReminderSentAt']) assert.equal(k in g, false, k);
    assert.equal(JSON.stringify(r.body).includes('secret@x.co'), false);
    assert.equal(JSON.stringify(r.body).includes('ABCD2345'), false);
  });
});
