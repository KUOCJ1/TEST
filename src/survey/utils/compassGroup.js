// 領導力羅盤的班級層級彙整（組織診斷，規格第 8 節）。
// 匿名分級（⚠️ 門檻已由使用者接受，仍可調整）：
//   受評者 ≥ FULL_MIN：完整彙整；BASIC_MIN–FULL_MIN-1：只有構面與兩環平均；< BASIC_MIN：只有完成率。
// 這個函式只吃「自評結果」；他評落差的群體分布需要伺服器端彙整，尚未提供。

export const FULL_MIN = 5;
export const BASIC_MIN = 3;

export function groupTier(n) {
  if (n >= FULL_MIN) return 'full';
  if (n >= BASIC_MIN) return 'basic';
  return 'hidden';
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 每位使用者取最新一份（依 createdAt）自評作答。 */
export function latestSelfByUser(submissions, { phase = null, assessmentId } = {}) {
  const map = new Map();
  submissions.forEach((s) => {
    if ((s.raterType ?? 'self') !== 'self') return;
    if (assessmentId && (s.assessmentId ?? 'ai-competency') !== assessmentId) return;
    if (phase && (s.phase ?? 'pre') !== phase) return;
    if (!s.result?.dimensions) return;
    const cur = map.get(s.userId);
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) map.set(s.userId, s);
  });
  return [...map.values()];
}

/**
 * @param {Array<object>} results 每位受評者一份結果（buildCompassResult 的輸出）
 * @param {number} memberCount 班級總人數（算完成率用）
 */
export function buildCompassGroupReport(results, memberCount) {
  const n = results.length;
  const tier = groupTier(n);
  const base = { n, tier, memberCount, completion: memberCount > 0 ? n / memberCount : 0 };
  if (tier === 'hidden') return { ...base, dimensions: null, loops: null, tensions: null, extremes: null, ratingSpread: null };

  const dimIds = results[0].dimensions.map((d) => d.id);
  const dimensions = dimIds.map((id) => {
    const rows = results.map((r) => r.dimensions.find((d) => d.id === id)).filter((d) => d && d.answered > 0);
    const first = results[0].dimensions.find((d) => d.id === id);
    return { id, name: first.name, subtitle: first.subtitle, color: first.color, average: mean(rows.map((d) => d.average)) ?? 0 };
  });
  const loopIds = (results[0].loops ?? []).map((l) => l.id);
  const loops = (results[0].loops ?? []).map((l) => ({
    id: l.id, name: l.name,
    average: mean(results.map((r) => r.loops?.find((x) => x.id === l.id)?.average).filter(Number.isFinite)) ?? 0,
  }));
  void loopIds;
  if (tier === 'basic') return { ...base, dimensions, loops, tensions: null, extremes: null, ratingSpread: null };

  const tensions = (results[0].tensions ?? []).map((t0) => {
    const rows = results.map((r) => r.tensions?.find((x) => x.id === t0.id)).filter((t) => t?.available);
    const counts = {};
    rows.forEach((t) => { counts[t.type] = (counts[t.type] ?? 0) + 1; });
    return {
      id: t0.id, nameA: t0.nameA, nameB: t0.nameB,
      averageA: mean(rows.map((t) => t.a)), averageB: mean(rows.map((t) => t.b)),
      respondents: rows.length, typeCounts: counts,
    };
  });
  const sorted = [...dimensions].sort((a, b) => b.average - a.average);
  const ratingSpread = {};
  results.forEach((r) => r.dimensions.forEach((d) => {
    if (!d.answered) return;
    ratingSpread[d.rating.label] = (ratingSpread[d.rating.label] ?? 0) + 1;
  }));
  return {
    ...base, dimensions, loops, tensions,
    extremes: { top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse() },
    ratingSpread,
  };
}
