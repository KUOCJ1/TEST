import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LearningResourceStatsPanel from '../survey/admin/LearningResourceStatsPanel';

const { adminLearningResourceStats } = vi.hoisted(() => ({ adminLearningResourceStats: vi.fn() }));
vi.mock('../survey/api/client', () => ({ api: { adminLearningResourceStats } }));

describe('LearningResourceStatsPanel', () => {
  it('沒有任何紀錄時顯示空狀態', async () => {
    adminLearningResourceStats.mockResolvedValue([]);
    render(<LearningResourceStatsPanel />);
    expect(await screen.findByText('目前還沒有任何點擊或加入清單的紀錄。')).toBeInTheDocument();
  });

  it('顯示依題庫＋構面彙總的點擊與加入清單次數', async () => {
    adminLearningResourceStats.mockResolvedValue([
      { assessmentId: 'leadership-9d', dimensionId: 'communication', clicks: 5, saves: 2 },
    ]);
    render(<LearningResourceStatsPanel />);
    expect(await screen.findByText('leadership-9d')).toBeInTheDocument();
    expect(screen.getByText('communication')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('載入失敗時顯示錯誤訊息', async () => {
    adminLearningResourceStats.mockRejectedValue(new Error('掛了'));
    render(<LearningResourceStatsPanel />);
    expect(await screen.findByText('掛了')).toBeInTheDocument();
  });
});
