import { describe, it, expect } from 'vitest';
import {
  NA_VALUE, THRESHOLDS, selectForm, effectiveScore, questionState, completeness,
  isCompassComplete, buildCompassResult, computeTensions, classifyTension, classifyGap,
  computeGaps, aggregateRaters, computeDimensions,
} from '../survey/utils/compassScoring.js';

// 小型測試設定：3 個構面；d1 含一組張力（focus/flex 各 3 題，其中 2 題屬精簡版）
function q(id, subId, extra = {}) {
  return { id, subId, reversed: false, forms: ['full'], observability: 'normal', ...extra };
}
const CONFIG = {
  ID: 'test-compass', NAME: '測試羅盤', ITEM_VERSION: 'test-1',
  SCALE_MIN: 1, SCALE_MAX: 5,
  LOOPS: [{ id: 'fast', name: '應變環', dimensionIds: ['d1', 'd2'] }, { id: 'last', name: '養成環', dimensionIds: ['d3'] }],
  TENSIONS: [{ id: 't1', dimensionId: 'd1', poleA: 'focus', poleB: 'flex', nameA: '聚焦', nameB: '彈性' }],
  DIMENSIONS: [
    {
      id: 'd1', index: 1, name: '聚焦應變', subtitle: 'Aim', color: '#111', loop: 'fast',
      subDimensions: [{ id: 's1', name: '聚焦取捨' }, { id: 's2', name: '彈性調整' }],
      questions: [
        q('a1', 's1', { pole: 'focus', forms: ['full', 'short'] }),
        q('a2', 's1', { pole: 'focus', forms: ['full', 'short'] }),
        q('a3', 's1', { pole: 'focus' }),
        q('a4', 's2', { pole: 'flex', forms: ['full', 'short'] }),
        q('a5', 's2', { pole: 'flex', forms: ['full', 'short'] }),
        q('a6', 's2', { pole: 'flex' }),
      ],
    },
    {
      id: 'd2', index: 2, name: '洞察情勢', subtitle: 'Find', color: '#222', loop: 'fast',
      subDimensions: [],
      questions: [
        q('b1', null, { forms: ['full', 'short'] }),
        q('b2', null, { reversed: true, forms: ['full', 'short'] }),
        q('b3', null, { observability: 'low', forms: ['full', 'short'] }),
        q('b4', null),
        q('b5', null),
      ],
    },
    {
      id: 'd3', index: 3, name: '傳承留能', subtitle: 'Transfer', color: '#333', loop: 'last',
      subDimensions: [],
      questions: [q('c1', null, { forms: ['full', 'short'] }), q('c2', null, { forms: ['full', 'short'] }), q('c3', null)],
    },
  ],
};
const fullIds = CONFIG.DIMENSIONS.flatMap((d) => d.questions.map((x) => x.id));
const allAnswers = (v, cfg = CONFIG) => Object.fromEntries(cfg.DIMENSIONS.flatMap((d) => d.questions).map((x) => [x.id, v]));

describe('selectForm', () => {
  it('完整版含全部題目，精簡版為子集，且不修改原設定', () => {
    const full = selectForm(CONFIG, 'full');
    const short = selectForm(CONFIG, 'short');
    expect(full.TOTAL_QUESTIONS).toBe(14);
    expect(short.TOTAL_QUESTIONS).toBe(9);
    const fullSet = new Set(full.ALL_QUESTIONS.map((x) => x.id));
    expect(short.ALL_QUESTIONS.every((x) => fullSet.has(x.id))).toBe(true);
    expect(short.MAX_SCORE).toBe(9 * 5);
    expect(CONFIG.DIMENSIONS[0].questions).toHaveLength(6);
  });
  it('未知版本丟錯', () => {
    expect(() => selectForm(CONFIG, 'tiny')).toThrow();
  });
});

