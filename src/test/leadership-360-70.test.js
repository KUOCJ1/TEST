import { describe, it, expect } from 'vitest';
import { getAssessment } from '../survey/data/assessments/index.js';
import * as L9D from '../survey/data/assessments/leadership-9d.js';
import { buildResult, computeTotalScore } from '../survey/utils/scoring.js';
import { buildNarrative, buildOverallSummary } from '../survey/utils/narrative.js';
import { startersFor, GENERIC_STARTERS } from '../survey/data/goal-starters.js';

const config = getAssessment('leadership-360-70');
const fill = (v) => Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, v]));

describe('領導力 360° 行為評量（70 題）：沿用 L9D 框架', () => {
  it('70 題，題號 l1–l70 不重複且連續（與客戶表單的題號一一對應）；沒有反向題', () => {
    expect(config.TOTAL_QUESTIONS).toBe(70);
    expect(config.ALL_QUESTIONS.map((q) => Number(q.id.slice(1))).sort((a, b) => a - b)).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
    expect(config.ALL_QUESTIONS.every((q) => q.reversed === false)).toBe(true);
  });

  it('構面：L9D 的 7 個構面（名稱、子能力、顏色都與 L9D 相同）＋額外的「應變與創新」；沒有思辨與決策、接班成熟度', () => {
    const ids = config.DIMENSIONS.map((d) => d.id);
    expect(ids).toEqual(['communication', 'collaboration', 'task-management', 'execution', 'leadership-impact', 'developing-others', 'self-development', 'adaptive-innovation']);
    expect(ids).not.toContain('succession-readiness');
    expect(ids).not.toContain('critical-thinking');
    for (const d of config.DIMENSIONS.filter((x) => x.id !== 'adaptive-innovation')) {
      const base = L9D.DIMENSIONS.find((x) => x.id === d.id);
      expect([d.name, d.subtitle, d.color, d.layer]).toEqual([base.name, base.subtitle, base.color, base.layer]);
      for (const s of d.subDimensions) expect(base.subDimensions.find((b) => b.id === s.id)?.name, `${d.id}/${s.id}`).toBe(s.name);
    }
  });

  it('題號區塊與 L9D 子能力的對照（抽查區塊邊界）', () => {
    const subOf = (n) => config.ALL_QUESTIONS.find((q) => q.id === `l${n}`).subId;
    expect([1, 4, 5, 8, 9, 12].map(subOf)).toEqual(['listening', 'listening', 'processing', 'processing', 'expressing', 'expressing']);
    expect([13, 17, 18, 21, 22, 26].map(subOf)).toEqual(['trust', 'trust', 'direction', 'direction', 'delegation', 'delegation']);
    expect([27, 29, 30, 33].map(subOf)).toEqual(['adapting', 'adapting', 'innovating', 'innovating']);
    expect([34, 38, 39, 43].map(subOf)).toEqual(['build-relations', 'build-relations', 'lead-team', 'lead-team']);
    expect([44, 47, 48, 50, 51, 54, 55, 57].map(subOf)).toEqual(['efficiency', 'efficiency', 'competence', 'competence', 'take-action', 'take-action', 'create-results', 'create-results']);
    expect([58, 61, 62, 64, 65, 67, 68, 70].map(subOf)).toEqual(['cultivate', 'cultivate', 'motivate', 'motivate', 'commitment', 'commitment', 'improvement', 'improvement']);
  });

  it('每題的子能力都在所屬構面內；每個子能力至少有一題', () => {
    for (const d of config.DIMENSIONS) {
      const sub = new Set(d.subDimensions.map((s) => s.id));
      for (const q of d.questions) expect(sub.has(q.subId), `${q.id} → ${q.subId}`).toBe(true);
      for (const s of d.subDimensions) expect(d.questions.some((q) => q.subId === s.id), `${d.id}/${s.id}`).toBe(true);
    }
  });

  it('題目文字與客戶表單一致（抽查）', () => {
    const text = (id) => config.ALL_QUESTIONS.find((q) => q.id === id).text;
    expect(text('l1')).toBe('向他人徵求想法、意見與建議');
    expect(text('l13')).toBe('能夠準備好目前工作相關資訊，讓相關人員可以使用');
    expect(text('l60')).toBe('能針對他人的優勢及需求提供客觀的評價');
    expect(text('l70')).toBe('能找出並追蹤改善績效的資源');
  });

  it('等級沿用 L9D 的四級（id、名稱、顏色），門檻是 70–350 的 50%／70%／90%，涵蓋每個可能的總分', () => {
    expect(config.LEVELS.map((l) => [l.id, l.badge, l.color])).toEqual(L9D.LEVELS.map((l) => [l.id, l.badge, l.color]));
    expect(config.LEVELS.map((l) => [l.min, l.max])).toEqual([[70, 175], [176, 245], [246, 315], [316, 350]]);
    for (let t = config.MIN_SCORE; t <= config.MAX_SCORE; t++) {
      expect(config.LEVELS.filter((l) => t >= l.min && t <= l.max), `總分 ${t}`).toHaveLength(1);
    }
    expect(config.LEVELS.some((l) => /九大構面|接班成熟度/.test(l.desc + l.advice))).toBe(false);
  });

  it('是 360° 題庫、已公開（會列在評測工具庫）；圈層沿用 L9D 且不含不存在的構面', () => {
    expect(config.SUPPORTS_360).toBe(true);
    expect(config.LIBRARY_HIDDEN).toBeUndefined();
    expect(config.NAME).toBe('經贏® 領導力八大構面行為評量（70 題）');
    const all = config.LAYERS.flatMap((l) => l.dimensions).sort();
    expect(all).toEqual(config.DIMENSIONS.map((d) => d.id).sort());
  });

  it('計分：全部 4 分 → 280 分、各構面平均 4、落點「領導精熟期」；全部 5 分 → 350、「卓越領導者」', () => {
    expect(computeTotalScore(fill(4), config)).toBe(280);
    const r = buildResult(fill(4), config);
    expect(r.level.id).toBe('proficient');
    expect(r.dimensions).toHaveLength(8);
    expect(r.dimensions.every((d) => d.average === 4)).toBe(true);
    expect(buildResult(fill(5), config).level.id).toBe('leader');
  });

  it('敘事報告：每個子能力都有評語，產生報告不會出錯（含額外的兩個子能力）', () => {
    const r = buildResult(fill(4), config);
    for (const d of r.dimensions) {
      expect(() => buildNarrative(d, config, r.total), d.id).not.toThrow();
      expect(buildNarrative(d, config, r.total)).toBeTruthy();
    }
    expect(buildOverallSummary(r, config, r.total)).toBeTruthy();
  });

  it('每個構面都有專屬的起手行動範例', () => {
    for (const d of config.DIMENSIONS) expect(startersFor(config.ID, d.id), d.id).not.toBe(GENERIC_STARTERS);
  });
});
