// 班級的「前測分布」與「前後測比較」分析（教練後台總覽）。純函式，不打 API，方便單元測試。
//
// 名詞：
// - 前測／後測：每人各取「最新一筆」自評（phase 為 null 的舊資料視為前測，與 ProgressPanel 一致）。
// - 配對樣本：前測、後測都有的人。比較只用配對樣本，避免拿不同的兩批人比。
// - 構面分數用 result.dimensions[].average（1–5 的平均），不同題數的構面才能並排比較。
//
// 樣本通常很小（一班十幾二十人），所以這裡只提供描述統計與效果量（dz）作為參考，不做顯著性檢定。

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/** 描述統計：n、平均、中位數、標準差（樣本）、最小、最大。空陣列回 null。 */
export function summarize(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2;
  const sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: round1(mean), median: round1(median), sd: round1(sd), min: xs[0], max: xs[n - 1] };
}

/** 每人在某階段的最新一筆自評。 */
export function latestByPhase(submissions, phase) {
  const map = new Map();
  for (const s of submissions ?? []) {
    if ((s.raterType ?? 'self') !== 'self') continue;
    if ((s.phase ?? 'pre') !== phase) continue;
    const cur = map.get(s.userId);
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) map.set(s.userId, s);
  }
  return map;
}

/** 這份題庫是否適合做「分數前後比較」：有總分與落點等級，且不是風格輪廓或專屬計分的題庫。 */
export function supportsPrePost(config) {
  return !!config && !config.PROFILE_MODE && !config.SCORING && !config.REPORT && Array.isArray(config.LEVELS) && config.LEVELS.length > 0;
}

const DEFAULT_RATING = (avg) => {
  if (avg >= 4.2) return 'strong';
  if (avg >= 3.4) return 'good';
  if (avg >= 2.6) return 'mid';
  if (avg >= 1.8) return 'low';
  return 'weak';
};
export const RATING_ORDER = ['strong', 'good', 'mid', 'low', 'weak'];
export const RATING_LABEL = { strong: '精熟', good: '熟練', mid: '發展中', low: '萌芽', weak: '待啟蒙' };

function levelOf(config, sub) {
  const id = sub.result?.level?.id;
  return config.LEVELS.find((l) => l.id === id) ?? null;
}

function histogram(config, totals, bins = 8) {
  const lo = config.MIN_SCORE;
  const hi = config.MAX_SCORE;
  const width = (hi - lo + 1) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    from: Math.round(lo + i * width),
    to: Math.round(lo + (i + 1) * width) - 1,
    count: 0,
  }));
  for (const t of totals) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((t - lo) / width)));
    out[idx].count += 1;
  }
  return out;
}

function phaseSummary(config, subs) {
  const list = [...subs.values()];
  const n = list.length;
  const totals = list.map((s) => s.result.total);
  const levelDist = config.LEVELS.map((l) => {
    const count = list.filter((s) => s.result.level?.id === l.id).length;
    return { id: l.id, badge: l.badge, color: l.color, min: l.min, max: l.max, count, pct: n ? Math.round((count / n) * 100) : 0 };
  });
  const dimensions = (config.DIMENSIONS ?? []).map((d) => {
    const avgs = list.map((s) => s.result.dimensions.find((x) => x.id === d.id)?.average).filter((v) => typeof v === 'number');
    const ratingFn = (v) => {
      const tone = config.dimensionRating?.(v)?.tone;
      return RATING_ORDER.includes(tone) ? tone : DEFAULT_RATING(v);
    };
    const ratingDist = Object.fromEntries(RATING_ORDER.map((r) => [r, 0]));
    avgs.forEach((v) => { ratingDist[ratingFn(v)] += 1; });
    return { id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, stats: summarize(avgs), ratingDist };
  });
  return {
    n,
    total: summarize(totals),
    levelDist,
    histogram: histogram(config, totals),
    dimensions,
  };
}

/**
 * @param {Array} submissions 該班的作答（含各階段、各 raterType）
 * @param {object} config getAssessment(group.assessmentId)
 * @param {Array<{id,name,email?}>} members 班級成員（取姓名用）
 * @returns {null | {pre, post, paired, unpaired}} 不適用（風格型等）或完全沒有作答時回 null
 */
