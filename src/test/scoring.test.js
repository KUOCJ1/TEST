import { describe, it, expect } from 'vitest';
import {
  answeredCount,
  isComplete,
  unansweredQuestionIds,
  computeTotalScore,
  getLevel,
  computeDimensionScores,
  buildResult,
} from '../survey/utils/scoring';
import { ALL_QUESTIONS, TOTAL_QUESTIONS, DIMENSIONS } from '../survey/data/questions';

// 工具：以同一分數填滿所有題目。
function fillAll(value) {
  return Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value]));
}

describe('題庫結構', () => {
  it('共 31 題、6 構面', () => {
    expect(TOTAL_QUESTIONS).toBe(31);
    expect(DIMENSIONS).toHaveLength(6);
  });

  it('題目 id 不重複', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('answeredCount / isComplete / unanswered', () => {
  it('空白時為 0 且未完成', () => {
    expect(answeredCount({})).toBe(0);
    expect(isComplete({})).toBe(false);
    expect(unansweredQuestionIds({})).toHaveLength(31);
  });

  it('忽略超出範圍或非數字的值', () => {
    expect(answeredCount({ q1: 0, q2: 6, q3: 'abc', q4: 3 })).toBe(1);
  });

  it('全部填滿時完成', () => {
    const a = fillAll(3);
    expect(answeredCount(a)).toBe(31);
    expect(isComplete(a)).toBe(true);
    expect(unansweredQuestionIds(a)).toHaveLength(0);
  });

  it('接受字串型數字（來自表單）', () => {
    expect(answeredCount({ q1: '4' })).toBe(1);
    expect(computeTotalScore({ q1: '4', q2: '2' })).toBe(6);
  });
});

describe('computeTotalScore', () => {
  it('最小總分 31、最大總分 155', () => {
    expect(computeTotalScore(fillAll(1))).toBe(31);
    expect(computeTotalScore(fillAll(5))).toBe(155);
  });
});

describe('getLevel 落點邊界', () => {
  const cases = [
    [31, 'novice'],
    [62, 'novice'],
    [63, 'practitioner'],
    [93, 'practitioner'],
    [94, 'advanced'],
    [124, 'advanced'],
    [125, 'catalyst'],
    [155, 'catalyst'],
  ];
  it.each(cases)('總分 %i → %s', (score, id) => {
    expect(getLevel(score).id).toBe(id);
  });
});

describe('computeDimensionScores', () => {
  it('每構面滿分為題數×5，全 5 分時百分比 100', () => {
    const dims = computeDimensionScores(fillAll(5));
    expect(dims).toHaveLength(6);
    dims.forEach((d) => {
      expect(d.percent).toBe(100);
      expect(d.score).toBe(d.max);
      expect(d.average).toBe(5);
    });
    // 安全思維力構面有 6 題 → 滿分 30。
    expect(dims.find((d) => d.id === 'safety').max).toBe(30);
  });

  it('未作答的構面平均為 0', () => {
    const dims = computeDimensionScores({});
    dims.forEach((d) => expect(d.average).toBe(0));
  });
});

describe('buildResult', () => {
  it('彙整總分、等級與最強/最弱構面', () => {
    const answers = fillAll(3);
    // 讓「創新力」構面拉高，成為最強。
    DIMENSIONS.find((d) => d.id === 'innovation').questions.forEach((q) => {
      answers[q.id] = 5;
    });
    const r = buildResult(answers);
    expect(r.complete).toBe(true);
    expect(r.strongest.id).toBe('innovation');
    expect(r.total).toBe(computeTotalScore(answers));
    expect(r.level.id).toBe(getLevel(r.total).id);
  });
});
