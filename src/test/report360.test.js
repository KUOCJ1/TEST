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
