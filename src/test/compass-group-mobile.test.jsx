import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { buildCompassGroupReport } from '../survey/utils/compassGroup.js';
import * as compass from '../survey/data/assessments/leadership-compass.js';

vi.mock('../survey/api/client', () => ({ api: {} }));
vi.mock('../survey/hooks/useIsMobile.js', () => ({ useIsMobile: () => true }));

const { default: CompassGroupPrintable } = await import('../survey/coach/CompassGroupPrintable.jsx');

const resultOf = (i) => {
  const view = compass.selectForm('full');
  return compass.SCORING.buildResult(Object.fromEntries(view.ALL_QUESTIONS.map((q, j) => [q.id, ((i + j) % 5) + 1])), view);
};

describe('羅盤班級報告：手機閱讀版沿用匿名分級', () => {
  let portal;
  beforeEach(() => { portal = document.createElement('div'); portal.id = 'report-portal'; document.body.appendChild(portal); });
  afterEach(() => portal.remove());
  const group = { name: '測試班', assessmentId: 'leadership-compass' };

  it('人數不足：閱讀版與 A4 都不顯示任何分數', () => {
    const report = buildCompassGroupReport([resultOf(0), resultOf(1)], 10);
    render(<CompassGroupPrintable report={report} group={group} phaseLabel="課前" onClose={() => {}} />);
    const read = portal.querySelector('.report-read');
    expect(read).not.toBeNull();
    expect(read.textContent).toContain('暫不顯示分數與統計');
    expect(read.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  });

  it('人數足夠：閱讀版有八構面與張力，並可切 A4', () => {
    const report = buildCompassGroupReport([0, 1, 2, 3, 4, 5].map(resultOf), 6);
    render(<CompassGroupPrintable report={report} group={group} phaseLabel="課前" onClose={() => {}} />);
    const read = portal.querySelector('.report-read');
    expect(read.querySelectorAll('[role="progressbar"]').length).toBeGreaterThanOrEqual(8);
    expect(read.textContent).toContain('四組張力的取向分布');
    expect(portal.querySelector('.report-a4')).not.toBeNull();
  });
});
