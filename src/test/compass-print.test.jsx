import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import PrintableReport, { ReportPages } from '../survey/components/PrintableReport.jsx';
import CompassGroupPrintable from '../survey/coach/CompassGroupPrintable.jsx';
import CompassGroupReport from '../survey/coach/CompassGroupReport.jsx';
import * as compass from '../survey/data/assessments/leadership-compass.js';
import { buildCompassGroupReport } from '../survey/utils/compassGroup.js';
import { fireEvent, screen } from '@testing-library/react';

vi.mock('../survey/api/client', () => ({ api: {} }));

const resultOf = (fn, form = 'full') => {
  const view = compass.selectForm(form);
  const ans = Object.fromEntries(view.ALL_QUESTIONS.map((q, i) => [q.id, fn(q, i)]));
  return compass.SCORING.buildResult(ans, view);
};
const varied = (q, i) => (i % 5) + 1;

describe('雙環領導羅盤：個人列印報告', () => {
  it('使用專屬版面：不出現總分、達成率、百分位排名，但有八構面、張力、人機協作與解讀', () => {
    const { container } = render(<ReportPages result={resultOf(varied)} user={{ name: '王小明' }} submittedAt="2026-10-17T00:00:00Z" benchmark={{ totals: [100, 200, 300], count: 3, dimensionAverages: [] }} />);
    const text = container.textContent;
    expect(text).toContain('王小明');
    expect(text).toContain('雙環領導羅盤八大構面評測');
    expect(text).not.toMatch(/總得分|能力達成率|百分位|超越/);
    ['洞察情勢', '聚焦應變', '知人授權', '凝聚帶動', '敏捷學習', '穩定當責', '識才育才', '傳承留能'].forEach((n) => expect(text).toContain(n));
    expect(text).toContain('四組張力');
    expect(text).toContain('人機協作剖面');
    expect(text).toContain('各構面的解讀');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('教練回饋有留言時多一頁，沒有時不出現', () => {
    const r = resultOf(varied);
    const none = render(<ReportPages result={r} user={{ name: 'A' }} submittedAt="2026-10-17T00:00:00Z" />);
    expect(none.container.textContent).not.toContain('教練回饋');
    none.unmount();
    const withC = render(<ReportPages result={r} user={{ name: 'A' }} submittedAt="2026-10-17T00:00:00Z" comments={[{ id: 'c1', coachName: '王教練', text: '很棒的輪廓', tips: ['試試每週一次回饋'] }]} />);
    expect(withC.container.textContent).toContain('王教練');
    expect(withC.container.textContent).toContain('很棒的輪廓');
  });

  it('精簡版也能列印，並標示版本', () => {
    const { container } = render(<ReportPages result={resultOf(varied, 'short')} user={{ name: 'A' }} submittedAt="2026-10-17T00:00:00Z" />);
    expect(container.textContent).toContain('精簡版（32 題）');
  });

  it('沒有作答也不會當掉', () => {
    const { container } = render(<ReportPages result={compass.SCORING.buildResult({}, compass.selectForm('full'))} user={{ name: 'A' }} submittedAt="2026-10-17T00:00:00Z" />);
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });
});

describe('PrintableReport 工具列', () => {
  beforeEach(() => { const p = document.createElement('div'); p.id = 'report-portal'; document.body.appendChild(p); });
  afterEach(() => { document.getElementById('report-portal')?.remove(); });
  it('羅盤不顯示「超越 N% 填答者」', () => {
    render(<PrintableReport result={resultOf(varied)} user={{ name: 'A' }} submittedAt="2026-10-17T00:00:00Z" benchmark={{ totals: [100, 200, 300], count: 3 }} onClose={() => {}} />);
    expect(document.getElementById('report-portal').textContent).not.toMatch(/超越/);
  });
});

describe('班級組織診斷列印版沿用匿名分級', () => {
  beforeEach(() => { const p = document.createElement('div'); p.id = 'report-portal'; document.body.appendChild(p); });
  afterEach(() => { document.getElementById('report-portal')?.remove(); });
  const results = (n) => Array.from({ length: n }, (_, i) => resultOf((q, j) => ((i + j) % 5) + 1));
  const printText = (n) => {
    render(<CompassGroupPrintable report={buildCompassGroupReport(results(n), 10)} group={{ name: '甲班' }} phaseLabel="課後" onClose={() => {}} />);
    return document.getElementById('report-portal').textContent;
  };

  it('少於 3 位：只有完成率，沒有分數', () => {
    const t = printText(2);
    expect(t).toContain('暫不顯示分數與統計');
    expect(t).not.toContain('八構面平均');
  });
  it('3–4 位：只有平均，沒有張力分布', () => {
    const t = printText(4);
    expect(t).toContain('八構面平均');
    expect(t).toContain('樣本少，僅供參考');
    expect(t).not.toContain('四組張力的取向分布');
  });
  it('5 位以上：完整，且不含個人姓名', () => {
    const t = printText(6);
    expect(t).toContain('四組張力的取向分布');
    expect(t).toContain('不含任何個人資料');
  });
  it('組織診斷分頁的「列印報告」按鈕會開啟列印版', () => {
    const subs = results(6).map((r, i) => ({ id: `s${i}`, userId: `u${i}`, raterType: 'self', phase: 'pre', assessmentId: 'leadership-compass', createdAt: '2020-01-01', result: r }));
    render(<CompassGroupReport group={{ assessmentId: 'leadership-compass', name: '甲班' }} members={subs.map((s) => ({ id: s.userId }))} submissions={subs} />);
    fireEvent.click(screen.getByRole('button', { name: /列印報告/ }));
    expect(document.getElementById('report-portal').textContent).toContain('班級組織診斷報告');
  });
});