export function buildPrePost(submissions, config, members = []) {
  if (!supportsPrePost(config)) return null;
  const preMap = latestByPhase(submissions, 'pre');
  const postMap = latestByPhase(submissions, 'post');
  if (preMap.size === 0 && postMap.size === 0) return null;
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? [...preMap.values(), ...postMap.values()].find((s) => s.userId === id)?.userName ?? '（已移除）';
  const emailOf = (id) => members.find((m) => m.id === id)?.email ?? '';

  const pre = preMap.size ? phaseSummary(config, preMap) : null;
  const post = postMap.size ? phaseSummary(config, postMap) : null;

  const pairedIds = [...preMap.keys()].filter((id) => postMap.has(id));
  let paired = null;
  if (pairedIds.length > 0) {
    const rows = pairedIds.map((id) => {
      const a = preMap.get(id);
      const b = postMap.get(id);
      return {
        userId: id, name: nameOf(id), email: emailOf(id),
        pre: a.result.total, post: b.result.total, delta: b.result.total - a.result.total,
        preLevel: levelOf(config, a), postLevel: levelOf(config, b),
        preDims: Object.fromEntries(a.result.dimensions.map((d) => [d.id, d.average])),
        postDims: Object.fromEntries(b.result.dimensions.map((d) => [d.id, d.average])),
      };
    }).sort((x, y) => y.delta - x.delta);

    const deltas = rows.map((r) => r.delta);
    const dStat = summarize(deltas);
    // 效果量 dz = 平均差 ÷ 差的標準差；人數少於 5 或差全部相同時不提供（沒有意義）。
    const dzOf = (arr) => {
      const s = summarize(arr);
      return s && s.n >= 5 && s.sd > 0 ? round2(s.mean / s.sd) : null;
    };
    const levelIdx = (lv) => config.LEVELS.findIndex((l) => l.id === lv?.id);
    const matrix = config.LEVELS.map((from) => config.LEVELS.map((to) => rows.filter((r) => r.preLevel?.id === from.id && r.postLevel?.id === to.id).length));
    const dims = (config.DIMENSIONS ?? []).map((d) => {
      const diffs = rows.map((r) => (r.postDims[d.id] ?? 0) - (r.preDims[d.id] ?? 0));
      const preAvg = summarize(rows.map((r) => r.preDims[d.id]));
      const postAvg = summarize(rows.map((r) => r.postDims[d.id]));
      return {
        id: d.id, name: d.name, subtitle: d.subtitle, color: d.color,
        pre: preAvg.mean, post: postAvg.mean, delta: round2(postAvg.mean - preAvg.mean),
        improved: diffs.filter((x) => x > 0.001).length,
        same: diffs.filter((x) => Math.abs(x) <= 0.001).length,
        declined: diffs.filter((x) => x < -0.001).length,
        dz: dzOf(diffs),
      };
    }).sort((a, b) => b.delta - a.delta);

    // 起點較低的人是否進步較多：依前測總分切成較低／較高兩半（人數少時只是參考；
    // 也有「回歸平均」的成分，不能直接解讀成課程對低分者特別有效）。
    const byPre = [...rows].sort((a, b) => a.pre - b.pre);
    const half = Math.floor(byPre.length / 2);
    const lower = byPre.slice(0, half);
    const upper = byPre.slice(byPre.length - half);
    paired = {
      n: rows.length,
      pre: summarize(rows.map((r) => r.pre)),
      post: summarize(rows.map((r) => r.post)),
      delta: dStat,
      improved: rows.filter((r) => r.delta > 0).length,
      same: rows.filter((r) => r.delta === 0).length,
      declined: rows.filter((r) => r.delta < 0).length,
      dz: dzOf(deltas),
      levelMatrix: { levels: config.LEVELS.map((l) => ({ id: l.id, badge: l.badge, color: l.color })), counts: matrix },
      levelUp: rows.filter((r) => levelIdx(r.postLevel) > levelIdx(r.preLevel)).length,
      levelDown: rows.filter((r) => levelIdx(r.postLevel) < levelIdx(r.preLevel)).length,
      dimensions: dims,
      rows,
      lowerHalf: half >= 2 ? { n: lower.length, meanDelta: summarize(lower.map((r) => r.delta)).mean } : null,
      upperHalf: half >= 2 ? { n: upper.length, meanDelta: summarize(upper.map((r) => r.delta)).mean } : null,
    };
  }

  return {
    pre,
    post,
    paired,
    unpaired: {
      preOnly: [...preMap.keys()].filter((id) => !postMap.has(id)).length,
      postOnly: [...postMap.keys()].filter((id) => !preMap.has(id)).length,
    },
  };
}
