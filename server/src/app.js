import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID, createHash } from 'node:crypto';
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

// ── 班別「評量設定」欄位清洗 ───────────────────────────────
// 構面 id 屬於前端題庫設定，後端不持有完整清單，故僅做型別/長度防呆，
// 由前端提供合法選項（與現有 assessmentId 僅存字串的作法一致）。
export function sanitizeFocusDimensionIds(v) {
  if (!Array.isArray(v)) return [];
  const cleaned = v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  return [...new Set(cleaned)].slice(0, 50);
}
export function sanitizeTargetHeadcount(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), 100000);
}
export function sanitizeDimensionNotes(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof k === 'string' && typeof val === 'string') {
      const t = val.trim();
      if (t) out[k] = t.slice(0, 2000);
    }
  }
  return out;
}

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

  // Normalize legacy submissions that lack assessmentId / rater fields.
  function normalizeSubmission(s) {
    return {
      ...s,
      assessmentId: s.assessmentId ?? 'ai-competency',
      phase: s.phase ?? null,
      rateeId: s.rateeId ?? s.userId,
      raterType: s.raterType ?? 'self',
    };
  }

  const hashToken = (t) => createHash('sha256').update(t).digest('hex');

  // 將使用者 email 比對各班別的待加入名單；命中則自動轉為正式成員。
  function claimPendingGroups(user) {
    let changed = false;
    for (const g of db.data.groups ?? []) {
      const pending = g.pendingMembers ?? [];
      const idx = pending.findIndex((p) => p.email === user.email);
      if (idx >= 0) {
        if (!g.memberIds.includes(user.id)) g.memberIds.push(user.id);
        pending.splice(idx, 1);
        g.pendingMembers = pending;
        changed = true;
      }
    }
    if (changed) db.persist();
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ── 評量清單 ─────────────────────────────────────────────
  app.get('/api/assessments', requireAuth, (_req, res) => {
    const list = (db.data.assessments ?? []).filter((a) => a.enabled);
    res.json({ assessments: list });
  });

  // ── 母體基準（百分位 / Benchmark）─────────────────────────
  // 以「每位填答者最新一筆」為母體，回傳不含 PII 的聚合統計。
  app.get('/api/assessments/:id/benchmark', requireAuth, (req, res) => {
    const assessmentId = req.params.id;
    const all = db.data.submissions.filter(
      (s) => (s.assessmentId ?? 'ai-competency') === assessmentId,
    );
    const latestMap = new Map();
    for (const s of all) {
      const cur = latestMap.get(s.userId);
      if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) latestMap.set(s.userId, s);
    }
    const latest = [...latestMap.values()];
    const totals = latest.map((s) => s.result?.total ?? 0).sort((a, b) => a - b);

    // 各構面平均百分比
    const dimMap = new Map();
    for (const s of latest) {
      for (const d of s.result?.dimensions ?? []) {
        if (!dimMap.has(d.id)) dimMap.set(d.id, { id: d.id, subtitle: d.subtitle, name: d.name, color: d.color, sum: 0, n: 0 });
        const e = dimMap.get(d.id);
        e.sum += d.percent ?? 0;
        e.n += 1;
      }
    }
    const dimensionAverages = [...dimMap.values()].map((e) => ({
      id: e.id, subtitle: e.subtitle, name: e.name, color: e.color,
      percent: e.n ? Math.round(e.sum / e.n) : 0,
    }));

    const count = latest.length;
    const avgTotal = count ? Math.round((totals.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0;

    res.json({
      assessmentId,
      count,
      avgTotal,
      totals, // 已排序的總分陣列，供前端算百分位
      dimensionAverages,
    });
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
    claimPendingGroups(user);
    setAuthCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = db.data.users.find((u) => u.email === (email || '').trim().toLowerCase());
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Email 或密碼錯誤' });
    }
    claimPendingGroups(user);
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

  // 更新個人檔案：姓名與偏好設定。
  app.patch('/api/auth/profile', requireAuth, (req, res) => {
    const { name, preferences } = req.body ?? {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: '姓名不可為空' });
      req.user.name = name.trim();
    }
    if (preferences !== undefined && preferences && typeof preferences === 'object') {
      req.user.preferences = { ...(req.user.preferences ?? {}), ...preferences };
    }
    db.persist();
    res.json({ user: publicUser(req.user) });
  });

  // 登入狀態下變更密碼。
  app.post('/api/auth/password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if ((newPassword || '').length < 6) {
      return res.status(400).json({ error: '新密碼至少需 6 碼' });
    }
    if (!(await verifyPassword(currentPassword || '', req.user.passwordHash))) {
      return res.status(401).json({ error: '目前密碼不正確' });
    }
    req.user.passwordHash = await hashPassword(newPassword);
    db.persist();
    res.json({ ok: true });
  });

  // 以重設 token 設定新密碼（忘記密碼流程，免登入）。
  app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || (newPassword || '').length < 6) {
      return res.status(400).json({ error: '重設連結或新密碼不正確（密碼至少 6 碼）' });
    }
    const h = hashToken(token);
    const user = db.data.users.find(
      (u) => u.resetTokenHash === h && (u.resetTokenExpires || 0) > Date.now(),
    );
    if (!user) return res.status(400).json({ error: '重設連結無效或已過期，請向管理員重新索取' });
    user.passwordHash = await hashPassword(newPassword);
    delete user.resetTokenHash;
    delete user.resetTokenExpires;
    db.persist();
    res.json({ ok: true });
  });

  // ── 作答 ────────────────────────────────────────────────
  const VALID_RATER_TYPES = new Set(['self', 'manager', 'peer', 'subordinate']);

  app.post('/api/submissions', requireAuth, (req, res) => {
    const { answers, result, assessmentId, phase, rateeId, raterType } = req.body || {};
    if (!result || typeof result.total !== 'number' || !Array.isArray(result.dimensions)) {
      return res.status(400).json({ error: '作答結果格式不正確' });
    }
    const effectiveRateeId = typeof rateeId === 'string' && rateeId.trim()
      ? rateeId.trim()
      : req.user.id;
    const effectiveRaterType = VALID_RATER_TYPES.has(raterType) ? raterType : 'self';
    // 自評時強制 rateeId = self
    const finalRateeId = effectiveRaterType === 'self' ? req.user.id : effectiveRateeId;

    const record = {
      id: randomUUID(),
      userId: req.user.id,
      userName: req.user.name,
      rateeId: finalRateeId,
      raterType: effectiveRaterType,
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      phase: phase === 'pre' || phase === 'post' ? phase : null,
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

  // 查詢某位被評者（ratee）的所有 360° 評測紀錄。
  // 存取控制：本人 / 該 ratee 所在班別的教練 / 管理員。
  // 同儕與部屬評測者預設匿名（教練與管理員可傳 ?deanonymize=1 解匿名）。
  app.get('/api/submissions/ratee/:rateeId', requireAuth, (req, res) => {
    const { rateeId } = req.params;
    const { assessmentId, deanonymize } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === rateeId;
    const isCoachOfRatee = !isAdmin && !isSelf && (db.data.groups ?? []).some(
      (g) => g.coachId === req.user.id && g.memberIds.includes(rateeId),
    );
    if (!isSelf && !isCoachOfRatee && !isAdmin) {
      return res.status(403).json({ error: '無權限查看此評測資料' });
    }
    const canDeanonymize = isAdmin || isCoachOfRatee || (isSelf && deanonymize === '1');

    let subs = db.data.submissions
      .filter((s) => {
        const rid = s.rateeId ?? s.userId;
        const matchRatee = rid === rateeId;
        const matchAssessment = !assessmentId || (s.assessmentId ?? 'ai-competency') === assessmentId;
        return matchRatee && matchAssessment;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((s) => {
        const n = normalizeSubmission(s);
        if (!canDeanonymize && (n.raterType === 'peer' || n.raterType === 'subordinate')) {
          return { ...n, userId: 'anonymous', userName: '匿名', answers: undefined };
        }
        return { ...n, answers: undefined };
      });

    res.json({ submissions: subs });
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

  // 管理員協助：產生一次性密碼重設 token（24 小時有效），交給使用者自行設定新密碼。
  app.post('/api/admin/users/:id/reset-token', requireAuth, requireAdmin, (req, res) => {
    const user = db.data.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    user.resetTokenHash = hashToken(token);
    user.resetTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    db.persist();
    res.json({ token, email: user.email, expiresInHours: 24 });
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
    const { name, companyName, assessmentId, memberIds, focusDimensionIds, targetHeadcount, dimensionNotes } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: '請輸入班別名稱' });
    const group = {
      id: randomUUID(),
      name: name.trim(),
      companyName: companyName?.trim() ?? '',
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      coachId: req.user.id,
      coachName: req.user.name,
      memberIds: Array.isArray(memberIds) ? memberIds : [],
      focusDimensionIds: sanitizeFocusDimensionIds(focusDimensionIds),
      targetHeadcount: sanitizeTargetHeadcount(targetHeadcount),
      dimensionNotes: sanitizeDimensionNotes(dimensionNotes),
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
    const { name, companyName, assessmentId, memberIds, groupComment, groupTips, focusDimensionIds, targetHeadcount, dimensionNotes } = req.body ?? {};
    groups[idx] = {
      ...groups[idx],
      ...(name !== undefined && { name: name.trim() }),
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(assessmentId !== undefined && { assessmentId }),
      ...(memberIds !== undefined && { memberIds: Array.isArray(memberIds) ? memberIds : [] }),
      ...(groupComment !== undefined && { groupComment }),
      ...(groupTips !== undefined && { groupTips: Array.isArray(groupTips) ? groupTips : [] }),
      ...(focusDimensionIds !== undefined && { focusDimensionIds: sanitizeFocusDimensionIds(focusDimensionIds) }),
      ...(targetHeadcount !== undefined && { targetHeadcount: sanitizeTargetHeadcount(targetHeadcount) }),
      ...(dimensionNotes !== undefined && { dimensionNotes: sanitizeDimensionNotes(dimensionNotes) }),
      updatedAt: new Date().toISOString(),
    };
    db.persist();
    res.json({ group: groups[idx] });
  });

  // 批量匯入名單：以 email 比對現有用戶；未註冊者列入待加入名單，註冊後自動入班。
  app.post('/api/coach/groups/:id/roster', requireAuth, requireCoach, (req, res) => {
    const groups = db.data.groups ?? [];
    const group = groups.find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const { entries } = req.body ?? {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: '名單格式不正確' });

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!group.pendingMembers) group.pendingMembers = [];
    const result = { added: 0, pending: 0, invalid: [] };

    for (const raw of entries) {
      const email = (raw.email || '').trim().toLowerCase();
      const name = (raw.name || '').trim();
      if (!emailRe.test(email)) { result.invalid.push(raw.email || '(空白)'); continue; }
      const existing = db.data.users.find((u) => u.email === email && u.role !== 'admin');
      if (existing) {
        if (!group.memberIds.includes(existing.id)) { group.memberIds.push(existing.id); result.added += 1; }
      } else if (!group.pendingMembers.some((p) => p.email === email)) {
        group.pendingMembers.push({ name, email });
        result.pending += 1;
      }
    }
    group.updatedAt = new Date().toISOString();
    db.persist();
    res.json({ group, result });
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

  // 回傳使用者在所有班別中的同儕成員（不含自己），供 360° 選人介面使用。
  app.get('/api/groups/mine/members', requireAuth, (req, res) => {
    const myGroups = (db.data.groups ?? []).filter((g) => g.memberIds.includes(req.user.id));
    const memberIds = [...new Set(myGroups.flatMap((g) => g.memberIds))].filter((id) => id !== req.user.id);
    const members = memberIds
      .map((id) => {
        const u = db.data.users.find((x) => x.id === id);
        return u ? { id: u.id, name: u.name } : null;
      })
      .filter(Boolean);
    res.json({ members });
  });

  return app;
}
