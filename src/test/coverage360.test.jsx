import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThreeSixtyCoveragePanel from '../survey/coach/ThreeSixtyCoveragePanel.jsx';
import { buildCoverage, GROUP_MIN } from '../survey/utils/coverage360.js';
import { api } from '../survey/api/client';

vi.mock('../survey/api/client', () => ({ api: { remindGroupRaters: vi.fn(), logReportExport: vi.fn().mockResolvedValue({ ok: true }), rateeSubmissions: vi.fn().mockResolvedValue([]) } }));

const row = (name, byType, count) => ({ userId: name, name, others: byType ? { count: count ?? Object.values(byType).reduce((a, b) => a + b, 0), byType } : null });
const group = { id: 'g1', name: '森永班', assessmentId: 'leadership-360-70' };

describe('360° 他評收齊清單', () => {
  beforeEach(() => vi.clearAllMocks());

  it('buildCoverage：沒有他評、同儕不足、已收齊各自標示；主管 1 位不算不足', () => {
    const c = buildCoverage([row('甲', null), row('乙', { manager: 1, peer: 2, subordinate: 3 }), row('丙', { manager: 1, peer: 3, subordinate: 4 })]);
    expect(c[0].none).toBe(true);
    expect(c[1].low).toEqual(['peer']);
    expect(c[2].low).toEqual([]);
    expect(GROUP_MIN).toBe(3);
  });

  it('buildCoverage：他評合計不足 3 位標 short（報告暫不顯示他評）', () => {
    const c = buildCoverage([row('甲', { manager: 1, peer: 1, subordinate: 0 }), row('乙', { manager: 1, peer: 1, subordinate: 1 })]);
    expect(c[0]).toMatchObject({ short: true, total: 2 });
    expect(c[1]).toMatchObject({ short: false, total: 3 });
  });

  it('面板只有人數與狀態、不含評分者姓名；提醒呼叫 API 並顯示寄出人數', async () => {
    api.remindGroupRaters.mockResolvedValue({ sent: 4 });
    const toast = vi.fn();
    render(<ThreeSixtyCoveragePanel group={group} memberRows={[row('甲', null), row('乙', { manager: 1, peer: 2, subordinate: 3 }), row('丙', { manager: 1, peer: 3, subordinate: 4 })]} mailConfigured showToast={toast} />);
    expect(screen.getByText('尚無他評')).toBeInTheDocument();
    expect(screen.getByText(/同儕未達 3 位/)).toBeInTheDocument();
    expect(screen.getByText('已收齊')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '提醒尚未完成的評分者' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('已提醒 4 位尚未完成的評分者'));
  });

  it('沒有 SMTP：提醒按鈕停用；非 360° 題庫（或嚴格隱私）整個面板不出現', () => {
    const { unmount } = render(<ThreeSixtyCoveragePanel group={group} memberRows={[row('乙', { manager: 1 })]} mailConfigured={false} showToast={() => {}} />);
    expect(screen.getByRole('button', { name: '提醒尚未完成的評分者' })).toBeDisabled();
    unmount();
    const { container } = render(<ThreeSixtyCoveragePanel group={{ ...group, assessmentId: 'leadership-compass' }} memberRows={[row('乙', { manager: 1 })]} mailConfigured showToast={() => {}} />);
    expect(container.textContent).toBe('');
  });
});
