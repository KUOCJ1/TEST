import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { presentRateeSubmissions, stripRaterDetails, MIN_RATERS } from '../src/lib/compassPrivacy.js';

// 領導力羅盤 360° 評分者隱私（S16）。

const JWT_SECRET = 'test-secret-please-change';
const COMPASS = 'leadership-compass';

function result(avg) {
  return {
    total: avg * 10, assessmentId: COMPASS,
    dimensions: [{ id: 'find', index: 1, name: '洞察情勢', subtitle: 'Find', color: '#111', score: avg * 4, max: 20, percent: Math.round((avg / 5) * 100), average: avg, rating: { label: '熟練' } }],
  };
}

async function setup({ peers = 3, subs = 0, managers = 0, assessmentId = COMPASS } = {}) {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw });
  const admin = mk('管理員', 'admin@b.co', 'admin');
  const coach = mk('教練', 'coach@b.co', 'coach');
  const ratee = mk('受評者', 'ratee@b.co');
  const otherCoach = mk('別班教練', 'coach2@b.co', 'coach');
  const raters = [];
  const addRaters = (n, type) => { for (let i = 0; i < n; i += 1) raters.push({ user: mk(`${type}${i}`, `${type}${i}@b.co`), type }); };
  addRaters(peers, 'peer'); addRaters(subs, 'subordinate'); addRaters(managers, 'manager');
  db.data.users.push(admin, coach, ratee, otherCoach, ...raters.map((r) => r.user));
  const group = {
    id: randomUUID(), name: '班', coachId: coach.id, assessmentId,
    memberIds: [ratee.id, ...raters.map((r) => r.user.id)],
    startDate: '2020-01-01', endDate: '2020-02-01', publishedAt: '2020-02-02', pendingMembers: [],
  };
  db.data.groups.push(group);
  const base = { assessmentId, groupId: group.id, phase: 'pre', createdAt: '2020-01-10T10:00:00.000Z' };
  db.data.submissions.push({ id: randomUUID(), userId: ratee.id, userName: ratee.name, rateeId: ratee.id, raterType: 'self', ...base, result: result(4) });
  raters.forEach((r, i) => {
    db.data.submissions.push({ id: randomUUID(), userId: r.user.id, userName: r.user.name, rateeId: ratee.id, raterType: r.type, ...base, createdAt: `2020-01-1${i}T10:00:00.000Z`, result: result(2 + (i % 3)) });
  });
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (email) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password: 'abcdef12' }); return a; };
  return { db, app, group, ratee, raters, login, agents: {
    admin: await login('admin@b.co'), coach: await login('coach@b.co'), ratee: await login('ratee@b.co'), otherCoach: await login('coach2@b.co'),
  } };
}

const noIdentity = (body) => !/peer\d|subordinate\d|manager\d|@b\.co/.test(JSON.stringify(body).replace(/ratee@b\.co/g, ''));

