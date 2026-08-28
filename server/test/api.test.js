import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const JWT_SECRET = 'test-secret-please-change';

async function setupWithDb({ withAdmin = false, trustProxy = 0 } = {}) {
  const db = createDb(':memory:');
  if (withAdmin) {
    db.data.users.push({
      id: randomUUID(),
      name: '系統管理員',
      email: 'admin@demo.tw',
      passwordHash: await hashPassword('admin1234'),
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  }
  return { app: createApp({ db, jwtSecret: JWT_SECRET, trustProxy }), db };
}

async function setup(opts) {
  return (await setupWithDb(opts)).app;
}

// 形狀需與前端 buildResult() 的輸出一致（含 dimension.score/max/rating），
// 後端會驗證這些欄位——缺欄位的結果前端渲染時會 crash，因此寫入前就擋。
function sampleResult(total = 124) {
  return {
    total,
    maxScore: 155,
    percent: Math.round((total / 155) * 100),
    level: { id: 'advanced', badge: '🚀 AI 數位高潛力股', color: '#805ad5' },
    dimensions: [{
      id: 'foundation', subtitle: '基礎力', name: '工具認知', color: '#2b6cb0',
      score: 20, max: 25, average: 4, percent: 80,
      rating: { label: '熟練', tone: 'good' },
    }],
    strongest: { subtitle: '基礎力' },
    weakest: { subtitle: '基礎力' },
  };
}

describe('認證', () => {
  test('註冊後即帶有登入 cookie，且不外洩密碼雜湊', async () => {
    const app = await setup();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '小明', email: 'ming@example.com', password: 'abcdef12' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'ming@example.com');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.match(res.headers['set-cookie']?.[0] ?? '', /aiassess_token=/);
  });

  test('擋下不合法 email、過短密碼與重複註冊', async () => {
    const app = await setup();
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'a', email: 'bad', password: 'abcdef12' })).status, 400);
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'a', email: 'a@b.co', password: '123' })).status, 400);
    await request(app).post('/api/auth/register').send({ name: 'a', email: 'dup@b.co', password: 'abcdef12' });
    assert.equal((await request(app).post('/api/auth/register').send({ name: 'b', email: 'dup@b.co', password: 'abcdef12' })).status, 409);
  });

  test('密碼錯誤回 401；正確則可登入並讀取 /me', async () => {
    const app = await setup();
    await request(app).post('/api/auth/register').send({ name: 'z', email: 'z@b.co', password: 'abcdef12' });
    const agent = request.agent(app);
    assert.equal((await agent.post('/api/auth/login').send({ email: 'z@b.co', password: 'wrong' })).status, 401);
    assert.equal((await agent.post('/api/auth/login').send({ email: 'z@b.co', password: 'abcdef12' })).status, 200);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'z@b.co');
  });

  test('未登入存取 /me 回 401；logout 後失效', async () => {
    const app = await setup();
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'z', email: 'z@b.co', password: 'abcdef12' });
    assert.equal((await agent.get('/api/auth/me')).status, 200);
    await agent.post('/api/auth/logout');
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });

  test('註冊/登入的頻率限制：預設每 5 分鐘 10 次，帶有效報到代碼時放寬到 100 次', async () => {
    const { app, db } = await setupWithDb();
    // 一整班學員很可能共用同一個出口 IP（同一個 Wi-Fi/NAT）；沒帶代碼時，
    // 第 11 次應該被擋下——這是「一般情況下限流仍然有效」的基本保證。
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'u', email: `nolimit-${i}@b.co`, password: 'abcdef12' });
      assert.equal(res.status, 201, `第 ${i + 1} 次註冊不應被擋`);
    }
    const eleventh = await request(app).post('/api/auth/register')
      .send({ name: 'u', email: 'nolimit-11@b.co', password: 'abcdef12' });
    assert.equal(eleventh.status, 429, '沒有代碼時，第 11 次應被限流擋下');

    // 帶一組真實存在的報到代碼，額度應放寬到 100 次（用另一組 email 起算，
    // 避免與上面已經用掉的 10 次額度算在同一個限流視窗裡相互干擾）。
    db.data.groups.push({ id: 'g1', joinCode: 'TESTCODE1', memberIds: [] });
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'u', email: `withcode-${i}@b.co`, password: 'abcdef12', joinCode: 'testcode1' });
      assert.equal(res.status, 201, `帶有效代碼時，第 ${i + 1} 次不應被擋（大小寫應被正規化）`);
    }

    // 代碼錯誤／不存在時，仍套用一般的 10 次額度（此時已用完，直接擋下）。
    const badCode = await request(app).post('/api/auth/register')
      .send({ name: 'u', email: 'badcode@b.co', password: 'abcdef12', joinCode: 'NOSUCHCODE' });
    assert.equal(badCode.status, 429, '代碼不存在時不應享有放寬額度');
  });
});

