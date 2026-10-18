import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler, normalizeSubmission, getGroupPhase, validateResultShape, auditLog } from '../lib/helpers.js';
import { notifyNewComment } from '../lib/notifications.js';
import { isStrictPrivacy, presentRateeSubmissions } from '../lib/compassPrivacy.js';
import { POLICY_VERSION, CONSENT_REQUIRED_ASSESSMENTS } from '../lib/policy.js';
import { isActiveInvite } from '../lib/invites.js';

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

    const effectivePhase = phase === 'pre' || phase === 'post' ? phase : null;

    // 評量必須存在且已啟用：停用的評量（例如預設停用的領導力羅盤、接班準備度）不能直接打 API 提交。
    const assessmentRecord = (db.data.assessments ?? []).find((a) => a.id === effectiveAssessmentId);
    if (!assessmentRecord) return res.status(400).json({ code: 'UNKNOWN_ASSESSMENT', error: '評量不存在' });
    if (!assessmentRecord.enabled) return res.status(403).json({ code: 'ASSESSMENT_DISABLED', error: '這份評量目前未開放' });
    // 高敏感評量：伺服器端確認已同意現行版政策。
    if (CONSENT_REQUIRED_ASSESSMENTS.has(effectiveAssessmentId) && req.user.consent?.version !== POLICY_VERSION) {
      return res.status(403).json({ code: 'CONSENT_REQUIRED', error: '請先同意最新的隱私權政策' });
    }

    // 嚴格隱私題庫的他評必須持有邀請：邀請決定評分者類型與班級，每個邀請每個階段只能用一次。
    let invite = null;
    if (isStrictPrivacy(effectiveAssessmentId) && effectiveRaterType !== 'self') {
      invite = (db.data.raterInvites ?? []).find((i) => isActiveInvite(i)
        && i.raterUserId === req.user.id && i.rateeId === finalRateeId
        && i.assessmentId === effectiveAssessmentId && i.raterType === effectiveRaterType);
      if (!invite) {
        return res.status(403).json({ code: 'NO_INVITE', error: '需要受評者或教練的邀請才能評這位成員' });
      }
      if ((invite.usedPhases ?? []).includes(effectivePhase ?? 'none')) {
        return res.status(409).json({ code: 'ALREADY_SUBMITTED', error: '已完成作答，不可重複提交' });
      }
    }

    // 這位使用者、這個評量底下所有他所屬的班級（可能不只一個——例如重複開班、
    // 同一學員報名下一梯，教練也可能忘了把他從舊班移除）。
    const matchingGroups = (db.data.groups ?? []).filter(
      (g) => g.memberIds.includes(req.user.id) &&
             (g.assessmentId ?? 'ai-competency') === effectiveAssessmentId &&
             (!invite || (g.id === invite.groupId && g.memberIds.includes(finalRateeId))),
    );
    if (invite && matchingGroups.length === 0) {
      return res.status(403).json({ code: 'NO_INVITE', error: '邀請對應的班級已不存在或你們已不在同一班' });
    }
    const hasSubmittedTo = (groupId) => db.data.submissions.some((s) => {
      const n = normalizeSubmission(s);
      return n.userId === req.user.id &&
             n.raterType === effectiveRaterType &&
             n.rateeId === finalRateeId &&
             n.groupId === groupId &&
             n.phase === effectivePhase;
    });
    // 只屬於一個班級時就是它；同時屬於多個班級時，優先選「這個階段還沒作答過」
    // 的那一個——這樣同一學員參加下一梯課程（新班還沒交、舊班已經交過）才能
    // 正確歸到新班，而不是被舊班的重複檢查卡住。都做過或都沒做時退回第一個，
    // 純粹當作 phase guard 用（見下方 403）。
    const userGroup = matchingGroups.find((g) => !hasSubmittedTo(g.id)) ?? matchingGroups[0];

    if (userGroup && getGroupPhase(userGroup) !== 'in_progress') {
      return res.status(403).json({ code: 'PHASE_LOCKED', error: '目前不在開放作答期間' });
    }

    // 唯一性檢查：只在有班級歸屬時才擋——同班同階段重複送出才算重複；同班
    // 「課前→課後」、不同梯次（不同班）、或完全不屬於任何班級（自主重測）皆
    // 放行。不設班級限制時完全不擋，讓「重新作答」與歷次趨勢這類本來就支援
    // 多次作答的功能正常運作。
    if (userGroup && hasSubmittedTo(userGroup.id)) {
      return res.status(409).json({ code: 'ALREADY_SUBMITTED', error: '已完成作答，不可重複提交' });
    }

    const record = {
      id: randomUUID(),
      userId: req.user.id,
      userName: req.user.name,
      rateeId: finalRateeId,
      raterType: effectiveRaterType,
      assessmentId: effectiveAssessmentId,
      groupId: userGroup?.id ?? null,
      phase: effectivePhase,
      createdAt: new Date().toISOString(),
      answers: answers && typeof answers === 'object' ? answers : {},
      result,
    };
    db.data.submissions.push(record);
    if (invite) (invite.usedPhases ??= []).push(effectivePhase ?? 'none');
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

    const rows = db.data.submissions
      .filter((s) => {
        const rid = s.rateeId ?? s.userId;
        const matchRatee = rid === rateeId;
        const matchAssessment = !assessmentId || (s.assessmentId ?? 'ai-competency') === assessmentId;
        return matchRatee && matchAssessment;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 嚴格隱私題庫（領導力羅盤）：評分者身分與個別分數不對教練與本人開放。
    // 只有管理員能還原身分，且要填理由、留稽核紀錄。其他題庫維持下面的既有行為。
    const hasStrict = rows.some((s) => isStrictPrivacy(s.assessmentId ?? 'ai-competency'));
    const wantsIdentity = isAdmin && deanonymize && deanonymize !== '0' && deanonymize !== 'false';
    if (hasStrict && wantsIdentity) {
      const reason = typeof req.query.reason === 'string' ? req.query.reason.trim() : '';
      if (reason.length < 5) {
        return res.status(400).json({ code: 'REASON_REQUIRED', error: '還原評分者身分前，請填寫理由（至少 5 個字）。' });
      }
      auditLog(req, 'view_rater_identity', { rateeId, assessmentId: assessmentId ?? null, reason });
    }
    const ratee = db.data.users.find((u) => u.id === rateeId);
    const managerConsent = Boolean(ratee?.compassManagerShare?.granted);
    const present = (list) => (hasStrict && !wantsIdentity ? presentRateeSubmissions(list, { managerConsent }) : list);

    const subs = present(rows.map((s) => normalizeSubmission(s)))
      .map((n) => {
        const strict = isStrictPrivacy(n.assessmentId);
        // Coach/Admin 可看真實身分（含 manager）；使用者本人看到的他評一律匿名。
        // 嚴格隱私題庫的教練也一律匿名（上面 presentRateeSubmissions 已處理，這裡不再放寬）。
        if (n.raterType !== 'self' && !n.aggregate && !(canDeanonymize && (!strict || wantsIdentity))) {
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
    // 只有管理者，或「受評者在自己班上」的教練可以留評語——跟教練後台其他地方
    // 「教練只看得到自己班上學員」的範圍一致。以前只檢查身分是教練，任何教練只要
    // 拿到作答 id 就能對別班學員留言（Sprint 7 起還會因此寄通知信給對方學員）。
    const { rateeId, userId } = normalizeSubmission(submission);
    const coachesThem = (db.data.groups ?? []).some((g) => g.coachId === req.user.id
      && ((g.memberIds ?? []).includes(rateeId) || (g.memberIds ?? []).includes(userId)));
    if (req.user.role !== 'admin' && !coachesThem) {
      return res.status(403).json({ error: '只能對自己班上的學員留評語' });
    }
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
    // 通知學員（Sprint 7 驗收條件 7.6）：不等寄信完成才回應，教練存評語不必等 SMTP；
    // 寄信失敗只記 log，評語本身已經存好了。
    notifyNewComment(db, submission, req.user.name)
      .catch((err) => console.error('[notify] comment mail failed', err?.message ?? err));
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
