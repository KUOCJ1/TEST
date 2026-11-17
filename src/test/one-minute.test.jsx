import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildOneMinute } from '../survey/utils/oneMinute.js';
import OneMinuteSummary from '../survey/components/OneMinuteSummary.jsx';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const resultOf = (id, valueOfDim) => {
  const cfg = getAssessment(id);
  return { cfg, result: buildResult(Object.fromEntries(cfg.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, valueOfDim(d.id)]))), cfg) };
};

describe('報告一分鐘版', () => {
  it('L9D：三句話——落點、最穩、最值得先練（含構面說明第一句與起手行動）', () => {
    const { cfg, result } = resultOf('leadership-9d', (id) => (id === 'communication' ? 5 : id === 'execution' ? 2 : 4));
    const s = buildOneMinute(result, cfg);
    expect(s.lines.map((l) => l.label)).toEqual(['你在哪', '你最穩的', '最值得先練']);
    // 不重複主視覺的落點名稱，用落點說明的第一句
    expect(s.lines[0].text).toBe(result.level.desc.match(/^[^。！？]*[。！？]/)[0]);
    expect(s.lines[0].text).not.toContain(result.level.badge);
    expect(s.lines[1].text).toContain('「溝通力」');
    expect(s.lines[2].text).toContain('「執行力」');
    expect(s.lines[2].text).toContain('可以從這件事開始');
    expect(s.focus).toMatchObject({ id: 'execution' });
  });

  it('沒有構面說明的題庫（AI 評測）：仍有三句，只是少了說明', () => {
    const { cfg, result } = resultOf('ai-competency', (id) => (id === 'safety' ? 2 : 4));
    const s = buildOneMinute(result, cfg);
    expect(s.lines).toHaveLength(3);
    expect(s.lines[2].text).toContain('可以從這件事開始');
  });

  it('各構面一樣高：不硬挑弱項', () => {
    const { cfg, result } = resultOf('leadership-9d', () => 4);
    const flat = { ...result, dimensions: result.dimensions.map((d, i) => ({ ...d, average: 3.8 + (i % 2) * 0.1 })) };
    const s = buildOneMinute(flat, cfg);
    expect(s.lines[2].text).toContain('很接近');
  });

  it('風格輪廓型（DISC）：不說強弱與「最該練」', () => {
    const { cfg, result } = resultOf('disc', (id) => (id === cfgFirst() ? 5 : 3));
    function cfgFirst() { return getAssessment('disc').DIMENSIONS[0].id; }
    const s = buildOneMinute(result, cfg);
    expect(s.focus).toBeNull();
    expect(s.lines.map((l) => l.label)).toEqual(['你的風格', '怎麼看', '可以試試']);
    expect(s.lines.map((l) => l.text).join('')).not.toMatch(/最值得先練|弱/);
  });

  it('畫面：有標題與三組說明；沒有分數資料時不顯示', () => {
    const { cfg, result } = resultOf('leadership-9d', () => 3);
    const { unmount } = render(<OneMinuteSummary result={result} config={cfg} />);
    expect(screen.getByRole('region', { name: '一分鐘看懂' })).toBeInTheDocument();
    expect(screen.getAllByRole('definition')).toHaveLength(3);
    unmount();
    const { container } = render(<OneMinuteSummary result={{ ...result, dimensions: [] }} config={cfg} />);
    expect(container).toBeEmptyDOMElement();
  });
});
