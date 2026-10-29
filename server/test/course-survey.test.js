import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { validateResultShape } from '../src/lib/helpers.js';
import {
  COURSE_SURVEY_ID, COURSE_DIMENSIONS, SJT_KEY, sanitizeCourseAnswers, buildCourseResult, requiredKeys,
} from '../src/lib/courseSurvey.js';

// 課後學習成效問卷（ai-course-post）：班級附加、伺服器端計分、完成率與彙總（不含姓名、少於 3 人不顯示）。

const JWT_SECRET = 'test-secret-please-change';
const DAY = 864e5;

/** 一份完整有效的答案；overrides 可覆寫個別欄位。 */
export function validAnswers(overrides = {}) {
  const a = {};
  for (let i = 1; i <= 8; i++) a[`a${i}`] = 4;
  a.a9 = 9;
  for (let i = 1; i <= 6; i++) a[`a10_${i}`] = 4;
  for (let i = 1; i <= 12; i++) { a[`b${i}_before`] = 2; a[`b${i}_now`] = 4; }
  for (const [id, key] of Object.entries(SJT_KEY)) a[id] = key;
  for (let i = 1; i <= 4; i++) a[`d${i}`] = 4;
  a.d5 = ['time'];
  a.d6 = '下週五前用 Agent 整理月報異常摘要';
  a.d7 = 'yes';
  a.e1 = '用 OAR 拆需求很有用';
  a.e2 = '';
  a.e3 = '月報整理';
  return { ...a, ...overrides };
}

async function setup({ members = 3, extra = [COURSE_SURVEY_ID], endDate = null, startDate = new Date(Date.now() - DAY).toISOString() } = {}) {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const learners = Array.from({ length: members }, (_, i) => mk(`學員${i + 1}`, `l${i + 1}@b.co`));
  const outsider = mk('外人', 'out@b.co');
  const coach = mk('教練', 'coach@b.co', 'coach');
  const coach2 = mk('別班教練', 'coach2@b.co', 'coach');
  const admin = mk('管理員', 'admin@b.co', 'admin');
  db.data.users.push(...learners, outsider, coach, coach2, admin);
  const group = {
    id: 'g1', name: '韋能班', assessmentId: 'ai-competency', coachId: coach.id,
    memberIds: learners.map((l) => l.id), startDate, endDate, extraAssessmentIds: extra,
  };
  db.data.groups.push(group);
  const app = createApp({ db, jwtSecret: JWT_SECRET });
  const login = async (user) => {
    const ag = request.agent(app);
    await ag.post('/api/auth/login').send({ email: user.email, password: 'abcdef12' });
    return ag;
  };
  return { db, app, learners, outsider, coach, coach2, admin, group, login };
}

const submit = (agent, answers = validAnswers(), extra = {}) =>
  agent.post('/api/submissions').send({ assessmentId: COURSE_SURVEY_ID, answers, ...extra });

describe('答案清洗', () => {
  test('完整答案通過；未知欄位被丟掉、文字被截斷、重複的複選合併', () => {
    const r = sanitizeCourseAnswers(validAnswers({ evil: 'x', d6: 'y'.repeat(900), d5: ['time', 'time', 'policy'] }));
    assert.ok(r.answers);
    assert.equal(r.answers.evil, undefined);
    assert.equal(r.answers.d6.length, 500);
    assert.deepEqual(r.answers.d5, ['time', 'policy']);
  });

  test('缺必填、超出範圍、型別錯誤都擋下', () => {
    const missing = validAnswers(); delete missing.b3_now;
    assert.match(sanitizeCourseAnswers(missing).error, /沒有作答/);
    assert.ok(sanitizeCourseAnswers(validAnswers({ a1: 6 })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ a1: '4' })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ a9: 11 })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ c1: 'z' })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ d5: ['nope'] })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ d7: 'maybe' })).error);
    assert.ok(sanitizeCourseAnswers(validAnswers({ e1: 123 })).error);
    assert.ok(sanitizeCourseAnswers(null).error);
    assert.ok(sanitizeCourseAnswers([]).error);
  });

  test('開放題與 D5、D6 可以略過', () => {
    const a = validAnswers(); delete a.d5; delete a.d6; delete a.e1; delete a.e2; delete a.e3;
    assert.ok(sanitizeCourseAnswers(a).answers);
  });

  test('必填欄位數：8＋1＋6＋24＋6＋4＋1', () => {
    assert.equal(requiredKeys().length, 50);
  });
});

