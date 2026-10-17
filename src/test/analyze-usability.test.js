import { describe, it, expect } from 'vitest';
import { analyzeUsability, renderUsabilityReport, THRESHOLDS } from '../../scripts/analyze-usability.mjs';

const r = (who, task, result, seconds, errors = 0, issue = '', severity = '', quote = '') => ({ 受測者代號: who, 角色: '學員', 裝置: '桌機', 任務: task, 結果: result, 耗時秒: String(seconds), 錯誤次數: String(errors), 卡關描述: issue, 原話: quote, 嚴重度: String(severity) });

describe('analyzeUsability', () => {
  it('計算各任務的完成情形、完成率與耗時中位數', () => {
    const a = analyzeUsability([
      r('P1', 'T1', '完成', 100), r('P2', 'T1', '完成', 200), r('P3', 'T1', '協助後完成', 300, 2), r('P4', 'T1', '失敗', 400, 1), r('P5', 'T1', '完成', 150),
    ]);
    const t = a.tasks[0];
    expect(t).toMatchObject({ participants: 5, pass: 3, assisted: 1, fail: 1, errors: 3, medianSeconds: 200 });
    expect(t.unaidedRate).toBeCloseTo(0.6);
    expect(t.belowThreshold).toBe(true);
  });
  it('達標與未達標；沒有資料的欄位不會產生 NaN', () => {
    const ok = analyzeUsability([r('P1', 'T2', '完成', ''), r('P2', 'T2', '完成', ''), r('P3', 'T2', '完成', ''), r('P4', 'T2', '完成', ''), r('P5', 'T2', '協助後完成', '')]);
    expect(ok.tasks[0].unaidedRate).toBeCloseTo(0.8);
    expect(ok.tasks[0].belowThreshold).toBe(false);
    expect(ok.tasks[0].medianSeconds).toBeNull();
    expect(THRESHOLDS.successRate).toBe(0.8);
  });
  it('問題清單：相同描述合併，依嚴重度與人數排序', () => {
    const a = analyzeUsability([
      r('P1', 'T3', '失敗', 60, 0, '找不到說明頁', 4, '在哪裡？'),
      r('P2', 'T3', '失敗', 80, 0, '找不到說明頁', 3),
      r('P3', 'T3', '完成', 20, 0, '看不懂按鈕文字', 2),
      r('P4', 'T3', '完成', 20, 0, '', ''),
    ]);
    expect(a.issues.map((i) => i.text)).toEqual(['找不到說明頁', '看不懂按鈕文字']);
    expect(a.issues[0]).toMatchObject({ people: 2, maxSeverity: 4 });
    expect(a.issues[0].quotes).toEqual(['P1：在哪裡？']);
  });
  it('忽略沒有任務名稱的列；報告輸出表格與警示', () => {
    const a = analyzeUsability([r('P1', '', '完成', 1), r('P1', 'T1', '失敗', 10, 1, '卡住', 3)]);
    expect(a.tasks).toHaveLength(1);
    const md = renderUsabilityReport(a);
    expect(md).toContain('T1 ⚠️');
    expect(md).toContain('| 3 | 1 | T1 | 卡住 |');
    expect(renderUsabilityReport(analyzeUsability([]))).toContain('沒有記錄到問題');
  });
});
