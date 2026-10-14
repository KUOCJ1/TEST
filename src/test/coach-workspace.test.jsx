import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import GroupWorkspace from '../survey/coach/GroupWorkspace';
import OnboardingBanner from '../survey/components/OnboardingBanner';
import AssessmentCard from '../survey/components/AssessmentCard';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { ToastProvider } from '../survey/components/Toast';

// Sprint 11 驗收條件 11.2、11.6：教練後台進頁面自動選班、班別標題列、新手引導文字、班級指定標示。

const { coachGroups, getGroup, assessments } = vi.hoisted(() => ({ coachGroups: vi.fn(), getGroup: vi.fn(), assessments: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { coachGroups, getGroup, assessments } }));

const grp = (id, name, phase, extra = {}) => ({
  id, name, phase, assessmentId: 'ai-competency', memberIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra,
});

function renderWorkspace() {
  return render(<ToastProvider><ConfirmProvider><GroupWorkspace users={[]} currentUserId="coach1" /></ConfirmProvider></ToastProvider>);
}

beforeEach(() => {
  [coachGroups, getGroup, assessments].forEach((m) => m.mockReset());
  assessments.mockResolvedValue([]);
  getGroup.mockImplementation((id) => Promise.resolve({ group: grp(id, `班 ${id}`, 'in_progress', { companyName: '示範公司', startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z', memberIds: ['m1'] }), submissions: [], members: [{ id: 'm1', name: '林小美', email: 'm@x.co' }] }));
});

describe('GroupWorkspace：自動選班與標題列', () => {
  it('進頁面自動載入「進行中」的班別（多個時選最近更新的），並顯示標題列', async () => {
    coachGroups.mockResolvedValue([
      grp('old', '舊班', 'closed', { updatedAt: '2026-09-01T00:00:00Z' }),
      grp('a', '進行中甲', 'in_progress', { updatedAt: '2026-03-01T00:00:00Z' }),
      grp('b', '進行中乙', 'in_progress', { updatedAt: '2026-05-01T00:00:00Z' }),
    ]);
    renderWorkspace();
    await waitFor(() => expect(getGroup).toHaveBeenCalledWith('b'));
    expect(await screen.findByRole('heading', { name: '班 b' })).toBeInTheDocument();
    const header = screen.getByRole('heading', { name: '班 b' }).closest('div').parentElement;
    expect(header).toHaveTextContent('示範公司');
    expect(header).toHaveTextContent('AI 全方位職能實戰課前評測');
    expect(header).toHaveTextContent('1 人');
    expect(header).toHaveTextContent('2026/10/01 – 2026/12/31');
  });

  it('沒有進行中的班就選最近建立的；沒有任何班別時不載入、顯示提示', async () => {
    coachGroups.mockResolvedValue([grp('x', '舊', 'closed', { createdAt: '2026-01-01T00:00:00Z' }), grp('y', '新', 'not_started', { createdAt: '2026-06-01T00:00:00Z' })]);
    const { unmount } = renderWorkspace();
    await waitFor(() => expect(getGroup).toHaveBeenCalledWith('y'));
    unmount();

    getGroup.mockClear();
    coachGroups.mockResolvedValue([]);
    renderWorkspace();
    expect(await screen.findByText(/尚無班別/)).toBeInTheDocument();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('沒設定施測日期時標題列說明尚未設定', async () => {
    coachGroups.mockResolvedValue([grp('a', '甲', 'in_progress')]);
    getGroup.mockResolvedValue({ group: grp('a', '甲', 'in_progress'), submissions: [], members: [] });
    renderWorkspace();
    expect(await screen.findByText(/尚未設定施測日期/)).toBeInTheDocument();
  });
});

describe('新手引導與卡片文字', () => {
  it('教練新手引導的文字對應現行的分頁（班級／成員與設定／總覽／360° 進度），不再提已不存在的「個人評語」「班別管理」', () => {
    localStorage.clear();
    render(<OnboardingBanner role="coach" />);
    expect(screen.getByText(/建立班別並邀請學員/)).toBeInTheDocument();
    expect(screen.getByText(/報到 QR Code/)).toBeInTheDocument();
    expect(screen.queryByText(/個人評語」分頁/)).not.toBeInTheDocument();
    expect(screen.queryByText(/班別管理」/)).not.toBeInTheDocument();
  });

  it('已加入班級的評量卡片有「班級指定」標示；沒有班級的沒有', () => {
    const a = { id: 'ai-competency', name: 'AI 職能', description: 'd' };
    const { rerender } = render(<AssessmentCard assessment={a} groupPhase="in_progress" submittedPhases={new Set()} onStart={() => {}} onViewAnalysis={() => {}} />);
    expect(screen.getByText('班級指定')).toBeInTheDocument();
    rerender(<AssessmentCard assessment={a} groupPhase={null} submittedPhases={null} onStart={() => {}} onViewAnalysis={() => {}} />);
    expect(screen.queryByText('班級指定')).not.toBeInTheDocument();
  });
});