describe('presentRateeSubmissions（純函式）', () => {
  const sub = (type, i, avg = 3) => ({ assessmentId: COMPASS, rateeId: 'r', raterType: type, phase: 'pre', groupId: 'g', userId: `${type}${i}`, userName: `${type}${i}`, result: result(avg) });
  test('同類不足 3 位不單獨顯示；合計達 3 位才顯示「他評合計」', () => {
    const out = presentRateeSubmissions([sub('peer', 1), sub('peer', 2), sub('subordinate', 1), sub('subordinate', 2)]);
    assert.deepEqual(out.map((o) => o.raterType), ['others']);
    assert.equal(out[0].count, 4);
  });
  test('合計不足 3 位什麼都不回傳', () => {
    assert.equal(presentRateeSubmissions([sub('peer', 1), sub('subordinate', 1)]).length, 0);
  });
  test('同類 3 位 → 該類與合計都顯示，且彙整為平均、不含身分', () => {
    const out = presentRateeSubmissions([sub('peer', 1, 2), sub('peer', 2, 3), sub('peer', 3, 4)]);
    const peer = out.find((o) => o.raterType === 'peer');
    assert.equal(peer.count, 3);
    assert.equal(peer.result.dimensions[0].average, 3);
    assert.ok(noIdentity(out));
    assert.ok(out.every((o) => o.aggregate === true && !('createdAt' in o)));
  });
  test('上級預設不顯示、不併入合計；受評者同意後單獨顯示並併入合計', () => {
    const subs = [sub('peer', 1), sub('peer', 2), sub('manager', 1)];
    assert.equal(presentRateeSubmissions(subs).length, 0);
    const out = presentRateeSubmissions(subs, { managerConsent: true });
    // 同儕只有 2 位：合計扣掉已單獨顯示的上級後只剩 2 位，會被相減還原，所以不輸出合計。
    assert.deepEqual(out.map((o) => o.raterType).sort(), ['manager']);
    const more = presentRateeSubmissions([...subs, sub('peer', 3)], { managerConsent: true });
    assert.deepEqual(more.map((o) => o.raterType).sort(), ['manager', 'others', 'peer']);
  });
  test('不能用「他評合計」減去單獨顯示的類別，還原人數不足類別的分數', () => {
    // 同儕 3 位 + 部屬 1 位：合計 − 同儕 = 那一位部屬 → 不得輸出合計。
    const subs = [sub('peer', 1), sub('peer', 2), sub('peer', 3), sub('subordinate', 1)];
    const out = presentRateeSubmissions(subs);
    assert.deepEqual(out.map((o) => o.raterType), ['peer']);
    // 同儕 3 + 部屬 2：合計 − 同儕 = 2 位部屬的平均，同樣不得輸出。
    const out2 = presentRateeSubmissions([...subs, sub('subordinate', 2)]);
    assert.deepEqual(out2.map((o) => o.raterType), ['peer']);
    // 同儕 3 + 部屬 3：兩類都單獨顯示，合計是兩者的組合，不洩漏新資訊。
    const out3 = presentRateeSubmissions([...subs, sub('subordinate', 2), sub('subordinate', 3)]);
    assert.deepEqual(out3.map((o) => o.raterType).sort(), ['others', 'peer', 'subordinate']);
    // 同儕 2 + 部屬 1：都不足，合計 3 位才顯示，且沒有任何單獨顯示的類別可相減。
    const out4 = presentRateeSubmissions([sub('peer', 1), sub('peer', 2), sub('subordinate', 1)]);
    assert.deepEqual(out4.map((o) => o.raterType), ['others']);
  });
  test('其他題庫與自評原樣通過', () => {
    const self = { assessmentId: COMPASS, raterType: 'self', userId: 'u' };
    const other = { assessmentId: 'leadership-9d', raterType: 'peer', userId: 'p1', userName: '甲' };
    const out = presentRateeSubmissions([self, other]);
    assert.deepEqual(out, [self, other]);
  });
  test('門檻常數為 3', () => assert.equal(MIN_RATERS, 3));
});

describe('stripRaterDetails（教練總覽）', () => {
  test('只對嚴格隱私題庫的他評去識別化並拿掉分數與時間', () => {
    const out = stripRaterDetails([
      { id: 'a', assessmentId: COMPASS, raterType: 'peer', rateeId: 'r', userId: 'p', userName: '甲', createdAt: 'x', result: result(3), groupId: 'g', phase: 'pre' },
      { id: 'b', assessmentId: COMPASS, raterType: 'self', userId: 'r', userName: '乙', result: result(3) },
      { id: 'c', assessmentId: 'leadership-9d', raterType: 'peer', userId: 'p', userName: '丙', result: result(3) },
    ]);
    assert.equal(out[0].userId, 'anonymous');
    assert.ok(!('result' in out[0]) && !('createdAt' in out[0]));
    assert.equal(out[0].raterType, 'peer');
    assert.equal(out[1].userName, '乙');
    assert.equal(out[2].userName, '丙');
  });
});

