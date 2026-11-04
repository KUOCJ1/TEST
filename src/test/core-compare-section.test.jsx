import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CoreCompareSection from '../survey/admin/CoreCompareSection.jsx';
import * as L9D from '../survey/data/assessments/leadership-9d.js';
import * as L8D from '../survey/data/assessments/leadership-360-70.js';
import { buildResult } from '../survey/utils/scoring.js';

const sub = (cfg, v, userId) => ({ assessmentId: cfg.ID, userId, raterType: 'self', createdAt: '2026-11-01T00:00:00Z', result: buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 6 - v : v])), cfg) });

describe('CoreCompareSection', () => {
  it('只有一套評量有資料時不顯示', () => {
    const { container } = render(<CoreCompareSection submissions={[sub(L9D, 4, 'u1')]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('兩套都有資料：並排核心 7 構面與人數；同一人兩套都做過時顯示配對差', () => {
    render(<CoreCompareSection submissions={[sub(L9D, 4, 'u1'), sub(L8D, 3, 'u1'), sub(L8D, 5, 'u2')]} />);
    expect(screen.getByLabelText('核心 7 構面跨評量比較')).toBeInTheDocument();
    expect(screen.getByText(/九大構面行為評量/)).toBeInTheDocument();
    expect(screen.getByText('（2 人）')).toBeInTheDocument();
    expect(screen.getByText(/同時完成兩套評量的人（1 人）/)).toBeInTheDocument();
    expect(screen.getAllByText('溝通力').length).toBeGreaterThanOrEqual(2);
    // 專屬構面不在比較表
    expect(screen.queryByText('接班成熟度')).toBeNull();
    expect(screen.queryByText('應變與創新')).toBeNull();
  });
});
