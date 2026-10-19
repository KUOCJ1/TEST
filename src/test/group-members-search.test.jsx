import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import GroupSettingsSection from '../survey/coach/GroupSettingsSection';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { ToastProvider } from '../survey/components/Toast';

// Sprint 11 驗收條件 11.1：成員加入改為「搜尋才顯示」，不再列出全站名單。

const { coachUserSearch, updateGroup } = vi.hoisted(() => ({ coachUserSearch: vi.fn(), updateGroup: vi.fn() }));
vi.mock('../survey/api/client', () => ({
  api: { coachUserSearch, updateGroup, importRoster: vi.fn(), updateGroupDates: vi.fn(), publishGroup: vi.fn(), unpublishGroup: vi.fn() },
}));

const members = [
  { id: 'm1', name: '林小美', email: 'mei@x.co' },
  { id: 'm2', name: '王大明', email: 'ming@x.co', disabled: true },
];
const group = { id: 'g1', name: '班', assessmentId: 'ai-competency', memberIds: ['m1', 'm2'], phase: 'in_progress', joinCode: null };

function renderSection(over = {}) {
  const props = {
    group, members, users: [], patchedSubmissions: [],
    onGroupUpdated: vi.fn(), refreshSubmissions: vi.fn().mockResolvedValue(undefined), showToast: vi.fn(), ...over,
  };
  render(<ToastProvider><ConfirmProvider><GroupSettingsSection {...props} /></ConfirmProvider></ToastProvider>);
  return props;
}
const box = () => screen.getByLabelText('搜尋並加入已註冊的用戶');
const type = async (value) => { await act(async () => { fireEvent.change(box(), { target: { value } }); await new Promise((r) => setTimeout(r, 400)); }); };

beforeEach(() => {
  coachUserSearch.mockReset(); updateGroup.mockReset();
  coachUserSearch.mockResolvedValue([]);
});

describe('成員管理：目前成員＋搜尋加入', () => {
  it('只列出這個班的成員，不會一次列出全站名單；一開始不呼叫搜尋', () => {
    renderSection();
    const list = screen.getByText('目前成員（2）').parentElement.querySelector('ul');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('林小美')).toBeInTheDocument();
    expect(screen.getByText('已停用')).toBeInTheDocument();
    expect(screen.getByText(/不會列出全部用戶/)).toBeInTheDocument();
    expect(coachUserSearch).not.toHaveBeenCalled();
  });

  it('只輸入 1 個字不會搜尋；2 個字以上才送出（停手後才送）', async () => {
    renderSection();
    await type('王');
    expect(coachUserSearch).not.toHaveBeenCalled();
    await type('王小');
    expect(coachUserSearch).toHaveBeenCalledTimes(1);
    expect(coachUserSearch).toHaveBeenCalledWith('王小');
  });

  it('搜尋結果可以加入；加入後人數增加、顯示「尚未儲存」、搜尋結果不再列出已在班上的人', async () => {
    coachUserSearch.mockResolvedValue([
      { id: 'n1', name: '張新人', email: 'new@x.co' },
      { id: 'm1', name: '林小美', email: 'mei@x.co' }, // 已在班上
    ]);
    renderSection();
    await type('張新');
    expect(await screen.findByRole('button', { name: '加入 張新人' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加入 林小美' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入 張新人' }));
    expect(screen.getByText('目前成員（3）')).toBeInTheDocument();
    expect(screen.getByText(/有尚未儲存的變更/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加入 張新人' })).not.toBeInTheDocument();
  });

  it('沒有結果時說明怎麼邀請還沒註冊的人', async () => {
    renderSection();
    await type('查無此人');
    expect(await screen.findByText(/找不到符合的已註冊用戶/)).toBeInTheDocument();
    expect(screen.getByText(/找不到符合的已註冊用戶.*批量匯入名單/)).toBeInTheDocument();
  });

  it('搜尋失敗顯示錯誤', async () => {
    coachUserSearch.mockRejectedValue(new Error('搜尋壞了'));
    renderSection();
    await type('王小');
    expect(await screen.findByRole('alert')).toHaveTextContent('搜尋壞了');
  });

  it('移除成員後要按「儲存成員名單」才生效，送出的是更新後的 id 清單', async () => {
    updateGroup.mockResolvedValue({ ...group, memberIds: ['m2'] });
    const props = renderSection();
    const saveBtn = screen.getByRole('button', { name: '儲存成員名單' });
    expect(saveBtn).toBeDisabled(); // 沒有變更時不能存
    fireEvent.click(screen.getByRole('button', { name: '移除 林小美' }));
    expect(screen.getByText('目前成員（1）')).toBeInTheDocument();
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);
    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith('g1', { memberIds: ['m2'] }));
    await waitFor(() => expect(props.onGroupUpdated).toHaveBeenCalled());
    expect(props.refreshSubmissions).toHaveBeenCalled();
  });

  it('慢的舊搜尋回應不會蓋掉新的結果', async () => {
    let resolveOld;
    coachUserSearch
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
      .mockResolvedValueOnce([{ id: 'n2', name: '新結果', email: 'n2@x.co' }]);
    renderSection();
    await type('王小');
    await type('王小明');
    expect(await screen.findByRole('button', { name: '加入 新結果' })).toBeInTheDocument();
    await act(async () => { resolveOld([{ id: 'old', name: '舊結果', email: 'o@x.co' }]); });
    expect(screen.queryByRole('button', { name: '加入 舊結果' })).not.toBeInTheDocument();
  });
});
