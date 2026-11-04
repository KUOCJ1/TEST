// 360° 完整報告的資料整理（純函式）。輸入是某位受評者的全部作答（自評＋各類評分者），
// 輸出報告各頁要用的數字與文字；畫面與列印版面在 components/ThreeSixtyReport.jsx。
//
// 名詞：
// - 自評：受評者本人（raterType self）最新一筆。
// - 他評：主管／同儕／部屬。每位評分者（同一類、同一個填答者）只取最新一筆；各類平均＝該類評分者的平均，
//   「他評合計」＝所有他評評分者平均（每位評分者等權重，不因某類人數多而偏重）。
// - 構面與子能力分數用 1–5 的平均（result.dimensions[].average、subs[].average）。
// - 差距＝自評 − 他評合計；≥ 0.5 視為「自評高於他評（可能的盲點）」，≤ −0.5 視為「他評高於自評（被低估的優勢）」。
import { buildNarrative, buildOverallSummary, buildDevelopmentPlan, dimensionText } from './narrative.js';
import { buildInsights } from './dimensionInsights.js';

export const GAP_THRESHOLD = 0.5;
const OTHER_TYPES = ['manager', 'peer', 'subordinate'];
const round2 = (n) => Math.round(n * 100) / 100;
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** 每位評分者（類型＋填答者）只留最新一筆。 */
function latestPerRater(subs) {
  const map = new Map();
  for (const s of subs) {
    const key = `${s.raterType}|${s.userId}`;
    const cur = map.get(key);
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) map.set(key, s);
  }
  return [...map.values()];
}

/** 把多份結果的構面（含子能力）取平均。 */
function averageDimensions(results) {
  const byDim = new Map();
  for (const r of results) {
    for (const d of r.dimensions ?? []) {
      // 沒有作答的構面（量表是 1–5，平均 0 只可能是「這份問卷沒有這個構面的題目」）視為未評量，不是低分。
      if (!(d.average > 0)) continue;
      const e = byDim.get(d.id) ?? { id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, avgs: [], subs: new Map() };
      e.avgs.push(d.average);
      for (const sub of d.subs ?? []) {
        if (!(sub.average > 0)) continue;
        const se = e.subs.get(sub.id) ?? { id: sub.id, name: sub.name, avgs: [] };
        se.avgs.push(sub.average);
        e.subs.set(sub.id, se);
      }
      byDim.set(d.id, e);
    }
  }
  return new Map([...byDim.entries()].map(([id, e]) => [id, {
    id, name: e.name, subtitle: e.subtitle, color: e.color,
    average: mean(e.avgs),
    subs: [...e.subs.values()].map((s) => ({ id: s.id, name: s.name, average: mean(s.avgs) })),
  }]));
}

function levelOfTotal(config, total) {
  return (config.LEVELS ?? []).find((l) => total >= l.min && total <= l.max) ?? null;
}

const kindOf = (gap) => (gap == null ? 'unknown' : gap >= GAP_THRESHOLD ? 'blind' : gap <= -GAP_THRESHOLD ? 'hidden' : 'aligned');

/**
 * @param {Array} submissions 受評者的全部作答（GET /submissions/ratee/:id 的結果）
 * @param {object} config 題庫設定（getAssessment）
 * @returns {null | object} 沒有任何作答時回 null
 */