describe('結果組裝', () => {
  test('構面得分是「現在」、before 是課前回溯、gain 是差；通過共用的結果格式檢查', () => {
    const result = buildCourseResult(validAnswers());
    assert.equal(validateResultShape(result), null);
    assert.equal(result.dimensions.length, 6);
    assert.deepEqual(result.dimensions.map((d) => d.id), COURSE_DIMENSIONS.map((d) => d.id));
    for (const d of result.dimensions) {
      assert.equal(d.max, 10); assert.equal(d.score, 8); assert.equal(d.average, 4);
      assert.equal(d.before, 2); assert.equal(d.gain, 2);
    }
    assert.equal(result.total, 6); assert.equal(result.maxScore, 6);
    assert.equal(result.course.followUpConsent, true);
  });

  test('情境題答錯會反映在 sjt 與 total', () => {
    const wrong = Object.fromEntries(Object.entries(SJT_KEY).map(([id, k]) => [id, k === 'a' ? 'b' : 'a']));
    const result = buildCourseResult(validAnswers(wrong));
    assert.equal(result.total, 0);
    assert.ok(result.course.sjt.every((s) => !s.correct));
  });

  test('標準答案的選項位置有打散（不是全都同一個字母）', () => {
    assert.ok(new Set(Object.values(SJT_KEY)).size >= 3);
  });
});

describe('評量清單：classOnly 只對附加了問卷的班級成員可見', () => {
  test('成員看得到；外人、教練、管理員看不到', async () => {
    const s = await setup();
    const ids = async (user) => (await (await s.login(user)).get('/api/assessments')).body.assessments.map((a) => a.id);
    assert.ok((await ids(s.learners[0])).includes(COURSE_SURVEY_ID));
    assert.ok(!(await ids(s.outsider)).includes(COURSE_SURVEY_ID));
    assert.ok(!(await ids(s.coach)).includes(COURSE_SURVEY_ID));
    assert.ok(!(await ids(s.admin)).includes(COURSE_SURVEY_ID));
  });

  test('班級沒有附加問卷時，成員也看不到', async () => {
    const s = await setup({ extra: [] });
    const res = await (await s.login(s.learners[0])).get('/api/assessments');
    assert.ok(!res.body.assessments.some((a) => a.id === COURSE_SURVEY_ID));
  });
});

describe('提交', () => {
  test('成功：結果由伺服器計算（不信任前端送來的 result）、不寫 groupId、寫 surveyGroupId', async () => {
    const s = await setup();
    const ag = await s.login(s.learners[0]);
    const res = await submit(ag, validAnswers(), { result: { total: 999, dimensions: [], level: { badge: '假的' } } });
    assert.equal(res.status, 201);
    const sub = res.body.submission;
    assert.equal(sub.groupId, null);
    assert.equal(sub.surveyGroupId, 'g1');
    assert.equal(sub.result.total, 6);
    assert.notEqual(sub.result.level.badge, '假的');
    assert.equal(sub.phase, null);
  });

  test('不屬於附加班級的人 403；班級沒附加 403；未登入 401', async () => {
    const s = await setup();
    assert.equal((await submit(await s.login(s.outsider))).status, 403);
    const s2 = await setup({ extra: [] });
    assert.equal((await submit(await s2.login(s2.learners[0]))).status, 403);
    assert.equal((await submit(request(s.app))).status, 401);
  });

  test('同一班只能交一次（409）', async () => {
    const s = await setup();
    const ag = await s.login(s.learners[0]);
    assert.equal((await submit(ag)).status, 201);
    assert.equal((await submit(ag)).status, 409);
  });

  test('不在開放期間：未開始、已結束都 403', async () => {
    const future = await setup({ startDate: new Date(Date.now() + DAY).toISOString() });
    assert.equal((await submit(await future.login(future.learners[0]))).status, 403);
    const ended = await setup({ endDate: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await submit(await ended.login(ended.learners[0]))).status, 403);
  });

  test('答案不完整 400，且不會留下紀錄', async () => {
    const s = await setup();
    const bad = validAnswers(); delete bad.c2;
    const res = await submit(await s.login(s.learners[0]), bad);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_ANSWERS');
    assert.equal(s.db.data.submissions.length, 0);
  });

  test('評量被管理者停用時不能交', async () => {
    const s = await setup();
    s.db.data.assessments.find((a) => a.id === COURSE_SURVEY_ID).enabled = false;
    assert.equal((await submit(await s.login(s.learners[0]))).status, 403);
  });

  test('作答內容存的是清洗後的答案（未知欄位不落地）', async () => {
    const s = await setup();
    await submit(await s.login(s.learners[0]), validAnswers({ evil: '<script>' }));
    assert.equal(s.db.data.submissions[0].answers.evil, undefined);
  });
});