describe('effectiveScore / questionState', () => {
  const rev = { id: 'x', reversed: true };
  const fwd = { id: 'y', reversed: false };
  it('反向題 6 − 原始分；範圍外、空值為 null', () => {
    expect(effectiveScore(5, rev, CONFIG)).toBe(1);
    expect(effectiveScore(2, rev, CONFIG)).toBe(4);
    expect(effectiveScore(3, fwd, CONFIG)).toBe(3);
    expect(effectiveScore(0, fwd, CONFIG)).toBeNull();
    expect(effectiveScore(6, fwd, CONFIG)).toBeNull();
    expect(effectiveScore(undefined, fwd, CONFIG)).toBeNull();
    expect(effectiveScore('', fwd, CONFIG)).toBeNull();
    expect(effectiveScore(NA_VALUE, fwd, CONFIG)).toBeNull();
  });
  it('na 只在他評版的低可觀察題合法', () => {
    const low = { id: 'z', observability: 'low' };
    expect(questionState(NA_VALUE, low, CONFIG, 'other')).toBe('na');
    expect(questionState(NA_VALUE, low, CONFIG, 'self')).toBe('missing');
    expect(questionState(NA_VALUE, fwd, CONFIG, 'other')).toBe('missing');
    expect(questionState(4, low, CONFIG, 'other')).toBe('valid');
  });
});

describe('completeness', () => {
  const fc = selectForm(CONFIG, 'full');
  it('自評必須全部作答，na 不算', () => {
    expect(isCompassComplete(allAnswers(3), fc, 'self')).toBe(true);
    expect(isCompassComplete({ ...allAnswers(3), a1: undefined }, fc, 'self')).toBe(false);
    expect(isCompassComplete({ ...allAnswers(3), b3: NA_VALUE }, fc, 'self')).toBe(false);
  });
  it('他評：低可觀察題可為 na，且覆蓋率達標才算完成', () => {
    expect(isCompassComplete({ ...allAnswers(3), b3: NA_VALUE }, fc, 'other')).toBe(true);
  });
  it('他評：漏填（非 na）不算完成', () => {
    expect(isCompassComplete({ ...allAnswers(3), a1: undefined }, fc, 'other')).toBe(false);
  });
  it('他評：構面內 na 太多（d2 僅 1 個可為 na，所以以 d2 有效比例驗證邊界）', () => {
    const c = completeness({ ...allAnswers(3), b3: NA_VALUE }, fc, 'other');
    expect(c.na).toBe(1);
    expect(c.dimensions.find((d) => d.id === 'd2').valid).toBe(4);
  });
});

describe('buildCompassResult', () => {
  it('形狀相容 validateResultShape，並含 loops／tensions／版本', () => {
    const r = buildCompassResult(allAnswers(4), CONFIG, { form: 'full' });
    expect(typeof r.total).toBe('number');
    expect(r.dimensions.every((d) => typeof d.id === 'string' && Number.isFinite(d.score) && Number.isFinite(d.max) && typeof d.rating.label === 'string')).toBe(true);
    expect(r.loops).toHaveLength(2);
    expect(r.tensions).toHaveLength(1);
    expect(r.itemVersion).toBe('test-1');
    expect(r.assessmentId).toBe('test-compass');
    expect(r.level).toBeNull();
    expect(r.complete).toBe(true);
  });
  it('反向題與平均：全部填 4 → 反向題為 2', () => {
    const r = buildCompassResult(allAnswers(4), CONFIG);
    const d2 = r.dimensions.find((d) => d.id === 'd2');
    // b1,b3,b4,b5 = 4；b2 反向 = 2 → 平均 3.6
    expect(d2.average).toBeCloseTo(3.6, 5);
  });
  it('na 不計入分子與分母', () => {
    const r = buildCompassResult({ ...allAnswers(4), b3: NA_VALUE }, CONFIG, { rater: 'other' });
    const d2 = r.dimensions.find((d) => d.id === 'd2');
    expect(d2.answered).toBe(4);
    expect(d2.max).toBe(20);
    expect(d2.average).toBeCloseTo((4 + 2 + 4 + 4) / 4, 5);
    expect(r.naCount).toBe(1);
  });
  it('精簡版只算精簡版題目', () => {
    const r = buildCompassResult(allAnswers(3), CONFIG, { form: 'short' });
    expect(r.minScore).toBe(9);
    expect(r.dimensions.find((d) => d.id === 'd1').answered).toBe(4);
  });
  it('未作答時不產生 NaN', () => {
    const r = buildCompassResult({}, CONFIG);
    expect(r.dimensions.every((d) => Number.isFinite(d.average) && Number.isFinite(d.percent))).toBe(true);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.complete).toBe(false);
  });
});

