import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReflectionsPanel from '../survey/components/ReflectionsPanel.jsx';
import CoachingSessionsSection from '../survey/coach/CoachingSessionsSection.jsx';
import { coachingLine } from '../survey/utils/groupSummary.js';
import { ConfirmProvider } from '../survey/components/ConfirmDialog.jsx';

const { api } = vi.hoisted(() => ({ api: { myReflections: vi.fn(), submitReflection: vi.fn(), groupSessions: vi.fn(), createSession: vi.fn(), replyReflection: vi.fn(), deleteSession: vi.fn() } }));
vi.mock('../survey/api/client', () => ({ api }));

const session = (extra = {}) => ({
  id: 's1', type: 'one-on-one', typeLabel: '一對一教練', title: '授權與交辦', focus: '練習一對一回饋', sessionDate: '2026-11-17T04:00:00Z', dueAt: '2026-11-20T04:00:00Z',
  coachName: '陳教練', coachComment: { text: '溝通很清楚，下一步練授權。', tips: ['每週交辦一件事'] }, reflection: null, overdue: false, ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe('學員：會後反思', () => {
  it('待填：看得到教練的評語與焦點；四題填完才能送出，可勾選變成目標', async () => {
    api.myReflections.mockResolvedValue([session()]);
    api.submitReflection.mockResolvedValue(session({ reflection: { insight: 'a', action: 'b', rating: 4, submittedAt: '2026-11-17', goalId: 'g1' } }));
    render(<ReflectionsPanel />);
    expect(await screen.findByText('溝通很清楚，下一步練授權。')).toBeInTheDocument();
    expect(screen.getByText(/待填 1/)).toBeInTheDocument();
    expect(screen.getByText('本次焦點：練習一對一回饋')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: '送出反思' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/最大的收穫/), { target: { value: '我太快給答案' } });
    fireEvent.change(screen.getByLabelText(/一個行動/), { target: { value: '下次先問三個問題' } });
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /變成我的發展目標/ }));
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() => expect(api.submitReflection).toHaveBeenCalledWith('s1', expect.objectContaining({ insight: '我太快給答案', action: '下次先問三個問題', rating: 4, makeGoal: true })));
    expect(await screen.findByText(/已設成發展目標/)).toBeInTheDocument();
  });

  it('已繳交：顯示摘要與教練回覆，可以修改；沒有任何會談時不顯示', async () => {
    api.myReflections.mockResolvedValue([session({ reflection: { insight: '收穫一', action: '行動一', rating: 5, submittedAt: '2026-11-17', coachReply: { text: '很好的覺察', by: '陳教練' } } })]);
    const { unmount } = render(<ReflectionsPanel />);
    expect(await screen.findByText('很好的覺察')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '修改' }));
    expect(screen.getByRole('button', { name: '更新反思' })).toBeInTheDocument();
    unmount();
    api.myReflections.mockResolvedValue([]);
    const { container } = render(<ReflectionsPanel />);
    await waitFor(() => expect(api.myReflections).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('教練：會談分頁', () => {
  const members = [{ id: 'u1', name: '學員甲' }, { id: 'u2', name: '學員乙' }, { id: 'u3', name: '學員丙', excluded: true }];
  const group = { id: 'g1', name: '班' };

  it('從成員抽屜帶入：一對一、只選那一位；建立後列出繳交狀況', async () => {
    api.groupSessions.mockResolvedValue([]);
    api.createSession.mockResolvedValue({ id: 's9', type: 'one-on-one', typeLabel: '一對一教練', title: '一對一：學員甲', sessionDate: '2026-11-17T04:00:00Z', dueAt: '2026-11-20T04:00:00Z', participants: [{ userId: 'u1', name: '學員甲', status: 'pending', reflection: null }] });
    render(<ConfirmProvider><CoachingSessionsSection group={group} members={members} prefill={{ userId: 'u1', title: '一對一：學員甲' }} /></ConfirmProvider>);
    expect(screen.getByRole('radio', { name: '一對一教練' })).toBeChecked();
    expect(screen.getByDisplayValue('一對一：學員甲')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '學員甲' })).toBeChecked();
    expect(screen.queryByText('學員丙')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '建立會談' }));
    await waitFor(() => expect(api.createSession).toHaveBeenCalledWith('g1', expect.objectContaining({ type: 'one-on-one', participantIds: ['u1'] })));
    expect(await screen.findByText('已繳 0／1')).toBeInTheDocument();
  });

  it('已繳交：可展開看全文並回覆', async () => {
    const reflection = { insight: '收穫X', action: '行動Y', support: '', rating: 4, ratingNote: '', submittedAt: '2026-11-17' };
    const s = { id: 's1', type: 'team', typeLabel: '團隊教練', title: '團隊一', sessionDate: '2026-11-17T04:00:00Z', dueAt: '2026-11-20T04:00:00Z', participants: [{ userId: 'u1', name: '學員甲', status: 'submitted', reflection }, { userId: 'u2', name: '學員乙', status: 'overdue', reflection: null }] };
    api.groupSessions.mockResolvedValue([s]);
    api.replyReflection.mockResolvedValue(s);
    render(<ConfirmProvider><CoachingSessionsSection group={group} members={members} /></ConfirmProvider>);
    expect(await screen.findByText('已繳 1／2')).toBeInTheDocument();
    expect(screen.getByText('逾期未繳')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/看反思內容/));
    expect(screen.getByText('收穫X')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('回覆 學員甲'), { target: { value: '下次見' } });
    fireEvent.click(screen.getByRole('button', { name: /回覆/ }));
    await waitFor(() => expect(api.replyReflection).toHaveBeenCalledWith('s1', 'u1', '下次見'));
    expect(screen.queryByRole('button', { name: /刪除會談/ })).toBeNull();
  });
});

describe('班級報告的會談彙總文字', () => {
  it('有平均才說平均；沒有姓名', () => {
    expect(coachingLine({ sessions: 3, oneOnOne: 2, team: 1, assigned: 10, submitted: 8, rate: 80, avgRating: 4.2, ratingCount: 8 })).toBe('共 3 場（一對一 2 場、團隊 1 場），會後反思繳交 8／10 份（80%），學員對會談的回饋平均 4.2／5（8 份）。');
    expect(coachingLine({ sessions: 1, oneOnOne: 1, team: 0, assigned: 1, submitted: 1, rate: 100, avgRating: null, ratingCount: 1 })).toBe('共 1 場（一對一 1 場），會後反思繳交 1／1 份（100%）。');
  });
});
