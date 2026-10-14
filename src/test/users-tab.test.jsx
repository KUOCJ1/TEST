import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import UsersTab from '../survey/admin/UsersTab';
import { AuthContext } from '../survey/auth/useAuth';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { ToastProvider } from '../survey/components/Toast';

// Sprint 11 驗收條件 11.3、11.4：用戶與權限。

const { setUserRole, setUserDisabled, generateResetToken } = vi.hoisted(() => ({
  setUserRole: vi.fn(), setUserDisabled: vi.fn(), generateResetToken: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: { setUserRole, setUserDisabled, generateResetToken } }));

const U = (id, name, role = 'user', extra = {}) => ({ id, name, email: `${id}@x.co`, role, ...extra });
const users = [
  U('me', '我自己', 'admin'),
  U('a2', '管理員二', 'admin'),
  U('c1', '教練甲', 'coach'),
  U('s1', '學員一'),
  U('s2', '學員二', 'user', { disabled: true }),
];

function renderTab(onUserChanged = vi.fn(), list = users) {
  render(
    <AuthContext.Provider value={{ user: { id: 'me', name: '我自己', role: 'admin' } }}>
      <ToastProvider><ConfirmProvider><UsersTab users={list} onUserChanged={onUserChanged} /></ConfirmProvider></ToastProvider>
    </AuthContext.Provider>,
  );
  return onUserChanged;
}
const rowOf = (name) => screen.getByText(name, { selector: 'span.truncate' }).closest('li');
const confirmDialog = async (label) => fireEvent.click(await screen.findByRole('button', { name: label }));

beforeEach(() => { [setUserRole, setUserDisabled, generateResetToken].forEach((m) => m.mockReset()); });

describe('UsersTab：列表、篩選與說明', () => {
  it('列出所有人（含管理者與已停用），角色與停用狀態都有標示', () => {
    renderTab();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(within(rowOf('管理員二')).getByText('管理者', { selector: 'span' })).toBeInTheDocument();
    expect(within(rowOf('學員二')).getByText('已停用')).toBeInTheDocument();
    expect(within(rowOf('我自己')).getByText('（你自己）')).toBeInTheDocument();
  });

  it('角色篩選按鈕顯示人數，點了只留下該角色；已停用另成一類', () => {
    renderTab();
    expect(screen.getByRole('button', { name: '全部（5）' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '管理者（2）' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '已停用（1）' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('學員二', { selector: 'span.truncate' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '教練（1）' }));
    expect(screen.getByText('教練甲', { selector: 'span.truncate' })).toBeInTheDocument();
  });

  it('搜尋會跟篩選疊加；查無時顯示提示', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: '一般用戶（2）' }));
    fireEvent.change(screen.getByLabelText('搜尋姓名或 Email'), { target: { value: '學員一' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('搜尋姓名或 Email'), { target: { value: '不存在的人' } });
    expect(screen.getByText(/查無符合的用戶/)).toBeInTheDocument();
  });

  it('有「各角色能做什麼」的說明', () => {
    renderTab();
    expect(screen.getByText('各角色能做什麼？')).toBeInTheDocument();
    expect(screen.getByText(/開關題庫、修改題庫文字、管理用戶角色/)).toBeInTheDocument();
  });
});

describe('UsersTab：角色變更要先確認，並說明後果', () => {
  it('升為教練：跳確認、說明對方會被登出；確認後才呼叫 API', async () => {
    setUserRole.mockResolvedValue(U('s1', '學員一', 'coach'));
    const changed = renderTab();
    fireEvent.change(within(rowOf('學員一')).getByLabelText('變更 學員一 的角色'), { target: { value: 'coach' } });
    expect(setUserRole).not.toHaveBeenCalled();
    expect(await screen.findByText(/對方目前的登入會立即失效/)).toBeInTheDocument();
    await confirmDialog('確定變更');
    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith('s1', 'coach'));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', role: 'coach' })));
  });

  it('取消確認就什麼都不做', async () => {
    renderTab();
    fireEvent.change(within(rowOf('學員一')).getByLabelText('變更 學員一 的角色'), { target: { value: 'coach' } });
    fireEvent.click(await screen.findByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it('設為管理者會用更強的警語', async () => {
    setUserRole.mockResolvedValue(U('s1', '學員一', 'admin'));
    renderTab();
    fireEvent.change(within(rowOf('學員一')).getByLabelText('變更 學員一 的角色'), { target: { value: 'admin' } });
    expect(await screen.findByText(/管理者可以修改題庫內容、管理所有用戶與班別、停用帳號，權限很大/)).toBeInTheDocument();
    await confirmDialog('確定變更');
    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith('s1', 'admin'));
  });

  it('不能改自己的角色、不能停用自己（按鈕與下拉都停用）', () => {
    renderTab();
    const me = rowOf('我自己');
    expect(within(me).getByLabelText('變更 我自己 的角色')).toBeDisabled();
    expect(within(me).getByRole('button', { name: '停用 我自己' })).toBeDisabled();
    expect(within(rowOf('管理員二')).getByLabelText('變更 管理員二 的角色')).toBeEnabled();
  });

  it('伺服器拒絕時顯示錯誤訊息（例如至少要保留一位管理員）', async () => {
    setUserRole.mockRejectedValue(new Error('至少要保留一位管理員'));
    renderTab();
    fireEvent.change(within(rowOf('管理員二')).getByLabelText('變更 管理員二 的角色'), { target: { value: 'user' } });
    await confirmDialog('確定變更');
    expect(await screen.findByRole('alert')).toHaveTextContent('至少要保留一位管理員');
  });
});

describe('UsersTab：停用與重新啟用', () => {
  it('停用要確認並說明後果，確認後呼叫 API', async () => {
    setUserDisabled.mockResolvedValue(U('s1', '學員一', 'user', { disabled: true }));
    renderTab();
    fireEvent.click(within(rowOf('學員一')).getByRole('button', { name: '停用 學員一' }));
    expect(await screen.findByText(/立即被登出、無法再登入；作答紀錄與班級資料都會保留/)).toBeInTheDocument();
    await confirmDialog('停用');
    await waitFor(() => expect(setUserDisabled).toHaveBeenCalledWith('s1', true));
  });

  it('已停用的帳號顯示「重新啟用」，確認後呼叫 API', async () => {
    setUserDisabled.mockResolvedValue(U('s2', '學員二', 'user'));
    renderTab();
    fireEvent.click(within(rowOf('學員二')).getByRole('button', { name: '重新啟用 學員二' }));
    await confirmDialog('重新啟用');
    await waitFor(() => expect(setUserDisabled).toHaveBeenCalledWith('s2', false));
  });
});
