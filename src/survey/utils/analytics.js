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

/**
 * 計算某數值在母體中的百分位（你超越了多少 % 的人）。
 * @param {number} value 個人數值
 * @param {number[]} population 母體數值（不需先排序）
 * @returns {number|null} 0~100 的整數；母體不足 2 人時回 null（樣本太小無意義）
 */
export function computePercentile(value, population) {
  if (!Array.isArray(population) || population.length < 2) return null;
  const below = population.filter((v) => v < value).length;
  return Math.round((below / population.length) * 100);
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

/**
 * 班級課前 vs 課後學習成效（Sprint 4 驗收條件 4.3）：只算「配對樣本」——同一個
 * 人課前跟課後都有自評提交的才算數，單獨一筆課前或課後不參與平均，避免用
 * 不對等的兩批人比較出沒有意義的「進步」。
 *
 * PROFILE_MODE 題庫（構面沒有優劣）不回傳分數增益，改回傳風格分布變化
 * （課前/課後各自的風格徽章人數分布），呈現方式跟第 1 章「風格輪廓沒有
 * 好壞」的原則一致。
 *
 * @param {Array} submissions 該班已依 groupId 篩過的作答（含各種 raterType）
 * @param {object} config getAssessment(group.assessmentId) 的結果
 * @returns {null | {pairedCount:number, profileMode:true, preDistribution, postDistribution}
 *   | {pairedCount:number, profileMode:false, avgTotalDelta:number, dimensionDeltas:Array}}
 *   pairedCount 為 0 時回傳 null（沒有任何人課前課後都做過，無法算成效）。
 */
export function computeGroupGain(submissions, config) {
  if (!config) return null;
  const selfSubs = submissions.filter((s) => (s.raterType ?? 'self') === 'self');

  // 每個人的「最新一筆課前」與「最新一筆課後」（同一階段作答多次時取最新）。
  const byUser = new Map();
  for (const s of selfSubs) {
    const phase = s.phase ?? 'pre';
    const entry = byUser.get(s.userId) ?? {};
    const existing = entry[phase];
    if (!existing || new Date(s.createdAt) >= new Date(existing.createdAt)) entry[phase] = s;
    byUser.set(s.userId, entry);
  }
  const paired = [...byUser.values()].filter((e) => e.pre && e.post);
  if (paired.length === 0) return null;

  if (config.PROFILE_MODE) {
    const distributionOf = (key) => {
      const counts = new Map();
      paired.forEach((p) => {
        const badge = p[key].result.level.badge;
        counts.set(badge, (counts.get(badge) ?? 0) + 1);
      });
      return [...counts.entries()].map(([badge, count]) => ({ badge, count })).sort((a, b) => b.count - a.count);
    };
    return {
      pairedCount: paired.length,
      profileMode: true,
      preDistribution: distributionOf('pre'),
      postDistribution: distributionOf('post'),
    };
  }

  const avgTotalDelta = Math.round(avg(paired.map((p) => p.post.result.total - p.pre.result.total)) * 10) / 10;
  const dimensionDeltas = (config.DIMENSIONS ?? []).map((d) => {
    const deltas = paired.map((p) => {
      const preScore = p.pre.result.dimensions.find((x) => x.id === d.id)?.score ?? 0;
      const postScore = p.post.result.dimensions.find((x) => x.id === d.id)?.score ?? 0;
      return postScore - preScore;
    });
    return { id: d.id, subtitle: d.subtitle, color: d.color, avgDelta: Math.round(avg(deltas) * 10) / 10 };
  }).sort((a, b) => b.avgDelta - a.avgDelta);

  return {
    pairedCount: paired.length,
    profileMode: false,
    avgTotalDelta,
    dimensionDeltas,
    mostImproved: dimensionDeltas[0] ?? null,
    leastImproved: dimensionDeltas.length > 1 ? dimensionDeltas[dimensionDeltas.length - 1] : null,
  };
}

/**
 * 跨班級／跨梯次比較（Sprint 6 驗收條件 6.3、6.4）：同一套題庫底下的所有班級
 * （不限教練）依開課日排序，各自算一份 aggregateStats，讓管理者看出這門課辦了
 * 好幾梯之後，整體是往哪個方向走。
 *
 * 一次只看一個階段（課前或課後）：每人「最新一筆」若把課前、課後混在一起取，
 * 會把「這梯學員進來時的程度」跟「上完課的成果」攪在同一個平均裡，兩梯就沒得比。
 * phase 為 null 的舊資料視為課前，跟 ProgressPanel 的判斷一致；只算自評。
 *
 * 班級歸屬沿用教練後台班級報告的規則：有 groupId 的以 groupId 為準，舊資料
 * （groupId 為 null）退回「目前成員名單 + 同題庫」反查。
 *
 * @param {Array} groups 全部班級（管理者視角）
 * @param {Array} submissions 全部作答（已 normalize，含 groupId／phase／raterType）
 * @param {object} config getAssessment(assessmentId)
 * @param {'pre'|'post'} phase
 * @returns {{cohorts: Array, emptyCount: number}} cohorts 依開課日由舊到新，
 *   沒設開課日的排最後；emptyCount 為該階段沒有任何作答、因此未列入的班級數。
 */
export function computeCohortTrend(groups, submissions, config, phase = 'pre') {
  if (!config) return { cohorts: [], emptyCount: 0 };
  const inPhase = (s) => (s.phase ?? 'pre') === phase && (s.raterType ?? 'self') === 'self';
  const relevant = (groups ?? []).filter((g) => (g.assessmentId ?? 'ai-competency') === config.ID);

  const all = relevant.map((g) => {
    const subs = submissions.filter((s) => inPhase(s) && (s.groupId
      ? s.groupId === g.id
      : (g.memberIds ?? []).includes(s.userId) && (s.assessmentId ?? 'ai-competency') === config.ID));
    const stats = aggregateStats(subs, config);
    return {
      id: g.id,
      name: g.name,
      coachName: g.coachName ?? '',
      startDate: g.startDate ?? null,
      respondents: stats.respondents,
      avgTotal: stats.avgTotal,
      avgPercent: stats.avgPercent,
      levelDistribution: stats.levelDistribution,
    };
  });

  const cohorts = all
    .filter((c) => c.respondents > 0)
    .sort((a, b) => {
      if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    });
  return { cohorts, emptyCount: all.length - cohorts.length };
}
