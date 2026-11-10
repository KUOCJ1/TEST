import { describe, it, expect } from 'vitest';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';
import { build360Report, GAP_THRESHOLD } from '../survey/utils/report360.js';

const config = getAssessment('leadership-360-70');

// 每題給 base，指定構面給 dimValue。
const resultOf = (base, dimValues = {}) => buildResult(
  Object.fromEntries(config.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, dimValues[d.id] ?? base]))),
  config,
);
let n = 0;
const sub = (userId, raterType, result, extra = {}) => ({ id: `s${++n}`, userId, rateeId: 'ratee', raterType, createdAt: new Date(2026, 10, 1, 0, n).toISOString(), result, ...extra });

describe('build360Report', () => {
  const subs = [
    sub('ratee', 'self', resultOf(4, { communication: 5, execution: 2 })),
    sub('m1', 'manager', resultOf(3, { communication: 3, execution: 4 })),
    sub('s1', 'subordinate', resultOf(4)),
    sub('s2', 'subordinate', resultOf(4)),
    sub('s3', 'subordinate', resultOf(5)),
  ];
  const r = build360Report(subs, config);

  it('沒有資料或沒有設定時回 null', () => {
    expect(build360Report([], config)).toBeNull();
    expect(build360Report(subs, null)).toBeNull();
  });

  it('評分者組成：自評 1、主管 1、部屬 3；他評合計平均 = 每位評分者等權重', () => {
    expect(r.hasSelf).toBe(true);
    expect(r.counts).toEqual({ manager: 1, peer: 0, subordinate: 3 });
    expect(r.othersCount).toBe(4);
    const comm = r.dimensions.find((d) => d.id === 'communication');
    expect(comm.manager).toBe(3);
    expect(comm.subordinate).toBeCloseTo((4 + 4 + 5) / 3, 5);
    expect(comm.others).toBeCloseTo((3 + 4 + 4 + 5) / 4, 5);
    expect(comm.peer).toBeNull();
  });

  it('差距＝自評 − 他評合計；≥ 0.5 是盲點、≤ −0.5 是被低估的優勢', () => {
    const byId = Object.fromEntries(r.dimensions.map((d) => [d.id, d]));
    expect(byId.communication.gap).toBeCloseTo(5 - 4, 1);
    expect(byId.communication.kind).toBe('blind');
    expect(byId.execution.kind).toBe('hidden'); // 自評 2、他評 (4+4+4+5)/4
    expect(byId.collaboration.kind).toBe('aligned');
    expect(GAP_THRESHOLD).toBe(0.5);
    expect(r.blind.map((d) => d.id)).toContain('communication');
    expect(r.hidden.map((d) => d.id)).toContain('execution');
  });

  it('同一位評分者重複送出只取最新一筆；每個構面有子能力的自評與他評', () => {
    const again = build360Report([...subs, sub('m1', 'manager', resultOf(5, { communication: 5 }))], config);
    expect(again.counts.manager).toBe(1);
    expect(again.dimensions.find((d) => d.id === 'communication').manager).toBe(5);
    const comm = r.dimensions.find((d) => d.id === 'communication');
    expect(comm.subs.map((s) => s.id)).toEqual(['listening', 'processing', 'expressing']);
    expect(comm.subs.every((s) => typeof s.self === 'number' && typeof s.others === 'number')).toBe(true);
  });

  it('整體評價：他人眼中的強項與優先發展各 3 個；有整體評語、每個構面有敘事、有發展建議', () => {
    expect(r.basis).toBe('others');
    expect(r.strengths).toHaveLength(3);
    expect(r.develop).toHaveLength(3);
    expect(r.strengths[0].others).toBeGreaterThanOrEqual(r.strengths[2].others);
    expect(r.summaryText).toMatch(/「/);
    expect(r.summaryText).not.toMatch(/九大/);
    expect(Object.keys(r.narratives)).toHaveLength(8);
    expect(Object.values(r.narratives).every((t) => t.length > 10)).toBe(true);
    expect(r.plan.length).toBeGreaterThanOrEqual(2);
  });

  it('他評落點用本題庫的等級門檻；自評與他評總分都有', () => {
    expect(r.self.total).toBeGreaterThan(0);
    expect(r.othersSummary.level.id).toBeTruthy();
    expect(r.othersSummary.total).toBeGreaterThanOrEqual(config.MIN_SCORE);
  });

  it('只有自評：報告仍可產出，以自評為依據', () => {
    const only = build360Report([sub('ratee', 'self', resultOf(4))], config);
    expect(only.hasOthers).toBe(false);
    expect(only.basis).toBe('self');
    expect(only.blind).toEqual([]);
    expect(only.dimensions.every((d) => d.kind === 'unknown')).toBe(true);
  });

  it('只有他評（沒有自評）：以他評為依據，不產生差距', () => {
    const only = build360Report([sub('m1', 'manager', resultOf(4))], config);
    expect(only.hasSelf).toBe(false);
    expect(only.basis).toBe('others');
    expect(only.dimensions.every((d) => d.gap === null)).toBe(true);
  });

  it('沒有作答的構面（平均 0）不列入報告：不是強項、不是優先發展、不產生差距', () => {
    // 模擬「問卷沒有這個構面的題目」：該構面的平均與子能力平均都是 0。
    const blank = (result, ids) => ({
      ...result,
      dimensions: result.dimensions.map((d) => (ids.includes(d.id) ? { ...d, average: 0, score: 0, subs: d.subs.map((x) => ({ ...x, average: 0 })) } : d)),
    });
    const ids = ['self-development', 'adaptive-innovation'];
    const partial = build360Report([
      sub('ratee', 'self', blank(resultOf(4), ids)),
      sub('m1', 'manager', blank(resultOf(3), ids)),
    ], config);
    expect(partial.dimensions.map((d) => d.id)).not.toContain('self-development');
    expect(partial.dimensions.map((d) => d.id)).not.toContain('adaptive-innovation');
    expect(partial.dimensions).toHaveLength(6);
    const all = [...partial.strengths, ...partial.develop, ...partial.blind, ...partial.hidden].map((d) => d.id);
    for (const id of ids) expect(all).not.toContain(id);
    expect(Object.keys(partial.narratives)).not.toContain('self-development');
    expect(partial.develop.every((d) => d.others > 0)).toBe(true);
  });
});