describe('不污染班級原本的課前／課後統計', () => {
  test('教練看班級詳情時，課後問卷的作答不在 submissions 裡；催交也不受影響', async () => {
    const s = await setup();
    await submit(await s.login(s.learners[0]));
    const coach = await s.login(s.coach);
    const detail = await coach.get('/api/coach/groups/g1');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.submissions.length, 0);
  });
});

describe('個人作答不經由教練的明細介面外洩', () => {
  test('教練的 overview 與 ratee 查詢都看不到課後問卷的個人結果；本人看得到', async () => {
    const s = await setup();
    const l = s.learners[0];
    await submit(await s.login(l));
    const coach = await s.login(s.coach);
    const overview = await coach.get('/api/coach/overview');
    assert.equal(overview.status, 200);
    assert.ok(!overview.body.submissions.some((x) => x.assessmentId === COURSE_SURVEY_ID));
    const ratee = await coach.get(`/api/submissions/ratee/${l.id}?assessmentId=${COURSE_SURVEY_ID}`);
    assert.equal(ratee.status, 200);
    assert.equal(ratee.body.submissions.length, 0);
    const mine = await (await s.login(l)).get('/api/submissions/me');
    assert.ok(mine.body.submissions.some((x) => x.assessmentId === COURSE_SURVEY_ID));
  });
});

describe('課後問卷不能繞過彙總規則', () => {
  test('不能把課後問卷設成班級的主要評量（建班、改班都擋）；改不成就看不到個人明細', async () => {
    const s = await setup();
    await submit(await s.login(s.learners[0]));
    const coach = await s.login(s.coach);
    const put = await coach.put('/api/coach/groups/g1').send({ assessmentId: COURSE_SURVEY_ID });
    assert.equal(put.status, 400);
    const post = await coach.post('/api/coach/groups').send({ name: '新班', assessmentId: COURSE_SURVEY_ID });
    assert.equal(post.status, 400);
    assert.equal(s.group.assessmentId, 'ai-competency');
  });

  test('即使班級資料裡的主要評量被設成問卷（舊資料、直接改庫），班級明細與催交也不含個人問卷', async () => {
    const s = await setup();
    await submit(await s.login(s.learners[0]));
    s.group.assessmentId = COURSE_SURVEY_ID;
    const coach = await s.login(s.coach);
    const detail = await coach.get('/api/coach/groups/g1');
    assert.equal(detail.body.submissions.length, 0);
    assert.ok(!JSON.stringify(detail.body).includes('學員1的'));
  });

  test('全站基準（benchmark）不提供課後問卷的資料', async () => {
    const s = await setup();
    for (const l of s.learners) await submit(await s.login(l));
    const res = await (await s.login(s.learners[0])).get(`/api/assessments/${COURSE_SURVEY_ID}/benchmark`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.totals, []);
  });
});

