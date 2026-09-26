import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ProgressPanel from '../survey/coach/ProgressPanel';
import { api } from '../survey/api/client';

vi.mock('../survey/api/client', () => ({ api: { sendGroupReminders: vi.fn() } }));

const group = { id: 'g1', name: '2026 秋季班', memberIds: ['u1', 'u2', 'u3'], endDate: '2026-12-31T00:00:00Z', joinCode: 'ABC123' };
const members = [
  { id: 'u1', name: '小明', email: 'ming@x.com' },
  { id: 'u2', name: '小華', email: 'hua@x.com' },
  { id: 'u3', name: '小美', email: 'mei@x.com' },
];

function sub(userId, phase) {
  return { userId, raterType: 'self', phase };
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
});

describe('ProgressPanel', () => {
  it('顯示課前／課後完成人數', () => {
    const submissions = [sub('u1', 'pre'), sub('u1', 'post'), sub('u2', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    const preBlock = screen.getByText('課前').closest('div');
    const postBlock = screen.getByText('課後').closest('div');
    expect(preBlock).toHaveTextContent('2');
    expect(preBlock).toHaveTextContent('/ 3');
    expect(postBlock).toHaveTextContent('1');
    expect(postBlock).toHaveTextContent('/ 3');
  });

  it('列出課前未完成的成員', () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    expect(screen.getByText('課前未完成（2）')).toBeInTheDocument();
    expect(screen.getByText('小華')).toBeInTheDocument();
    expect(screen.getByText('小美')).toBeInTheDocument();
  });

  it('課前完成但課後未完成的人只出現在課後未完成名單，不會同時出現在課前名單', () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    const preSection = screen.getByText('課前未完成（2）').closest('div');
    expect(preSection).not.toHaveTextContent('小明');
    expect(screen.getByText('課後未完成（1）')).toBeInTheDocument();
  });

  it('全部完成時顯示恭喜訊息，不顯示未完成名單', () => {
    const submissions = [sub('u1', 'pre'), sub('u1', 'post'), sub('u2', 'pre'), sub('u2', 'post'), sub('u3', 'pre'), sub('u3', 'post')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    expect(screen.getByText(/所有成員都已完成評測/)).toBeInTheDocument();
    expect(screen.queryByText(/未完成/)).not.toBeInTheDocument();
  });

  it('複製提醒訊息會把班名、截止日、報到連結一起複製', async () => {
    const submissions = [sub('u1', 'pre')];
    render(<ProgressPanel group={group} members={members} submissions={submissions} />);
    fireEvent.click(screen.getByRole('button', { name: /複製提醒訊息/ }));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain('2026 秋季班');
    expect(text).toContain('ABC123');
    expect(text).toContain('尚未完成課前評測');
  });
});

describe('ProgressPanel：寄送提醒信（Sprint 6 驗收條件 6.5）', () => {
  const openGroup = { ...group, phase: 'in_progress' };

  function renderWithReminder(g, submissions, overrides = {}) {
    const props = {
      onGroupUpdated: vi.fn(),
      showToast: vi.fn(),
      confirm: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
    render(<ProgressPanel group={g} members={members} submissions={submissions} {...props} />);
    return props;
  }

  beforeEach(() => { api.sendGroupReminders.mockReset(); });

  it('沒傳 onGroupUpdated 時不顯示寄信按鈕（維持只能複製訊息）', () => {
    render(<ProgressPanel group={openGroup} members={members} submissions={[]} />);
    expect(screen.queryByRole('button', { name: /寄送提醒信/ })).not.toBeInTheDocument();
  });

  it('確認框寫明要寄給幾位成員；確認後呼叫 API、更新班級並顯示成功訊息', async () => {
    api.sendGroupReminders.mockResolvedValue({ phase: 'pre', sent: 2, failed: [], group: { ...openGroup, lastReminderSentAt: new Date().toISOString() } });
    const props = renderWithReminder(openGroup, [sub('u1', 'pre')]);

    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    await vi.waitFor(() => expect(props.showToast).toHaveBeenCalledWith('已寄出 2 封提醒信'));
    expect(props.confirm.mock.calls[0][0].message).toMatch(/課前評測.*2 位/);
    expect(api.sendGroupReminders).toHaveBeenCalledWith('g1');
    expect(props.onGroupUpdated).toHaveBeenCalledWith(expect.objectContaining({ lastReminderSentAt: expect.any(String) }));
  });

  it('待加入（尚未註冊）的名單也算進課前提醒人數', async () => {
    const props = renderWithReminder({ ...openGroup, pendingMembers: [{ email: 'new@x.com' }] }, [sub('u1', 'pre')]);
    props.confirm.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    await vi.waitFor(() => expect(props.confirm).toHaveBeenCalled());
    expect(props.confirm.mock.calls[0][0].message).toMatch(/3 位/);
  });

  it('全員課前完成後改催課後', async () => {
    const props = renderWithReminder(openGroup, [sub('u1', 'pre'), sub('u2', 'pre'), sub('u3', 'pre'), sub('u1', 'post')]);
    props.confirm.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    await vi.waitFor(() => expect(props.confirm).toHaveBeenCalled());
    expect(props.confirm.mock.calls[0][0].message).toMatch(/課後評測.*2 位/);
  });

  it('取消確認框就不寄信', async () => {
    const props = renderWithReminder(openGroup, []);
    props.confirm.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    await vi.waitFor(() => expect(props.confirm).toHaveBeenCalled());
    expect(api.sendGroupReminders).not.toHaveBeenCalled();
  });

  it('1 小時內寄過時按鈕停用並顯示剩餘時間', () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    renderWithReminder({ ...openGroup, lastReminderSentAt: recent }, []);
    expect(screen.getByRole('button', { name: /寄送提醒信/ })).toBeDisabled();
    expect(screen.getByText(/50 分鐘後可再寄/)).toBeInTheDocument();
  });

  it('冷卻時間一到，按鈕自動恢復可按（不必重新整理）', () => {
    vi.useFakeTimers();
    try {
      const almost = new Date(Date.now() - 59.5 * 60 * 1000).toISOString();
      renderWithReminder({ ...openGroup, lastReminderSentAt: almost }, []);
      expect(screen.getByRole('button', { name: /寄送提醒信/ })).toBeDisabled();
      act(() => { vi.advanceTimersByTime(60 * 1000); });
      expect(screen.getByRole('button', { name: /寄送提醒信/ })).toBeEnabled();
      expect(screen.queryByText(/分鐘後可再寄/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('不在施測期間時按鈕停用並說明原因', () => {
    renderWithReminder({ ...group, phase: 'not_started' }, []);
    expect(screen.getByRole('button', { name: /寄送提醒信/ })).toBeDisabled();
    expect(screen.getByText(/不在施測期間/)).toBeInTheDocument();
  });

  it('部分寄送失敗時列出失敗的信箱', async () => {
    api.sendGroupReminders.mockResolvedValue({ phase: 'pre', sent: 1, failed: ['hua@x.com'], group: openGroup });
    renderWithReminder(openGroup, [sub('u1', 'pre')]);
    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('hua@x.com');
  });

  it('後端錯誤（例如未設定寄信服務）直接顯示錯誤訊息', async () => {
    api.sendGroupReminders.mockRejectedValue(Object.assign(new Error('尚未設定寄信服務，請聯絡管理員設定 SMTP。'), { status: 503 }));
    renderWithReminder(openGroup, []);
    fireEvent.click(screen.getByRole('button', { name: /寄送提醒信/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('尚未設定寄信服務');
  });

  it('全員都完成時不顯示寄信按鈕', () => {
    const all = ['u1', 'u2', 'u3'].flatMap((u) => [sub(u, 'pre'), sub(u, 'post')]);
    renderWithReminder(openGroup, all);
    expect(screen.queryByRole('button', { name: /寄送提醒信/ })).not.toBeInTheDocument();
  });
});