describe('個人檔案 / 密碼', () => {
  test('可更新姓名與偏好設定', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: '舊名', email: 'p@b.co', password: 'abcdef12' });
    const res = await agent.patch('/api/auth/profile').send({ name: '新名', preferences: { darkMode: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, '新名');
    assert.equal(res.body.user.preferences.darkMode, true);
  });

  test('變更密碼需驗證目前密碼，成功後可用新密碼登入', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'pw@b.co', password: 'abcdef12' });
    assert.equal((await agent.post('/api/auth/password').send({ currentPassword: 'wrong', newPassword: 'newpass1' })).status, 401);
    assert.equal((await agent.post('/api/auth/password').send({ currentPassword: 'abcdef12', newPassword: 'newpass1' })).status, 200);
    const fresh = request.agent(app);
    assert.equal((await fresh.post('/api/auth/login').send({ email: 'pw@b.co', password: 'newpass1' })).status, 200);
  });

  test('變更密碼會撤銷舊 token（舊 cookie 失效），但當下請求本身重發新 cookie 不會被登出', async () => {
    const app = await setup();
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({ name: 'u', email: 'rv@b.co', password: 'abcdef12' });
    const staleCookie = reg.headers['set-cookie'][0].split(';')[0];

    // 用「變更密碼前」的舊 cookie 手動發請求，此時應該還有效。
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', staleCookie)).status, 200);

    await agent.post('/api/auth/password').send({ currentPassword: 'abcdef12', newPassword: 'newpass1' });

    // 舊 cookie（變更密碼前簽發）現在應該失效。
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', staleCookie)).status, 401);
    // agent 的 cookie jar 已被回應中的新 Set-Cookie 自動更新，同一個瀏覽器工作階段不會被登出。
    assert.equal((await agent.get('/api/auth/me')).status, 200);
  });

  test('管理員變更角色會撤銷該使用者舊 token', async () => {
    const app = await setup({ withAdmin: true });
    const agent = request.agent(app);
    const reg = await agent.post('/api/auth/register').send({ name: 'u', email: 'role-rv@b.co', password: 'abcdef12' });
    const staleCookie = reg.headers['set-cookie'][0].split(';')[0];

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    await admin.patch(`/api/admin/users/${reg.body.user.id}/role`).send({ role: 'coach' });

    assert.equal((await request(app).get('/api/auth/me').set('Cookie', staleCookie)).status, 401);
    // 重新登入可拿到反映新角色的有效 cookie。
    const relogin = await agent.post('/api/auth/login').send({ email: 'role-rv@b.co', password: 'abcdef12' });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.body.user.role, 'coach');
  });

  test('管理員產生重設 token，使用者可用其設定新密碼', async () => {
    const app = await setup({ withAdmin: true });
    const u = request.agent(app);
    const reg = await u.post('/api/auth/register').send({ name: 'u', email: 'r@b.co', password: 'abcdef12' });

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const tok = await admin.post(`/api/admin/users/${reg.body.user.id}/reset-token`);
    assert.equal(tok.status, 200);
    assert.ok(tok.body.token);

    // 錯誤 token 應失敗
    assert.equal((await request(app).post('/api/auth/reset-password').send({ token: 'bad', newPassword: 'fresh123' })).status, 400);
    // 重設前先留一份舊 cookie，等等驗證重設後會失效。
    const staleCookie = reg.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', staleCookie)).status, 200);

    // 正確 token 可重設
    assert.equal((await request(app).post('/api/auth/reset-password').send({ token: tok.body.token, newPassword: 'fresh123' })).status, 200);

    // 重設密碼視為原密碼可能外洩，重設前的舊 cookie 應立即失效。
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', staleCookie)).status, 401);

    // 用新密碼登入
    const fresh = request.agent(app);
    assert.equal((await fresh.post('/api/auth/login').send({ email: 'r@b.co', password: 'fresh123' })).status, 200);
  });
});

