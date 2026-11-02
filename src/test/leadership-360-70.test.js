import { describe, it, expect } from 'vitest';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult, computeTotalScore } from '../survey/utils/scoring.js';
import { startersFor, GENERIC_STARTERS } from '../survey/data/goal-starters.js';

const config = getAssessment('leadership-360-70');

describe('領導力 360° 行為評量（70 題）題庫', () => {
  it('70 題、10 構面，題號 l1–l70 不重複且連續（與客戶表單的題號一一對應）', () => {
    expect(config.TOTAL_QUESTIONS).toBe(70);
    expect(config.DIMENSIONS).toHaveLength(10);
    expect(config.ALL_QUESTIONS.map((q) => q.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))
      .toEqual(Array.from({ length: 70 }, (_, i) => `l${i + 1}`));
  });

  it('沒有反向題（原表單全部是正向敘述）；每題的子能力都在所屬構面內', () => {
    for (const d of config.DIMENSIONS) {
      const subIds = new Set(d.subDimensions.map((s) => s.id));
      for (const q of d.questions) {
        expect(q.reversed).toBe(false);
        if (q.subId) expect(subIds.has(q.subId), `${q.id} → ${q.subId}`).toBe(true);
      }
    }
  });

  it('題目文字與客戶表單一致（抽查首尾與有空格的題號）', () => {
    const text = (id) => config.ALL_QUESTIONS.find((q) => q.id === id).text;
    expect(text('l1')).toBe('向他人徵求想法、意見與建議');
    expect(text('l13')).toBe('能夠準備好目前工作相關資訊，讓相關人員可以使用');
    expect(text('l60')).toBe('能針對他人的優勢及需求提供客觀的評價');
    expect(text('l70')).toBe('能找出並追蹤改善績效的資源');
  });

  it('是 360° 題庫、不在公開評測工具庫、LEVELS 涵蓋 70–350 每個整數', () => {
    expect(config.SUPPORTS_360).toBe(true);
    expect(config.LIBRARY_HIDDEN).toBe(true);
    for (let t = config.MIN_SCORE; t <= config.MAX_SCORE; t++) {
      expect(config.LEVELS.filter((l) => t >= l.min && t <= l.max), `總分 ${t}`).toHaveLength(1);
    }
  });

  it('計分：全部 4 分 → 280 分、各構面平均 4、落點「成熟穩健」；全部 5 分 → 350', () => {
    const fill = (v) => Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, v]));
    expect(computeTotalScore(fill(4), config)).toBe(280);
    const r = buildResult(fill(4), config);
    expect(r.level.id).toBe('proficient');
    expect(r.dimensions).toHaveLength(10);
    expect(r.dimensions.every((d) => d.average === 4)).toBe(true);
    expect(buildResult(fill(5), config).total).toBe(350);
    expect(buildResult(fill(5), config).level.id).toBe('exemplary');
  });

  it('每個構面都有專屬的起手行動範例（不是通用範例）', () => {
    for (const d of config.DIMENSIONS) expect(startersFor(config.ID, d.id), d.id).not.toBe(GENERIC_STARTERS);
  });
});
