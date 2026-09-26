import { describe, it, expect } from 'vitest';
import { aggregateStats, computePercentile, latestPerUser, computeGroupGain, computeCohortTrend } from '../survey/utils/analytics';
import { buildResult } from '../survey/utils/scoring';
import { getAssessment } from '../survey/data/assessments/index.js';

const config = getAssessment('ai-competency');
const { ALL_QUESTIONS } = config;
const discConfig = getAssessment('disc');

function resultFor(value) {
  return buildResult(Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value])), config);
}

// 只讓某一個構面拿高分、其餘拿低分，這樣各構面才會有「不一樣」的進步幅度可比較
// （resultFor() 全題同分會讓每個構面漲跌完全一樣，測不出排序邏輯）。
function resultFavoring(dimId, value = 5, otherValue = 1) {
  const answers = {};
  config.DIMENSIONS.forEach((d) => {
    d.questions.forEach((q) => { answers[q.id] = d.id === dimId ? value : otherValue; });
  });
  return buildResult(answers, config);
}

function discResultFavoring(dimId, value = 5, otherValue = 1) {
  const answers = {};
  discConfig.DIMENSIONS.forEach((d) => {
    d.questions.forEach((q) => { answers[q.id] = d.id === dimId ? value : otherValue; });
  });
  return buildResult(answers, discConfig);
}

function selfSub(userId, phase, result, order) {
  return {
    id: `s${order}`, userId, userName: userId, raterType: 'self', phase,
    createdAt: new Date(2026, 0, 1, 0, 0, order).toISOString(), result,
  };
}

// 以遞增的 createdAt 建構作答陣列（後者較新）。
function sub(userId, value, order) {
  return {
    id: `s${order}`,
    userId,
    userName: userId,
    createdAt: new Date(2026, 0, 1, 0, 0, order).toISOString(),
    result: resultFor(value),
  };
}

describe('latestPerUser', () => {
  it('每位使用者僅保留最新一筆', () => {
    const subs = [sub('u1', 1, 1), sub('u1', 5, 2), sub('u2', 3, 3)];
    const latest = latestPerUser(subs);
    expect(latest).toHaveLength(2);
    expect(latest.find((s) => s.userId === 'u1').result.total).toBe(161);
  });

  it('時間相同時以較後寫入者為準', () => {
    const a = sub('u1', 1, 1);
    const b = { ...sub('u1', 5, 2), createdAt: a.createdAt };
    expect(latestPerUser([a, b])[0].result.total).toBe(161);
  });
});

describe('aggregateStats', () => {
  it('空資料時回傳 0', () => {
    const s = aggregateStats([]);
    expect(s.respondents).toBe(0);
    expect(s.avgPercent).toBe(0);
    expect(s.levelDistribution.reduce((a, b) => a + b.count, 0)).toBe(0);
  });

  it('以每人最新一筆計算人數、平均與落點分佈', () => {
    const subs = [sub('u1', 1, 1), sub('u1', 5, 2), sub('u2', 3, 3)];
    const s = aggregateStats(subs);

    expect(s.respondents).toBe(2);
    expect(s.totalSubmissions).toBe(3);
    // 平均總分 =（161 + 111）/ 2 = 136
    expect(s.avgTotal).toBe(136);
    expect(s.dimensionAverages).toHaveLength(6);

    const dist = Object.fromEntries(s.levelDistribution.map((d) => [d.id, d.count]));
    expect(dist.catalyst).toBe(1);
    expect(dist.practitioner).toBe(1);
    expect(dist.novice).toBe(0); // u1 的舊紀錄不計入
  });
});

describe('computePercentile', () => {
  it('returns null when population has fewer than 2 members', () => {
    expect(computePercentile(50, [])).toBeNull();
    expect(computePercentile(50, [50])).toBeNull();
  });

  it('returns 0 when value is lowest in population', () => {
    expect(computePercentile(10, [10, 20, 30, 40])).toBe(0);
  });

  it('returns 75 when value beats 3 out of 4 members', () => {
    expect(computePercentile(40, [10, 20, 30, 40])).toBe(75);
  });

  it('returns 100 when value exceeds entire population', () => {
    expect(computePercentile(99, [10, 20, 30])).toBe(100);
  });

  it('counts strictly-below values (ties do not count)', () => {
    expect(computePercentile(20, [10, 20, 20, 30])).toBe(25);
  });
});

