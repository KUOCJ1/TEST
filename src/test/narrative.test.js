import { describe, it, expect } from 'vitest';
import { buildResult, computeDimensionScores } from '../survey/utils/scoring';
import {
  bandOf,
  buildNarrative,
  buildOverallSummary,
  buildCoachNarrative,
  buildConsultantNarrative,
  buildDevelopmentPlan,
} from '../survey/utils/narrative';
import { getAssessment } from '../survey/data/assessments/index.js';

const config = getAssessment('leadership-9d');
const { ALL_QUESTIONS, DIMENSIONS, COMMENTARY } = config;

function fillAll(value) {
  return Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, value]));
}

// 以「有效滿分」作答：正向題填 5、反向題填 1 → 每題還原後皆為 5。
function fillEffectiveMax() {
  return Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 1 : 5]));
}

describe('子能力結構', () => {
  it('每題都有對應的 subId，且 subId 屬於該構面的 subDimensions', () => {
    for (const dim of DIMENSIONS) {
      const subIds = new Set(dim.subDimensions.map((s) => s.id));
      for (const q of dim.questions) {
        expect(q.subId, `${q.id} 缺少 subId`).toBeTruthy();
        expect(subIds.has(q.subId), `${q.id} 的 subId ${q.subId} 不在 ${dim.id}`).toBe(true);
      }
    }
  });

  it('每個 subDimension 都至少對應一題，且都有三段評語', () => {
    for (const dim of DIMENSIONS) {
      for (const sub of dim.subDimensions) {
        const n = dim.questions.filter((q) => q.subId === sub.id).length;
        expect(n, `${sub.id} 無對應題目`).toBeGreaterThan(0);
        expect(COMMENTARY[sub.id]).toBeTruthy();
        expect(COMMENTARY[sub.id].high).toBeTruthy();
        expect(COMMENTARY[sub.id].mid).toBeTruthy();
        expect(COMMENTARY[sub.id].low).toBeTruthy();
      }
    }
  });
});

describe('bandOf 分段門檻', () => {
  it('≥4.5 為 high；3.5–<4.5 為 mid；<3.5 為 low（含邊界）', () => {
    expect(bandOf(5)).toBe('high');
    expect(bandOf(4.5)).toBe('high');
    expect(bandOf(4.49)).toBe('mid');
    expect(bandOf(3.5)).toBe('mid');
    expect(bandOf(3.49)).toBe('low');
    expect(bandOf(1)).toBe('low');
  });
});

describe('computeDimensionScores 子能力分數', () => {
  it('有效滿分作答 → 每個子能力平均為 5（反向題已被正確還原）', () => {
    const dims = computeDimensionScores(fillEffectiveMax(), config);
    for (const d of dims) {
      expect(d.subs.length).toBeGreaterThan(0);
      for (const s of d.subs) expect(s.average).toBe(5);
    }
  });

  it('全部填 1 → 含反向題的子能力平均不會是極端值（反向被還原）', () => {
    const dims = computeDimensionScores(fillAll(1), config);
    // communication.listening 含反向題 l9/l10，全填 1 → 正向題=1、反向題還原=5
    const comm = dims.find((d) => d.id === 'communication');
    const listening = comm.subs.find((s) => s.id === 'listening');
    // l6,l7=1；l9,l10 反向→5 → 平均=(1+1+5+5)/4=3
    expect(listening.average).toBe(3);
  });
});

describe('buildNarrative 段落組裝', () => {
  const result = buildResult(fillAll(5), config);
  const dim = result.dimensions[0];

  it('產出非空段落，且包含構面名稱與收尾句', () => {
    const text = buildNarrative(dim, config, result.total);
    expect(text.length).toBeGreaterThan(20);
    expect(text).toContain(dim.name);
  });

  it('相同 seed 產出完全相同（決定性）', () => {
    const a = buildNarrative(dim, config, 123);
    const b = buildNarrative(dim, config, 123);
    expect(a).toBe(b);
  });

  it('不同 seed 至少在部分構面產生不同模板（有變化）', () => {
    const variants = new Set();
    for (let seed = 0; seed < 12; seed += 1) {
      variants.add(buildNarrative(dim, config, seed));
    }
    expect(variants.size).toBeGreaterThan(1);
  });

  it('題庫無 COMMENTARY 時回傳空字串（向後相容）', () => {
    const text = buildNarrative(dim, { COMMENTARY: undefined }, 1);
    expect(text).toBe('');
  });
});

describe('buildOverallSummary 整體總評', () => {
  it('包含落點徽章與最強構面名稱', () => {
    const result = buildResult(fillAll(5), config);
    const summary = buildOverallSummary(result, config, result.total);
    expect(summary).toContain(result.level.badge);
    expect(summary).toContain(result.dimensions[0].name);
  });
});

describe('buildCoachNarrative 教練級敘事', () => {
  it('產出非空段落且決定性（相同 seed 相同輸出）', () => {
    const result = buildResult(fillAll(4), config);
    const a = buildCoachNarrative(result, config, result.total);
    const b = buildCoachNarrative(result, config, result.total);
    expect(a.length).toBeGreaterThan(30);
    expect(a).toBe(b);
  });
  it('結果為空時回傳空字串', () => {
    expect(buildCoachNarrative({ dimensions: [] }, config, 1)).toBe('');
  });
});

describe('buildConsultantNarrative 顧問級敘事', () => {
  it('L9D（有三圈層）會提到能力梯度與落點', () => {
    const result = buildResult(fillAll(4), config);
    const text = buildConsultantNarrative(result, config, result.total);
    expect(text.length).toBeGreaterThan(40);
    expect(text).toContain(result.level.badge);
    // 應提到某一圈層名稱
    expect(config.LAYERS.some((l) => text.includes(l.name))).toBe(true);
  });
  it('無 LAYERS 的題庫會退回構面層級且不報錯', () => {
    const result = buildResult(fillAll(4), config);
    const text = buildConsultantNarrative(result, { ...config, LAYERS: undefined }, result.total);
    expect(text).toContain(result.level.badge);
  });
});

describe('buildDevelopmentPlan 發展建議', () => {
  it('回傳近/中/長期階段，每階段含行動項', () => {
    const result = buildResult(fillAll(3), config);
    const plan = buildDevelopmentPlan(result, config, {}, result.total);
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan[0].horizon).toContain('近期');
    expect(Array.isArray(plan[0].actions)).toBe(true);
    expect(plan[0].actions.length).toBeGreaterThan(0);
  });
  it('指定重點構面時，近期階段優先鎖定重點構面中的最弱者', () => {
    // 讓 communication 偏弱、其餘較高：communication 全 2，其餘全 5
    const answers = Object.fromEntries(
      ALL_QUESTIONS.map((q) => {
        const dim = DIMENSIONS.find((d) => d.questions.some((x) => x.id === q.id));
        const weak = dim.id === 'communication';
        const base = weak ? 2 : 5;
        return [q.id, q.reversed ? 6 - base : base];
      }),
    );
    const result = buildResult(answers, config);
    const plan = buildDevelopmentPlan(result, config, { focusDimensionIds: ['communication'] }, result.total);
    expect(plan[0].id).toBe('communication');
  });
});
