import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyLearningPage from '../survey/learning/MyLearningPage';

const {
  myGoals, myReadingList, markReadingListItem, removeReadingListItem,
} = vi.hoisted(() => ({
  myGoals: vi.fn(),
  myReadingList: vi.fn(),
  markReadingListItem: vi.fn(),
  removeReadingListItem: vi.fn(),
}));

vi.mock('../survey/api/client', () => ({
  api: { myGoals, myReadingList, markReadingListItem, removeReadingListItem },
}));

const goal = {
  id: 'g1', text: '每週練習表達', dimensionName: '溝通力', actions: [{ done: true }, { done: false }],
  createdAt: '2026-01-01T00:00:00Z', reviewDate: '2026-02-01T00:00:00Z', achievedAt: null,
};
const item = {
  id: 'r1', title: '溝通的藝術', url: 'https://x/', dimensionName: '溝通力',
  addedAt: '2026-01-01T00:00:00Z', read: false,
};

describe('MyLearningPage', () => {
  it('空狀態：沒有目標與學習清單時顯示引導文字', async () => {
    myGoals.mockResolvedValue([]);
    myReadingList.mockResolvedValue([]);
    render(<MyLearningPage />);
    expect(await screen.findByText(/還沒有進行中的目標/)).toBeInTheDocument();
    expect(screen.getByText(/還沒有加入任何文章/)).toBeInTheDocument();
  });

  it('顯示進行中目標與學習清單項目', async () => {
    myGoals.mockResolvedValue([goal]);
    myReadingList.mockResolvedValue([item]);
    render(<MyLearningPage />);
    expect(await screen.findByText('每週練習表達')).toBeInTheDocument();
    expect(screen.getByText(/行動 1\/2/)).toBeInTheDocument();
    expect(screen.getByText('溝通的藝術', { exact: false })).toBeInTheDocument();
  });

  it('可以標記文章已讀', async () => {
    myGoals.mockResolvedValue([]);
    myReadingList.mockResolvedValue([item]);
    markReadingListItem.mockResolvedValue({ ...item, read: true, readAt: '2026-01-02T00:00:00Z' });
    render(<MyLearningPage />);
    await screen.findByText('溝通的藝術', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: '標記為已讀' }));
    expect(markReadingListItem).toHaveBeenCalledWith('r1', true);
    expect(await screen.findByRole('button', { name: '標記為未讀' })).toBeInTheDocument();
  });

  it('可以移除學習清單項目', async () => {
    myGoals.mockResolvedValue([]);
    myReadingList.mockResolvedValue([item]);
    removeReadingListItem.mockResolvedValue({ ok: true });
    render(<MyLearningPage />);
    await screen.findByText('溝通的藝術', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    expect(removeReadingListItem).toHaveBeenCalledWith('r1');
    await vi.waitFor(() => expect(screen.queryByText('溝通的藝術', { exact: false })).not.toBeInTheDocument());
  });
});