describe('作答', () => {
  test('需登入才能建立作答，並可取回自己的紀錄', async () => {
    const app = await setup();
    assert.equal((await request(app).post('/api/submissions').send({ result: sampleResult() })).status, 401);

    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    const created = await agent.post('/api/submissions').send({ answers: { q1: 4 }, result: sampleResult(124) });
    assert.equal(created.status, 201);
    assert.equal(created.body.submission.result.total, 124);

    const mine = await agent.get('/api/submissions/me');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.submissions.length, 1);
  });

  test('作答結果格式不正確回 400', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    assert.equal((await agent.post('/api/submissions').send({ result: { total: 'x' } })).status, 400);
  });

  test('構面缺少欄位的結果會被擋下（避免寫入後讓分析頁 crash）', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'shape@b.co', password: 'abcdef12' });

    // 前端報告會讀 dimension.rating.label / score / max，缺任一都應在寫入前擋下。
    const cases = [
      [{ id: 'a', score: 1, max: 2 }, '缺 rating'],
      [{ id: 'a', score: 1, max: 2, rating: {} }, 'rating 缺 label'],
      [{ id: 'a', max: 2, rating: { label: '熟練' } }, '缺 score'],
      [{ score: 1, max: 2, rating: { label: '熟練' } }, '缺 id'],
    ];
    for (const [dim, why] of cases) {
      const res = await agent.post('/api/submissions')
        .send({ assessmentId: 'ai-competency', result: { total: 10, dimensions: [dim] } });
      assert.equal(res.status, 400, `${why} 應回 400，實際 ${res.status}`);
    }

    // 構面陣列為空也不合法。
    assert.equal(
      (await agent.post('/api/submissions').send({ result: { total: 10, dimensions: [] } })).status,
      400,
    );

    // 完整形狀仍可正常寫入。
    assert.equal(
      (await agent.post('/api/submissions')
        .send({ assessmentId: 'ai-competency', result: sampleResult(120) })).status,
      201,
    );
  });

  test('不屬於任何班級時可重複作答（重新作答／歷次趨勢不受阻擋）', async () => {
    const app = await setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'u', email: 'retake@b.co', password: 'abcdef12' });

    const first = await agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(100) });
    assert.equal(first.status, 201);
    const second = await agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(120) });
    assert.equal(second.status, 201, '不在班級內時應可無限次重新作答');

    const mine = await agent.get('/api/submissions/me');
    assert.equal(mine.body.submissions.length, 2);
  });

  test('班級內：同班同階段重複作答擋 409；課前→課後、不同梯次、退班後皆放行', async () => {
    const app = await setup({ withAdmin: true });
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const coach = request.agent(app);
    const creg = await coach.post('/api/auth/register').send({ name: '教練', email: 'dedup-coach@b.co', password: 'abcdef12' });
    await admin.patch(`/api/admin/users/${creg.body.user.id}/role`).send({ role: 'coach' });
    await coach.post('/api/auth/login').send({ email: 'dedup-coach@b.co', password: 'abcdef12' });

    const student = request.agent(app);
    const sreg = await student.post('/api/auth/register').send({ name: '學員', email: 'dedup-stu@b.co', password: 'abcdef12' });

    const openWindow = () => ({
      startDate: new Date(Date.now() - 864e5).toISOString(),
      endDate: new Date(Date.now() + 864e5).toISOString(),
    });

    const g1 = await coach.post('/api/coach/groups')
      .send({ name: '第一梯', assessmentId: 'ai-competency', memberIds: [sreg.body.user.id] });
    await coach.put(`/api/coach/groups/${g1.body.group.id}`).send(openWindow());

    // 課前：第一次送出成功。
    const pre = await student.post('/api/submissions')
      .send({ assessmentId: 'ai-competency', phase: 'pre', result: sampleResult(100) });
    assert.equal(pre.status, 201);
    assert.equal(pre.body.submission.groupId, g1.body.group.id, '作答應寫入所屬班級的 groupId');

    // 同班同階段（課前）重複送出 → 409。
    const dupe = await student.post('/api/submissions')
      .send({ assessmentId: 'ai-competency', phase: 'pre', result: sampleResult(105) });
    assert.equal(dupe.status, 409);

    // 同班「課前 → 課後」→ 放行（原本被卡死的 bug）。
    const post = await student.post('/api/submissions')
      .send({ assessmentId: 'ai-competency', phase: 'post', result: sampleResult(130) });
    assert.equal(post.status, 201);
    assert.equal(post.body.submission.groupId, g1.body.group.id);

    // 開第二梯，同一位學員再參加一次 → 不同 groupId，應放行，且各自歸屬正確梯次。
    const g2 = await coach.post('/api/coach/groups')
      .send({ name: '第二梯', assessmentId: 'ai-competency', memberIds: [sreg.body.user.id] });
    await coach.put(`/api/coach/groups/${g2.body.group.id}`).send(openWindow());
    const secondCohort = await student.post('/api/submissions')
      .send({ assessmentId: 'ai-competency', phase: 'pre', result: sampleResult(140) });
    assert.equal(secondCohort.status, 201, '不同梯次（不同班）應可再次作答');
    assert.equal(secondCohort.body.submission.groupId, g2.body.group.id);

    // 班級報告依 groupId 精準歸屬：第一梯報告應只看到第一梯的兩筆（pre+post），
    // 不會把第二梯的作答也算進去。
    const g1Detail = await coach.get(`/api/coach/groups/${g1.body.group.id}`);
    assert.equal(g1Detail.body.submissions.length, 2, '第一梯報告只應含第一梯自己的作答');
    assert.ok(g1Detail.body.submissions.every((s) => s.groupId === g1.body.group.id));

    const g2Detail = await coach.get(`/api/coach/groups/${g2.body.group.id}`);
    assert.equal(g2Detail.body.submissions.length, 1);

    // 把學員移出第一梯後，第一梯報告仍看得到他的歷史成績（不因成員異動而消失）。
    await coach.put(`/api/coach/groups/${g1.body.group.id}`).send({ memberIds: [] });
    const g1AfterRemoval = await coach.get(`/api/coach/groups/${g1.body.group.id}`);
    assert.equal(g1AfterRemoval.body.submissions.length, 2, '退班不應讓歷史成績從班級報告消失');
  });
});

describe('母體基準 / 百分位', () => {
  test('benchmark 回傳已排序的總分陣列與構面平均', async () => {
    const app = await setup();
    for (const [email, total] of [['a@b.co', 80], ['c@b.co', 155], ['d@b.co', 124]]) {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ name: email, email, password: 'abcdef12' });
      await agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(total) });
    }
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'q', email: 'q@b.co', password: 'abcdef12' });
    const res = await agent.get('/api/assessments/ai-competency/benchmark');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 3);
    assert.deepEqual(res.body.totals, [80, 124, 155]); // 已排序
  });

  test('benchmark 有快取：重複查詢命中快取，新增作答後立即反映最新資料', async () => {
    const app = await setup();
    const a = request.agent(app);
    await a.post('/api/auth/register').send({ name: 'a', email: 'a@b.co', password: 'abcdef12' });
    await a.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(80) });

    const q = request.agent(app);
    await q.post('/api/auth/register').send({ name: 'q', email: 'q@b.co', password: 'abcdef12' });

    const first = await q.get('/api/assessments/ai-competency/benchmark');
    assert.equal(first.body.count, 1);
    // 未新增作答時重複查詢應命中快取，回傳一致的結果。
    const second = await q.get('/api/assessments/ai-competency/benchmark');
    assert.deepEqual(second.body, first.body);

    const b = request.agent(app);
    await b.post('/api/auth/register').send({ name: 'b', email: 'b@b.co', password: 'abcdef12' });
    await b.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(150) });

    // 新增作答後，快取應失效並反映最新總數，而非沿用舊快取。
    const third = await q.get('/api/assessments/ai-competency/benchmark');
    assert.equal(third.body.count, 2);
    assert.deepEqual(third.body.totals, [80, 150]);
  });
});

