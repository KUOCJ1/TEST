import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

// 專案範本：管理員維護；教練開班選範本，評量鎖定。

async function setup() {
  const db = createDb(':memory:');
  const pw = await hashPassword('abcdef12');
  const mk = (name, email, role = 'user') => ({ id: randomUUID(), name, email, role, passwordHash: pw, createdAt: new Date().toISOString() });
  const u = { admin: mk('管理員', 'a@b.co', 'admin'), coach: mk('教練', 'c@b.co', 'coach'), learner: mk('學員', 'l@b.co') };
  db.data.users.push(...Object.values(u));
  const app = createApp({ db, jwtSecret: 'test-secret-please-change' });
  const as = async (user) => {
    const ag = request.agent(app);
    await ag.post('/api/auth/login').send({ email: user.email, password: 'abcdef12' });
    return ag;
  };
  return { db, app, u, as };
}

const body = (over = {}) => ({ name: '森永高階教練 360', clientName: '森永', assessmentId: 'leadership-360-70', exclusive: false, ...over });

describe('範本維護（管理員）', () => {
  test('新增、列出、修改、刪除；寫稽核', async () => {
    const { db, u, as } = await setup();
    const admin = await as(u.admin);
    const created = await admin.post('/api/admin/project-templates').send(body());
    assert.equal(created.status, 201);
    const id = created.body.template.id;
    assert.equal(created.body.template.assessmentId, 'leadership-360-70');
    assert.equal((await admin.get('/api/admin/project-templates')).body.templates.length, 1);
    const upd = await admin.put(`/api/admin/project-templates/${id}`).send(body({ name: '改名', exclusive: true }));
    assert.equal(upd.body.template.name, '改名');
    assert.equal(upd.body.template.exclusive, true);
    assert.equal((await admin.delete(`/api/admin/project-templates/${id}`)).status, 200);
    assert.equal((await admin.get('/api/admin/project-templates')).body.templates.length, 0);
    const actions = db.data.auditLog.map((e) => e.action);
    for (const a of ['create_project_template', 'update_project_template', 'delete_project_template']) assert.ok(actions.includes(a), a);
  });

  test('驗證：沒名稱、評量不存在、課後問卷不能當主要評量、停用的評量；附加只收課後問卷', async () => {
    const { db, u, as } = await setup();
    const admin = await as(u.admin);
    assert.equal((await admin.post('/api/admin/project-templates').send(body({ name: '' }))).status, 400);
    assert.equal((await admin.post('/api/admin/project-templates').send(body({ assessmentId: 'nope' }))).status, 400);
    assert.equal((await admin.post('/api/admin/project-templates').send(body({ assessmentId: 'ai-course-post' }))).status, 400);
    db.data.assessments.find((a) => a.id === 'disc').enabled = false;
    assert.equal((await admin.post('/api/admin/project-templates').send(body({ assessmentId: 'disc' }))).status, 400);
    const ok = await admin.post('/api/admin/project-templates').send(body({ assessmentId: 'ai-competency', extraAssessmentIds: ['ai-course-post', 'ai-competency', 'x'] }));
    assert.deepEqual(ok.body.template.extraAssessmentIds, ['ai-course-post']);
  });

  test('只有管理員能維護；教練與學員不行', async () => {
    const { u, as } = await setup();
    for (const who of [u.coach, u.learner]) {
      const ag = await as(who);
      assert.equal((await ag.post('/api/admin/project-templates').send(body())).status, 403);
      assert.equal((await ag.get('/api/admin/project-templates')).status, 403);
    }
  });
});

describe('開班套用範本', () => {
  async function withTemplate(over = {}) {
    const s = await setup();
    const admin = await s.as(s.u.admin);
    const t = (await admin.post('/api/admin/project-templates').send(body(over))).body.template;
    return { ...s, admin, t };
  }

  test('教練看得到範本；選範本開班：評量、專屬班級、附加問卷、公司名稱都以範本為準', async () => {
    const { u, as, t } = await withTemplate({ exclusive: true, extraAssessmentIds: ['ai-course-post'] });
    const coach = await as(u.coach);
    assert.equal((await coach.get('/api/coach/project-templates')).body.templates[0].id, t.id);
    const res = await coach.post('/api/coach/groups').send({ name: '森永班', templateId: t.id });
    assert.equal(res.status, 201);
    const g = res.body.group;
    assert.equal(g.assessmentId, 'leadership-360-70');
    assert.equal(g.exclusive, true);
    assert.deepEqual(g.extraAssessmentIds, ['ai-course-post']);
    assert.equal(g.companyName, '森永');
    assert.equal(g.templateId, t.id);
  });

  test('選了範本又指定別的評量 → 拒絕（評量鎖定）；指定同一份可以', async () => {
    const { u, as, t } = await withTemplate();
    const coach = await as(u.coach);
    const bad = await coach.post('/api/coach/groups').send({ name: '班', templateId: t.id, assessmentId: 'leadership-9d' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'TEMPLATE_LOCKED');
    const same = await coach.post('/api/coach/groups').send({ name: '班', templateId: t.id, assessmentId: 'leadership-360-70' });
    assert.equal(same.status, 201);
  });

  test('範本不存在 → 400；沒選範本照舊（可自選評量）', async () => {
    const { u, as } = await withTemplate();
    const coach = await as(u.coach);
    assert.equal((await coach.post('/api/coach/groups').send({ name: '班', templateId: 'nope' })).body.code, 'UNKNOWN_TEMPLATE');
    const plain = await coach.post('/api/coach/groups').send({ name: '一般班', assessmentId: 'leadership-9d' });
    assert.equal(plain.status, 201);
    assert.equal(plain.body.group.templateId, undefined);
  });

  test('用範本開的班不能事後改評量；其他欄位照常可改；範本被刪就不再鎖', async () => {
    const { u, as, t, admin, db } = await withTemplate();
    const coach = await as(u.coach);
    const g = (await coach.post('/api/coach/groups').send({ name: '班', templateId: t.id })).body.group;
    const lock = await coach.put(`/api/coach/groups/${g.id}`).send({ assessmentId: 'leadership-9d' });
    assert.equal(lock.status, 400);
    assert.equal(lock.body.code, 'TEMPLATE_LOCKED');
    assert.equal((await coach.put(`/api/coach/groups/${g.id}`).send({ name: '改名' })).status, 200);
    await admin.delete(`/api/admin/project-templates/${t.id}`);
    assert.equal((await coach.put(`/api/coach/groups/${g.id}`).send({ assessmentId: 'leadership-9d' })).status, 200);
    assert.equal(db.data.groups.find((x) => x.id === g.id).assessmentId, 'leadership-9d');
  });

  test('學員不能看範本清單', async () => {
    const { u, as } = await withTemplate();
    const ag = await as(u.learner);
    assert.notEqual((await ag.get('/api/coach/project-templates')).status, 200);
  });
});
