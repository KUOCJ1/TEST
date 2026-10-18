import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RaterInvitePanel, { InvitationsToRate } from '../survey/components/compass/RaterInvitePanel.jsx';
import GroupInvites from '../survey/components/GroupInvites.jsx';

const m = vi.hoisted(() => ({
  raterInvitesMine: vi.fn(), createRaterInvite: vi.fn(), deleteRaterInvite: vi.fn(), groupRaterInvites: vi.fn(),
  acceptGroupInvite: vi.fn(), declineGroupInvite: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: m }));

const ID = 'leadership-compass';
const members = [{ id: 'b', name: '乙' }, { id: 'c', name: '丙' }];

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe('邀請別人評我（領導力羅盤）', () => {
  it('選成員與身分後送出邀請，並列出已邀請的人（不顯示完成狀態）', async () => {
    m.raterInvitesMine.mockResolvedValueOnce({ invited: [] }).mockResolvedValue({ invited: [{ id: 'i1', assessmentId: ID, raterUserId: 'b', raterName: '乙', raterType: 'peer' }] });
    m.createRaterInvite.mockResolvedValue({});
    render(<RaterInvitePanel assessmentId={ID} members={members} />);
    fireEvent.change(await screen.findByLabelText('邀請誰'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }));
    await waitFor(() => expect(m.createRaterInvite).toHaveBeenCalledWith({ assessmentId: ID, raterUserId: 'b', raterType: 'peer' }));
    const list = await screen.findByRole('list', { name: '已發出的邀請' });
    expect(list.textContent).toContain('乙');
    expect(list.textContent).not.toMatch(/已完成|未完成/);
  });

  it('沒選成員就送出會提示；伺服器拒絕時顯示原因', async () => {
    m.raterInvitesMine.mockResolvedValue({ invited: [] });
    m.createRaterInvite.mockRejectedValue(new Error('評分者與受評者必須在同一個班級'));
    render(<RaterInvitePanel assessmentId={ID} members={members} />);
    fireEvent.click(await screen.findByRole('button', { name: '送出邀請' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請先選擇要邀請的成員');
    fireEvent.change(screen.getByLabelText('邀請誰'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }));
    expect(await screen.findByText(/必須在同一個班級/)).toBeInTheDocument();
  });

  it('教練模式：先選受評者，邀請會帶上 rateeId 與 groupId', async () => {
    m.groupRaterInvites.mockResolvedValue([]);
    m.createRaterInvite.mockResolvedValue({});
    render(<RaterInvitePanel assessmentId={ID} groupId="g1" members={members} rateeOptions={members} />);
    fireEvent.change(await screen.findByLabelText('邀請誰'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }));
    await waitFor(() => expect(m.createRaterInvite).toHaveBeenCalledWith({ assessmentId: ID, raterUserId: 'c', raterType: 'peer', rateeId: 'b', groupId: 'g1' }));
  });
});

describe('等你評測的人', () => {
  it('列出收到的邀請，點「開始評測」帶出受評者與邀請決定的身分', async () => {
    m.raterInvitesMine.mockResolvedValue({ toRate: [{ id: 'i', assessmentId: ID, rateeId: 'r', rateeName: '小明', raterType: 'subordinate' }, { id: 'j', assessmentId: 'other', rateeId: 'z', rateeName: '別的', raterType: 'peer' }] });
    const onRate = vi.fn();
    render(<InvitationsToRate assessmentId={ID} onRate={onRate} />);
    expect(await screen.findByText('小明')).toBeInTheDocument();
    expect(screen.queryByText('別的')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '開始評測' }));
    expect(onRate).toHaveBeenCalledWith('r', 'subordinate', '小明');
  });

  it('沒有邀請時說明需要受評者或教練邀請', async () => {
    m.raterInvitesMine.mockResolvedValue({ toRate: [] });
    render(<InvitationsToRate assessmentId={ID} onRate={() => {}} />);
    expect(await screen.findByText(/受評者本人或教練/)).toBeInTheDocument();
  });
});

describe('班級邀請', () => {
  const invite = { id: 'gi1', groupName: '領導班', companyName: '甲公司', coachName: '王教練' };
  it('顯示邀請內容與可見範圍；接受後通知重新載入', async () => {
    m.acceptGroupInvite.mockResolvedValue({});
    const onChanged = vi.fn();
    render(<GroupInvites invites={[invite]} onChanged={onChanged} />);
    expect(screen.getByText(/王教練邀請你加入「領導班」/)).toBeInTheDocument();
    expect(screen.getByText(/教練可以看到你在這個班的作答與成績/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '接受邀請' }));
    await waitFor(() => expect(m.acceptGroupInvite).toHaveBeenCalledWith('gi1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('婉拒會呼叫婉拒；沒有邀請時什麼都不顯示', async () => {
    m.declineGroupInvite.mockResolvedValue({});
    const { container, rerender } = render(<GroupInvites invites={[invite]} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '婉拒' }));
    await waitFor(() => expect(m.declineGroupInvite).toHaveBeenCalledWith('gi1'));
    rerender(<GroupInvites invites={[]} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
