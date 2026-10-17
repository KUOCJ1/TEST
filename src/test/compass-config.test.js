import { describe, it, expect } from 'vitest';
import * as compass from '../survey/data/assessments/leadership-compass.js';
import { REGISTRY, getAssessment } from '../survey/data/assessments/index.js';
import { selectForm } from '../survey/utils/compassScoring.js';

// 設定檔完整性：題庫由 scripts/build-compass-config.mjs 產生，這裡守住規格承諾的結構。
describe('雙環領導羅盤：題庫設定完整性', () => {
  it('已註冊，且 ID 與名稱符合決定', () => {
    expect(getAssessment('leadership-compass')).toBe(REGISTRY['leadership-compass']);
    expect(compass.NAME).toBe('雙環領導羅盤八大構面評測');
  });

  it('8 構面、四字名稱；24 個子面向皆為四字', () => {
    expect(compass.DIMENSIONS).toHaveLength(8);
    compass.DIMENSIONS.forEach((d) => {
      expect(d.name).toHaveLength(4);
      d.subDimensions.forEach((s) => expect(s.name, `${d.id}/${s.id}`).toHaveLength(4));
    });
    expect(compass.DIMENSIONS.reduce((n, d) => n + d.subDimensions.length, 0)).toBe(24);
  });

  it('完整版 69 題、精簡版 32 題，精簡版為完整版子集；題目 id 不重複', () => {
    const full = selectForm(compass, 'full');
    const short = selectForm(compass, 'short');
    expect(full.TOTAL_QUESTIONS).toBe(69);
    expect(short.TOTAL_QUESTIONS).toBe(32);
    const ids = full.ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const fullSet = new Set(ids);
    short.ALL_QUESTIONS.forEach((q) => expect(fullSet.has(q.id)).toBe(true));
  });

  it('精簡版每個構面 4 題', () => {
    const short = selectForm(compass, 'short');
    short.DIMENSIONS.forEach((d) => expect(d.questions, d.id).toHaveLength(4));
  });

  it('每題有自評與他評文字，子面向存在於所屬構面', () => {
    compass.DIMENSIONS.forEach((d) => {
      const subIds = new Set(d.subDimensions.map((s) => s.id));
      d.questions.forEach((q) => {
        expect(q.text.length).toBeGreaterThan(5);
        expect(q.textOther.length).toBeGreaterThan(5);
        expect(q.text).not.toBe(q.textOther);
        expect(subIds.has(q.subId), q.id).toBe(true);
      });
    });
  });

  it('他評文字不含第一人稱', () => {
    compass.ALL_QUESTIONS.forEach((q) => expect(q.textOther, q.id).not.toMatch(/我/));
  });

  it('每組張力兩端題數相等（完整版與精簡版皆是）', () => {
    ['full', 'short'].forEach((form) => {
      const fc = selectForm(compass, form);
      compass.TENSIONS.forEach((t) => {
        const qs = fc.DIMENSIONS.find((d) => d.id === t.dimensionId).questions;
        const a = qs.filter((q) => q.pole === t.poleA).length;
        const b = qs.filter((q) => q.pole === t.poleB).length;
        expect(a, `${form}:${t.id}`).toBeGreaterThan(0);
        expect(a, `${form}:${t.id}`).toBe(b);
      });
    });
  });

  it('反向題比例約 10–15%；人機題存在；難觀察題有標記', () => {
    const all = compass.ALL_QUESTIONS;
    const rev = all.filter((q) => q.reversed).length / all.length;
    expect(rev).toBeGreaterThanOrEqual(0.1);
    expect(rev).toBeLessThanOrEqual(0.15);
    expect(all.filter((q) => q.ai).length).toBeGreaterThanOrEqual(9);
    expect(all.filter((q) => q.observability === 'low').length).toBe(8);
  });

  it('兩個環涵蓋全部構面且各 4 個', () => {
    const all = compass.LOOPS.flatMap((l) => l.dimensionIds);
    expect(all.sort()).toEqual(compass.DIMENSIONS.map((d) => d.id).sort());
    compass.LOOPS.forEach((l) => expect(l.dimensionIds).toHaveLength(4));
  });

  it('與既有題庫沒有逐字相同的題目', () => {
    const others = Object.values(REGISTRY).filter((c) => c.ID !== compass.ID).flatMap((c) => c.ALL_QUESTIONS.map((q) => q.text));
    const set = new Set(others);
    compass.ALL_QUESTIONS.forEach((q) => expect(set.has(q.text), q.id).toBe(false));
  });
});
