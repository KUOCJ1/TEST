import { describe, it, expect, beforeEach } from 'vitest';
import { addSubmission, submissionsByUser, listSubmissions } from '../survey/data/submissionStore';
import { aggregateStats, latestPerUser } from '../survey/utils/analytics';
import { buildResult } from '../survey/utils/scoring';
import { ALL_QUESTIONS } from '../survey/data/questions';

beforeEach(() => {
  localStorage.clear();
});

function resultFor(value) {
  return buildResult(Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value])));
}

function submit(userId, userName, value) {
  return addSubmission({ userId, userName, answers: {}, result: resultFor(value) });
}

describe('submissionStore', () => {
  it('新增與依使用者查詢（新到舊排序）', () => {
    submit('u1', '甲', 2);
    submit('u1', '甲', 4);
    submit('u2', '乙', 5);
    expect(listSubmissions()).toHaveLength(3);
    const u1 = submissionsByUser('u1');
    expect(u1).toHaveLength(2);
    // 最新一筆（後新增者）在前。
    expect(new Date(u1[0].createdAt) >= new Date(u1[1].createdAt)).toBe(true);
  });
});

describe('latestPerUser', () => {
  it('每位使用者僅保留最新一筆', () => {
    submit('u1', '甲', 1);
    submit('u1', '甲', 5);
    submit('u2', '乙', 3);
    const latest = latestPerUser(listSubmissions());
    expect(latest).toHaveLength(2);
    expect(latest.find((s) => s.userId === 'u1').result.total).toBe(155);
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
    submit('u1', '甲', 1); // 舊：31 分 novice
    submit('u1', '甲', 5); // 新：155 分 catalyst
    submit('u2', '乙', 3); // 93 分 practitioner
    const s = aggregateStats(listSubmissions());

    expect(s.respondents).toBe(2);
    expect(s.totalSubmissions).toBe(3);
    // 平均總分 = (155 + 93) / 2 = 124
    expect(s.avgTotal).toBe(124);
    expect(s.dimensionAverages).toHaveLength(6);

    const dist = Object.fromEntries(s.levelDistribution.map((d) => [d.id, d.count]));
    expect(dist.catalyst).toBe(1);
    expect(dist.practitioner).toBe(1);
    expect(dist.novice).toBe(0); // u1 的舊紀錄不計入
  });
});