describe('教練 / 班別 / 名單', () => {
  async function makeCoach(app) {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const coach = request.agent(app);
    const reg = await coach.post('/api/auth/register').send({ name: '教練', email: 'coach@b.co', password: 'abcdef12' });
    await admin.patch(`/api/admin/users/${reg.body.user.id}/role`).send({ role: 'coach' });
    return { admin, coach };
  }

  test('一般使用者無法存取教練 API（403）', async () => {
    const app = await setup({ withAdmin: true });
    const user = request.agent(app);
    await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    assert.equal((await user.get('/api/coach/overview')).status, 403);
  });

  test('/coach/overview 只回傳自己班級成員的資料，看不到其他教練的學員成績', async () => {
    const app = await setup({ withAdmin: true });
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });

    // 兩位教練，各帶一位學員。
    const mk = async (name, email) => {
      const a = request.agent(app);
      const r = await a.post('/api/auth/register').send({ name, email, password: 'abcdef12' });
      return { agent: a, id: r.body.user.id };
    };
    const coachA = await mk('教練A', 'ca@b.co');
    const coachB = await mk('教練B', 'cb@b.co');
    const stuA = await mk('學員A', 'sa@b.co');
    const stuB = await mk('學員B', 'sb@b.co');
    for (const c of [coachA, coachB]) {
      await admin.patch(`/api/admin/users/${c.id}/role`).send({ role: 'coach' });
      await c.agent.post('/api/auth/login').send({
        email: c === coachA ? 'ca@b.co' : 'cb@b.co', password: 'abcdef12',
      });
    }
    await coachA.agent.post('/api/coach/groups').send({ name: 'A 班', assessmentId: 'ai-competency', memberIds: [stuA.id] });
    await coachB.agent.post('/api/coach/groups').send({ name: 'B 班', assessmentId: 'ai-competency', memberIds: [stuB.id] });

    // 兩位學員各交一份作答。
    await stuA.agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(100) });
    await stuB.agent.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(150) });

    const ovA = await coachA.agent.get('/api/coach/overview');
    const idsA = ovA.body.users.map((u) => u.id);
    assert.ok(idsA.includes(stuA.id), '教練A 應看得到自己的學員');
    assert.ok(!idsA.includes(stuB.id), '教練A 不應看到教練B 的學員');
    const rateeIdsA = ovA.body.submissions.map((s) => s.rateeId);
    assert.ok(!rateeIdsA.includes(stuB.id), '教練A 不應拿到教練B 學員的作答');

    // admin 仍看得到全部。
    const ovAdmin = await admin.get('/api/coach/overview');
    const idsAdmin = ovAdmin.body.users.map((u) => u.id);
    assert.ok(idsAdmin.includes(stuA.id) && idsAdmin.includes(stuB.id), 'admin 應看得到所有學員');

    // 名冊（僅姓名/Email、不含成績）仍給完整清單，教練才能把新成員加進班別。
    const dir = await coachA.agent.get('/api/coach/directory');
    assert.equal(dir.status, 200);
    const dirIds = dir.body.users.map((u) => u.id);
    assert.ok(dirIds.includes(stuB.id), '名冊應包含尚未加入自己班級的使用者');
    assert.ok(dir.body.users.every((u) => u.result === undefined), '名冊不應帶任何成績欄位');
  });

  test('教練可建立班別、寫評語', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    // 重新登入取得 coach 角色 cookie
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });

    const g = await coach.post('/api/coach/groups').send({ name: 'A 班', assessmentId: 'ai-competency' });
    assert.equal(g.status, 201);

    const u = request.agent(app);
    const ureg = await u.post('/api/auth/register').send({ name: '學員', email: 's@b.co', password: 'abcdef12' });
    const sub = await u.post('/api/submissions').send({ assessmentId: 'ai-competency', result: sampleResult(124) });

    const c = await coach.post(`/api/submissions/${sub.body.submission.id}/comment`)
      .send({ text: '表現良好', tips: ['多練習提示詞'] });
    assert.equal(c.status, 200);
    assert.equal(c.body.comment.text, '表現良好');

    // 學員自己的紀錄應帶有評語
    const mine = await u.get('/api/submissions/me');
    assert.equal(mine.body.submissions[0].comments[0].text, '表現良好');
    assert.equal(ureg.body.user.role, 'user');
  });

  test('批量名單：現有用戶入班、未註冊者待加入並於註冊後自動入班', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });

    const existing = request.agent(app);
    const ereg = await existing.post('/api/auth/register').send({ name: '已註冊', email: 'have@b.co', password: 'abcdef12' });

    const g = await coach.post('/api/coach/groups').send({ name: 'B 班', assessmentId: 'ai-competency' });
    const gid = g.body.group.id;

    const imp = await coach.post(`/api/coach/groups/${gid}/roster`).send({
      entries: [
        { name: '已註冊', email: 'have@b.co' },
        { name: '未註冊', email: 'new@b.co' },
        { name: '壞格式', email: 'not-an-email' },
      ],
    });
    assert.equal(imp.status, 200);
    assert.equal(imp.body.result.added, 1);
    assert.equal(imp.body.result.pending, 1);
    assert.equal(imp.body.result.invalid.length, 1);
    assert.ok(imp.body.group.memberIds.includes(ereg.body.user.id));

    // 未註冊者註冊後應自動成為成員
    const fresh = request.agent(app);
    const freg = await fresh.post('/api/auth/register').send({ name: '未註冊', email: 'new@b.co', password: 'abcdef12' });
    const myGroups = await fresh.get('/api/groups/mine');
    assert.equal(myGroups.body.groups.length, 1);
    assert.ok(myGroups.body.groups[0].memberIds.includes(freg.body.user.id));
  });

  test('班別評量設定：重點構面、目標人數、逐構面備註（建立 + 更新 + 清洗）', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });

    // 建立時帶入設定，含需清洗的髒值（重複構面、負數人數、空白備註）
    const g = await coach.post('/api/coach/groups').send({
      name: 'L9D 班',
      assessmentId: 'leadership-9d',
      focusDimensionIds: ['communication', 'communication', 'leadership-impact', '  '],
      targetHeadcount: 12,
      dimensionNotes: { communication: '  加強跨部門溝通  ', 'leadership-impact': '', bogus: 123 },
    });
    assert.equal(g.status, 201);
    const grp = g.body.group;
    assert.deepEqual(grp.focusDimensionIds, ['communication', 'leadership-impact']);
    assert.equal(grp.targetHeadcount, 12);
    assert.deepEqual(grp.dimensionNotes, { communication: '加強跨部門溝通' });

    // 更新：改人數、改備註、清空重點構面
    const upd = await coach.put(`/api/coach/groups/${grp.id}`).send({
      targetHeadcount: -5,
      focusDimensionIds: [],
      dimensionNotes: { communication: '已達標，轉觀察' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.group.targetHeadcount, null); // 負數→null
    assert.deepEqual(upd.body.group.focusDimensionIds, []);
    assert.deepEqual(upd.body.group.dimensionNotes, { communication: '已達標，轉觀察' });
  });

  test('班別設定向後相容：舊欄位省略時給安全預設', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    const g = await coach.post('/api/coach/groups').send({ name: '純舊欄位班', assessmentId: 'ai-competency' });
    assert.deepEqual(g.body.group.focusDimensionIds, []);
    assert.equal(g.body.group.targetHeadcount, null);
    assert.deepEqual(g.body.group.dimensionNotes, {});
  });

  test('報到 QR Code：只有本班教練能產生／撤銷；未設施測日期時產生代碼會自動開啟', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    const g = await coach.post('/api/coach/groups').send({ name: 'QR 班', assessmentId: 'ai-competency' });
    assert.equal(g.body.group.startDate, null, '一開始不應有施測日期');

    // 別班教練不能動這個班。
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ name: '別班教練', email: 'other-coach@b.co', password: 'abcdef12' });
    const admin2 = request.agent(app);
    await admin2.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const otherReg = await admin2.get('/api/coach/directory').then((r) => r.body.users.find((u) => u.email === 'other-coach@b.co'));
    await admin2.patch(`/api/admin/users/${otherReg.id}/role`).send({ role: 'coach' });
    await other.post('/api/auth/login').send({ email: 'other-coach@b.co', password: 'abcdef12' });
    assert.equal((await other.post(`/api/coach/groups/${g.body.group.id}/join-code`)).status, 403);

    // 本班教練產生代碼：因為還沒設定施測日期，應自動開啟（startDate 補上現在）。
    const gen = await coach.post(`/api/coach/groups/${g.body.group.id}/join-code`);
    assert.equal(gen.status, 200);
    assert.equal(gen.body.autoOpened, true);
    assert.match(gen.body.group.joinCode, /^[23-9A-HJ-NP-TV-Z]{8}$/);
    assert.ok(gen.body.group.startDate, '未設定施測日期時，產生代碼應自動補上開始時間');
    assert.equal(gen.body.group.phase, 'in_progress');

    // 已經有施測日期的班別，產生代碼不應覆蓋原本的日期設定。
    const future = new Date(Date.now() + 10 * 864e5).toISOString();
    await coach.put(`/api/coach/groups/${g.body.group.id}`).send({ startDate: future });
    const gen2 = await coach.post(`/api/coach/groups/${g.body.group.id}/join-code`);
    assert.equal(gen2.body.autoOpened, false);
    assert.equal(gen2.body.group.startDate, future, '已設定過的施測日期不應被覆蓋');
    const firstCode = gen2.body.group.joinCode;

    // 重新產生會讓舊代碼失效。
    const regen = await coach.post(`/api/coach/groups/${g.body.group.id}/join-code`);
    assert.notEqual(regen.body.group.joinCode, firstCode);

    // 撤銷後代碼消失。
    const revoke = await coach.delete(`/api/coach/groups/${g.body.group.id}/join-code`);
    assert.equal(revoke.status, 200);
    assert.equal(revoke.body.group.joinCode, null);
  });

  test('公開查詢端點只回傳班級／評量的顯示資訊，不含成員或成績；代碼無效回 404', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    const g = await coach.post('/api/coach/groups')
      .send({ name: '公開查詢班', companyName: '榕耀顧問', assessmentId: 'ai-competency' });
    const gen = await coach.post(`/api/coach/groups/${g.body.group.id}/join-code`);
    const code = gen.body.group.joinCode;

    // 未登入也查得到。
    const lookup = await request(app).get(`/api/public/join/${code}`);
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.groupName, '公開查詢班');
    assert.equal(lookup.body.companyName, '榕耀顧問');
    assert.equal(lookup.body.assessmentId, 'ai-competency');
    assert.ok(lookup.body.assessmentName, '應回傳評量的顯示名稱');
    assert.equal(lookup.body.phase, 'in_progress');
    // 不應洩漏成員名單或成績。
    assert.equal(lookup.body.memberIds, undefined);
    assert.equal(lookup.body.members, undefined);
    assert.equal(lookup.body.submissions, undefined);

    // 代碼不分大小寫。
    const lower = await request(app).get(`/api/public/join/${code.toLowerCase()}`);
    assert.equal(lower.status, 200);

    // 查無代碼、或代碼已撤銷。
    assert.equal((await request(app).get('/api/public/join/NOSUCHCODE')).status, 404);
    await coach.delete(`/api/coach/groups/${g.body.group.id}/join-code`);
    assert.equal((await request(app).get(`/api/public/join/${code}`)).status, 404, '撤銷後應查無此代碼');
  });

  test('帶報到代碼註冊／登入會自動加入對應班級', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    const g1 = await coach.post('/api/coach/groups').send({ name: '第一梯', assessmentId: 'ai-competency' });
    const code1 = (await coach.post(`/api/coach/groups/${g1.body.group.id}/join-code`)).body.group.joinCode;

    // 新學員帶代碼註冊：一次到位（建立帳號 + 加入班級），回應要帶班級資訊供前端導頁。
    const stu = request.agent(app);
    const reg = await stu.post('/api/auth/register')
      .send({ name: '學員', email: 'qr-stu@b.co', password: 'abcdef12', joinCode: code1 });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.joinedGroup.id, g1.body.group.id);
    assert.equal(reg.body.joinedGroup.assessmentId, 'ai-competency');

    const myGroups1 = await stu.get('/api/groups/mine');
    assert.equal(myGroups1.body.groups.length, 1);
    assert.equal(myGroups1.body.groups[0].id, g1.body.group.id);

    // 同一位學員之後又報名第二梯，用登入帶代碼的方式加入。
    const g2 = await coach.post('/api/coach/groups').send({ name: '第二梯', assessmentId: 'ai-competency' });
    const code2 = (await coach.post(`/api/coach/groups/${g2.body.group.id}/join-code`)).body.group.joinCode;
    const relogin = await stu.post('/api/auth/login')
      .send({ email: 'qr-stu@b.co', password: 'abcdef12', joinCode: code2 });
    assert.equal(relogin.status, 200);
    assert.equal(relogin.body.joinedGroup.id, g2.body.group.id);

    const myGroups2 = await stu.get('/api/groups/mine');
    assert.equal(myGroups2.body.groups.length, 2, '應同時保留第一梯與第二梯的班級成員身份');

    // 代碼無效時不阻擋正常註冊／登入，只是不會加入任何班級。
    const noGroup = request.agent(app);
    const regBad = await noGroup.post('/api/auth/register')
      .send({ name: '無代碼', email: 'no-code@b.co', password: 'abcdef12', joinCode: 'BADCODE1' });
    assert.equal(regBad.status, 201);
    assert.equal(regBad.body.joinedGroup, null);
  });

  test('已登入使用者可用 POST /api/groups/join 直接加入另一個班級（免重新登入）', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach(app);
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    const g = await coach.post('/api/coach/groups').send({ name: '現場加開班', assessmentId: 'ai-competency' });
    const code = (await coach.post(`/api/coach/groups/${g.body.group.id}/join-code`)).body.group.joinCode;

    const stu = request.agent(app);
    await stu.post('/api/auth/register').send({ name: '學員', email: 'walkin@b.co', password: 'abcdef12' });

    const unauth = await request(app).post('/api/groups/join').send({ joinCode: code });
    assert.equal(unauth.status, 401, '未登入應被拒絕');

    const join = await stu.post('/api/groups/join').send({ joinCode: code });
    assert.equal(join.status, 200);
    assert.equal(join.body.joinedGroup.id, g.body.group.id);

    const myGroups = await stu.get('/api/groups/mine');
    assert.equal(myGroups.body.groups.length, 1);
    assert.equal(myGroups.body.groups[0].id, g.body.group.id);

    const bad = await stu.post('/api/groups/join').send({ joinCode: 'NOSUCHCODE' });
    assert.equal(bad.status, 404);
  });
});