describe('張力指標', () => {
  const fc = selectForm(CONFIG, 'full');
  it('分類邊界', () => {
    expect(classifyTension(4, 4)).toBe('both_high');
    expect(classifyTension(3.5, 3.5)).toBe('both_high');
    expect(classifyTension(2, 2)).toBe('both_low');
    expect(classifyTension(2.4, 2.4)).toBe('both_low');
    expect(classifyTension(4.5, 3.0)).toBe('lean_a');
    expect(classifyTension(2.0, 3.4)).toBe('lean_b');
    expect(classifyTension(3.5, 3.0)).toBe('moderate');
    expect(classifyTension(3.0, 3.0)).toBe('moderate');
  });
  it('計算強度、偏態、平衡度', () => {
    const ans = { ...allAnswers(3), a1: 5, a2: 5, a3: 5, a4: 1, a5: 1, a6: 1 };
    const [t] = computeTensions(ans, fc);
    expect(t.a).toBe(5);
    expect(t.b).toBe(1);
    expect(t.strength).toBe(3);
    expect(t.skew).toBe(4);
    expect(t.balance).toBe(0);
    expect(t.type).toBe('lean_a');
    expect(t.lowConfidence).toBe(false);
  });
  it('完全平衡', () => {
    const [t] = computeTensions(allAnswers(4), fc);
    expect(t.balance).toBe(1);
    expect(t.type).toBe('both_high');
  });
  it('精簡版每端 2 題：可算，不算低信心；任一端無題則 unavailable', () => {
    const [t] = computeTensions(allAnswers(4), selectForm(CONFIG, 'short'));
    expect(t.countA).toBe(2);
    expect(t.lowConfidence).toBe(false);
    const [none] = computeTensions({ a1: 4, a2: 4, a3: 4 }, fc);
    expect(none.available).toBe(false);
    expect(none.balance).toBeNull();
  });
  it('每組張力兩端題數相等（設定完整性）', () => {
    CONFIG.TENSIONS.forEach((t) => {
      const dim = CONFIG.DIMENSIONS.find((d) => d.id === t.dimensionId);
      expect(dim.questions.filter((x) => x.pole === t.poleA).length)
        .toBe(dim.questions.filter((x) => x.pole === t.poleB).length);
    });
  });
});

describe('落差', () => {
  it('分類邊界', () => {
    expect(classifyGap(0.8)).toBe('blind_spot');
    expect(classifyGap(0.79)).toBe('aligned');
    expect(classifyGap(-0.8)).toBe('hidden_strength');
    expect(classifyGap(0)).toBe('aligned');
  });
  const self = allAnswers(5);
  const rater = (v) => allAnswers(v);
  it('他評者不足 3 位 → 不給任何數字', () => {
    const g = computeGaps({ selfAnswers: self, othersAnswers: [rater(3), rater(3)], config: CONFIG });
    expect(g.available).toBe(false);
    expect(g.dimensions).toEqual([]);
    expect(g.index).toBeNull();
  });
  it('達 3 位 → 計算各構面落差與整體指數', () => {
    const g = computeGaps({ selfAnswers: self, othersAnswers: [rater(3), rater(3), rater(3)], config: CONFIG });
    expect(g.available).toBe(true);
    const d1 = g.dimensions.find((d) => d.id === 'd1');
    expect(d1.gap).toBeCloseTo(2, 5);
    expect(d1.type).toBe('blind_spot');
    expect(g.index).toBeGreaterThan(0);
  });
  it('未完成的他評不計入人數', () => {
    const broken = { ...rater(3), a1: undefined };
    const g = computeGaps({ selfAnswers: self, othersAnswers: [rater(3), rater(3), broken], config: CONFIG });
    expect(g.available).toBe(false);
    expect(g.raters).toBe(2);
  });
  it('自評完整版、他評精簡版 → 用 short 比較', () => {
    const shortOnly = (v) => Object.fromEntries(selectForm(CONFIG, 'short').ALL_QUESTIONS.map((x) => [x.id, v]));
    const g = computeGaps({ selfAnswers: self, othersAnswers: [shortOnly(3), shortOnly(3), shortOnly(3)], config: CONFIG, form: 'short' });
    expect(g.available).toBe(true);
  });
});

