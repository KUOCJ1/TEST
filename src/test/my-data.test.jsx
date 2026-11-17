import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MyDataCard from '../survey/account/MyDataCard.jsx';
import DeletionPendingGate from '../survey/account/DeletionPendingGate.jsx';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('../survey/auth/useAuth', () => ({ useAuth: () => auth.value }));
const { api } = vi.hoisted(() => ({ api: { exportMyData: vi.fn() } }));
vi.mock('../survey/api/client', () => ({ api }));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('個人設定：我的資料', () => {
  it('下載我的資料：呼叫 API 並存成 JSON 檔', async () => {
    auth.value = { user: { role: 'user' }, requestDeletion: vi.fn() };
    api.exportMyData.mockResolvedValue({ account: { email: 'a@b.co' } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<MyDataCard />);
    fireEvent.click(screen.getByRole('button', { name: /下載我的資料/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('已下載');
    click.mockRestore();
  });

  it('刪除帳號：要說明、密碼與勾選「我了解」才能送出', async () => {
    const requestDeletion = vi.fn().mockResolvedValue({});
    auth.value = { user: { role: 'user' }, requestDeletion };
    render(<MyDataCard />);
    fireEvent.click(screen.getByRole('button', { name: /刪除我的帳號/ }));
    expect(screen.getByText(/7 天/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/去識別化保留/)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: '確定刪除' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('輸入密碼確認'), { target: { value: 'abcdef12' } });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(requestDeletion).toHaveBeenCalledWith('abcdef12'));
  });

  it('教練與管理者：不能自助刪除，只顯示說明', () => {
    auth.value = { user: { role: 'coach' }, requestDeletion: vi.fn() };
    render(<MyDataCard />);
    expect(screen.queryByRole('button', { name: /刪除我的帳號/ })).toBeNull();
    expect(screen.getByText(/請聯絡平台管理者/)).toBeInTheDocument();
  });
});

describe('刪除等待畫面', () => {
  it('顯示刪除時間；可以取消、下載、登出', async () => {
    const cancelDeletion = vi.fn().mockResolvedValue({});
    auth.value = { user: { name: '學員甲', deletionScheduledFor: '2026-11-24T08:00:00.000Z' }, cancelDeletion, logout: vi.fn() };
    render(<DeletionPendingGate />);
    expect(screen.getByRole('heading', { name: '帳號已排定刪除' })).toBeInTheDocument();
    expect(screen.getByText(/2026\/11\/24/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消刪除，繼續使用' }));
    await waitFor(() => expect(cancelDeletion).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '下載我的資料' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument();
  });
});
