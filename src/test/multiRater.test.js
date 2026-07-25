import { describe, it, expect } from 'vitest';
import { resolveActiveAssessmentId } from '../survey/utils/multiRaterHome';

// Helper: build a minimal submission object
function makeSub(overrides = {}) {
  return {
    id: overrides.id ?? 'sub-1',
    userId: overrides.userId ?? 'user-a',
    userName: overrides.userName ?? 'User A',
    rateeId: overrides.rateeId ?? overrides.userId ?? 'user-a',
    raterType: overrides.raterType ?? 'self',
    assessmentId: overrides.assessmentId ?? 'leadership-9d',
    phase: overrides.phase ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    answers: overrides.answers ?? {},
    result: overrides.result ?? { total: 300, dimensions: [], percent: 67, level: { badge: '精熟', color: '#2563eb' } },
  };
}

// Re-implement normalizeSubmission logic (mirrors server/src/app.js)
function normalizeSubmission(s) {
  return {
    ...s,
    assessmentId: s.assessmentId ?? 'ai-competency',
    phase: s.phase ?? null,
    rateeId: s.rateeId ?? s.userId,
    raterType: s.raterType ?? 'self',
  };
}

// Re-implement rater type validation (mirrors server/src/app.js)
const VALID_RATER_TYPES = new Set(['self', 'manager', 'peer', 'subordinate']);
function effectiveRaterType(raw) {
  return VALID_RATER_TYPES.has(raw) ? raw : 'self';
}

describe('360° normalizeSubmission', () => {
  it('fills in rateeId = userId for legacy submissions', () => {
    const sub = { userId: 'u1', userName: 'User 1' };
    const n = normalizeSubmission(sub);
    expect(n.rateeId).toBe('u1');
    expect(n.raterType).toBe('self');
  });

  it('preserves explicit rateeId and raterType', () => {
    const sub = makeSub({ rateeId: 'u2', raterType: 'manager' });
    const n = normalizeSubmission(sub);
    expect(n.rateeId).toBe('u2');
    expect(n.raterType).toBe('manager');
  });

  it('fills in assessmentId for legacy submissions', () => {
    const sub = { userId: 'u1' };
    const n = normalizeSubmission(sub);
    expect(n.assessmentId).toBe('ai-competency');
  });
});

describe('raterType validation', () => {
  it('accepts all valid rater types', () => {
    expect(effectiveRaterType('self')).toBe('self');
    expect(effectiveRaterType('manager')).toBe('manager');
    expect(effectiveRaterType('peer')).toBe('peer');
    expect(effectiveRaterType('subordinate')).toBe('subordinate');
  });

  it('falls back to self for invalid types', () => {
    expect(effectiveRaterType('unknown')).toBe('self');
    expect(effectiveRaterType('')).toBe('self');
    expect(effectiveRaterType(undefined)).toBe('self');
    expect(effectiveRaterType(null)).toBe('self');
  });
});

describe('360° ratee filtering', () => {
  const subs = [
    makeSub({ id: 's1', userId: 'u-rater1', rateeId: 'u-ratee', raterType: 'self', assessmentId: 'leadership-9d' }),
    makeSub({ id: 's2', userId: 'u-rater2', rateeId: 'u-ratee', raterType: 'manager', assessmentId: 'leadership-9d' }),
    makeSub({ id: 's3', userId: 'u-rater3', rateeId: 'u-ratee', raterType: 'peer', assessmentId: 'leadership-9d' }),
    makeSub({ id: 's4', userId: 'u-rater4', rateeId: 'u-other', raterType: 'self', assessmentId: 'leadership-9d' }),
    makeSub({ id: 's5', userId: 'u-rater5', rateeId: 'u-ratee', raterType: 'peer', assessmentId: 'ai-competency' }),
  ];

  function filterRatee(allSubs, rateeId, assessmentId) {
    return allSubs
      .map(normalizeSubmission)
      .filter((s) => {
        const matchRatee = s.rateeId === rateeId;
        const matchAssessment = !assessmentId || s.assessmentId === assessmentId;
        return matchRatee && matchAssessment;
      });
  }

  it('returns only submissions for the specified ratee', () => {
    const result = filterRatee(subs, 'u-ratee', 'leadership-9d');
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.rateeId === 'u-ratee')).toBe(true);
  });

  it('filters by assessmentId', () => {
    const result = filterRatee(subs, 'u-ratee', 'ai-competency');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s5');
  });

  it('returns empty for unknown ratee', () => {
    const result = filterRatee(subs, 'unknown', 'leadership-9d');
    expect(result).toHaveLength(0);
  });
});

