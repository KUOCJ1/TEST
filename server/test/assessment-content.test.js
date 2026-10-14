import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { sanitizeOverrides, sanitizeNote, HISTORY_LIMIT } from '../src/lib/assessmentContent.js';

// 題庫內容後台編輯（Sprint 10 驗收條件 10.1）：草稿 → 發佈 → 還原。

const JWT_SECRET = 'test-secret-please-change';

async function setup() {
  const db = createDb(':memory:');
  db.data.users.push(
    { id: randomUUID(), name: '管理員', email: 'admin@b.co', role: 'admin', passwordHash: await hashPassword('abcdef12') },
    { id: randomUUID(), name: '教練', email: 'c@b.co', role: 'coach', passwordHash: await hashPassword('abcdef12') },
    { id: randomUUID(), name: '學員', email: 'u@b.co', role: 'user', passwordHash: await hashPassword('abcdef12') },
  );
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'abcdef12' });
    return agent;
  };
  return { db, app, admin: await login('admin@b.co'), coach: await login('c@b.co'), user: await login('u@b.co') };
}

const ID = 'leadership-9d';
const draft = (agent, overrides) => agent.put(`/api/admin/assessment-content/${ID}/draft`).send({ overrides });
const publish = (agent, note = '改錯字') => agent.post(`/api/admin/assessment-content/${ID}/publish`).send({ note });

describe('sanitizeOverrides()', () => {
  test('只留白名單欄位、去頭尾空白、空字串視為「用內建原文」而丟掉', () => {
    const out = sanitizeOverrides({
      dimensions: { communication: { name: '  溝通力 ', subtitle: '' } },
      questions: { l1: ' 新題目 ', l2: '   ' },
      commentary: { listening: { high: '很棒', mid: '', low: '待加強' } },
      levels: { explorer: { desc: '說明' } },
    });
    assert.deepEqual(out.dimensions, { communication: { name: '溝通力' } });
    assert.deepEqual(out.questions, { l1: '新題目' });
    assert.deepEqual(out.commentary, { listening: { high: '很棒', low: '待加強' } });
    assert.deepEqual(out.levels, { explorer: { desc: '說明' } });
    assert.deepEqual(out.subDimensions, {});
  });

  test('拒絕會影響計分的欄位與未知群組（reversed、min、max、badge 都不收）', () => {
    assert.throws(() => sanitizeOverrides({ questions: { l1: { reversed: true } } }), /必須是文字/);
    assert.throws(() => sanitizeOverrides({ levels: { explorer: { min: 1 } } }), /不支援欄位：min/);
    assert.throws(() => sanitizeOverrides({ levels: { explorer: { badge: 'x' } } }), /不支援欄位：badge/);
    assert.throws(() => sanitizeOverrides({ scoring: {} }), /不支援的欄位群組/);
  });

  test('拒絕不合法的 key、超過字數、非物件', () => {
    assert.throws(() => sanitizeOverrides({ questions: { '../x': 'a' } }), /不合法的代碼/);
    assert.throws(() => sanitizeOverrides({ questions: { l1: 'a'.repeat(201) } }), /超過 200 字/);
    assert.throws(() => sanitizeOverrides({ dimensions: { d: { name: 'a'.repeat(41) } } }), /超過 40 字/);
    assert.throws(() => sanitizeOverrides(null), /格式不正確/);
    assert.throws(() => sanitizeOverrides([]), /格式不正確/);
    assert.throws(() => sanitizeOverrides({ questions: ['a'] }), /格式不正確/);
  });

  test('sanitizeNote：必填、有上限', () => {
    assert.equal(sanitizeNote(' 改錯字 '), '改錯字');
    assert.throws(() => sanitizeNote(''), /請填寫/);
    assert.throws(() => sanitizeNote(undefined), /請填寫/);
    assert.throws(() => sanitizeNote('a'.repeat(101)), /不可超過/);
  });
});

