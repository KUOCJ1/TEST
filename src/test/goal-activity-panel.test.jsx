import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoalActivityPanel from '../survey/coach/GoalActivityPanel.jsx';
import { api } from '../survey/api/client';

vi.mock('../survey/api/client', () => ({ api: { remindGroupGoals: vi.fn() } }));
const group = { id: 'g1' };

describe('班級行動概況面板', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只顯示人數，不含任何姓名；可提醒未設定者', async () => {
    api.remindGroupGoals.mockResolvedValue({ sent: 2 });
    const toast = vi.fn();
    render(<GoalActivityPanel group={group} summary={{ hidden: false, members: 5, withGoal: 3, recentCheckin: 1, noGoal: 2, recentDays: 14 }} mailConfigured showToast={toast} />);
    expect(screen.getByText('已設定目標').nextSibling.textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: '提醒還沒設定目標的人' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('已提醒 2 位還沒設定目標的成員'));
  });

  it('人數不足：不顯示數字；沒有 SMTP 或全員都設定了：按鈕停用', () => {
    const { unmount } = render(<GoalActivityPanel group={group} summary={{ hidden: true, minN: 3 }} mailConfigured showToast={() => {}} />);
    expect(screen.getByText(/少於 3 位時不顯示/)).toBeInTheDocument();
    unmount();
    render(<GoalActivityPanel group={group} summary={{ hidden: false, members: 4, withGoal: 4, recentCheckin: 0, noGoal: 0, recentDays: 14 }} mailConfigured showToast={() => {}} />);
    expect(screen.getByRole('button', { name: '提醒還沒設定目標的人' })).toBeDisabled();
  });
});