describe('360° anonymization', () => {
  function anonymize(sub, canDeanonymize = false) {
    const n = normalizeSubmission(sub);
    if (!canDeanonymize && (n.raterType === 'peer' || n.raterType === 'subordinate')) {
      return { ...n, userId: 'anonymous', userName: '匿名', answers: undefined };
    }
    return { ...n, answers: undefined };
  }

  it('anonymizes peer raters by default', () => {
    const sub = makeSub({ raterType: 'peer', userId: 'u-peer' });
    const result = anonymize(sub);
    expect(result.userId).toBe('anonymous');
    expect(result.userName).toBe('匿名');
  });

  it('anonymizes subordinate raters by default', () => {
    const sub = makeSub({ raterType: 'subordinate', userId: 'u-sub' });
    const result = anonymize(sub);
    expect(result.userId).toBe('anonymous');
  });

  it('does not anonymize self or manager raters', () => {
    const selfSub = makeSub({ raterType: 'self', userId: 'u-self' });
    const mgrSub = makeSub({ raterType: 'manager', userId: 'u-mgr' });
    expect(anonymize(selfSub).userId).toBe('u-self');
    expect(anonymize(mgrSub).userId).toBe('u-mgr');
  });

  it('reveals peer/subordinate identity when canDeanonymize=true', () => {
    const sub = makeSub({ raterType: 'peer', userId: 'u-peer' });
    const result = anonymize(sub, true);
    expect(result.userId).toBe('u-peer');
    expect(result.userName).not.toBe('匿名');
  });

  it('always strips answers from response', () => {
    const sub = makeSub({ raterType: 'self', answers: { q1: 3 } });
    expect(anonymize(sub).answers).toBeUndefined();
  });
});

describe('access control logic', () => {
  const groups = [
    { id: 'g1', coachId: 'coach-1', memberIds: ['user-a', 'user-b'] },
    { id: 'g2', coachId: 'coach-2', memberIds: ['user-c'] },
  ];

  function canAccess(reqUser, rateeId) {
    const isAdmin = reqUser.role === 'admin';
    const isSelf = reqUser.id === rateeId;
    const isCoach = !isAdmin && !isSelf && groups.some(
      (g) => g.coachId === reqUser.id && g.memberIds.includes(rateeId),
    );
    return isAdmin || isSelf || isCoach;
  }

  it('allows access to own ratee data', () => {
    expect(canAccess({ id: 'user-a', role: 'user' }, 'user-a')).toBe(true);
  });

  it('allows coach to access group member ratee data', () => {
    expect(canAccess({ id: 'coach-1', role: 'coach' }, 'user-a')).toBe(true);
    expect(canAccess({ id: 'coach-1', role: 'coach' }, 'user-b')).toBe(true);
  });

  it('denies coach access to non-group member', () => {
    expect(canAccess({ id: 'coach-1', role: 'coach' }, 'user-c')).toBe(false);
  });

  it('allows admin to access any ratee data', () => {
    expect(canAccess({ id: 'admin-1', role: 'admin' }, 'user-a')).toBe(true);
    expect(canAccess({ id: 'admin-1', role: 'admin' }, 'user-c')).toBe(true);
  });

  it('denies regular user access to another user\'s ratee data', () => {
    expect(canAccess({ id: 'user-b', role: 'user' }, 'user-a')).toBe(false);
  });
});

describe('resolveActiveAssessmentId (360° 分頁的評量選擇回退邏輯)', () => {
  const supported = [
    { id: 'leadership-9d', name: '經贏® 領導力九大構面行為評量' },
  ];

  it('accepts a selectedId that is in the supported list', () => {
    expect(resolveActiveAssessmentId('leadership-9d', supported)).toBe('leadership-9d');
  });

  it('falls back to the first supported assessment when selectedId is null', () => {
    expect(resolveActiveAssessmentId(null, supported)).toBe('leadership-9d');
  });

  // 迴歸測試：2026-07 曾發生的 bug — 使用者先瀏覽了不支援 360 的評量（如 AI 問卷），
  // AppShell 把該 assessmentId 沿用到「360° 評測」分頁，MultiRaterHome 未驗證就直接
  // 採用，導致「評測他人」對著不支援 360 的評量誤發起評測流程。
  it('ignores a selectedId that does not support 360 and falls back instead', () => {
    expect(resolveActiveAssessmentId('ai-competency', supported)).toBe('leadership-9d');
  });

  it('ignores an unknown/stale selectedId not present in supported list at all', () => {
    expect(resolveActiveAssessmentId('some-deleted-assessment', supported)).toBe('leadership-9d');
  });

  it('returns null when nothing supports 360 and there is nothing to fall back to', () => {
    expect(resolveActiveAssessmentId('ai-competency', [])).toBeNull();
    expect(resolveActiveAssessmentId(null, [])).toBeNull();
  });

  it('respects selectedId when multiple assessments support 360', () => {
    const multi = [
      { id: 'leadership-9d', name: 'L9D' },
      { id: 'another-360-assessment', name: 'Another' },
    ];
    expect(resolveActiveAssessmentId('another-360-assessment', multi)).toBe('another-360-assessment');
    expect(resolveActiveAssessmentId(null, multi)).toBe('leadership-9d');
  });
});