describe('360° 多元評測', () => {
  async function makeCoach360(app) {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const coach = request.agent(app);
    const reg = await coach.post('/api/auth/register').send({ name: '教練', email: 'coach@b.co', password: 'abcdef12' });
    await admin.patch(`/api/admin/users/${reg.body.user.id}/role`).send({ role: 'coach' });
    await coach.post('/api/auth/login').send({ email: 'coach@b.co', password: 'abcdef12' });
    return { admin, coach };
  }

  test('POST /api/submissions 帶 rateeId 與 raterType 後正確存入', async () => {
    const app = await setup();
    const ratee = request.agent(app);
    const rateeReg = await ratee.post('/api/auth/register').send({ name: '被評者', email: 'ratee@b.co', password: 'abcdef12' });
    const rateeId = rateeReg.body.user.id;

    const rater = request.agent(app);
    await rater.post('/api/auth/register').send({ name: '同儕', email: 'rater@b.co', password: 'abcdef12' });
    const res = await rater.post('/api/submissions').send({
      answers: { q1: 4 }, result: sampleResult(124),
      assessmentId: 'leadership-9d', rateeId, raterType: 'peer',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.submission.rateeId, rateeId);
    assert.equal(res.body.submission.raterType, 'peer');
    assert.notEqual(res.body.submission.userId, rateeId);
  });

  test('raterType=self 時強制 rateeId 為登入者自己', async () => {
    const app = await setup();
    const user = request.agent(app);
    const reg = await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    const res = await user.post('/api/submissions').send({
      result: sampleResult(), rateeId: 'someone-else-id', raterType: 'self',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.submission.rateeId, reg.body.user.id);
  });

  test('本人可取得自己的 360° 評測集', async () => {
    const app = await setup();
    const user = request.agent(app);
    const reg = await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    await user.post('/api/submissions').send({ result: sampleResult(), assessmentId: 'leadership-9d' });
    const res = await user.get(`/api/submissions/ratee/${reg.body.user.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.submissions.length, 1);
  });

  test('他人無法取得別人的 ratee 資料（403）', async () => {
    const app = await setup();
    const userA = request.agent(app);
    const regA = await userA.post('/api/auth/register').send({ name: 'A', email: 'a@b.co', password: 'abcdef12' });
    await userA.post('/api/submissions').send({ result: sampleResult() });

    const userB = request.agent(app);
    await userB.post('/api/auth/register').send({ name: 'B', email: 'b@b.co', password: 'abcdef12' });
    assert.equal((await userB.get(`/api/submissions/ratee/${regA.body.user.id}`)).status, 403);
  });

  test('同儕評的評分者身份被匿名化，管理員評與自評不被匿名', async () => {
    const app = await setup();
    const ratee = request.agent(app);
    const rateeReg = await ratee.post('/api/auth/register').send({ name: '被評者', email: 'ratee@b.co', password: 'abcdef12' });
    const rateeId = rateeReg.body.user.id;

    const peer = request.agent(app);
    await peer.post('/api/auth/register').send({ name: '同儕', email: 'peer@b.co', password: 'abcdef12' });
    await peer.post('/api/submissions').send({
      result: sampleResult(), assessmentId: 'leadership-9d', rateeId, raterType: 'peer',
    });
    // self submission for the ratee
    await ratee.post('/api/submissions').send({
      result: sampleResult(), assessmentId: 'leadership-9d', raterType: 'self',
    });

    const res = await ratee.get(`/api/submissions/ratee/${rateeId}`);
    assert.equal(res.status, 200);
    const peerSub = res.body.submissions.find((s) => s.raterType === 'peer');
    const selfSub = res.body.submissions.find((s) => s.raterType === 'self');
    assert.ok(peerSub, '找不到同儕評');
    assert.equal(peerSub.userId, 'anonymous');
    assert.equal(peerSub.userName, '匿名');
    assert.equal(selfSub.userId, rateeId);
  });

  test('教練可取得組員的 ratee 資料並以 deanonymize=1 解匿名', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach360(app);

    const member = request.agent(app);
    const memReg = await member.post('/api/auth/register').send({ name: '學員', email: 'mem@b.co', password: 'abcdef12' });
    const memId = memReg.body.user.id;

    const g = await coach.post('/api/coach/groups').send({ name: 'G', assessmentId: 'leadership-9d' });
    await coach.post(`/api/coach/groups/${g.body.group.id}/roster`).send({ entries: [{ name: '學員', email: 'mem@b.co' }] });

    const peer = request.agent(app);
    await peer.post('/api/auth/register').send({ name: '同儕', email: 'peer@b.co', password: 'abcdef12' });
    await peer.post('/api/submissions').send({
      result: sampleResult(), assessmentId: 'leadership-9d', rateeId: memId, raterType: 'peer',
    });

    const res = await coach.get(`/api/submissions/ratee/${memId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.submissions.length, 1);

    const deAnon = await coach.get(`/api/submissions/ratee/${memId}?deanonymize=1`);
    assert.equal(deAnon.status, 200);
    assert.notEqual(deAnon.body.submissions[0].userId, 'anonymous');
  });

  test('GET /groups/mine/members 回傳同班成員（不含自己）', async () => {
    const app = await setup({ withAdmin: true });
    const { coach } = await makeCoach360(app);

    const userA = request.agent(app);
    const regA = await userA.post('/api/auth/register').send({ name: 'A', email: 'a@b.co', password: 'abcdef12' });

    const userB = request.agent(app);
    const regB = await userB.post('/api/auth/register').send({ name: 'B', email: 'b@b.co', password: 'abcdef12' });

    const g = await coach.post('/api/coach/groups').send({ name: 'G', assessmentId: 'leadership-9d' });
    await coach.post(`/api/coach/groups/${g.body.group.id}/roster`).send({
      entries: [{ name: 'A', email: 'a@b.co' }, { name: 'B', email: 'b@b.co' }],
    });

    const res = await userA.get('/api/groups/mine/members');
    assert.equal(res.status, 200);
    assert.ok(res.body.members.some((m) => m.id === regB.body.user.id), 'B 應在成員列表');
    assert.ok(!res.body.members.some((m) => m.id === regA.body.user.id), 'A 本人不應出現');
  });
});

describe('管理後台', () => {
  test('一般使用者無權限（403），管理員可取得總覽', async () => {
    const app = await setup({ withAdmin: true });

    const user = request.agent(app);
    await user.post('/api/auth/register').send({ name: 'u', email: 'u@b.co', password: 'abcdef12' });
    await user.post('/api/submissions').send({ result: sampleResult(93) });
    assert.equal((await user.get('/api/admin/overview')).status, 403);

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@demo.tw', password: 'admin1234' });
    const overview = await admin.get('/api/admin/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.submissions.length, 1);
    // 不應外洩任何密碼雜湊。
    assert.ok(overview.body.users.every((u) => u.passwordHash === undefined));
  });
});

describe('個人發展目標', () => {
  async function userAgent(app, email = 'g@b.co') {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'g', email, password: 'abcdef12' });
    return agent;
  }

  test('未登入不得存取', async () => {
    const app = await setup();
    assert.equal((await request(app).get('/api/goals')).status, 401);
    assert.equal((await request(app).post('/api/goals').send({ text: 'x' })).status, 401);
  });

  test('可建立目標並讀回，含行動項目', async () => {
    const app = await setup();
    const agent = await userAgent(app);

    const created = await agent.post('/api/goals').send({
      assessmentId: 'ai-competency',
      dimensionId: 'innovation',
      dimensionName: '創新力',
      text: '每週用 GPTs 做一個小工具',
      actions: [{ text: '先盤點三個重複性工作' }, { text: '做出第一版並找同事試用' }],
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.goal.dimensionName, '創新力');
    assert.equal(created.body.goal.actions.length, 2);
    assert.equal(created.body.goal.actions[0].done, false);
    assert.equal(created.body.goal.achievedAt, null);
    // 不應把 userId 這類內部欄位吐給前端
    assert.equal(created.body.goal.userId, undefined);

    const list = await agent.get('/api/goals');
    assert.equal(list.status, 200);
    assert.equal(list.body.goals.length, 1);
  });

  test('目標內容為空時擋下', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    assert.equal((await agent.post('/api/goals').send({ text: '   ' })).status, 400);
    assert.equal((await agent.post('/api/goals').send({})).status, 400);
  });

  test('可依評量篩選', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    await agent.post('/api/goals').send({ assessmentId: 'ai-competency', text: 'a' });
    await agent.post('/api/goals').send({ assessmentId: 'leadership-9d', text: 'b' });

    const filtered = await agent.get('/api/goals?assessmentId=leadership-9d');
    assert.equal(filtered.body.goals.length, 1);
    assert.equal(filtered.body.goals[0].text, 'b');
  });

  test('勾選行動項目會記錄完成時間，取消勾選則清除', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    const { body } = await agent.post('/api/goals').send({ text: '目標', actions: [{ text: '行動一' }] });
    const goal = body.goal;

    const done = await agent.patch(`/api/goals/${goal.id}`)
      .send({ actions: [{ ...goal.actions[0], done: true }] });
    assert.equal(done.status, 200);
    assert.equal(done.body.goal.actions[0].done, true);
    assert.ok(done.body.goal.actions[0].doneAt);

    const undone = await agent.patch(`/api/goals/${goal.id}`)
      .send({ actions: [{ ...done.body.goal.actions[0], done: false }] });
    assert.equal(undone.body.goal.actions[0].done, false);
    assert.equal(undone.body.goal.actions[0].doneAt, null);
  });

  test('可標記達成與取消達成', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    const { body } = await agent.post('/api/goals').send({ text: '目標' });

    const achieved = await agent.patch(`/api/goals/${body.goal.id}`).send({ achieved: true });
    assert.ok(achieved.body.goal.achievedAt);

    const reopened = await agent.patch(`/api/goals/${body.goal.id}`).send({ achieved: false });
    assert.equal(reopened.body.goal.achievedAt, null);
  });

  test('看不到也改不動別人的目標', async () => {
    const app = await setup();
    const alice = await userAgent(app, 'alice@b.co');
    const bob = await userAgent(app, 'bob@b.co');

    const { body } = await alice.post('/api/goals').send({ text: 'alice 的目標' });
    const goalId = body.goal.id;

    assert.equal((await bob.get('/api/goals')).body.goals.length, 0);
    assert.equal((await bob.patch(`/api/goals/${goalId}`).send({ text: '竄改' })).status, 404);
    assert.equal((await bob.delete(`/api/goals/${goalId}`)).status, 404);

    // 確認 alice 的目標沒有被動到
    const still = await alice.get('/api/goals');
    assert.equal(still.body.goals[0].text, 'alice 的目標');
  });

  test('可刪除自己的目標', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    const { body } = await agent.post('/api/goals').send({ text: '要刪掉的' });
    assert.equal((await agent.delete(`/api/goals/${body.goal.id}`)).status, 200);
    assert.equal((await agent.get('/api/goals')).body.goals.length, 0);
  });

  test('行動項目數量上限為 5，超過的被截掉', async () => {
    const app = await setup();
    const agent = await userAgent(app);
    const actions = Array.from({ length: 9 }, (_, i) => ({ text: `行動 ${i}` }));
    const { body } = await agent.post('/api/goals').send({ text: '目標', actions });
    assert.equal(body.goal.actions.length, 5);
  });
});

