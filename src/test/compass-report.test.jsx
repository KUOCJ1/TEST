import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultPanel from '../survey/components/ResultPanel';
import CompassGapSection from '../survey/components/compass/CompassGapSection.jsx';
import * as compass from '../survey/data/assessments/leadership-compass.js';
import { computeGaps } from '../survey/utils/compassScoring.js';
import { loopBalanceText, tensionText, tensionLabel } from '../survey/utils/compassText.js';

vi.mock('../survey/api/client', () => ({
  api: { learningResources: async () => [], myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [] },
}));

const resultFor = (form, fn = () => 4) => {
  const view = compass.selectForm(form);
  const answers = Object.fromEntries(view.ALL_QUESTIONS.map((q, i) => [q.id, fn(q, i)]));
  return { result: compass.SCORING.buildResult(answers, view), answers, view };
};
const renderPanel = (result, props = {}) => render(
  <MemoryRouter><ResultPanel result={result} onRetake={() => {}} onCopy={() => {}} copied={false} {...props} /></MemoryRouter>,
);

describe('雙環領導羅盤：個人報告', () => {
  it('用專屬報告：四字構面名稱、兩環、四組張力、人機協作剖面', () => {
    const { result } = resultFor('full', (q, i) => (i % 5) + 1);
    renderPanel(result);
    expect(screen.getByText(/您的雙環輪廓/)).toBeInTheDocument();
    expect(screen.getByText('完整版')).toBeInTheDocument();
    ['洞察情勢', '聚焦應變', '知人授權', '凝聚帶動', '敏捷學習', '穩定當責', '識才育才', '傳承留能'].forEach((n) => {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('快環與永環')).toBeInTheDocument();
    expect(screen.getByText('四組張力')).toBeInTheDocument();
    expect(screen.getByText('聚焦 ↔ 彈性')).toBeInTheDocument();
    expect(screen.getByText('授權 ↔ 掌握')).toBeInTheDocument();
    expect(screen.getByText('關係 ↔ 成果')).toBeInTheDocument();
    expect(screen.getByText('機制 ↔ 個人權威')).toBeInTheDocument();
    expect(screen.getByText('人機協作剖面')).toBeInTheDocument();
  });

  it('不再出現借自風格型題庫的「主要風格／次要風格」「風格輪廓」', () => {
    const { result } = resultFor('short');
    renderPanel(result);
    expect(screen.queryByText('主要風格')).not.toBeInTheDocument();
    expect(screen.queryByText('次要風格')).not.toBeInTheDocument();
    expect(screen.queryByText(/風格輪廓/)).not.toBeInTheDocument();
    expect(screen.queryByText(/總得分/)).not.toBeInTheDocument();
  });

  it('精簡版：張力每端只有 1 題的組別標示「僅供參考」', () => {
    const { result } = resultFor('short');
    renderPanel(result);
    expect(screen.getAllByText(/這一組題目較少，僅供參考/).length).toBe(3); // 授權/關係/機制各 1 題；聚焦應變各 2 題
  });

  it('未作答的張力顯示「有效作答不足」而不是 NaN', () => {
    const view = compass.selectForm('full');
    const result = compass.SCORING.buildResult({}, view);
    renderPanel(result);
    expect(screen.getAllByText(/有效作答不足/).length).toBe(4);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('報告不含「好／壞」評判字眼', () => {
    const { result } = resultFor('full', (q, i) => (i % 5) + 1);
    renderPanel(result);
    expect(document.body.textContent).not.toMatch(/待強化|不及格|落後|很差|失敗/);
  });

  it('readOnly 時不顯示重新評測與複製按鈕', () => {
    const { result } = resultFor('short');
    renderPanel(result, { readOnly: true });
    expect(screen.queryByRole('button', { name: /重新評測/ })).not.toBeInTheDocument();
  });

  it('其他題庫仍走原本的結果頁（AI 職能）', async () => {
    const ai = await import('../survey/data/assessments/ai-competency.js');
    const { buildResult } = await import('../survey/utils/scoring');
    const r = buildResult(Object.fromEntries(ai.ALL_QUESTIONS.map((q) => [q.id, 3])), ai);
    renderPanel(r);
    expect(screen.getByText(/您的總得分/)).toBeInTheDocument();
  });
});

describe('張力文字', () => {
  const t = (type) => ({ type, nameA: '聚焦', nameB: '彈性' });
  it('每種類型都有文字，且偏向某端時提到另一端的情境', () => {
    ['both_high', 'both_low', 'lean_a', 'lean_b', 'moderate'].forEach((type) => expect(tensionText(t(type)).length).toBeGreaterThan(10));
    expect(tensionText(t('lean_a'))).toMatch(/「彈性」/);
    expect(tensionLabel(t('lean_b'))).toBe('偏向彈性');
  });
  it('兩環差距的說明', () => {
    expect(loopBalanceText([{ id: 'fast', average: 3.5 }, { id: 'last', average: 3.4 }])).toMatch(/相當/);
    expect(loopBalanceText([{ id: 'fast', average: 4.2 }, { id: 'last', average: 3.0 }])).toMatch(/快環.*更常出現/);
    expect(loopBalanceText([{ id: 'fast', average: 3.0 }, { id: 'last', average: 4.2 }])).toMatch(/永環.*更常出現/);
    expect(loopBalanceText([])).toBeNull();
  });
});

describe('自評與他評落差區塊', () => {
  const view = compass.selectForm('short');
  const ans = (v) => Object.fromEntries(view.ALL_QUESTIONS.map((q) => [q.id, v]));
  const cfg = { ID: 'x', SCALE_MIN: 1, SCALE_MAX: 5, DIMENSIONS: compass.DIMENSIONS, LOOPS: compass.LOOPS, TENSIONS: compass.TENSIONS };

  it('他評不足門檻：只顯示說明，不出現任何分數', () => {
    const gaps = computeGaps({ selfAnswers: ans(5), othersAnswers: [ans(2), ans(2)], config: cfg, form: 'short' });
    const { container } = render(<CompassGapSection gaps={gaps} />);
    expect(container.textContent).toMatch(/不足 3 位/);
    expect(container.textContent).not.toMatch(/\d\.\d/);
  });

  it('達門檻：顯示各構面落差與分類', () => {
    const gaps = computeGaps({ selfAnswers: ans(5), othersAnswers: [ans(3), ans(3), ans(3)], config: cfg, form: 'short' });
    const { container } = render(<CompassGapSection gaps={gaps} />);
    expect(within(container).getAllByText(/自評高於他評/).length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/3 位他評者/);
  });

  it('沒有 gaps 時不渲染', () => {
    const { container } = render(<CompassGapSection gaps={null} />);
    expect(container.firstChild).toBeNull();
  });
});
