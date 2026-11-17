// 班級報告「給管理者的一頁摘要」與「課前課後比較」用的純函式（Sprint 24）。
// 不新寫計分：構面百分比來自 aggregateStats，前後比較來自 prePost.buildPrePost，
// 建議行動沿用個人報告的 DIM_DEVELOPMENT（printable-report/tokens.js）。
import { dimLabel } from './dimensionLabel.js';
import { DIM_DEVELOPMENT } from '../components/printable-report/tokens.js';

/** 前後比較章節至少要幾位「兩次都有作答」才顯示（人數太少會等於點名個人）。 */
export const MIN_PAIRED = 3;

export function buildExecutiveSummary({ stats, memberCount, prepost }) {
  const dims = [...(stats?.dimensionAverages ?? [])].sort((a, b) => b.percent - a.percent);
  const strengths = dims.slice(0, 3);
  const priorities = dims.length > 3 ? dims.slice(-3).reverse() : [];
  const respondents = stats?.respondents ?? 0;
  const participation = memberCount > 0 ? Math.round((respondents / memberCount) * 100) : 0;
  const nextSteps = priorities.slice(0, 2)
    .map((d) => ({ dim: dimLabel(d), action: DIM_DEVELOPMENT[d.id]?.action }))
    .filter((x) => x.action);
  const paired = prepost?.paired && prepost.paired.n >= MIN_PAIRED ? prepost.paired : null;
  return {
    respondents, memberCount, participation,
    avgPercent: stats?.avgPercent ?? 0,
    levelDistribution: stats?.levelDistribution ?? [],
    strengths, priorities, nextSteps,
    change: paired ? { n: paired.n, meanDelta: paired.delta?.mean ?? 0, improved: paired.improved, declined: paired.declined } : null,
  };
}

/** 前後比較章節要顯示的資料；配對人數不足 MIN_PAIRED 時回 null（章節不出現）。 */
export function buildPrePostChapter(prepost) {
  const p = prepost?.paired;
  if (!p || p.n < MIN_PAIRED) return null;
  const dims = p.dimensions ?? [];
  return {
    n: p.n,
    preTotal: p.pre?.mean, postTotal: p.post?.mean, delta: p.delta?.mean,
    improved: p.improved, same: p.same, declined: p.declined,
    levelUp: p.levelUp, levelDown: p.levelDown,
    dimensions: dims, // 已依進步幅度由大到小排序
    mostImproved: dims.filter((d) => d.delta > 0).slice(0, 3),
    leastImproved: [...dims].reverse().slice(0, 3).filter((d) => d.delta <= 0.1),
    unpaired: prepost.unpaired,
  };
}

// 教練會談的彙總（Sprint 40）：只有場次、繳交率與會談回饋平均（≥3 份才有平均），沒有姓名與內容。
export function coachingLine(c) {
  const kinds = [c.oneOnOne ? `一對一 ${c.oneOnOne} 場` : '', c.team ? `團隊 ${c.team} 場` : ''].filter(Boolean).join('、');
  return `共 ${c.sessions} 場（${kinds}），會後反思繳交 ${c.submitted}／${c.assigned} 份（${c.rate ?? 0}%）`
    + (c.avgRating != null ? `，學員對會談的回饋平均 ${c.avgRating}／5（${c.ratingCount} 份）。` : '。');
}