describe('專屬班級（客戶專案）也看得到附加的問卷', () => {
  test('exclusive 班級：只看到主要評量與附加問卷，看不到其他評量', async () => {
    const s = await setup();
    s.group.exclusive = true;
    const res = await (await s.login(s.learners[0])).get('/api/assessments');
    const ids = res.body.assessments.map((a) => a.id).sort();
    assert.deepEqual(ids, ['ai-competency', COURSE_SURVEY_ID].sort());
  });
});

describe('班級開放期間：只填日期的結束日算到當天結束（台灣時間）', () => {
  test('結束日是今天（只有日期）→ 今天仍可作答；結束日是昨天 → 不可作答', async () => {
    const { getGroupPhase } = await import('../src/lib/helpers.js');
    const taipeiDay = (offset) => new Date(Date.now() + 8 * 3600e3 + offset * DAY).toISOString().slice(0, 10);
    assert.equal(getGroupPhase({ startDate: taipeiDay(-1), endDate: taipeiDay(0) }), 'in_progress');
    assert.equal(getGroupPhase({ startDate: taipeiDay(0), endDate: taipeiDay(0) }), 'in_progress');
    assert.equal(getGroupPhase({ startDate: taipeiDay(-3), endDate: taipeiDay(-1) }), 'closed');
    assert.equal(getGroupPhase({ startDate: taipeiDay(1), endDate: taipeiDay(2) }), 'not_started');
    // 完整時間戳記照原樣使用。
    assert.equal(getGroupPhase({ startDate: new Date(Date.now() - DAY).toISOString(), endDate: new Date(Date.now() - 1000).toISOString() }), 'closed');
  });
});

