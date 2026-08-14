import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler, normalizeSubmission, getGroupPhase, validateResultShape } from '../lib/helpers.js';

const VALID_RATER_TYPES = new Set(['self', 'manager', 'peer', 'subordinate']);

/** @param {{db, requireAuth, requireCoach}} deps */
export function createSubmissionsRouter({ db, requireAuth, requireCoach }) {
  const router = Router();

  router.post('/submissions', requireAuth, (req, res) => {
    const { answers, result, assessmentId, phase, rateeId, raterType } = req.body || {};
    const shapeError = validateResultShape(result);
    if (shapeError) {
      return res.status(400).json({ code: 'INVALID_RESULT', error: `作答結果格式不正確：${shapeError}` });
    }
    const effectiveRateeId = typeof rateeId === 'string' && rateeId.trim()
      ? rateeId.trim()
      : req.user.id;
    const effectiveRaterType = VALID_RATER_TYPES.has(raterType) ? raterType : 'self';
    const finalRateeId = effectiveRaterType === 'self' ? req.user.id : effectiveRateeId;
    const effectiveAssessmentId = typeof assessmentId === 'string' ? assessmentId : 'ai-competency';

    // Phase guard：若受測者屬於某班級，需在 in_progress 期間才可提交。
    const userGroup = (db.data.groups ?? []).find(
      (g) => g.memberIds.includes(req.user.id) &&
             (g.assessmentId ?? 'ai-competency') === effectiveAssessmentId,
    );
    if (userGroup && getGroupPhase(userGroup) !== 'in_progress') {
      return res.status(403).json({ code: 'PHASE_LOCKED', error: '目前不在開放作答期間' });
    }

    // 唯一性檢查：同一 rater → 同一 ratee → 同一 assessmentId → 同一 raterType 只能提交一次。
    const duplicate = db.data.submissions.some(
      (s) => s.userId === req.user.id &&
             (s.assessmentId ?? 'ai-competency') === effectiveAssessmentId &&
             (s.raterType ?? 'self') === effectiveRaterType &&
             (s.rateeId ?? s.userId) === finalRateeId,
    );
    if (duplicate) {
      return res.status(409).json({ code: 'ALREADY_SUBMITTED', error: '已完成作答，不可重複提交' });
    }

    const record = {
      id: randomUUID(),
      userId: req.user.id,
      userName: req.user.name,
      rateeId: finalRateeId,
      raterType: effectiveRaterType,
      assessmentId: effectiveAssessmentId,
      phase: phase === 'pre' || phase === 'post' ? phase : null,
      createdAt: new Date().toISOString(),
      answers: answers && typeof answers === 'object' ? answers : {},
      result,
    };
    db.data.submissions.push(record);
    db.persist();
    res.status(201).json({ submission: record });
  });

  // Supports ?page=&limit= pagination. answers field excluded (large, not used by frontend).
  router.get('/submissions/me', requireAuth, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const all = db.data.submissions
      .filter((s) => s.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = all.length;
    const mine = all
      .slice((page - 1) * limit, page * limit)
      .map((s) => {
        const n = normalizeSubmission(s);
        return { ...n, answers: undefined };
      });
    res.json({ submissions: mine, total, page, limit });
  });

  router.get('/submissions/ratee/:rateeId', requireAuth, (req, res) => {
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
    const canDeanonymize = isAdmin || isCoachOfRatee;

    // 找受測者所屬班級（依 assessmentId 過濾）。
    const rateeGroup = (db.data.groups ?? []).find(
      (g) => g.memberIds.includes(rateeId) &&
             (!assessmentId || (g.assessmentId ?? 'ai-competency') === assessmentId),
    );
    const groupPhase = rateeGroup ? getGroupPhase(rateeGroup) : 'published';

    // 使用者本人：班級尚未 published 時擋掉（返回空陣列讓前端顯示等待提示）。
    if (isSelf && !isAdmin && groupPhase !== 'published') {
      return res.json({ submissions: [], phase: groupPhase });
    }

    const subs = db.data.submissions
      .filter((s) => {
        const rid = s.rateeId ?? s.userId;
        const matchRatee = rid === rateeId;
        const matchAssessment = !assessmentId || (s.assessmentId ?? 'ai-competency') === assessmentId;
        return matchRatee && matchAssessment;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((s) => {
        const n = normalizeSubmission(s);
        // Coach/Admin 可看真實身份（含 manager）；使用者本人看到的他評一律匿名。
        if (!canDeanonymize && n.raterType !== 'self') {
          return { ...n, userId: 'anonymous', userName: '匿名', answers: undefined };
        }
        return { ...n, answers: undefined };
      });

    res.json({ submissions: subs, phase: groupPhase });
  });

  // ── 評語（每位教練對每份作答只留一則，POST = upsert）────────
  router.post('/submissions/:id/comment', requireAuth, requireCoach, asyncHandler(async (req, res) => {
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
      text: text.trim().slice(0, 10000),
      tips: Array.isArray(tips)
        ? tips.slice(0, 20).map((t) => String(t ?? '').trim().slice(0, 500)).filter(Boolean)
        : [],
      createdAt: existingIdx >= 0 ? submission.comments[existingIdx].createdAt : now,
      updatedAt: now,
    };
    if (existingIdx >= 0) submission.comments[existingIdx] = comment;
    else submission.comments.push(comment);
    db.persist();
    res.json({ comment });
  }));

  router.delete('/submissions/:id/comment/:commentId', requireAuth, requireCoach, (req, res) => {
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

  return router;
}