describe('評分者彙整與匿名門檻', () => {
  const R = (raterType, v = 3) => ({ raterType, answers: allAnswers(v) });
  it('同類 ≥3 位才單獨顯示；不足併入合計，合計仍須 ≥3 位', () => {
    const a = aggregateRaters([R('peer'), R('peer'), R('subordinate'), R('subordinate')], CONFIG);
    expect(a.byType.peer.shown).toBe(false);
    expect(a.byType.peer.dimensions).toBeNull();
    expect(a.byType.subordinate.shown).toBe(false);
    expect(a.combined.count).toBe(4);
    expect(a.combined.shown).toBe(true);
  });
  it('合計不足 3 位 → 隱藏並標明原因', () => {
    const a = aggregateRaters([R('peer'), R('subordinate')], CONFIG);
    expect(a.combined.shown).toBe(false);
    expect(a.combined.reason).toBe('not_enough_raters');
    expect(a.combined.dimensions).toBeNull();
  });
  it('同類 3 位 → 單獨顯示', () => {
    const a = aggregateRaters([R('peer', 2), R('peer', 3), R('peer', 4)], CONFIG);
    expect(a.byType.peer.shown).toBe(true);
    expect(a.byType.peer.dimensions.find((d) => d.id === 'd1').average).toBeCloseTo(3, 5);
  });
  it('上級預設不併入合計，且標記需受評者同意', () => {
    const a = aggregateRaters([R('peer'), R('peer'), R('manager')], CONFIG);
    expect(a.combined.count).toBe(2);
    expect(a.combined.shown).toBe(false);
    expect(a.byType.manager.requiresConsent).toBe(true);
    expect(a.byType.manager.shown).toBe(false);
    const b = aggregateRaters([R('peer'), R('peer'), R('manager')], CONFIG, { includeManager: true });
    expect(b.combined.shown).toBe(true);
  });
  it('輸出不含任何評分者身分', () => {
    const a = aggregateRaters([{ raterType: 'peer', userId: 'u1', userName: '王小明', answers: allAnswers(3) }, R('peer'), R('peer')], CONFIG);
    expect(JSON.stringify(a)).not.toMatch(/u1|王小明/);
  });
  it('未完成的評分者不計入', () => {
    const a = aggregateRaters([R('peer'), R('peer'), { raterType: 'peer', answers: {} }], CONFIG);
    expect(a.byType.peer.count).toBe(2);
  });
});

describe('性質檢查：隨機缺漏／無法判斷下平均仍落在 1–5', () => {
  it('1000 次隨機作答', () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let i = 0; i < 1000; i += 1) {
      const ans = {};
      fullIds.forEach((id) => {
        const r = rnd();
        ans[id] = r < 0.15 ? undefined : r < 0.3 ? NA_VALUE : 1 + Math.floor(rnd() * 5);
      });
      const res = buildCompassResult(ans, CONFIG, { rater: 'other' });
      res.dimensions.forEach((d) => {
        expect(Number.isFinite(d.average)).toBe(true);
        if (d.answered > 0) {
          expect(d.average).toBeGreaterThanOrEqual(1);
          expect(d.average).toBeLessThanOrEqual(5);
        }
      });
      res.tensions.forEach((t) => {
        if (t.available) {
          expect(t.balance).toBeGreaterThanOrEqual(0);
          expect(t.balance).toBeLessThanOrEqual(1);
        }
      });
    }
  });
});

describe('相容性', () => {
  it('不修改既有 scoring.js 的行為：舊模組仍可獨立 import', async () => {
    const mod = await import('../survey/utils/scoring.js');
    expect(typeof mod.buildResult).toBe('function');
  });
  it('THRESHOLDS 為暫定值且集中管理', () => {
    expect(THRESHOLDS.minRatersPerType).toBe(3);
    expect(THRESHOLDS.gap).toBe(0.8);
  });
  it('computeDimensions 對空作答回傳 0 而非 NaN', () => {
    const dims = computeDimensions({}, selectForm(CONFIG, 'full'));
    expect(dims.every((d) => d.average === 0)).toBe(true);
  });
});
