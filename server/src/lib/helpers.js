import { createHash } from 'node:crypto';

// Wraps an async route handler so any thrown error propagates to Express
// error-handling middleware rather than causing an unhandled rejection.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Normalize legacy submissions that lack assessmentId / rater fields.
export function normalizeSubmission(s) {
  return {
    ...s,
    assessmentId: s.assessmentId ?? 'ai-competency',
    phase: s.phase ?? null,
    rateeId: s.rateeId ?? s.userId,
    raterType: s.raterType ?? 'self',
  };
}

export function getGroupPhase(group) {
  const now = new Date();
  if (!group.startDate || now < new Date(group.startDate)) return 'not_started';
  if (!group.endDate || now <= new Date(group.endDate)) return 'in_progress';
  if (!group.publishedAt) return 'closed';
  return 'published';
}

export const hashToken = (t) => createHash('sha256').update(t).digest('hex');

// 讓該使用者現有的所有已簽發 JWT 立即失效（下次請求時 authContext.currentUser
// 比對 tokenVersion 會不符）。密碼變更、密碼重設、角色變更等安全敏感操作後呼叫。
export function revokeUserTokens(user) {
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
}

export function auditLog(req, action, extra = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    actor: req.user?.id,
    actorEmail: req.user?.email,
    action,
    ...extra,
  }));
}

// ── 班別「評量設定」欄位清洗 ───────────────────────────────
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
