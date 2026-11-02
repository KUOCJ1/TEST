import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
// 前端的題庫設定與計分是純 JS，直接拿來產生「管理後台批次上傳」實際會送出的結果，驗證整條匯入路徑。
import * as config from '../../src/survey/data/assessments/leadership-360-70.js';
import { buildResult } from '../../src/survey/utils/scoring.js';

const ID = config.ID;

const answersOf = (v) => Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, v]));
const row = (rateeEmail, rateeName, raterType, raterEmail, raterName, v) => {
  const answers = answersOf(v);
  return { rateeEmail, rateeName, raterType, raterEmail, raterName, answers, result: buildResult(answers, config) };
};

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const admin = { id: randomUUID(), name: '管理員', email: 'admin@b.co', role: 'admin', passwordHash: pw, createdAt: new Date().toISOString() };
  db.data.users.push(admin);
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const ag = request.agent(app);
  await ag.post('/api/auth/login').send({ email: admin.email, password: 'abcdef12' });
  return { db, ag, app };
}

describe('批次匯入 70 題 360（森永高階教練）', () => {
  test('一位受評者：自評＋主管＋3 位部屬 → 建立帳號與 5 筆作答，結果通過格式檢查', async () => {
    const { db, ag } = await setup();
    const rows = [
      row('s@p.invalid', '謝玉瑟', 'self', '', '', 4),
      row('s@p.invalid', '謝玉瑟', 'manager', 'p@p.invalid', '潘信諺', 3),
      row('s@p.invalid', '謝玉瑟', 'subordinate', 'a@p.invalid', '林弘達', 5),
      row('s@p.invalid', '謝玉瑟', 'subordinate', 'b@p.invalid', '陳怡蒨', 4),
      row('s@p.invalid', '謝玉瑟', 'subordinate', 'c@p.invalid', '陳宣辰', 4),
    ];
    const res = await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows });
    assert.equal(res.status, 200);
    assert.equal(res.body.added, 5);
    assert.deepEqual(res.body.errors, []);
    assert.equal(res.body.usersCreated, 5);
    const ratee = db.data.users.find((u) => u.email === 's@p.invalid');
    assert.ok(ratee && ratee.passwordHash === null && ratee.source === 'imported');
    const subs = db.data.submissions.filter((s) => s.assessmentId === ID);
    assert.equal(subs.length, 5);
    assert.ok(subs.every((s) => s.rateeId === ratee.id));
    assert.deepEqual(subs.map((s) => s.raterType).sort(), ['manager', 'self', 'subordinate', 'subordinate', 'subordinate']);
    assert.equal(subs.find((s) => s.raterType === 'self').result.total, 280);
  });

  test('管理員可以讀到受評者的全部 360 作答；同一人可同時是別人的受評者與評分者（謝玉瑟與潘信諺）', async () => {
    const { db, ag } = await setup();
    const rows = [
      row('s@p.invalid', '謝玉瑟', 'self', '', '', 4),
      row('p@p.invalid', '潘信諺', 'self', '', '', 4),
      row('p@p.invalid', '潘信諺', 'subordinate', 's@p.invalid', '謝玉瑟', 3),
      row('s@p.invalid', '謝玉瑟', 'manager', 'p@p.invalid', '潘信諺', 5),
    ];
    const res = await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows });
    assert.equal(res.body.added, 4);
    assert.equal(res.body.usersCreated, 2); // 兩個人，不會重複建帳號
    const sId = db.data.users.find((u) => u.email === 's@p.invalid').id;
    const view = await ag.get(`/api/submissions/ratee/${sId}?assessmentId=${ID}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.submissions.length, 2); // 謝玉瑟的自評＋潘信諺的主管評
  });

  test('缺 Email 或答案超出 1–5 的列會被拒絕，其他列照常匯入', async () => {
    const { ag } = await setup();
    const bad1 = row('', '無信箱', 'self', '', '', 4);
    const good = row('g@p.invalid', '正常', 'self', '', '', 3);
    const res = await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows: [bad1, good] });
    assert.equal(res.body.added, 1);
    assert.equal(res.body.errors.length, 1);
  });
});

describe('移除批次匯入的作答（改分組後重新匯入用）', () => {
  test('只移除該評量 source=imported 的作答；學員自己填的、其他評量的不受影響；可重新匯入、沿用同一帳號', async () => {
    const { db, ag } = await setup();
    await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows: [row('s@p.invalid', '謝玉瑟', 'self', '', '', 4), row('p@p.invalid', '潘信諺', 'self', '', '', 3)] });
    const user = db.data.users.find((u) => u.email === 's@p.invalid');
    // 非匯入的作答（學員自己填）與其他評量的匯入。
    db.data.submissions.push({ id: randomUUID(), userId: user.id, rateeId: user.id, assessmentId: ID, raterType: 'self', source: undefined, answers: {}, result: {}, createdAt: new Date().toISOString() });
    db.data.submissions.push({ id: randomUUID(), userId: user.id, rateeId: user.id, assessmentId: 'ai-competency', raterType: 'self', source: 'imported', answers: {}, result: {}, createdAt: new Date().toISOString() });
    const res = await ag.delete(`/api/admin/batch-import/${ID}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.removed, 2);
    assert.equal(db.data.submissions.length, 2);
    assert.ok(db.data.submissions.some((s) => s.assessmentId === ID && s.source !== 'imported'));
    assert.ok(db.data.submissions.some((s) => s.assessmentId === 'ai-competency'));
    assert.ok(db.data.auditLog.some((e) => e.action === 'delete_imported_submissions' && e.removed === 2));
    const again = await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows: [row('s@p.invalid', '謝玉瑟', 'self', '', '', 5)] });
    assert.equal(again.body.added, 1);
    assert.equal(again.body.usersCreated, 0);
  });

  test('評量不存在 404；非管理員不能用', async () => {
    const { db, app, ag } = await setup();
    assert.equal((await ag.delete('/api/admin/batch-import/nope')).status, 404);
    const pw = await hashPassword('abcdef12');
    db.data.users.push({ id: randomUUID(), name: '教練', email: 'c@b.co', role: 'coach', passwordHash: pw, createdAt: new Date().toISOString() });
    const coach = request.agent(app);
    await coach.post('/api/auth/login').send({ email: 'c@b.co', password: 'abcdef12' });
    assert.equal((await coach.delete(`/api/admin/batch-import/${ID}`)).status, 403);
  });

  test('移除前可以預覽：筆數與受評者；只算該評量批次匯入的', async () => {
    const { db, ag } = await setup();
    await ag.post('/api/admin/batch-import').send({ assessmentId: ID, rows: [row('s@p.invalid', '謝玉瑟', 'self', '', '', 4), row('s@p.invalid', '謝玉瑟', 'manager', 'p@p.invalid', '潘信諺', 3)] });
    db.data.submissions.push({ id: randomUUID(), userId: 'x', rateeId: 'x', assessmentId: ID, raterType: 'self', answers: {}, result: {}, createdAt: new Date().toISOString() });
    const res = await ag.get(`/api/admin/batch-import/${ID}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    assert.deepEqual(res.body.ratees, [{ name: '謝玉瑟', email: 's@p.invalid' }]);
    assert.equal((await ag.get('/api/admin/batch-import/nope')).status, 404);
    const empty = await ag.get('/api/admin/batch-import/ai-competency');
    assert.equal(empty.body.count, 0);
  });
});

describe('批次匯入的最後防線', () => {
  test('結果是用別份評量算的（assessmentId 對不上上傳目標）→ 拒絕，不存入', async () => {
    const { db, ag } = await setup();
    const r = row('s@p.invalid', '謝玉瑟', 'self', '', '', 4);
    const res = await ag.post('/api/admin/batch-import').send({ assessmentId: 'ai-competency', rows: [r] });
    assert.equal(res.status, 200);
    assert.equal(res.body.added, 0);
    assert.equal(res.body.errors.length, 1);
    assert.match(res.body.errors[0].message, /不一致/);
    assert.equal(db.data.submissions.length, 0);
  });
});

describe('班級與資料的一致性警告', () => {
  const importedSub = (assessmentId, userId, extra = {}) => ({
    id: randomUUID(), userId, rateeId: userId, assessmentId, raterType: 'self', source: 'imported', answers: [], createdAt: new Date().toISOString(),
    result: { total: 1, dimensions: [{ id: 'd', average: 3 }] }, ...extra,
  });

  test('這次事故：班級用 L9D，成員的匯入作答屬於 70 題 360 → 警告；對的班級沒有警告', async () => {
    const { db, ag } = await setup();
    const u = { id: randomUUID(), name: '潘', email: 'p@p.invalid', role: 'user', passwordHash: null, createdAt: new Date().toISOString() };
    db.data.users.push(u);
    const admin = db.data.users.find((x) => x.role === 'admin');
    const wrong = { id: 'g-wrong', name: '用錯評量的班', assessmentId: 'leadership-9d', coachId: admin.id, memberIds: [u.id], startDate: null, endDate: null };
    const right = { id: 'g-right', name: '對的班', assessmentId: ID, coachId: admin.id, memberIds: [u.id], startDate: null, endDate: null };
    db.data.groups.push(wrong, right);
    db.data.submissions.push(importedSub(ID, u.id));
    const w = (await ag.get('/api/coach/groups/g-wrong')).body.warnings;
    assert.equal(w.length, 1);
    assert.equal(w[0].code, 'imported-other-assessment');
    assert.match(w[0].message, /70 題/);
    assert.deepEqual((await ag.get('/api/coach/groups/g-right')).body.warnings, []);
  });

  test('匯入的作答有構面平均 0（沒有作答）→ 警告；學員自己做的別份評量不警告', async () => {
    const { db, ag } = await setup();
    const u = { id: randomUUID(), name: '謝', email: 's@p.invalid', role: 'user', passwordHash: null, createdAt: new Date().toISOString() };
    db.data.users.push(u);
    const admin = db.data.users.find((x) => x.role === 'admin');
    db.data.groups.push({ id: 'g1', name: '班', assessmentId: 'leadership-9d', coachId: admin.id, memberIds: [u.id], startDate: null, endDate: null });
    db.data.submissions.push(importedSub('leadership-9d', u.id, { result: { total: 1, dimensions: [{ id: 'a', average: 4 }, { id: 'b', average: 0 }] } }));
    db.data.submissions.push({ ...importedSub('ai-competency', u.id), source: undefined }); // 自己做的別份評量
    const w = (await ag.get('/api/coach/groups/g1')).body.warnings;
    assert.deepEqual(w.map((x) => x.code), ['imported-blank-dimension']);
  });

  test('沒有任何問題的班級：warnings 是空陣列', async () => {
    const { db, ag } = await setup();
    const admin = db.data.users.find((x) => x.role === 'admin');
    db.data.groups.push({ id: 'g2', name: '空班', assessmentId: 'ai-competency', coachId: admin.id, memberIds: [], startDate: null, endDate: null });
    assert.deepEqual((await ag.get('/api/coach/groups/g2')).body.warnings, []);
  });
});
