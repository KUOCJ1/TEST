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
import { getAssessment } from '../survey/data/assessments/index.js';

const config = getAssessment('ai-competency');
const { ALL_QUESTIONS, TOTAL_QUESTIONS, DIMENSIONS } = config;

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
    expect(answeredCount({}, config)).toBe(0);
    expect(isComplete({}, config)).toBe(false);
    expect(unansweredQuestionIds({}, config)).toHaveLength(31);
  });

  it('忽略超出範圍或非數字的值', () => {
    expect(answeredCount({ q1: 0, q2: 6, q3: 'abc', q4: 3 }, config)).toBe(1);
  });

  it('全部填滿時完成', () => {
    const a = fillAll(3);
    expect(answeredCount(a, config)).toBe(31);
    expect(isComplete(a, config)).toBe(true);
    expect(unansweredQuestionIds(a, config)).toHaveLength(0);
  });

  it('接受字串型數字（來自表單）', () => {
    expect(answeredCount({ q1: '4' }, config)).toBe(1);
    expect(computeTotalScore({ q1: '4', q2: '2' }, config)).toBe(6);
  });
});

describe('computeTotalScore', () => {
  it('最小總分 31、最大總分 155', () => {
    expect(computeTotalScore(fillAll(1), config)).toBe(31);
    expect(computeTotalScore(fillAll(5), config)).toBe(155);
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
    expect(getLevel(score, config).id).toBe(id);
  });
});

describe('computeDimensionScores', () => {
  it('每構面滿分為題數×5，全 5 分時百分比 100', () => {
    const dims = computeDimensionScores(fillAll(5), config);
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
    const dims = computeDimensionScores({}, config);
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
    const r = buildResult(answers, config);
    expect(r.complete).toBe(true);
    expect(r.strongest.id).toBe('innovation');
    expect(r.total).toBe(computeTotalScore(answers, config));
    expect(r.level.id).toBe(getLevel(r.total, config).id);
  });
});
