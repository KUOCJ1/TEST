import { DIMENSIONS } from '../data/questions';
import { LEVELS } from '../data/levels';

/** 每位使用者只保留最新一筆作答（代表其目前能力落點）。 */
export function latestPerUser(submissions) {
  const map = new Map();
  for (const s of submissions) {
    const cur = map.get(s.userId);
    // 以較新的 createdAt 為準；時間相同時，後寫入者（陣列較後）視為最新。
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) {
      map.set(s.userId, s);
    }
  }
  return [...map.values()];
}

function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** 後台彙整統計：以「每人最新一筆」為母體計算。可選傳入題庫 config 以使用對應的構面和落點定義。 */
export function aggregateStats(submissions, config) {
  const dimensions = config?.DIMENSIONS ?? DIMENSIONS;
  const levels = config?.LEVELS ?? LEVELS;
  const latest = latestPerUser(submissions);
  const respondents = latest.length;

  const dimensionAverages = dimensions.map((d) => {
    const percents = latest.map((s) => s.result.dimensions.find((x) => x.id === d.id)?.percent ?? 0);
    return {
      id: d.id,
      subtitle: d.subtitle,
      name: d.name,
      color: d.color,
      percent: Math.round(avg(percents)),
    };
  });

  const levelDistribution = levels.map((l) => ({
    id: l.id,
    badge: l.badge,
    color: l.color,
    count: latest.filter((s) => s.result.level.id === l.id).length,
  }));

  return {
    respondents,
    totalSubmissions: submissions.length,
    avgTotal: respondents ? Math.round(avg(latest.map((s) => s.result.total)) * 10) / 10 : 0,
    avgPercent: respondents ? Math.round(avg(latest.map((s) => s.result.percent))) : 0,
    dimensionAverages,
    levelDistribution,
  };
}
