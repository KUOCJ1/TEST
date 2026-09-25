import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { publicUser } from '../auth.js';
import {
  asyncHandler, normalizeSubmission, auditLog, hashToken, revokeUserTokens, validateResultShape,
} from '../lib/helpers.js';

const VALID_RATER_TYPES = new Set(['self', 'manager', 'peer', 'subordinate']);

/** @param {{db, requireAuth, requireAdmin}} deps */
export function createAdminRouter({ db, requireAuth, requireAdmin }) {
  const router = Router();
  router.use(requireAuth, requireAdmin);

  router.get('/assessments', (_req, res) => {
    res.json({ assessments: db.data.assessments ?? [] });
  });

  router.patch('/assessments/:id', (req, res) => {
    const { enabled } = req.body ?? {};
    const list = db.data.assessments ?? [];
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '評量不存在' });
    list[idx] = { ...list[idx], enabled: Boolean(enabled) };
    db.persist();
    auditLog(req, 'toggle_assessment', { assessmentId: req.params.id, enabled: Boolean(enabled) });
    res.json({ assessment: list[idx] });
  });

  // 延伸閱讀使用情形：只回傳依「題庫+構面」彙總的點擊/加入清單次數，不揭露是
  // 誰點的、誰存的——個人的學習清單／閱讀紀錄設計上只有本人看得到（見
  // routes/readingList.js、components/GoalPanel.jsx 的隱私設計）。
  router.get('/learning-resources/stats', (_req, res) => {
    const key = (assessmentId, dimensionId) => `${assessmentId}::${dimensionId}`;
    const counts = new Map();
    const bump = (assessmentId, dimensionId, field) => {
      if (!assessmentId || !dimensionId) return;
      const k = key(assessmentId, dimensionId);
      const row = counts.get(k) ?? { assessmentId, dimensionId, clicks: 0, saves: 0 };
      row[field] += 1;
      counts.set(k, row);
    };
    (db.data.learningResourceClicks ?? []).forEach((c) => bump(c.assessmentId, c.dimensionId, 'clicks'));
    (db.data.readingList ?? []).forEach((i) => bump(i.assessmentId, i.dimensionId, 'saves'));
    const stats = [...counts.values()].sort((a, b) => (b.clicks + b.saves) - (a.clicks + a.saves));
    res.json({ stats });
  });

  router.get('/overview', (_req, res) => {
    res.json({
      users: db.data.users.map(publicUser),
      submissions: db.data.submissions.map((s) => ({
        ...normalizeSubmission(s),
        answers: undefined,
      })),
    });
  });

  // ── 角色管理 ────────────────────────────────────────────
  router.patch('/users/:id/role', (req, res) => {
    const { role } = req.body ?? {};
    if (!['user', 'coach'].includes(role)) {
      return res.status(400).json({ error: '角色必須是 user 或 coach' });
    }
    const user = db.data.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能修改管理員角色' });
    const prevRole = user.role;
    user.role = role;
    // 角色（權限）變了，該帳號現有的登入 session 一併撤銷，下次請求會被要求重新登入
    // 以取得反映新角色的 token；避免降級後舊 token 仍帶著舊權限繼續有效。
    revokeUserTokens(user);
    db.persist();
    auditLog(req, 'change_role', { targetUserId: user.id, from: prevRole, to: role });
    res.json({ user: publicUser(user) });
  });

  router.post('/users/:id/reset-token', (req, res) => {
    const user = db.data.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    user.resetTokenHash = hashToken(token);
    user.resetTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    db.persist();
    auditLog(req, 'generate_reset_token', { targetUserId: user.id });
    res.json({ token, email: user.email, expiresInHours: 24 });
  });

  // ── 管理後台：批次匯入 ────────────────────────────────────
  router.post('/batch-import', asyncHandler(async (req, res) => {
    const { assessmentId, rows } = req.body;
    if (!assessmentId || typeof assessmentId !== 'string') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '缺少 assessmentId' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '沒有可匯入的資料列' });
    }
    if (rows.length > 2000) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', error: '單次最多匯入 2000 筆' });
    }

    const now = new Date().toISOString();
    let added = 0;
    let usersCreated = 0;
    const errors = [];

    const findOrCreateUser = async (email, name) => {
      const existing = db.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) return existing;
      const newUser = {
        id: randomUUID(),
        email: email.toLowerCase().trim(),
        name: name?.trim() || email.split('@')[0],
        role: 'user',
        source: 'imported',
        passwordHash: null,
        createdAt: now,
      };
      db.data.users.push(newUser);
      usersCreated++;
      return newUser;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { rateeEmail, rateeName, raterType, raterEmail, raterName, answers, result } = row;
        if (!rateeEmail || !raterType || !VALID_RATER_TYPES.has(raterType)) {
          errors.push({ row: i + 2, message: '缺少 ratee_email 或 rater_type 無效' });
          continue;
        }
        if (!answers || typeof answers !== 'object') {
          errors.push({ row: i + 2, message: '缺少答題資料' });
          continue;
        }
        const shapeError = validateResultShape(result);
        if (shapeError) {
          errors.push({ row: i + 2, message: `計算結果不正確：${shapeError}` });
          continue;
        }

        const rateeUser = await findOrCreateUser(rateeEmail, rateeName);
        const effectiveRaterEmail = raterType === 'self' ? rateeEmail : (raterEmail || rateeEmail);
        const effectiveRaterName = raterType === 'self' ? rateeName : (raterName || rateeName);
        const raterUser = await findOrCreateUser(effectiveRaterEmail, effectiveRaterName);

        const submission = {
          id: randomUUID(),
          userId: raterUser.id,
          rateeId: rateeUser.id,
          assessmentId,
          raterType,
          answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value: Number(value) })),
          result,
          source: 'imported',
          createdAt: now,
        };
        db.data.submissions.push(submission);
        added++;
      } catch (e) {
        errors.push({ row: i + 2, message: e.message || '未知錯誤' });
      }
    }

    db.persist();
    auditLog(req, 'batch_import', { assessmentId, added, usersCreated, errors: errors.length });
    res.json({ added, usersCreated, errors });
  }));

  return router;
}
