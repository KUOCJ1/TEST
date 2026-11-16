import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CoachWorkbench from '../survey/coach/CoachWorkbench.jsx';
import { todoTotal } from '../survey/utils/workbench.js';
import { api } from '../survey/api/client';

const toast = vi.fn();
vi.mock('../survey/components/useToast', () => ({ useToast: () => toast }));
vi.mock('../survey/api/client', () => ({ api: { coachWorkbench: vi.fn(), sendGroupReminders: vi.fn(), remindGroupRaters: vi.fn(), remindGroupGoals: vi.fn() } }));

const g = (o) => ({ id: 'g1', name: '森永班', companyName: '森永', phase: 'in_progress', memberCount: 12, notDone: 3, ratersLow: 2, uncommented: 4, warnings: 1, noGoal: 5, ...o });

describe('教練工作台', () => {
  beforeEach(() => vi.clearAllMocks());

  it('todoTotal：null 視為不適用；每班只有人數', () => {
    expect(todoTotal(g({ ratersLow: null, noGoal: null }))).toBe(3 + 4 + 1);
  });

  it('列出待辦人數與一鍵動作；按「催交」呼叫既有 API 並提示寄出數量', async () => {
    api.coachWorkbench.mockResolvedValue({ groups: [g()], mailConfigured: true });
    api.sendGroupReminders.mockResolvedValue({ sent: 3 });
    const open = vi.fn();
    render(<CoachWorkbench onOpenGroup={open} />);
    await screen.findByRole('button', { name: '進入 森永班' });
    expect(screen.getByText(/還沒作答/).textContent).toContain('3');
    expect(screen.getByText(/他評不足的受評者/).textContent).toContain('2');
    fireEvent.click(screen.getByRole('button', { name: '催交' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('已寄出 3 封催交信'));
    fireEvent.click(screen.getByRole('button', { name: '進入 森永班' }));
    expect(open).toHaveBeenCalledWith('g1');
  });

  it('沒有 SMTP 時一鍵動作停用；不在施測期間不能催交；全班沒待辦顯示「沒有待辦」', async () => {
    api.coachWorkbench.mockResolvedValue({ groups: [g({ phase: 'closed' })], mailConfigured: false });
    const { unmount } = render(<CoachWorkbench onOpenGroup={() => {}} />);
    await screen.findByRole('button', { name: '進入 森永班' });
    expect(screen.getByRole('button', { name: '催交' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '提醒評分者' })).toBeDisabled();
    unmount();
    api.coachWorkbench.mockResolvedValue({ groups: [g({ notDone: 0, ratersLow: 0, uncommented: 0, warnings: 0, noGoal: 0 })], mailConfigured: true });
    render(<CoachWorkbench onOpenGroup={() => {}} />);
    expect(await screen.findByText(/今天沒有待辦/)).toBeInTheDocument();
  });
});
