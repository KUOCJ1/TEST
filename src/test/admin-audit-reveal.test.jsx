import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogTab from '../survey/admin/AuditLogTab.jsx';
import RaterRevealTab from '../survey/admin/RaterRevealTab.jsx';

const m = vi.hoisted(() => ({ adminAuditLog: vi.fn(), revealRaters: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: m }));

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe('稽核紀錄分頁', () => {
  it('列出紀錄（動作用白話名稱），可用動作篩選與載入更多', async () => {
    m.adminAuditLog.mockResolvedValueOnce({
      entries: [{ id: '1', ts: '2026-10-18T10:00:00.000Z', actorEmail: 'admin@x.co', action: 'view_rater_identity', rateeId: 'r1', reason: '客訴調查' }],
      actions: ['view_rater_identity', 'delete_group'], hasMore: true,
    });
    render(<AuditLogTab />);
    expect(await screen.findByRole('cell', { name: '還原評分者身分' })).toBeInTheDocument();
    expect(screen.getByText(/reason: 客訴調查/)).toBeInTheDocument();
    m.adminAuditLog.mockResolvedValueOnce({ entries: [{ id: '2', ts: '2026-10-17T10:00:00.000Z', actorEmail: 'a@x.co', action: 'delete_group' }], actions: [], hasMore: false });
    fireEvent.click(screen.getByRole('button', { name: '載入更多' }));
    expect(await screen.findByRole('cell', { name: '刪除班級' })).toBeInTheDocument();
    expect(m.adminAuditLog).toHaveBeenLastCalledWith({ action: '', before: '2026-10-18T10:00:00.000Z' });
    expect(screen.queryByRole('button', { name: '載入更多' })).not.toBeInTheDocument();
  });

  it('沒有紀錄時顯示說明；載入失敗顯示錯誤', async () => {
    m.adminAuditLog.mockResolvedValueOnce({ entries: [], actions: [], hasMore: false });
    const { unmount } = render(<AuditLogTab />);
    expect(await screen.findByText('還沒有紀錄。')).toBeInTheDocument();
    unmount();
    m.adminAuditLog.mockRejectedValueOnce(new Error('需要管理員權限'));
    render(<AuditLogTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('需要管理員權限');
  });
});

describe('身分還原分頁', () => {
  const users = [{ id: 'r1', name: '小明', email: 'm@x.co', role: 'user' }, { id: 'a', name: '管', email: 'a@x.co', role: 'admin' }];

  it('提醒會留稽核；沒選受評者或理由太短不會送出', async () => {
    render(<RaterRevealTab users={users} />);
    expect(screen.getByRole('note')).toHaveTextContent('每次查看都會留下稽核紀錄');
    fireEvent.click(screen.getByRole('button', { name: /還原並查看/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請先選擇受評者');
    fireEvent.change(screen.getByLabelText('受評者'), { target: { value: 'r1' } });
    fireEvent.change(screen.getByLabelText(/還原理由/), { target: { value: '短' } });
    fireEvent.click(screen.getByRole('button', { name: /還原並查看/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('至少 5 個字');
    expect(m.revealRaters).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: /管/ })).not.toBeInTheDocument();
  });

  it('填理由後顯示評分者身分與各構面平均', async () => {
    m.revealRaters.mockResolvedValue({
      ratee: { id: 'r1', name: '小明' },
      submissions: [
        { id: 's', raterType: 'self', userName: '小明' },
        { id: 'p', raterType: 'peer', userName: '同事甲', phase: 'pre', createdAt: '2026-10-10T00:00:00Z', result: { dimensions: [{ subtitle: 'Find', average: 4.25 }] } },
      ],
    });
    render(<RaterRevealTab users={users} />);
    fireEvent.change(screen.getByLabelText('受評者'), { target: { value: 'r1' } });
    fireEvent.change(screen.getByLabelText(/還原理由/), { target: { value: '客訴調查需要確認評分者' } });
    fireEvent.click(screen.getByRole('button', { name: /還原並查看/ }));
    expect(await screen.findByText('同事甲')).toBeInTheDocument();
    expect(screen.getByText(/Find 4\.3/)).toBeInTheDocument();
    await waitFor(() => expect(m.revealRaters).toHaveBeenCalledWith('r1', { assessmentId: 'leadership-compass', reason: '客訴調查需要確認評分者' }));
    expect(screen.queryByText('小明', { selector: 'td' })).not.toBeInTheDocument();
  });
});
