import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SharedGoalsPanel from '../survey/coach/SharedGoalsPanel.jsx';
import DevelopmentFunnelPanel from '../survey/admin/DevelopmentFunnelPanel.jsx';

const funnel = vi.hoisted(() => vi.fn());
vi.mock('../survey/api/client', () => ({ api: { adminDevelopmentFunnel: funnel } }));

describe('教練端：學員分享的發展目標', () => {
  it('依學員分組，顯示行動完成度與最近自評；說明沒分享的看不到、不含追蹤筆記', () => {
    render(<SharedGoalsPanel goals={[
      { id: 'g1', userId: 'u1', userName: '小明', dimensionName: '溝通', text: '每週練習表達', actions: [{ text: 'a', done: true }, { text: 'b', done: false }], reviewDate: '2026-12-01T00:00:00Z', achievedAt: null, checkinCount: 2, lastCheckin: { at: '2026-11-01T00:00:00Z', rating: 4 } },
      { id: 'g2', userId: 'u1', userName: '小明', text: '另一個目標', actions: [], achievedAt: '2026-11-05T00:00:00Z', checkinCount: 0, lastCheckin: null },
      { id: 'g3', userId: 'u2', userName: '小華', text: '小華的目標', actions: [], checkinCount: 0, lastCheckin: null },
    ]}
    />);
    expect(screen.getByText(/沒有分享的目標你看不到/)).toBeInTheDocument();
    expect(screen.getByText(/不含學員的追蹤筆記/)).toBeInTheDocument();
    expect(screen.getAllByText('小明')).toHaveLength(1);
    expect(screen.getByText(/行動 1\/2/)).toBeInTheDocument();
    expect(screen.getByText(/最近一次自評：大多有做/)).toBeInTheDocument();
    expect(screen.getByText(/已於 .* 達成/)).toBeInTheDocument();
    expect(screen.getByText('小華的目標')).toBeInTheDocument();
  });

  it('沒有人分享時說明學員可以選擇分享', () => {
    render(<SharedGoalsPanel goals={[]} />);
    expect(screen.getByText(/還沒有學員分享目標/)).toBeInTheDocument();
  });
});

describe('管理端：發展閉環漏斗', () => {
  it('顯示每一步的人數與比例，只有彙總', async () => {
    funnel.mockResolvedValue({ assessedUsers: 10, usersWithGoal: 5, goals: 8, goalsWithDoneAction: 4, goalsWithCheckin: 2, goalsAchieved: 1, goalsRetestedInTime: 3, goalsShared: 2, goalsSnoozed: 1 });
    render(<DevelopmentFunnelPanel />);
    const table = await screen.findByRole('table');
    const row = (label) => within(table).getByText(label).closest('tr');
    expect(within(row('訂了發展目標的人')).getByText('5')).toBeInTheDocument();
    expect(within(row('訂了發展目標的人')).getByText('50%')).toBeInTheDocument();
    expect(within(row('其中有行動被完成')).getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/分享給教練的目標 2 個；曾延後檢視日的目標 1 個/)).toBeInTheDocument();
  });
});
