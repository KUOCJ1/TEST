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
    // 舊資料沒有 groupId（班級歸屬在當時是靠當下成員名單反查的），一律補 null；
    // 讀取端（班級報告）遇到 null 時會退回舊的 memberIds 反查方式相容既有資料。
    groupId: s.groupId ?? null,
  };
}

/**
 * 驗證作答結果的形狀。前端報告會直接讀取這些欄位（例如 dimension.rating.label），
 * 缺欄位會讓分析頁渲染時整個 crash，且資料一旦寫入就無法從 UI 修復——所以在寫入
 * 前擋住，而不是等到讀取時才爆。回傳錯誤訊息字串，通過則回傳 null。
 */
export function validateResultShape(result) {
  if (!result || typeof result !== 'object') return '缺少作答結果';
  if (typeof result.total !== 'number' || !Number.isFinite(result.total)) return '總分格式不正確';
  if (!Array.isArray(result.dimensions) || result.dimensions.length === 0) return '缺少構面分數';
  for (const d of result.dimensions) {
    if (!d || typeof d !== 'object') return '構面資料格式不正確';
    if (typeof d.id !== 'string' || !d.id) return '構面缺少 id';
    if (typeof d.score !== 'number' || !Number.isFinite(d.score)) return `構面 ${d.id} 缺少分數`;
    if (typeof d.max !== 'number' || !Number.isFinite(d.max)) return `構面 ${d.id} 缺少滿分`;
    if (!d.rating || typeof d.rating.label !== 'string') return `構面 ${d.id} 缺少等級資訊`;
  }
  return null;
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
