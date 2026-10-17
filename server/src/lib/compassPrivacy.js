// 360° 評分者隱私（雙環領導羅盤，S16；規格 docs/leadership-new/04-platform-spec-v0.1.md 第 7 節）。
//
// 只對「嚴格隱私」的題庫生效，其他題庫（L9D 等）的既有行為完全不變。規則：
//  1. 教練與一般使用者永遠看不到個別評分者的身分或個別作答分數。
//  2. 同儕／部屬：同一類 ≥ MIN_RATERS 位才單獨顯示該類彙整；不足的併入「他評合計」，
//     合計（同儕＋部屬）仍須 ≥ MIN_RATERS 位才顯示。
//  3. 上級（manager）可辨識，必須受評者同意才顯示。
//  4. 只有管理員可以還原身分，而且要填理由並留下稽核紀錄（在路由層處理）。
//
// 後端不重算分數（部署時沒有前端程式碼）：彙整只用結果裡既有的 dimensions[].score/max/percent/average
// 做通用平均，並依評分者人數加權。

export const STRICT_PRIVACY_ASSESSMENTS = new Set(['leadership-compass']);
export const MIN_RATERS = 3;

export const isStrictPrivacy = (assessmentId) => STRICT_PRIVACY_ASSESSMENTS.has(assessmentId);

const mean = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

/**
 * 給教練／管理者總覽用：把嚴格隱私題庫的「他評」去識別化並拿掉分數與時間，只保留
 * 「誰（受評者）在哪個班、哪個階段、收到哪一類評分」這種計數用的欄位，讓教練仍能看到回收進度。
 * 自評與其他題庫原樣回傳。
 */
export function stripRaterDetails(submissions) {
  let n = 0;
  return submissions.map((s) => {
    if (!isStrictPrivacy(s.assessmentId) || (s.raterType ?? 'self') === 'self') return s;
    n += 1;
    return {
      id: `anon-${n}`,
      assessmentId: s.assessmentId,
      rateeId: s.rateeId,
      raterType: s.raterType,
      groupId: s.groupId ?? null,
      phase: s.phase ?? null,
      userId: 'anonymous',
      userName: '匿名',
      anonymized: true,
    };
  });
}

function averageDimensions(subs) {
  const map = new Map();
  subs.forEach((s) => {
    (s.result?.dimensions ?? []).forEach((d) => {
      if (!map.has(d.id)) map.set(d.id, { meta: d, scores: [], maxes: [], percents: [], averages: [] });
      const e = map.get(d.id);
      e.scores.push(d.score);
      e.maxes.push(d.max);
      e.percents.push(d.percent ?? 0);
      e.averages.push(d.average ?? 0);
    });
  });
  return [...map.values()].map((e) => ({
    id: e.meta.id,
    index: e.meta.index,
    name: e.meta.name,
    subtitle: e.meta.subtitle,
    color: e.meta.color,
    score: mean(e.scores),
    max: mean(e.maxes),
    percent: Math.round(mean(e.percents)),
    average: mean(e.averages),
    rating: e.meta.rating,
  }));
}

function aggregateEntry(subs, raterType, base) {
  return {
    id: `agg-${base.rateeId}-${base.phase ?? 'none'}-${raterType}`,
    rateeId: base.rateeId,
    assessmentId: base.assessmentId,
    groupId: base.groupId ?? null,
    phase: base.phase ?? null,
    raterType,
    aggregate: true,
    count: subs.length,
    userId: 'anonymous',
    userName: '匿名',
    result: { assessmentId: base.assessmentId, total: 0, dimensions: averageDimensions(subs) },
  };
}

/**
 * 給「受評者端／教練看某位受評者」用：回傳可以顯示的資料。
 * - 自評：原樣（呼叫端已移除 answers）。
 * - 他評：依規則 2、3 產生彙整項目（aggregate: true，不含任何個別評分者資料）。
 * 一個受評者可能有多個階段（pre／post）或班級，依 (groupId, phase) 分開彙整。
 */
export function presentRateeSubmissions(subs, { managerConsent = false } = {}) {
  const out = [];
  const buckets = new Map();
  subs.forEach((s) => {
    if (!isStrictPrivacy(s.assessmentId) || (s.raterType ?? 'self') === 'self') {
      out.push(s);
      return;
    }
    const key = `${s.assessmentId}|${s.rateeId}|${s.groupId ?? ''}|${s.phase ?? ''}`;
    if (!buckets.has(key)) buckets.set(key, { base: s, peer: [], subordinate: [], manager: [] });
    const b = buckets.get(key);
    if (b[s.raterType]) b[s.raterType].push(s);
  });

  buckets.forEach(({ base, peer, subordinate, manager }) => {
    const pooled = [...peer, ...subordinate];
    if (peer.length >= MIN_RATERS) out.push(aggregateEntry(peer, 'peer', base));
    if (subordinate.length >= MIN_RATERS) out.push(aggregateEntry(subordinate, 'subordinate', base));
    // 上級受評者同意才顯示（單獨列出，可辨識；同意與否由呼叫端傳入）。
    const shownManagers = managerConsent ? manager : [];
    const pooledAll = [...pooled, ...shownManagers];
    if (pooledAll.length >= MIN_RATERS) out.push(aggregateEntry(pooledAll, 'others', base));
    if (managerConsent && manager.length > 0) out.push(aggregateEntry(manager, 'manager', base));
  });
  return out;
}
