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

// 工具：以同一「原始分數」填滿所有題目。
function fillAll(value) {
  return Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value]));
}

// 工具：讓每題的「有效分數」都等於 value（反向題自動換算原始分數）。
function fillEffective(value) {
  return Object.fromEntries(
    ALL_QUESTIONS.map((q) => [q.id, q.reversed ? config.SCALE_MAX + config.SCALE_MIN - value : value]),
  );
}

describe('題庫結構', () => {
  it('共 48 題、6 構面', () => {
    expect(TOTAL_QUESTIONS).toBe(48);
    expect(DIMENSIONS).toHaveLength(6);
  });

  it('每個構面都至少有一題反向題', () => {
    DIMENSIONS.forEach((d) => {
      expect(d.questions.some((q) => q.reversed)).toBe(true);
    });
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
    expect(unansweredQuestionIds({}, config)).toHaveLength(48);
  });

  it('忽略超出範圍或非數字的值', () => {
    expect(answeredCount({ q1: 0, q2: 6, q3: 'abc', q4: 3 }, config)).toBe(1);
  });

  it('全部填滿時完成', () => {
    const a = fillAll(3);
    expect(answeredCount(a, config)).toBe(48);
    expect(isComplete(a, config)).toBe(true);
    expect(unansweredQuestionIds(a, config)).toHaveLength(0);
  });

  it('接受字串型數字（來自表單）', () => {
    expect(answeredCount({ q1: '4' }, config)).toBe(1);
    expect(computeTotalScore({ q1: '4', q2: '2' }, config)).toBe(6);
  });
});

describe('computeTotalScore', () => {
  it('反向題會反轉計分（有效分數最小 48、最大 240）', () => {
    expect(computeTotalScore(fillEffective(1), config)).toBe(48);
    expect(computeTotalScore(fillEffective(5), config)).toBe(240);
  });

  it('全部原始分數填 5 時，反向題被反轉（總分 < 滿分）', () => {
    expect(computeTotalScore(fillAll(5), config)).toBeLessThan(240);
  });
});

describe('getLevel 落點邊界', () => {
  const cases = [
    [48, 'novice'],
    [96, 'novice'],
    [97, 'practitioner'],
    [144, 'practitioner'],
    [145, 'advanced'],
    [192, 'advanced'],
    [193, 'catalyst'],
    [240, 'catalyst'],
  ];
  it.each(cases)('總分 %i → %s', (score, id) => {
    expect(getLevel(score, config).id).toBe(id);
  });
});

describe('computeDimensionScores', () => {
  it('每構面滿分為題數×5，有效分數全 5 時百分比 100', () => {
    const dims = computeDimensionScores(fillEffective(5), config);
    expect(dims).toHaveLength(6);
    dims.forEach((d) => {
      expect(d.percent).toBe(100);
      expect(d.score).toBe(d.max);
      expect(d.average).toBe(5);
    });
    // 安全思維力構面有 8 題（含 1 反向）→ 滿分 40。
    expect(dims.find((d) => d.id === 'safety').max).toBe(40);
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

describe('ai-competency 落點涵蓋全部可能總分', () => {
  it('MIN_SCORE 到 MAX_SCORE 每個整數都對得到唯一等級', () => {
    for (let t = config.MIN_SCORE; t <= config.MAX_SCORE; t++) {
      const hits = config.LEVELS.filter((l) => t >= l.min && t <= l.max);
      expect(hits, `總分 ${t}`).toHaveLength(1);
    }
  });
  it('新結果帶題庫版本', async () => {
    const { buildResult } = await import('../survey/utils/scoring.js');
    expect(buildResult(fillAll(3), config).itemVersion).toBe('2026-10');
  });
});