export function build360Report(submissions, config) {
  const subs = (submissions ?? []).filter((s) => s.result?.dimensions?.length);
  if (!config || subs.length === 0) return null;

  const selfSub = subs.filter((s) => (s.raterType ?? 'self') === 'self')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;
  const otherSubs = latestPerRater(subs.filter((s) => OTHER_TYPES.includes(s.raterType)));

  const counts = Object.fromEntries(OTHER_TYPES.map((t) => [t, otherSubs.filter((s) => s.raterType === t).length]));
  const othersCount = otherSubs.length;

  const selfDims = selfSub ? averageDimensions([selfSub.result]) : new Map();
  const typeDims = Object.fromEntries(OTHER_TYPES.map((t) => [t, averageDimensions(otherSubs.filter((s) => s.raterType === t).map((s) => s.result))]));
  const othersDims = averageDimensions(otherSubs.map((s) => s.result));

  // 這份問卷沒有題目（沒有任何作答）的構面不列入報告：不是「零分的弱項」，而是沒有評量。
  const dimensions = (config.DIMENSIONS ?? []).filter((cd) => selfDims.has(cd.id) || othersDims.has(cd.id)).map((cd) => {
    const self = selfDims.get(cd.id) ?? null;
    const others = othersDims.get(cd.id) ?? null;
    const selfAvg = self?.average ?? null;
    const othersAvg = others?.average ?? null;
    const gap = selfAvg != null && othersAvg != null ? round2(selfAvg - othersAvg) : null;
    const subDefs = (self ?? others)?.subs ?? [];
    return {
      id: cd.id, name: cd.name, subtitle: cd.subtitle, color: cd.color,
      self: selfAvg, others: othersAvg,
      manager: typeDims.manager.get(cd.id)?.average ?? null,
      peer: typeDims.peer.get(cd.id)?.average ?? null,
      subordinate: typeDims.subordinate.get(cd.id)?.average ?? null,
      gap,
      kind: kindOf(gap),
      subs: subDefs.map((sd) => {
        const s = self?.subs.find((x) => x.id === sd.id)?.average ?? null;
        const o = others?.subs.find((x) => x.id === sd.id)?.average ?? null;
        return { id: sd.id, name: sd.name, self: s, others: o, gap: s != null && o != null ? round2(s - o) : null };
      }),
    };
  });

  const selfTotal = selfSub?.result?.total ?? null;
  const othersTotal = othersCount ? Math.round(mean(otherSubs.map((s) => s.result.total))) : null;
  const othersLevel = othersTotal != null ? levelOfTotal(config, othersTotal) : null;

  // 他人眼中的整體樣貌（沒有他評時退回自評，報告仍可產出）。
  const viewDims = othersCount ? dimensions.filter((d) => d.others != null) : dimensions.filter((d) => d.self != null);
  const valueOf = (d) => (othersCount ? d.others : d.self);
  const ranked = [...viewDims].sort((a, b) => valueOf(b) - valueOf(a));
  const strengths = ranked.slice(0, 3);
  const develop = [...ranked].reverse().slice(0, 3);
  const blind = dimensions.filter((d) => d.kind === 'blind').sort((a, b) => b.gap - a.gap).slice(0, 3);
  const hidden = dimensions.filter((d) => d.kind === 'hidden').sort((a, b) => a.gap - b.gap).slice(0, 3);

  // 供敘事與發展建議使用的「他人眼中的結果」。
  const composite = {
    total: othersCount ? othersTotal : selfTotal,
    level: (othersCount ? othersLevel : selfSub?.result?.level) ?? { badge: '' },
    dimensions: viewDims.map((d) => {
      const src = (othersCount ? othersDims : selfDims).get(d.id);
      return { id: d.id, name: d.name, subtitle: d.subtitle, color: d.color, average: valueOf(d), subs: src?.subs ?? [] };
    }),
  };
  const seed = composite.total ?? 0;
  const narratives = Object.fromEntries(composite.dimensions.map((d) => [d.id, buildNarrative(d, config, seed)]));
  // 構面專屬說明（依他人眼中的分數；無他評時用自評）。
  const dimTexts = Object.fromEntries(composite.dimensions.map((d) => [d.id, dimensionText(d.id, d.average, config)]));

  return {
    assessmentName: (selfSub ?? otherSubs[0])?.result?.assessmentName ?? config.NAME,
    hasSelf: !!selfSub,
    hasOthers: othersCount > 0,
    counts,
    othersCount,
    self: selfSub ? { total: selfTotal, level: selfSub.result.level, createdAt: selfSub.createdAt } : null,
    othersSummary: othersCount ? { total: othersTotal, level: othersLevel } : null,
    dimensions,
    strengths, develop, blind, hidden,
    summaryText: buildOverallSummary(composite, config, seed),
    narratives,
    dimTexts,
    insights: buildInsights(composite.dimensions),
    plan: buildDevelopmentPlan(composite, config),
    basis: othersCount ? 'others' : 'self',
  };
}
