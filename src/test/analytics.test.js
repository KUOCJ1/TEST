import { describe, it, expect } from 'vitest';
import { aggregateStats, latestPerUser } from '../survey/utils/analytics';
import { buildResult } from '../survey/utils/scoring';
import { ALL_QUESTIONS } from '../survey/data/questions';

function resultFor(value) {
  return buildResult(Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value])));
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
    expect(latest.find((s) => s.userId === 'u1').result.total).toBe(155);
  });

  it('時間相同時以較後寫入者為準', () => {
    const a = sub('u1', 1, 1);
    const b = { ...sub('u1', 5, 2), createdAt: a.createdAt };
    expect(latestPerUser([a, b])[0].result.total).toBe(155);
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
    // 平均總分 =（155 + 93）/ 2 = 124
    expect(s.avgTotal).toBe(124);
    expect(s.dimensionAverages).toHaveLength(6);

    const dist = Object.fromEntries(s.levelDistribution.map((d) => [d.id, d.count]));
    expect(dist.catalyst).toBe(1);
    expect(dist.practitioner).toBe(1);
    expect(dist.novice).toBe(0); // u1 的舊紀錄不計入
  });
});