describe('學習資源（第二大腦整合）', () => {
  async function agentFor(app) {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'l', email: 'l@b.co', password: 'abcdef12' });
    return agent;
  }

  // 實測 brain.rong-rise.com/api/articles?q= 的真實回應形狀（見
  // server/src/routes/learningResources.js 頂端註解）：
  // { articles: [{ slug, title, category, categoryIcon, tags, date, excerpt }] }
  function mockBrainResponse(articles) {
    return { ok: true, status: 200, json: async () => ({ articles }) };
  }

  test('未登入不得存取', async () => {
    const app = await setup();
    const res = await request(app).get('/api/learning-resources?assessmentId=ai-competency&dimensionId=foundation');
    assert.equal(res.status, 401);
  });

  test('缺少 assessmentId／dimensionId 回 400', async () => {
    const app = await setup();
    const agent = await agentFor(app);
    assert.equal((await agent.get('/api/learning-resources')).status, 400);
    assert.equal((await agent.get('/api/learning-resources?assessmentId=ai-competency')).status, 400);
  });

  test('構面沒有對照關鍵字時直接回空陣列，不呼叫外部 API', async (t) => {
    const app = await setup();
    const agent = await agentFor(app);
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('不應該被呼叫');
    });
    const res = await agent.get('/api/learning-resources?assessmentId=ai-competency&dimensionId=not-a-real-dimension');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.articles, []);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  test('依構面查到文章時，依實際欄位（slug/title/category/excerpt）正確解析並組出連結', async (t) => {
    const app = await setup();
    const agent = await agentFor(app);
    t.mock.method(globalThis, 'fetch', async () => mockBrainResponse([
      {
        slug: '人才培訓體系設計框架', title: '人才培訓體系設計框架', category: '人資與組織發展',
        categoryIcon: '🏢', tags: [], date: '2026-06-09', excerpt: '系統化設計企業培訓體系的方法論。',
      },
    ]));
    const res = await agent.get('/api/learning-resources?assessmentId=leadership-9d&dimensionId=developing-others');
    assert.equal(res.status, 200);
    assert.equal(res.body.articles.length, 1);
    const [article] = res.body.articles;
    assert.equal(article.title, '人才培訓體系設計框架');
    assert.equal(article.excerpt, '系統化設計企業培訓體系的方法論。');
    assert.equal(article.url, `https://brain.rong-rise.com/api/articles/${encodeURIComponent('人才培訓體系設計框架')}`);
  });

  test('不在允許分類內的文章會被過濾掉（如「國際視野」「顧問專案」等內部筆記）', async (t) => {
    const app = await setup();
    const agent = await agentFor(app);
    t.mock.method(globalThis, 'fetch', async () => mockBrainResponse([
      { slug: 'a', title: '允許分類文章', category: '管理心理學', excerpt: '' },
      { slug: 'b', title: '不允許分類文章', category: '顧問專案', excerpt: '' },
    ]));
    const res = await agent.get('/api/learning-resources?assessmentId=leadership-9d&dimensionId=communication');
    assert.equal(res.body.articles.length, 1);
    assert.equal(res.body.articles[0].title, '允許分類文章');
  });

  test('外部 API 逾時或失敗時回空陣列，不讓報告頁面被卡住', async (t) => {
    const app = await setup();
    const agent = await agentFor(app);
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
    const res = await agent.get('/api/learning-resources?assessmentId=ai-competency&dimensionId=foundation');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.articles, []);
  });

  test('同一關鍵字在快取有效期內不重複呼叫外部 API', async (t) => {
    const app = await setup();
    const agent = await agentFor(app);
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => mockBrainResponse([
      { slug: 'x', title: 'X', category: '技術深讀', excerpt: '' },
    ]));
    await agent.get('/api/learning-resources?assessmentId=ai-competency&dimensionId=foundation');
    await agent.get('/api/learning-resources?assessmentId=ai-competency&dimensionId=foundation');
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});
