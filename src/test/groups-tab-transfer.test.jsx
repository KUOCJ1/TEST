import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import GroupsTab from '../survey/admin/GroupsTab';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { ToastProvider } from '../survey/components/Toast';

// Sprint 11 驗收條件 11.5：管理者看得到每班的教練，並能轉移班別。

const { transferGroup } = vi.hoisted(() => ({ transferGroup: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { transferGroup, updateGroup: vi.fn(), publishGroup: vi.fn(), unpublishGroup: vi.fn() } }));

const groups = [
  { id: 'g1', name: 'AI 第一梯', coachId: 'c1', coachName: '教練甲', phase: 'in_progress', memberIds: [] },
  { id: 'g2', name: '領導力班', coachId: 'c2', coachName: '教練乙', phase: 'not_started', memberIds: [] },
];
const users = [
  { id: 'c1', name: '教練甲', email: 'c1@x.co', role: 'coach' },
  { id: 'c2', name: '教練乙', email: 'c2@x.co', role: 'coach' },
  { id: 'c3', name: '教練丙', email: 'c3@x.co', role: 'coach', disabled: true },
  { id: 'a1', name: '管理員', email: 'a@x.co', role: 'admin' },
  { id: 's1', name: '學員', email: 's@x.co', role: 'user' },
];

function renderTab(onGroupUpdated = vi.fn()) {
  render(<ToastProvider><ConfirmProvider><GroupsTab groups={groups} users={users} onGroupUpdated={onGroupUpdated} /></ConfirmProvider></ToastProvider>);
  return onGroupUpdated;
}
beforeEach(() => { transferGroup.mockReset(); transferGroup.mockResolvedValue(undefined); });

describe('GroupsTab：負責教練與轉移班別', () => {
  it('每個班都顯示負責教練', () => {
    renderTab();
    expect(screen.getByText('教練甲', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('教練乙', { selector: 'p' })).toBeInTheDocument();
  });

  it('轉移對象只列出有效的教練與管理員，且不含目前的教練；學員與已停用帳號不在其中', () => {
    renderTab();
    const select = screen.getByLabelText('把「AI 第一梯」轉給');
    const labels = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['轉給其他教練…', '教練乙（c2@x.co）', '管理員（a@x.co）']);
  });

  it('沒選對象時不能按轉移；選了之後要確認，確認後呼叫 API 並更新', async () => {
    transferGroup.mockResolvedValue({ ...groups[0], coachId: 'c2', coachName: '教練乙' });
    const updated = renderTab();
    const card = screen.getByLabelText('把「AI 第一梯」轉給').closest('div.mt-2');
    const btn = within(card).getByRole('button', { name: '轉移班別' });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('把「AI 第一梯」轉給'), { target: { value: 'c2' } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(await screen.findByText(/轉移後原教練就看不到這個班/)).toBeInTheDocument();
    expect(transferGroup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '轉移' }));
    await waitFor(() => expect(transferGroup).toHaveBeenCalledWith('g1', 'c2'));
    await waitFor(() => expect(updated).toHaveBeenCalledWith(expect.objectContaining({ coachId: 'c2' })));
  });

  it('伺服器拒絕時顯示錯誤，不更新畫面', async () => {
    transferGroup.mockImplementation(() => { const p = Promise.reject(new Error('該帳號已停用')); p.catch(() => {}); return p; });
    const updated = renderTab();
    fireEvent.change(screen.getByLabelText('把「AI 第一梯」轉給'), { target: { value: 'a1' } });
    const card = screen.getByLabelText('把「AI 第一梯」轉給').closest('div.mt-2');
    fireEvent.click(within(card).getByRole('button', { name: '轉移班別' }));
    fireEvent.click(await screen.findByRole('button', { name: '轉移' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('該帳號已停用');
    expect(updated).not.toHaveBeenCalled();
  });

  it('沒有班別時顯示空狀態', () => {
    render(<ToastProvider><ConfirmProvider><GroupsTab groups={[]} users={users} onGroupUpdated={vi.fn()} /></ConfirmProvider></ToastProvider>);
    expect(screen.getByText(/目前尚無班別/)).toBeInTheDocument();
  });
});