describe('build360Report 的 framework（報告最前面的評量項目與評估方式）', () => {
  it('只列有資料的構面，含定義、子能力、題數；題數合計＝題庫總題數', async () => {
    const { getAssessment } = await import('../survey/data/assessments/index.js');
    const { buildResult } = await import('../survey/utils/scoring.js');
    const cfg = getAssessment('leadership-360-70');
    const answers = Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, 4]));
    const r = build360Report([{ userId: 'u', raterType: 'self', createdAt: '2026-11-01T00:00:00Z', result: buildResult(answers, cfg) }], cfg);
    const f = r.framework;
    expect(f.dimensions).toHaveLength(8);
    expect(f.itemCount).toBe(cfg.TOTAL_QUESTIONS);
    f.dimensions.forEach((d) => { expect(d.definition, d.id).toBeTruthy(); expect(d.subs.length).toBeGreaterThan(0); expect(d.items).toBeGreaterThan(0); });
    expect(f.dimensions.find((d) => d.id === 'adaptive-innovation').subs).toEqual(['因應環境變化', '創新思考']);
    expect(f.scale).toMatchObject({ min: 1, max: 5 });
    expect(f.scale.labels).toHaveLength(5);
    expect(f.levels.length).toBeGreaterThan(0);
    expect(f.gapThreshold).toBe(0.5);
  });
  it('L9D 的 9 個構面都有定義；沒有作答（沒有題目）的構面不列入', async () => {
    const L9D = await import('../survey/data/assessments/leadership-9d.js');
    L9D.DIMENSIONS.forEach((d) => expect(L9D.DIMENSION_DEFINITIONS[d.id], d.id).toBeTruthy());
  });
});

