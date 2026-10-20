import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MemberScreeningPanel from '../survey/coach/MemberScreeningPanel.jsx';
import JoinClassBanner from '../survey/components/JoinClassBanner.jsx';

const m = vi.hoisted(() => ({ setGroupExclusion: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: m }));
beforeEach(() => m.setGroupExclusion.mockReset());

const group = { id: 'g1', name: '韋能班' };
const members = [
  { id: 'u1', name: '王小明', email: 'ming@weineng.com.tw', excluded: false },
  { id: 'u2', name: '路人甲', email: 'stranger@gmail.com', excluded: false },
  { id: 'u3', name: '已排除的人', email: 'old@gmail.com', excluded: true },
];

describe('成員核對與排除', () => {
  it('貼上名單：標出在名單上／不在名單上／名單上還沒加入的人', () => {
    render(<MemberScreeningPanel group={group} members={members} />);
    fireEvent.change(screen.getByLabelText(/客戶的名單/), { target: { value: '王小明,ming@weineng.com.tw\n李小華,hua@weineng.com.tw' } });
    expect(screen.getByRole('status')).toHaveTextContent('名單 2 人：已加入 1 人、尚未加入 1 人');
    expect(screen.getByRole('status')).toHaveTextContent('2 人不在名單上');
    expect(screen.getByText('在名單上')).toBeInTheDocument();
    expect(screen.getAllByText('不在名單上')).toHaveLength(1);
    expect(screen.getByText('已排除（不列入統計）')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/名單上還沒加入的人/));
    expect(screen.getByText(/李小華 hua@weineng\.com\.tw/)).toBeInTheDocument();
  });

  it('排除與恢復呼叫 API 並要求重新載入；不貼名單也能排除', async () => {
    m.setGroupExclusion.mockResolvedValue({ ...group, excludedUserIds: ['u2'] });
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onGroupUpdated = vi.fn();
    render(<MemberScreeningPanel group={group} members={members} onChanged={onChanged} onGroupUpdated={onGroupUpdated} showToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '排除 路人甲（不列入統計）' }));
    await waitFor(() => expect(m.setGroupExclusion).toHaveBeenCalledWith('g1', 'u2', true));
    fireEvent.click(screen.getByRole('button', { name: '恢復 已排除的人' }));
    await waitFor(() => expect(m.setGroupExclusion).toHaveBeenCalledWith('g1', 'u3', false));
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(onGroupUpdated).toHaveBeenCalledTimes(2);
  });
});

describe('報到頁說明限制', () => {
  const base = { groupName: '韋能班', companyName: '韋能能源', assessmentName: 'AI 評測' };
  it('限定網域與名額已滿會在掃碼頁先說明', () => {
    const { rerender } = render(<JoinClassBanner info={{ ...base, emailDomains: ['weineng.com.tw'] }} />);
    expect(screen.getByText(/請使用 @weineng\.com\.tw 的 Email 註冊/)).toBeInTheDocument();
    rerender(<JoinClassBanner info={{ ...base, emailDomains: [], full: true }} />);
    expect(screen.getByText(/名額已滿/)).toBeInTheDocument();
  });
});
