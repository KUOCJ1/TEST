import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  validateRegistration,
  publicUser,
} from './auth.js';

const COOKIE_NAME = 'aiassess_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 建立 Express app（不啟動監聽），方便測試直接以 supertest 注入。
 * @param {{db, jwtSecret:string, secureCookies?:boolean}} opts
 */
export function createApp({ db, jwtSecret, secureCookies = false }) {
  if (!jwtSecret) throw new Error('createApp 需要 jwtSecret');

  const app = express();
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());

  function setAuthCookie(res, user) {
    res.cookie(COOKIE_NAME, signToken({ sub: user.id }, jwtSecret), {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  function currentUser(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;
    const payload = verifyToken(token, jwtSecret);
    if (!payload) return null;
    return db.data.users.find((u) => u.id === payload.sub) || null;
  }

  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: '尚未登入' });
    req.user = user;
    next();
  }

  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理員權限' });
    next();
  }

  function requireCoach(req, res, next) {
    if (req.user.role !== 'coach' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要教練或管理員權限' });
    }
    next();
  }

  // Normalize legacy submissions that lack assessmentId.
  function normalizeSubmission(s) {
    return { ...s, assessmentId: s.assessmentId ?? 'ai-competency' };
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ── 評量清單 ─────────────────────────────────────────────
  app.get('/api/assessments', requireAuth, (_req, res) => {
    const list = (db.data.assessments ?? []).filter((a) => a.enabled);
    res.json({ assessments: list });
  });

  // ── 認證 ────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    try {
      validateRegistration({ name, email, password });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const normEmail = email.trim().toLowerCase();
    if (db.data.users.some((u) => u.email === normEmail)) {
      return res.status(409).json({ error: '此 Email 已被註冊' });
    }
    const user = {
      id: randomUUID(),
      name: name.trim(),
      email: normEmail,
      passwordHash: await hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    db.persist();
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = db.data.users.find((u) => u.email === (email || '').trim().toLowerCase());
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Email 或密碼錯誤' });
    }
    setAuthCookie(res, user);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  // ── 作答 ────────────────────────────────────────────────
  app.post('/api/submissions', requireAuth, (req, res) => {
    const { answers, result, assessmentId } = req.body || {};
    if (!result || typeof result.total !== 'number' || !Array.isArray(result.dimensions)) {
      return res.status(400).json({ error: '作答結果格式不正確' });
    }
    const record = {
      id: randomUUID(),
      userId: req.user.id,
      userName: req.user.name,
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      createdAt: new Date().toISOString(),
      answers: answers && typeof answers === 'object' ? answers : {},
      result,
    };
    db.data.submissions.push(record);
    db.persist();
    res.status(201).json({ submission: record });
  });

  app.get('/api/submissions/me', requireAuth, (req, res) => {
    const mine = db.data.submissions
      .filter((s) => s.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(normalizeSubmission);
    res.json({ submissions: mine });
  });

  // ── 管理後台 ────────────────────────────────────────────
  app.get('/api/admin/assessments', requireAuth, requireAdmin, (_req, res) => {
    res.json({ assessments: db.data.assessments ?? [] });
  });

  app.patch('/api/admin/assessments/:id', requireAuth, requireAdmin, (req, res) => {
    const { enabled } = req.body ?? {};
    const list = db.data.assessments ?? [];
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '評量不存在' });
    list[idx] = { ...list[idx], enabled: Boolean(enabled) };
    db.persist();
    res.json({ assessment: list[idx] });
  });

  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      users: db.data.users.map(publicUser),
      submissions: db.data.submissions.map((s) => ({
        ...normalizeSubmission(s),
        answers: undefined,
      })),
    });
  });

  // ── 角色管理 ────────────────────────────────────────────
  app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, (req, res) => {
    const { role } = req.body ?? {};
    if (!['user', 'coach'].includes(role)) {
      return res.status(400).json({ error: '角色必須是 user 或 coach' });
    }
    const user = db.data.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能修改管理員角色' });
    user.role = role;
    db.persist();
    res.json({ user: publicUser(user) });
  });

  // ── 教練後台 ─────────────────────────────────────────────
  app.get('/api/coach/overview', requireAuth, requireCoach, (_req, res) => {
    res.json({
      users: db.data.users.filter((u) => u.role !== 'admin').map(publicUser),
      submissions: db.data.submissions.map((s) => ({
        ...normalizeSubmission(s),
        answers: undefined,
      })),
    });
  });

  // ── 班別 CRUD ─────────────────────────────────────────────
  app.get('/api/coach/groups', requireAuth, requireCoach, (req, res) => {
    const groups = (db.data.groups ?? []).filter(
      (g) => g.coachId === req.user.id || req.user.role === 'admin',
    );
    res.json({ groups });
  });

  app.post('/api/coach/groups', requireAuth, requireCoach, (req, res) => {
    const { name, companyName, assessmentId, memberIds } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: '請輸入班別名稱' });
    const group = {
      id: randomUUID(),
      name: name.trim(),
      companyName: companyName?.trim() ?? '',
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      coachId: req.user.id,
      coachName: req.user.name,
      memberIds: Array.isArray(memberIds) ? memberIds : [],
      groupComment: '',
      groupTips: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!db.data.groups) db.data.groups = [];
    db.data.groups.push(group);
    db.persist();
    res.status(201).json({ group });
  });

  app.get('/api/coach/groups/:id', requireAuth, requireCoach, (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const memberSubs = db.data.submissions
      .filter((s) => group.memberIds.includes(s.userId) && (s.assessmentId ?? 'ai-competency') === group.assessmentId)
      .map((s) => ({ ...normalizeSubmission(s), answers: undefined }));
    res.json({ group, submissions: memberSubs });
  });

  app.put('/api/coach/groups/:id', requireAuth, requireCoach, (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const { name, companyName, assessmentId, memberIds, groupComment, groupTips } = req.body ?? {};
    groups[idx] = {
      ...groups[idx],
      ...(name !== undefined && { name: name.trim() }),
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(assessmentId !== undefined && { assessmentId }),
      ...(memberIds !== undefined && { memberIds: Array.isArray(memberIds) ? memberIds : [] }),
      ...(groupComment !== undefined && { groupComment }),
      ...(groupTips !== undefined && { groupTips: Array.isArray(groupTips) ? groupTips : [] }),
      updatedAt: new Date().toISOString(),
    };
    db.persist();
    res.json({ group: groups[idx] });
  });

  app.delete('/api/coach/groups/:id', requireAuth, requireCoach, (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups.splice(idx, 1);
    db.persist();
    res.json({ ok: true });
  });

  // ── 評語（每位教練對每份作答只留一則，POST = upsert）────────
  app.post('/api/submissions/:id/comment', requireAuth, requireCoach, (req, res) => {
    const submission = db.data.submissions.find((s) => s.id === req.params.id);
    if (!submission) return res.status(404).json({ error: '作答記錄不存在' });
    const { text, tips } = req.body ?? {};
    if (!text?.trim()) return res.status(400).json({ error: '請輸入評語' });
    if (!submission.comments) submission.comments = [];
    const existingIdx = submission.comments.findIndex((c) => c.coachId === req.user.id);
    const now = new Date().toISOString();
    const comment = {
      id: existingIdx >= 0 ? submission.comments[existingIdx].id : randomUUID(),
      coachId: req.user.id,
      coachName: req.user.name,
      text: text.trim(),
      tips: Array.isArray(tips) ? tips.map((t) => t?.trim()).filter(Boolean) : [],
      createdAt: existingIdx >= 0 ? submission.comments[existingIdx].createdAt : now,
      updatedAt: now,
    };
    if (existingIdx >= 0) submission.comments[existingIdx] = comment;
    else submission.comments.push(comment);
    db.persist();
    res.json({ comment });
  });

  app.delete('/api/submissions/:id/comment/:commentId', requireAuth, requireCoach, (req, res) => {
    const submission = db.data.submissions.find((s) => s.id === req.params.id);
    if (!submission) return res.status(404).json({ error: '作答記錄不存在' });
    const comments = submission.comments ?? [];
    const idx = comments.findIndex((c) => c.id === req.params.commentId);
    if (idx === -1) return res.status(404).json({ error: '評語不存在' });
    if (comments[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    comments.splice(idx, 1);
    db.persist();
    res.json({ ok: true });
  });

  // ── 用戶：查看自己所在的班別 ──────────────────────────────
  app.get('/api/groups/mine', requireAuth, (req, res) => {
    const myGroups = (db.data.groups ?? []).filter((g) => g.memberIds.includes(req.user.id));
    res.json({ groups: myGroups });
  });

  return app;
}