describe('班級附加問卷的設定', () => {
  test('只接受存在、已啟用、classOnly 的評量；其他 id 被丟掉', async () => {
    const s = await setup({ extra: [] });
    const coach = await s.login(s.coach);
    const res = await coach.put('/api/coach/groups/g1').send({ extraAssessmentIds: [COURSE_SURVEY_ID, 'ai-competency', 'nope', COURSE_SURVEY_ID, 5] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.group.extraAssessmentIds, [COURSE_SURVEY_ID]);
    assert.ok(s.db.data.auditLog.some((e) => e.action === 'set_group_extra_assessments'));
  });

  test('別班教練不能改', async () => {
    const s = await setup({ extra: [] });
    const res = await (await s.login(s.coach2)).put('/api/coach/groups/g1').send({ extraAssessmentIds: [COURSE_SURVEY_ID] });
    assert.equal(res.status, 403);
  });
});

describe('教練端彙總', () => {
  test('完成率永遠顯示；少於 3 人不顯示任何彙總與文字', async () => {
    const s = await setup({ members: 4 });
    await submit(await s.login(s.learners[0]));
    await submit(await s.login(s.learners[1]));
    const res = await (await s.login(s.coach)).get('/api/coach/groups/g1/course-survey');
    assert.equal(res.status, 200);
    assert.equal(res.body.completed, 2);
    assert.equal(res.body.expected, 4);
    assert.equal(res.body.completionRate, 50);
    assert.equal(res.body.hidden, true);
    assert.equal(res.body.openText, undefined);
    assert.equal(res.body.dimensions, undefined);
  });

  test('3 人以上：滿意度、NPS、構面進步、答對人數、阻礙、開放題；開放題不含姓名', async () => {
    const s = await setup({ members: 3 });
    for (const l of s.learners) await submit(await s.login(l), validAnswers({ e1: `${l.name}的收穫` }));
    const res = await (await s.login(s.coach)).get('/api/coach/groups/g1/course-survey');
    const b = res.body;
    assert.equal(b.hidden, false);
    assert.equal(b.completionRate, 100);
    assert.equal(b.satisfaction.a8.mean, 4);
    assert.equal(b.nps.score, 100);
    assert.equal(b.dimensions.length, 6);
    assert.equal(b.dimensions[0].gain, 2);
    assert.equal(b.dimensions[0].improved, 3);
    assert.ok(b.sjt.every((x) => x.correct === 3 && x.n === 3));
    assert.equal(b.barriers.time, 3);
    assert.equal(b.followUpConsent, 3);
    assert.equal(b.openText.e1.length, 3);
    // 彙總裡不得出現任何 userId、姓名、Email。
    const text = JSON.stringify(b);
    for (const l of s.learners) { assert.ok(!text.includes(l.id)); assert.ok(!text.includes(l.email)); }
    assert.deepEqual(b.openText.e1, [...b.openText.e1].sort((x, y) => x.localeCompare(y, 'zh-Hant')));
  });

  test('差分攻擊：排除已交問卷的人，彙總與完成率完全不變（不能用前後差回推個人答案）', async () => {
    const s = await setup({ members: 4 });
    for (const [i, l] of s.learners.entries()) await submit(await s.login(l), validAnswers({ a8: i + 1, e1: `收穫${i}` }));
    const coach = await s.login(s.coach);
    const before = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    s.group.excludedUserIds = [s.learners[3].id];
    const afterExclude = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.deepEqual(afterExclude, before);
    s.group.memberIds = s.group.memberIds.filter((id) => id !== s.learners[3].id);
    const afterRemove = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.deepEqual(afterRemove, before);
    assert.equal(before.completed, 4);
  });

  test('排除一位「還沒交」的人只改分母，不影響任何彙總內容', async () => {
    const s = await setup({ members: 4 });
    for (const l of s.learners.slice(0, 3)) await submit(await s.login(l));
    const coach = await s.login(s.coach);
    const before = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.equal(before.expected, 4);
    s.group.excludedUserIds = [s.learners[3].id];
    const after = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.equal(after.expected, 3);
    assert.equal(after.completionRate, 100);
    assert.deepEqual({ ...after, expected: 0, completionRate: 0 }, { ...before, expected: 0, completionRate: 0 });
  });

  test('少於 3 人時不提供追蹤信同意數與到期日（會等於個人答案與作答日期）', async () => {
    const s = await setup();
    await submit(await s.login(s.learners[0]));
    const body = (await (await s.login(s.coach)).get('/api/coach/groups/g1/course-survey')).body;
    assert.equal(body.hidden, true);
    assert.equal(body.followUp, undefined);
    assert.equal(JSON.stringify(body).includes('due30'), false);
  });

  test('別班教練 403；管理員可看；沒附加問卷回 attached:false', async () => {
    const s = await setup();
    assert.equal((await (await s.login(s.coach2)).get('/api/coach/groups/g1/course-survey')).status, 403);
    assert.equal((await (await s.login(s.admin)).get('/api/coach/groups/g1/course-survey')).status, 200);
    const s2 = await setup({ extra: [] });
    assert.equal((await (await s2.login(s2.coach)).get('/api/coach/groups/g1/course-survey')).body.attached, false);
  });

  test('一般學員不能看彙總', async () => {
    const s = await setup();
    assert.ok([401, 403].includes((await (await s.login(s.learners[0])).get('/api/coach/groups/g1/course-survey')).status));
  });
});

describe('30／60 天追蹤同意', () => {
  test('同意的人數與到期日出現在彙總；撤回後立即不計', async () => {
    const s = await setup();
    for (const l of s.learners) await submit(await s.login(l));
    const coach = await s.login(s.coach);
    const before = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.equal(before.followUp.consented, 3);
    assert.match(before.followUp.due30, /^\d{4}-\d{2}-\d{2}$/);
    const ag = await s.login(s.learners[0]);
    const res = await ag.patch('/api/course-survey/follow-up').send({ consent: false });
    assert.equal(res.status, 200);
    const after = (await coach.get('/api/coach/groups/g1/course-survey')).body;
    assert.equal(after.followUp.consented, 2);
    assert.ok(s.db.data.auditLog.some((e) => e.action === 'course_followup_withdraw'));
  });

  test('沒有作答紀錄的人撤回 404；參數錯誤 400', async () => {
    const s = await setup();
    const ag = await s.login(s.learners[0]);
    assert.equal((await ag.patch('/api/course-survey/follow-up').send({ consent: false })).status, 404);
    await submit(ag);
    assert.equal((await ag.patch('/api/course-survey/follow-up').send({ consent: 'no' })).status, 400);
  });
});
