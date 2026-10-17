import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SurveyApp from '../survey/SurveyApp';
import ResultPanel from '../survey/components/ResultPanel';
import { ReportPages } from '../survey/components/PrintableReport.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import * as si from '../survey/data/assessments/succession-intent.js';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { stanceOf, NA_VALUE } from '../survey/utils/successionScoring.js';
import { SUCCESSION_TEXT } from '../survey/utils/successionText.js';
import { resultSummaryText } from '../survey/utils/format.js';
import { jaccard, longestCommonSubstring, THRESHOLDS } from '../../scripts/leadership-similarity.mjs';

const { createSubmission } = vi.hoisted(() => ({ createSubmission: vi.fn() }));
vi.mock('../survey/api/client', () => ({
  api: {
    createSubmission, myGroups: async () => [], mySubmissions: async () => [], learningResources: async () => [],
    myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [],
  },
}));
beforeEach(() => { localStorage.clear(); createSubmission.mockReset(); createSubmission.mockResolvedValue({ id: 's' }); });

const answersAll = (v) => Object.fromEntries(si.ALL_QUESTIONS.map((q) => [q.id, v]));
const build = (a) => si.SCORING.buildResult(a, si);

describe('接班準備度評測：設定', () => {
  it('已註冊；4 面向各 5 題共 20 題；名稱皆為四字；不支援 360°', () => {
    expect(REGISTRY['succession-intent']).toBeTruthy();
    expect(si.TOTAL_QUESTIONS).toBe(20);
    si.DIMENSIONS.forEach((d) => { expect(d.name).toHaveLength(4); expect(d.questions).toHaveLength(5); });
    expect(si.SUPPORTS_360).toBe(false);
  });
  it('每個面向有一題反向題；只有長期意向可選答', () => {
    si.DIMENSIONS.forEach((d) => expect(d.questions.filter((q) => q.reversed)).toHaveLength(1));
    si.DIMENSIONS.forEach((d) => d.questions.forEach((q) => expect(Boolean(q.optional)).toBe(d.id === 'outlook')));
  });
  it('不問家庭、婚育、年齡、性別', () => {
    si.ALL_QUESTIONS.forEach((q) => expect(q.text, q.id).not.toMatch(/家庭|婚|生育|小孩|懷孕|年齡|性別|年紀/));
  });
  it('原創：與其他題庫的題目沒有過度相似', () => {
    const others = Object.values(REGISTRY).filter((c) => c.ID !== si.ID).flatMap((c) => c.ALL_QUESTIONS.map((q) => q.text));
    si.ALL_QUESTIONS.forEach((q) => others.forEach((o) => {
      expect(jaccard(q.text, o), q.id).toBeLessThan(THRESHOLDS.jaccard);
      expect(longestCommonSubstring(q.text, o), q.id).toBeLessThan(THRESHOLDS.lcs);
    }));
  });
  it('報告文字：每個面向三個分段都有，且不含評判字眼', () => {
    si.DIMENSIONS.forEach((d) => ['high', 'mid', 'low'].forEach((b) => {
      expect(SUCCESSION_TEXT[d.id][b].length).toBeGreaterThan(40);
      expect(SUCCESSION_TEXT[d.id][b]).not.toMatch(/待強化|不及格|落後|很差|失敗|不適任|風險員工/);
    }));
  });
});

describe('接班準備度評測：計分', () => {
  it('傾向切分', () => {
    expect(stanceOf(4).label).toBe('明確');
    expect(stanceOf(3.99).label).toBe('開放');
    expect(stanceOf(3).label).toBe('開放');
    expect(stanceOf(2.99).label).toBe('保留');
  });
  it('反向題反轉；全填 5 → 反向題為 1', () => {
    const r = build(answersAll(5));
    expect(r.dimensions[0].average).toBeCloseTo((5 * 4 + 1) / 5);
  });
  it('長期意向全部「不想回答」仍算完成，且該面向不產生分數', () => {
    const a = answersAll(4);
    si.DIMENSIONS.find((d) => d.id === 'outlook').questions.forEach((q) => { a[q.id] = NA_VALUE; });
    const r = build(a);
    expect(r.complete).toBe(true);
    const out = r.dimensions.find((d) => d.id === 'outlook');
    expect(out.answered).toBe(0);
    expect(out.optionalSkipped).toBe(5);
    expect(Number.isFinite(r.total)).toBe(true);
  });
  it('非可選題填「不想回答」不算完成', () => {
    const a = answersAll(4);
    a['si-amb-1'] = NA_VALUE;
    expect(si.SCORING.isComplete(a, si)).toBe(false);
    expect(si.SCORING.unansweredQuestionIds(a, si)).toEqual(['si-amb-1']);
  });
  it('結果形狀相容後端驗證，且沒有等級排名文字', () => {
    const r = build(answersAll(3));
    r.dimensions.forEach((d) => { expect(typeof d.id).toBe('string'); expect(Number.isFinite(d.score)).toBe(true); expect(typeof d.rating.label).toBe('string'); });
    expect(r.assessmentId).toBe('succession-intent');
  });
  it('複製摘要不含總分與最強構面', () => {
    const t = resultSummaryText(build(answersAll(4)));
    expect(t).not.toMatch(/總得分|最強構面|優先強化|達成率/);
    expect(t).toContain('升任企圖');
  });
});

describe('接班準備度評測：作答頁與報告', () => {
  const renderSurvey = () => render(<MemoryRouter><ConfirmProvider><SurveyApp assessmentId="succession-intent" user={{ id: 'u', name: '測試' }} /></ConfirmProvider></MemoryRouter>);
  it('單頁 20 題；長期意向每題有「不想回答」', () => {
    renderSurvey();
    expect(document.querySelectorAll('fieldset[data-question-id]')).toHaveLength(20);
    expect(screen.getAllByText('不想回答')).toHaveLength(5);
  });
  it('填完（長期意向全部不回答）可送出', async () => {
    renderSurvey();
    document.querySelectorAll('fieldset[data-question-id]').forEach((fs) => {
      const id = fs.getAttribute('data-question-id');
      const q = si.ALL_QUESTIONS.find((x) => x.id === id);
      const radios = fs.querySelectorAll('input[type="radio"]');
      fireEvent.click(q.optional ? radios[radios.length - 1] : radios[3]);
    });
    fireEvent.click(screen.getByRole('button', { name: /送出評測/ }));
    await waitFor(() => expect(createSubmission).toHaveBeenCalledTimes(1));
    expect(createSubmission.mock.calls[0][0].result.complete).toBe(true);
  });
  it('結果頁：中性說明、不含總分／排名', () => {
    const { container } = render(<MemoryRouter><ResultPanel result={build(answersAll(4))} onRetake={() => {}} onCopy={() => {}} copied={false} /></MemoryRouter>);
    const t = container.textContent;
    expect(t).toContain('不是在評分');
    expect(t).toContain('升任企圖');
    expect(t).not.toMatch(/總得分|百分位|超越|主要風格|次要風格/);
  });
  it('列印版：一頁、不含總分；未回答的面向標示不顯示內容', () => {
    const a = answersAll(4);
    si.DIMENSIONS.find((d) => d.id === 'outlook').questions.forEach((q) => { a[q.id] = NA_VALUE; });
    const { container } = render(<ReportPages result={build(a)} user={{ name: '王小明' }} submittedAt="2026-10-17T00:00:00Z" />);
    const t = container.textContent;
    expect(t).toContain('王小明');
    expect(t).toContain('不回答這個面向');
    expect(t).not.toMatch(/總得分|百分位|NaN|undefined/);
  });
});