describe('題庫內容 API 權限', () => {
  test('寫入／讀草稿只有管理者；教練與學員 403、未登入 401', async () => {
    const { app, coach, user } = await setup();
    for (const agent of [coach, user]) {
      assert.equal((await agent.get(`/api/admin/assessment-content/${ID}`)).status, 403);
      assert.equal((await draft(agent, {})).status, 403);
      assert.equal((await publish(agent)).status, 403);
      assert.equal((await agent.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 0 })).status, 403);
      assert.equal((await agent.delete(`/api/admin/assessment-content/${ID}/draft`)).status, 403);
    }
    assert.equal((await request(app).get(`/api/admin/assessment-content/${ID}`)).status, 401);
    assert.equal((await request(app).get('/api/assessments/content')).status, 401);
  });

  test('不存在的題庫 404', async () => {
    const { admin } = await setup();
    assert.equal((await admin.get('/api/admin/assessment-content/nope')).status, 404);
    assert.equal((await admin.put('/api/admin/assessment-content/nope/draft').send({ overrides: {} })).status, 404);
  });
});

describe('草稿 → 發佈 → 還原', () => {
  test('沒有發佈過時，公開端點回空；草稿不會被學員看到', async () => {
    const { admin, user } = await setup();
    assert.deepEqual((await user.get('/api/assessments/content')).body, { content: {} });
    const r = await draft(admin, { questions: { l1: '草稿題目' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.content.draft.overrides.questions.l1, '草稿題目');
    assert.deepEqual((await user.get('/api/assessments/content')).body, { content: {} });
  });

  test('發佈需要草稿與備註；發佈後學員看到新版本、草稿清空', async () => {
    const { admin, user } = await setup();
    assert.equal((await publish(admin)).status, 400); // 沒有草稿
    await draft(admin, { questions: { l1: '新題目' }, dimensions: { communication: { name: '溝通' } } });
    const noNote = await admin.post(`/api/admin/assessment-content/${ID}/publish`).send({});
    assert.equal(noNote.status, 400);
    assert.match(noNote.body.error, /備註/);

    const pub = await publish(admin, '潤飾第一題');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.content.published.version, 1);
    assert.equal(pub.body.content.published.note, '潤飾第一題');
    assert.equal(pub.body.content.published.publishedByName, '管理員');
    assert.equal(pub.body.content.draft, null);
    assert.equal(pub.body.content.history.length, 1);

    const pubView = (await user.get('/api/assessments/content')).body.content[ID];
    assert.equal(pubView.version, 1);
    assert.equal(pubView.overrides.questions.l1, '新題目');
    assert.equal(pubView.overrides.dimensions.communication.name, '溝通');
  });

  test('改草稿不影響已發佈版本；再發佈版本號遞增', async () => {
    const { admin, user } = await setup();
    await draft(admin, { questions: { l1: 'v1' } });
    await publish(admin, 'v1');
    await draft(admin, { questions: { l1: 'v2 草稿' } });
    assert.equal((await user.get('/api/assessments/content')).body.content[ID].overrides.questions.l1, 'v1');
    const second = await publish(admin, 'v2');
    assert.equal(second.body.content.published.version, 2);
    assert.equal((await user.get('/api/assessments/content')).body.content[ID].overrides.questions.l1, 'v2 草稿');
  });

  test('丟棄草稿', async () => {
    const { admin } = await setup();
    await draft(admin, { questions: { l1: 'x' } });
    const r = await admin.delete(`/api/admin/assessment-content/${ID}/draft`);
    assert.equal(r.status, 200);
    assert.equal(r.body.content.draft, null);
  });

  test('還原到舊版本＝發佈一個新版本，歷史不被改寫', async () => {
    const { admin, user } = await setup();
    await draft(admin, { questions: { l1: 'A' } }); await publish(admin, 'A');
    await draft(admin, { questions: { l1: 'B' } }); await publish(admin, 'B');
    const r = await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.content.published.version, 3);
    assert.equal(r.body.content.published.kind, 'rollback');
    assert.equal(r.body.content.published.rolledBackTo, 1);
    assert.deepEqual(r.body.content.history.map((h) => h.version), [3, 2, 1]);
    assert.equal((await user.get('/api/assessments/content')).body.content[ID].overrides.questions.l1, 'A');
  });

  test('還原成內建原文（version 0）：學員拿到空覆寫；已經是內建時 400', async () => {
    const { admin, user } = await setup();
    const already = await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 0 });
    assert.equal(already.status, 400);
    await draft(admin, { questions: { l1: 'A' } }); await publish(admin, 'A');
    const r = await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 0 });
    assert.equal(r.status, 200);
    const content = (await user.get('/api/assessments/content')).body.content[ID];
    assert.equal(content.version, 2);
    assert.deepEqual(content.overrides.questions, {});
  });

  test('還原不存在的版本 404、參數不合法 400', async () => {
    const { admin } = await setup();
    await draft(admin, { questions: { l1: 'A' } }); await publish(admin, 'A');
    assert.equal((await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 99 })).status, 404);
    assert.equal((await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 'x' })).status, 400);
    assert.equal((await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({})).status, 400);
  });

  test(`歷史最多保留 ${HISTORY_LIMIT} 筆，版本號不會因此重複`, async () => {
    const { admin } = await setup();
    for (let i = 1; i <= HISTORY_LIMIT + 3; i++) {
      await draft(admin, { questions: { l1: `v${i}` } });
      await publish(admin, `第 ${i} 版`);
    }
    const r = await admin.get(`/api/admin/assessment-content/${ID}`);
    assert.equal(r.body.content.history.length, HISTORY_LIMIT);
    assert.equal(r.body.content.published.version, HISTORY_LIMIT + 3);
    assert.equal(r.body.content.history[0].version, HISTORY_LIMIT + 3);
    const versions = r.body.content.history.map((h) => h.version);
    assert.equal(new Set(versions).size, versions.length);
  });

  test('不影響已作答資料：發佈前後既有作答的 result 一字不變', async () => {
    const { db, admin } = await setup();
    const result = { total: 200, dimensions: [{ id: 'communication', name: '溝通力', score: 10, max: 20, rating: { label: '熟練' } }], level: { id: 'developer', badge: '📈 領導發展期' } };
    db.data.submissions.push({ id: 's1', userId: 'u1', assessmentId: ID, phase: 'pre', result, answers: { l1: 3 }, createdAt: new Date().toISOString() });
    const before = JSON.stringify(db.data.submissions);
    await draft(admin, { dimensions: { communication: { name: '全新名稱' } }, levels: { developer: { desc: '新說明' } } });
    await publish(admin, '改名');
    assert.equal(JSON.stringify(db.data.submissions), before);
  });

  test('草稿格式錯誤 400，且不會寫入', async () => {
    const { admin } = await setup();
    const r = await draft(admin, { levels: { explorer: { min: 5 } } });
    assert.equal(r.status, 400);
    const view = await admin.get(`/api/admin/assessment-content/${ID}`);
    assert.equal(view.body.content.draft, null);
  });

  test('發佈與還原寫稽核日誌', async (t) => {
    const { admin } = await setup();
    const lines = [];
    t.mock.method(console, 'log', (l) => lines.push(String(l)));
    await draft(admin, { questions: { l1: 'A' } }); await publish(admin, 'A');
    await admin.post(`/api/admin/assessment-content/${ID}/rollback`).send({ version: 0 });
    const actions = lines.map((l) => { try { return JSON.parse(l).action; } catch { return null; } });
    assert.ok(actions.includes('publish_assessment_content'));
    assert.ok(actions.includes('rollback_assessment_content'));
  });
});

