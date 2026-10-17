import { describe, it, expect } from 'vitest';
import { parseCsv, analyzeExperts, analyzePretest, renderReport, CVI } from '../../scripts/analyze-compass-review.mjs';

const H = ['題號', '構面', '子面向', '題目（自評版）', '相關性(1-4)', '清晰度(1-4)', '像他牌題目?(是/否/不確定)', '修改建議／備註'];
const row = (id, rel, cla, sim = '否', note = '') => ({ '題號': id, '構面': '洞察情勢', '子面向': '風險預見', '題目（自評版）': `題目${id}`, '相關性(1-4)': String(rel), '清晰度(1-4)': String(cla), '像他牌題目?(是/否/不確定)': sim, '修改建議／備註': note });

describe('parseCsv', () => {
  it('支援 BOM、引號、逗號、換行與跳脫引號', () => {
    const rows = parseCsv('﻿"題號","備註"\r\n"a-1","有,逗號"\r\n"a-2","第一行\n第二行 ""引"""\r\n');
    expect(rows).toEqual([{ 題號: 'a-1', 備註: '有,逗號' }, { 題號: 'a-2', 備註: '第一行\n第二行 "引"' }]);
  });
  it('空檔案回傳空陣列', () => expect(parseCsv('')).toEqual([]));
});

describe('analyzeExperts', () => {
  const six = (rels) => rels.map((r, i) => ({ expert: `E${i}`, rows: [row('x-1', r, 4)] }));
  it('專家 ≥6 位門檻 0.78：5/6 通過、4/6 不通過', () => {
    expect(analyzeExperts(six([4, 4, 4, 4, 4, 2])).items[0].revise).toBe(false);
    const bad = analyzeExperts(six([4, 4, 4, 4, 2, 2])).items[0];
    expect(bad.revise).toBe(true);
    expect(bad.reasons.join()).toContain('相關性');
  });
  it('專家少於 6 位：門檻為 1.0（有一位評低就標記）', () => {
    const r = analyzeExperts([{ expert: 'a', rows: [row('x-1', 4, 4)] }, { expert: 'b', rows: [row('x-1', 2, 4)] }]);
    expect(r.threshold).toBe(CVI.strictItemMin);
    expect(r.items[0].revise).toBe(true);
  });
  it('清晰度不足、像他牌題目（是／不確定）會被標記，並收集意見', () => {
    const r = analyzeExperts([
      { expert: 'a', rows: [row('x-1', 4, 2, '是', '像某某量表')] },
      { expert: 'b', rows: [row('x-1', 4, 2, '不確定'), row('x-2', 4, 4)] },
    ]);
    const x1 = r.items.find((i) => i.id === 'x-1');
    expect(x1.reasons.join()).toContain('清晰度');
    expect(x1.reasons.join()).toContain('像他牌題目');
    expect(x1.notes[0]).toContain('像某某量表');
    expect(r.items.find((i) => i.id === 'x-2').revise).toBe(false);
  });
  it('沒有評分時標記，S-CVI 為各題平均', () => {
    expect(analyzeExperts([{ expert: 'a', rows: [{ 題號: 'x-1' }] }]).items[0].reasons[0]).toContain('沒有任何專家');
    const r = analyzeExperts(six([4, 4, 4, 4, 4, 4]));
    expect(r.sCviRelevance).toBe(1);
  });
});

describe('analyzePretest', () => {
  const p = (id, who, codes, extra = {}) => ({ '題號': id, '受訪者代號': who, '構面': '洞察情勢', '題目（自評版）': `題目${id}`, '問題代碼(A-I，可複選)': codes, '複述是否符合原意(是/部分/否)': '是', '原話摘錄': '', '建議修法': '', ...extra });
  it('同一題 2 位以上出現 A/B/C/G → 必改；1 位 → 觀察', () => {
    const r = analyzePretest([p('a', 'P1', 'A'), p('a', 'P2', 'B'), p('a', 'P3', ''), p('b', 'P1', 'G'), p('c', 'P1', '')]);
    const a = r.items.find((i) => i.id === 'a');
    expect(a.mustFix).toBe(false); // A×1、B×1：各只有一位
    expect(a.watch).toBe(true);
    const r2 = analyzePretest([p('a', 'P1', 'A'), p('a', 'P2', 'A, C')]);
    expect(r2.items[0].mustFix).toBe(true);
    expect(r2.items[0].reasons[0]).toContain('A×2');
    expect(r.items.find((i) => i.id === 'b').watch).toBe(true);
    expect(r.items.find((i) => i.id === 'c').reasons).toEqual([]);
  });
  it('D、E、H 兩位以上各有處理建議', () => {
    const r = analyzePretest([p('d', 'P1', 'D'), p('d', 'P2', 'D'), p('e', 'P1', 'E'), p('e', 'P2', 'E'), p('h', 'P1', 'H'), p('h', 'P2', 'H')]);
    expect(r.items.find((i) => i.id === 'd').reasons.join()).toContain('不適用');
    expect(r.items.find((i) => i.id === 'e').reasons.join()).toContain('社會期許');
    expect(r.items.find((i) => i.id === 'h').reasons.join()).toContain('observability: low');
  });
  it('同一位受訪者重複標同一代碼只算一位；忽略沒有代號或題號的列', () => {
    const r = analyzePretest([p('a', 'P1', 'A'), p('a', 'P1', 'A'), p('', 'P2', 'A'), p('a', '', 'A')]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].count.A).toBe(1);
  });
  it('蒐集原話與建議修法，複述不符原意計數', () => {
    const r = analyzePretest([p('a', 'P1', 'B', { '原話摘錄': '我以為是預算', '建議修法': '改成權限', '複述是否符合原意(是/部分/否)': '否' })]);
    expect(r.items[0].quotes[0]).toContain('P1：我以為是預算');
    expect(r.items[0].suggestions).toEqual(['改成權限']);
    expect(r.items[0].paraphraseOff).toBe(1);
  });
});

describe('renderReport', () => {
  it('產出含表格的 Markdown，且沒有標記時顯示「沒有題目被標記」', () => {
    const experts = analyzeExperts([{ expert: 'a', rows: [row('x-1', 4, 4)] }]);
    const md = renderReport({ experts, pretest: analyzePretest([]) });
    expect(md).toContain('專家內容效度');
    expect(md).toContain('沒有題目被標記');
    const bad = renderReport({ experts: analyzeExperts([{ expert: 'a', rows: [row('x-1', 1, 4)] }]) });
    expect(bad).toContain('| x-1 |');
  });
});