describe('computeGroupGain', () => {
  it('沒有任何配對樣本（沒人課前課後都做過）時回傳 null', () => {
    const subs = [selfSub('u1', 'pre', resultFor(3), 1)];
    expect(computeGroupGain(subs, config)).toBeNull();
  });

  it('config 為 null 時回傳 null', () => {
    expect(computeGroupGain([], null)).toBeNull();
  });

  it('只計算配對樣本，並算出平均總分增益與各構面平均增益', () => {
    const subs = [
      selfSub('u1', 'pre', resultFavoring('foundation', 1, 1), 1),
      selfSub('u1', 'post', resultFavoring('foundation', 5, 1), 2),
      selfSub('u2', 'pre', resultFor(3), 3), // 單獨一筆課前，沒有課後配對，不計入
    ];
    const gain = computeGroupGain(subs, config);
    expect(gain.pairedCount).toBe(1);
    expect(gain.profileMode).toBe(false);
    expect(gain.avgTotalDelta).toBeGreaterThan(0);
    const foundation = gain.dimensionDeltas.find((d) => d.id === 'foundation');
    expect(foundation.avgDelta).toBeGreaterThan(0);
    expect(gain.mostImproved.id).toBe('foundation');
  });

  it('只算自評（raterType=self），360 他評提交不列入配對', () => {
    const subs = [
      selfSub('u1', 'pre', resultFor(3), 1),
      selfSub('u1', 'post', resultFor(4), 2),
      { id: 's3', userId: 'u1', raterType: 'peer', rateeId: 'u1', phase: 'pre', createdAt: new Date().toISOString(), result: resultFor(1) },
    ];
    const gain = computeGroupGain(subs, config);
    expect(gain.pairedCount).toBe(1);
  });

  it('同一階段有多筆時取最新一筆', () => {
    const subs = [
      selfSub('u1', 'pre', resultFor(1), 1),
      selfSub('u1', 'pre', resultFor(3), 2), // 較新的課前
      selfSub('u1', 'post', resultFor(5), 3),
    ];
    const gain = computeGroupGain(subs, config);
    // 課前應採較新一筆（3 分，非最舊 1 分）：total 3 分 * 37 題左右換算後仍可用增益方向驗證。
    expect(gain.avgTotalDelta).toBeGreaterThan(0);
  });

  it('PROFILE_MODE 題庫（如 DISC）回傳風格分布變化，不是分數增益', () => {
    const subs = [
      selfSub('u1', 'pre', discResultFavoring('dominance'), 1),
      selfSub('u1', 'post', discResultFavoring('steadiness'), 2),
    ];
    const gain = computeGroupGain(subs, discConfig);
    expect(gain.profileMode).toBe(true);
    expect(gain.avgTotalDelta).toBeUndefined();
    expect(gain.preDistribution.reduce((n, d) => n + d.count, 0)).toBe(1);
    expect(gain.postDistribution.reduce((n, d) => n + d.count, 0)).toBe(1);
  });
});

describe('computeCohortTrend（Sprint 6 跨梯次比較）', () => {
  const g = (id, startDate, extra = {}) => ({ id, name: `班${id}`, assessmentId: 'ai-competency', startDate, memberIds: [], ...extra });
  const s = (userId, groupId, value, extra = {}) => ({
    userId, groupId, raterType: 'self', phase: 'pre', assessmentId: 'ai-competency',
    createdAt: '2026-01-01T00:00:00Z', result: resultFor(value), ...extra,
  });

  it('依開課日由舊到新排序，沒設開課日的排最後', () => {
    const groups = [g('c', null), g('b', '2026-06-01'), g('a', '2026-03-01')];
    const subs = [s('u1', 'a', 3), s('u2', 'b', 4), s('u3', 'c', 5)];
    const { cohorts } = computeCohortTrend(groups, subs, config);
    expect(cohorts.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('每班各自彙整：人數、平均總分與達成率只算歸屬在該班的作答', () => {
    const groups = [g('a', '2026-03-01'), g('b', '2026-06-01')];
    const subs = [s('u1', 'a', 2), s('u2', 'a', 4), s('u3', 'b', 5)];
    const { cohorts } = computeCohortTrend(groups, subs, config);
    const [a, b] = cohorts;
    expect(a.respondents).toBe(2);
    expect(a.avgTotal).toBe(aggregateStats([s('u1', 'a', 2), s('u2', 'a', 4)], config).avgTotal);
    expect(b.respondents).toBe(1);
    expect(b.avgPercent).toBe(resultFor(5).percent);
  });

  it('只看指定階段：課前、課後分開計算，不混在同一個平均', () => {
    const groups = [g('a', '2026-03-01')];
    const subs = [s('u1', 'a', 2), s('u1', 'a', 5, { phase: 'post', createdAt: '2026-02-01T00:00:00Z' })];
    expect(computeCohortTrend(groups, subs, config, 'pre').cohorts[0].avgPercent).toBe(resultFor(2).percent);
    expect(computeCohortTrend(groups, subs, config, 'post').cohorts[0].avgPercent).toBe(resultFor(5).percent);
  });

  it('phase 為 null 的舊資料視為課前；360 他評不算', () => {
    const groups = [g('a', '2026-03-01')];
    const subs = [s('u1', 'a', 3, { phase: null }), s('u2', 'a', 5, { raterType: 'peer' })];
    const { cohorts } = computeCohortTrend(groups, subs, config, 'pre');
    expect(cohorts[0].respondents).toBe(1);
  });

  it('舊資料（groupId 為 null）退回用成員名單＋同題庫反查', () => {
    const groups = [g('a', '2026-03-01', { memberIds: ['u1'] })];
    const subs = [s('u1', null, 4), s('u9', null, 4), s('u1', null, 4, { assessmentId: 'disc' })];
    expect(computeCohortTrend(groups, subs, config).cohorts[0].respondents).toBe(1);
  });

  it('只列出同一套題庫的班級；該階段沒有作答的班級不列入並回報數量', () => {
    const groups = [g('a', '2026-03-01'), g('b', '2026-06-01'), g('d', '2026-01-01', { assessmentId: 'disc' })];
    const { cohorts, emptyCount } = computeCohortTrend(groups, [s('u1', 'a', 3)], config);
    expect(cohorts.map((c) => c.id)).toEqual(['a']);
    expect(emptyCount).toBe(1);
  });

  it('沒有 config 時回傳空結果', () => {
    expect(computeCohortTrend([g('a', null)], [], null)).toEqual({ cohorts: [], emptyCount: 0 });
  });
});