describe('建立／更新班別時的題庫驗證', () => {
  test('可以用任何已知題庫建班；不認得的題庫 id 回 400；沒帶時預設 ai-competency', async () => {
    const { coach } = await setup();
    for (const id of ['ai-competency', 'leadership-9d', 'disc', 'archetype']) {
      const r = await coach.post('/api/coach/groups').send({ name: `班-${id}`, assessmentId: id });
      assert.equal(r.status, 201, id);
      assert.equal(r.body.group.assessmentId, id);
    }
    const bad = await coach.post('/api/coach/groups').send({ name: '壞班', assessmentId: 'no-such' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /評量不存在/);
    const bad2 = await coach.post('/api/coach/groups').send({ name: '壞班2', assessmentId: { $ne: 1 } });
    assert.equal(bad2.status, 400);
    const dflt = await coach.post('/api/coach/groups').send({ name: '預設班' });
    assert.equal(dflt.body.group.assessmentId, 'ai-competency');
  });

  test('更新班別時改成不存在的題庫也擋下', async () => {
    const { coach } = await setup();
    const g = await coach.post('/api/coach/groups').send({ name: '班', assessmentId: 'ai-competency' });
    const ok = await coach.put(`/api/coach/groups/${g.body.group.id}`).send({ assessmentId: 'leadership-9d' });
    assert.equal(ok.status, 200);
    const bad = await coach.put(`/api/coach/groups/${g.body.group.id}`).send({ assessmentId: 'no-such' });
    assert.equal(bad.status, 400);
  });
});
