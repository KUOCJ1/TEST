import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BatchThreeSixtyReport from '../survey/components/BatchThreeSixtyReport.jsx';
import { api } from '../survey/api/client';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const cfg = getAssessment('leadership-360-70');
const sub = (raterType, userId, v) => ({ userId, raterType, createdAt: '2026-11-01T00:00:00Z', result: buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, v])), cfg) });

describe('360° 批次報告', () => {
  let portal;
  beforeEach(() => { portal = document.createElement('div'); portal.id = 'report-portal'; document.body.appendChild(portal); });
  afterEach(() => { portal.remove(); vi.restoreAllMocks(); });

  it('每位受評者各一份、之間換頁；沒有資料的人不放進文件並在螢幕提醒列說明', async () => {
    vi.spyOn(api, 'rateeSubmissions').mockImplementation(async (id) => {
      if (id === 'a') return [sub('self', 'a', 5), sub('manager', 'm', 3)];
      if (id === 'b') return [sub('self', 'b', 4)];
      return [];
    });
    render(<BatchThreeSixtyReport ratees={[{ id: 'a', name: '受評者甲' }, { id: 'b', name: '受評者乙' }, { id: 'c', name: '受評者丙' }]} assessmentId="leadership-360-70" groupName="森永班" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/共 2 份/)).toBeInTheDocument(), { timeout: 5000 });
    const text = portal.textContent;
    expect(text).toContain('受評者甲');
    expect(text).toContain('受評者乙');
    expect(text.match(/360° 完整回饋報告/g).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('note').textContent).toContain('1 位受評者沒有可用資料');
    expect(screen.getByRole('note').textContent).toContain('受評者丙');
    const breaks = [...portal.querySelectorAll('div')].filter((d) => d.style.pageBreakBefore === 'always');
    expect(breaks).toHaveLength(1); // 第 1 位不換頁、第 2 位換頁
    expect(screen.getByRole('button', { name: /全部列印/ })).toBeEnabled();
  });
});