describe('受評者端與教練端（API）', () => {
  test('受評者與教練看到的他評都是彙整，沒有任何評分者身分；教練帶 deanonymize 也一樣', async () => {
    const { agents, ratee } = await setup({ peers: 3 });
    for (const [name, agent] of [['ratee', agents.ratee], ['coach', agents.coach]]) {
      const res = await agent.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}&deanonymize=1`);
      assert.equal(res.status, 200, name);
      const others = res.body.submissions.filter((s) => s.raterType !== 'self');
      assert.ok(others.length > 0, name);
      assert.ok(others.every((s) => s.aggregate), name);
      assert.ok(noIdentity(res.body), name);
    }
  });

  test('同儕只有 2 位時，受評者與教練都看不到任何他評', async () => {
    const { agents, ratee } = await setup({ peers: 2 });
    for (const agent of [agents.ratee, agents.coach]) {
      const res = await agent.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}`);
      assert.equal(res.body.submissions.filter((s) => s.raterType !== 'self').length, 0);
    }
  });

  test('上級評分：受評者同意前看不到，同意後才出現，撤回即消失', async () => {
    const { agents, ratee } = await setup({ peers: 3, managers: 1 });
    const get = async () => (await agents.ratee.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}`)).body.submissions.map((s) => s.raterType);
    assert.ok(!(await get()).includes('manager'));
    const on = await agents.ratee.put('/api/auth/compass-manager-share').send({ granted: true });
    assert.equal(on.status, 200);
    assert.equal(on.body.user.compassManagerShare.granted, true);
    assert.ok((await get()).includes('manager'));
    await agents.ratee.put('/api/auth/compass-manager-share').send({ granted: false });
    assert.ok(!(await get()).includes('manager'));
  });

  test('同意狀態只接受布林值', async () => {
    const { agents } = await setup();
    const bad = await agents.ratee.put('/api/auth/compass-manager-share').send({ granted: 'yes' });
    assert.equal(bad.status, 400);
  });

  test('教練總覽與班級詳情不洩漏評分者身分或個別分數，但保留回收進度', async () => {
    const { agents, group } = await setup({ peers: 3 });
    const detail = await agents.coach.get(`/api/coach/groups/${group.id}`);
    assert.equal(detail.status, 200);
    const others = detail.body.submissions.filter((s) => s.raterType === 'peer');
    assert.equal(others.length, 3);
    assert.ok(others.every((s) => s.anonymized && s.userId === 'anonymous' && !s.result && !s.createdAt));
    assert.ok(noIdentity(detail.body.submissions));
    const overview = await agents.coach.get('/api/coach/overview');
    assert.ok(noIdentity(overview.body.submissions));
  });

  test('別班教練看不到這位受評者', async () => {
    const { agents, ratee } = await setup();
    const res = await agents.otherCoach.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}`);
    assert.equal(res.status, 403);
  });
});

describe('管理員還原身分', () => {
  test('沒有 deanonymize 時管理員看到的也是彙整', async () => {
    const { agents, ratee } = await setup({ peers: 3 });
    const res = await agents.admin.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}`);
    assert.ok(res.body.submissions.filter((s) => s.raterType !== 'self').every((s) => s.aggregate));
  });

  test('要求還原但沒填理由 → 400，且不洩漏', async () => {
    const { agents, ratee } = await setup({ peers: 3 });
    const res = await agents.admin.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}&deanonymize=1`);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'REASON_REQUIRED');
    assert.ok(noIdentity(res.body));
  });

  test('填理由後可還原，並寫入稽核紀錄', async () => {
    const { agents, ratee } = await setup({ peers: 3 });
    const lines = [];
    const orig = console.log;
    console.log = (l) => { lines.push(l); };
    let res;
    try {
      res = await agents.admin.get(`/api/submissions/ratee/${ratee.id}?assessmentId=${COMPASS}&deanonymize=1&reason=${encodeURIComponent('客訴調查需要確認評分者')}`);
    } finally { console.log = orig; }
    assert.equal(res.status, 200);
    const peers = res.body.submissions.filter((s) => s.raterType === 'peer');
    assert.equal(peers.length, 3);
    assert.ok(peers.every((s) => /^peer\d$/.test(s.userName)));
    const audit = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((a) => a?.action === 'view_rater_identity');
    assert.ok(audit);
    assert.equal(audit.rateeId, ratee.id);
    assert.equal(audit.reason, '客訴調查需要確認評分者');
  });
});

describe('其他題庫完全不受影響（L9D）', () => {
  test('教練看 L9D 的他評仍可還原身分，與過去一致', async () => {
    const { agents, ratee } = await setup({ peers: 2, assessmentId: 'leadership-9d' });
    const res = await agents.coach.get(`/api/submissions/ratee/${ratee.id}?assessmentId=leadership-9d&deanonymize=1`);
    const peers = res.body.submissions.filter((s) => s.raterType === 'peer');
    assert.equal(peers.length, 2);
    assert.ok(peers.every((s) => /^peer\d$/.test(s.userName) && !s.aggregate));
  });
});

describe('比較基準（benchmark）只算自評', () => {
  test('領導力羅盤：評分者的他評不會被當成他本人的最新成績', async () => {
    const { agents, db } = await setup({ peers: 3 });
    // setup：1 份自評（平均 4）＋ 3 份同儕他評（平均 2、3、4）。他評提交的 userId 是評分者。
    const res = await agents.ratee.get(`/api/assessments/${COMPASS}/benchmark`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.dimensionAverages.find((d) => d.id === 'find').percent, 80);
    assert.equal(db.data.submissions.length, 4);
  });

  test('L9D 維持原本算法（決策待產品確認：他評提交仍會被算入）', async () => {
    const { agents } = await setup({ peers: 3, assessmentId: 'leadership-9d' });
    const res = await agents.ratee.get('/api/assessments/leadership-9d/benchmark');
    assert.equal(res.body.count, 4);
  });
});
