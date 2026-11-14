import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FirstActionCard from '../survey/components/FirstActionCard.jsx';
import { api } from '../survey/api/client';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

vi.mock('../survey/api/client', () => ({ api: { myGoals: vi.fn(), createGoal: vi.fn(), addGoalCheckin: vi.fn(), updateGoal: vi.fn() } }));

const cfg = getAssessment('leadership-9d');
// 讓「溝通」構面最低：該構面題目給 1，其餘給 4。
const comm = cfg.DIMENSIONS.find((d) => d.id === 'communication');
const commIds = new Set(cfg.ALL_QUESTIONS.filter((q) => q.dimensionId === comm.id || q.dimension === comm.id).map((q) => q.id));
const result = buildResult(Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, commIds.has(q.id) ? 1 : 4])), cfg);

describe('結果頁「選一件事」', () => {
  beforeEach(() => vi.clearAllMocks());

  it('沒有進行中的目標：列出起手行動，選一個一鍵建立目標（帶最弱構面）', async () => {
    api.myGoals.mockResolvedValue([]);
    api.createGoal.mockImplementation(async (b) => ({ id: 'g1', ...b, checkins: [] }));
    render(<FirstActionCard result={result} />);
    await screen.findByText('先選一件事開始');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: '就做這件事' }));
    await waitFor(() => expect(api.createGoal).toHaveBeenCalled());
    const body = api.createGoal.mock.calls[0][0];
    expect(body.assessmentId).toBe('leadership-9d');
    expect(body.dimensionId).toBe(result.dimensions.slice().sort((a, b) => a.average - b.average)[0].id);
    expect(body.actions).toHaveLength(1);
    await screen.findByRole('status');
  });

  it('預設不分享給教練；勾選「讓我的教練看到」才會更新 sharedWithCoach', async () => {
    api.myGoals.mockResolvedValue([]);
    api.createGoal.mockImplementation(async (b) => ({ id: 'g1', ...b, checkins: [] }));
    api.updateGoal.mockResolvedValue({ id: 'g1', sharedWithCoach: true, checkins: [] });
    const first = render(<FirstActionCard result={result} />);
    await screen.findByText('先選一件事開始');
    fireEvent.click(screen.getByRole('button', { name: '就做這件事' }));
    await screen.findByRole('status');
    expect(api.updateGoal).not.toHaveBeenCalled();
    first.unmount();
    render(<FirstActionCard result={result} />);
    await screen.findByText('先選一件事開始');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '就做這件事' }));
    await waitFor(() => expect(api.updateGoal).toHaveBeenCalledWith('g1', { sharedWithCoach: true }));
  });

  it('已有進行中的目標：改成回報進度，一鍵送出評分與心得', async () => {
    api.myGoals.mockResolvedValue([{ id: 'g1', text: '把溝通往前推一步', actions: [{ text: '做一件事' }], achievedAt: null, checkins: [] }]);
    api.addGoalCheckin.mockResolvedValue({ id: 'g1', text: 't', actions: [], achievedAt: null, checkins: [{ id: 'c' }] });
    render(<FirstActionCard result={result} />);
    await screen.findByText('回報一下進度');
    fireEvent.change(screen.getByLabelText('心得（選填）'), { target: { value: '有做' } });
    fireEvent.click(screen.getByRole('button', { name: '做了一部分' }));
    await waitFor(() => expect(api.addGoalCheckin).toHaveBeenCalledWith('g1', { rating: 3, text: '有做' }));
    await screen.findByRole('status');
  });

  it('只有已達成的目標：視為沒有進行中，仍可選新的一件事', async () => {
    api.myGoals.mockResolvedValue([{ id: 'g0', text: 'x', achievedAt: '2026-11-01T00:00:00Z', actions: [], checkins: [] }]);
    render(<FirstActionCard result={result} />);
    await screen.findByText('先選一件事開始');
  });
});