describe('build360Report：子能力排名、評分者群組差距、參考區間', () => {
  const build = async () => {
    const { getAssessment } = await import('../survey/data/assessments/index.js');
    const { buildResult } = await import('../survey/utils/scoring.js');
    const { REF_BAND, GROUP_GAP_DIM, GROUP_GAP_SUB } = await import('../survey/utils/report360.js');
    const cfg = getAssessment('leadership-360-70');
    const by = (value) => buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, typeof value === 'function' ? value(q) : value])), cfg);
    const mk = (raterType, userId, value) => ({ userId, raterType, createdAt: '2026-11-01T00:00:00Z', result: by(value) });
    return { cfg, mk, REF_BAND, GROUP_GAP_DIM, GROUP_GAP_SUB, report: (subs) => build360Report(subs, cfg) };
  };
  it('參考區間＝3.5–4.5（子能力語句「中」段）', async () => {
    const { REF_BAND } = await build();
    expect(REF_BAND).toEqual({ min: 3.5, max: 4.5 });
  });
  it('子能力排名：由高到低、共 18 個；≥ 3.5 為強項區、< 3.5 為發展機會區', async () => {
    const { cfg, mk, report } = await build();
    const lowIds = new Set(cfg.DIMENSIONS.find((d) => d.id === 'communication').questions.map((q) => q.id));
    expect(report([mk('self', 'r', 4)]).subRanking.all).toHaveLength(18);
    const { buildResult } = await import('../survey/utils/scoring.js');
    const mixed = (q) => (lowIds.has(q.id) ? 2 : 5);
    const r2 = report([
      { userId: 'r', raterType: 'self', createdAt: '2026-11-01T00:00:00Z', result: buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, 4])), cfg) },
      { userId: 'm', raterType: 'manager', createdAt: '2026-11-01T00:00:00Z', result: buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, mixed(q)])), cfg) },
    ]);
    const vals = r2.subRanking.all.map((s) => s.value);
    expect([...vals].sort((a, b) => b - a)).toEqual(vals);
    expect(r2.subRanking.opportunities.map((s) => s.dimId)).toEqual(['communication', 'communication', 'communication']);
    expect(r2.subRanking.strengths).toHaveLength(15);
    expect(r2.subRanking.all[0].band).toBe('high');
    expect(r2.subRanking.all.at(-1).band).toBe('low');
  });
  it('只有自評時，排名以自評為依據', async () => {
    const { mk, report } = await build();
    const r = report([mk('self', 'r', 4)]);
    expect(r.subRanking.all.every((s) => s.value === s.self)).toBe(true);
  });
  it('評分者群組差距：構面 ≥ 1.0、子能力 ≥ 1.5 才標；各類子能力平均都有', async () => {
    const { cfg, mk, report } = await build();
    const wide = report([mk('self', 'r', 5), mk('manager', 'm', 3), mk('subordinate', 's', 4)]);
    const d = wide.dimensions[0];
    expect(d.spread).toBe(2);
    expect(d.wideSpread).toBe(true);
    expect(d.subs[0]).toMatchObject({ manager: 3, subordinate: 4, peer: null, self: 5 });
    expect(d.subs[0].spread).toBe(2);
    expect(d.subs[0].wideSpread).toBe(true);
    const narrow = report([mk('self', 'r', 4), mk('manager', 'm', 3)]);
    expect(narrow.dimensions[0].spread).toBe(1);
    expect(narrow.dimensions[0].wideSpread).toBe(true); // 剛好 1.0 → 標
    expect(narrow.dimensions[0].subs[0].wideSpread).toBe(false); // 1.0 < 1.5
    expect(cfg.DIMENSIONS.length).toBe(8);
  });
  it('只有自評（沒有其他群組）：差距為 null、不標', async () => {
    const { mk, report } = await build();
    const r = report([mk('self', 'r', 4)]);
    expect(r.dimensions[0].spread).toBeNull();
    expect(r.dimensions[0].wideSpread).toBe(false);
  });
});
