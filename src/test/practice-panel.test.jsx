import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PracticePanel from '../survey/components/PracticePanel.jsx';
import PracticeChip from '../survey/components/PracticeChip.jsx';
import { buildPracticeTasks, practiceDueThisWeek, REFLECTION_TASK } from '../survey/utils/practice.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const { api } = vi.hoisted(() => ({ api: { myPractice: vi.fn(), startPractice: vi.fn(), markPracticeWeek: vi.fn(), stopPractice: vi.fn() } }));
vi.mock('../survey/api/client', () => ({ api }));

const cfg = getAssessment('leadership-9d');
const result = buildResult(Object.fromEntries(cfg.DIMENSIONS.flatMap((d) => d.questions.map((q) => [q.id, d.id === 'execution' ? 2 : 4]))), cfg);
const active = (week, doneWeeks = []) => ({
  active: true, finished: false, currentWeek: week, dimensionName: '執行力',
  weeks: [1, 2, 3, 4].map((w) => ({ week: w, task: w <= week ? `任務${w}` : null, doneAt: doneWeeks.includes(w) ? '2026-11-17' : null })),
});

beforeEach(() => vi.clearAllMocks());

describe('微練習：任務與規則', () => {
  it('四週：前三週是該構面的起手行動，第四週固定回顧', () => {
    const t = buildPracticeTasks('leadership-9d', 'execution');
    expect(t).toHaveLength(4);
    expect(t[3]).toBe(REFLECTION_TASK);
    expect(new Set(t.slice(0, 3)).size).toBe(3);
    expect(buildPracticeTasks('unknown', 'x')).toHaveLength(4);
  });
  it('首頁提示：只有本週還沒勾時才有', () => {
    expect(practiceDueThisWeek(null)).toBeNull();
    expect(practiceDueThisWeek(active(2))).toMatchObject({ week: 2 });
    expect(practiceDueThisWeek(active(2, [2]))).toBeNull();
    expect(practiceDueThisWeek({ ...active(2), active: false })).toBeNull();
  });
});

describe('PracticePanel', () => {
  it('結果頁：沒有進行中的一組 → 邀請開始，送出最弱構面與四週任務', async () => {
    api.myPractice.mockResolvedValue(null);
    api.startPractice.mockResolvedValue(active(1));
    render(<PracticePanel offerFrom={result} compact />);
    const btn = await screen.findByRole('button', { name: '開始四週微練習' });
    expect(screen.getByText(/練「執行力」/)).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => expect(api.startPractice).toHaveBeenCalled());
    const body = api.startPractice.mock.calls[0][0];
    expect(body).toMatchObject({ assessmentId: 'leadership-9d', dimensionId: 'execution', dimensionName: '執行力' });
    expect(body.tasks).toHaveLength(4);
    expect(await screen.findByText(/目前第 1／4 週/)).toBeInTheDocument();
  });

  it('我的學習：四週清單，未開始的週只有編號；勾選與取消呼叫 API', async () => {
    api.myPractice.mockResolvedValue(active(2, [1]));
    api.markPracticeWeek.mockResolvedValue(active(2, [1, 2]));
    render(<PracticePanel />);
    expect(await screen.findByText('任務2')).toBeInTheDocument();
    expect(screen.getAllByText(/週開始時出現/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: '第 1 週已完成，按一下取消' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '第 2 週標記為完成' }));
    await waitFor(() => expect(api.markPracticeWeek).toHaveBeenCalledWith(2, true));
  });

  it('結束：先確認才呼叫 API', async () => {
    api.myPractice.mockResolvedValue(active(1));
    api.stopPractice.mockResolvedValue({ ...active(1), active: false, stoppedAt: 'x' });
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PracticePanel />);
    fireEvent.click(await screen.findByRole('button', { name: '結束微練習' }));
    expect(api.stopPractice).not.toHaveBeenCalled();
    spy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '結束微練習' }));
    await waitFor(() => expect(api.stopPractice).toHaveBeenCalled());
  });

  it('首頁小卡：本週沒勾才出現，顯示本週任務', async () => {
    api.myPractice.mockResolvedValue(active(3, [1, 2]));
    render(<PracticeChip onClick={() => {}} />);
    expect(await screen.findByText(/本週微練習（3／4）：任務3/)).toBeInTheDocument();
  });
});
