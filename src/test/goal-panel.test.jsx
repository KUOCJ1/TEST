import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoalPanel from '../survey/components/GoalPanel';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';

function renderPanel(props) {
  return render(
    <ConfirmProvider>
      <GoalPanel {...props} />
    </ConfirmProvider>,
  );
}

const { myGoals, createGoal } = vi.hoisted(() => ({
  myGoals: vi.fn(),
  createGoal: vi.fn(),
}));

vi.mock('../survey/api/client', () => ({
  api: { myGoals, createGoal, updateGoal: vi.fn(), deleteGoal: vi.fn() },
}));

const weakest = { id: 'communication', subtitle: '溝通力', color: '#2b6cb0' };
const dims = [
  { id: 'dominance', subtitle: '支配型', color: '#e53e3e' },
  { id: 'influence', subtitle: '影響型', color: '#d69e2e' },
];

beforeEach(() => {
  myGoals.mockReset();
  createGoal.mockReset();
  myGoals.mockResolvedValue([]);
  createGoal.mockResolvedValue({ id: 'g1', actions: [], achievedAt: null, createdAt: new Date().toISOString() });
});

describe('GoalPanel（一般題庫，非 PROFILE_MODE）', () => {
  it('新增目標時預設帶入最待強化的構面文案，不出現選單', async () => {
    renderPanel({ assessmentId: 'ai-competency', weakestDimension: weakest });
    fireEvent.click(await screen.findByRole('button', { name: /新增目標/ }));

    expect(screen.getByText(/針對目前最待強化的/)).toBeInTheDocument();
    expect(screen.getByText('溝通力')).toBeInTheDocument();
    expect(screen.queryByLabelText(/想刻意練習哪一種風格/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/每週用 AI 完成/), { target: { value: '每天練習傾聽' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存目標' }));

    await vi.waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    expect(createGoal.mock.calls[0][0]).toMatchObject({ dimensionId: 'communication', dimensionName: '溝通力' });
  });
});

describe('GoalPanel（PROFILE_MODE 題庫，如 DISC）', () => {
  it('不預設最待強化構面，改用中性引導語與可選構面選單', async () => {
    renderPanel({ assessmentId: 'disc', weakestDimension: weakest, profileMode: true, dimensions: dims });
    fireEvent.click(await screen.findByRole('button', { name: /新增目標/ }));

    expect(screen.queryByText(/針對目前最待強化的/)).not.toBeInTheDocument();
    expect(screen.getByText('想刻意練習哪一種風格？（可不選）')).toBeInTheDocument();
    const select = screen.getByLabelText('想刻意練習哪一種風格？（可不選）');
    expect(select).toHaveValue('');

    fireEvent.change(select, { target: { value: 'influence' } });
    fireEvent.change(screen.getByPlaceholderText(/每週用 AI 完成/), { target: { value: '練習主動表達想法' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存目標' }));

    await vi.waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    expect(createGoal.mock.calls[0][0]).toMatchObject({ dimensionId: 'influence', dimensionName: '影響型' });
  });

  it('不選構面也能儲存目標（dimensionId 為 null）', async () => {
    renderPanel({ assessmentId: 'disc', profileMode: true, dimensions: dims });
    fireEvent.click(await screen.findByRole('button', { name: /新增目標/ }));
    fireEvent.change(screen.getByPlaceholderText(/每週用 AI 完成/), { target: { value: '維持目前的節奏' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存目標' }));

    await vi.waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    expect(createGoal.mock.calls[0][0]).toMatchObject({ dimensionId: null, dimensionName: null });
  });
});
