import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LearningResources from '../survey/components/LearningResources';

const {
  learningResources, myReadingList, addToReadingList, trackArticleClick, myGoals, createGoal, updateGoal,
} = vi.hoisted(() => ({
  learningResources: vi.fn(),
  myReadingList: vi.fn(),
  addToReadingList: vi.fn(),
  trackArticleClick: vi.fn(),
  myGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
}));

vi.mock('../survey/api/client', () => ({
  api: { learningResources, myReadingList, addToReadingList, trackArticleClick, myGoals, createGoal, updateGoal },
}));

const dimensions = [{ id: 'communication', subtitle: '溝通力', average: 3.2 }];
const article = { title: '溝通的藝術', url: 'https://brain.rong-rise.com/brain/x/', excerpt: '摘要', category: '管理心理學' };

beforeEach(() => {
  Object.values({ learningResources, myReadingList, addToReadingList, trackArticleClick, myGoals, createGoal, updateGoal })
    .forEach((fn) => fn.mockReset());
  myReadingList.mockResolvedValue([]);
  myGoals.mockResolvedValue([]);
  learningResources.mockResolvedValue([{ dimensionId: 'communication', articles: [article] }]);
});

describe('LearningResources', () => {
  it('沒有任何文章時不渲染', async () => {
    learningResources.mockResolvedValue([{ dimensionId: 'communication', articles: [] }]);
    const { container } = render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);
    await vi.waitFor(() => expect(learningResources).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('點擊「加入清單」會呼叫 API 並改為「已加入清單」', async () => {
    addToReadingList.mockResolvedValue({ id: 'r1' });
    render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);
    const saveBtn = await screen.findByRole('button', { name: /加入清單/ });
    fireEvent.click(saveBtn);

    expect(addToReadingList).toHaveBeenCalledWith(expect.objectContaining({
      url: article.url,
      title: article.title,
      assessmentId: 'leadership-9d',
      dimensionId: 'communication',
      dimensionName: '溝通力',
    }));
    expect(await screen.findByRole('button', { name: /已加入清單/ })).toBeDisabled();
  });

  it('已經加過的文章載入時就直接顯示「已加入清單」', async () => {
    myReadingList.mockResolvedValue([{ url: article.url }]);
    render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);
    expect(await screen.findByRole('button', { name: /已加入清單/ })).toBeDisabled();
  });

  it('點擊文章標題連結會記一筆點擊', async () => {
    render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);
    const link = await screen.findByRole('link', { name: new RegExp(article.title) });
    fireEvent.click(link);
    expect(trackArticleClick).toHaveBeenCalledWith({ assessmentId: 'leadership-9d', dimensionId: 'communication', url: article.url });
  });

  it('加入目標：沒有既有目標時直接建立新目標', async () => {
    createGoal.mockResolvedValue({ id: 'g1', actions: [{ id: 'a1', text: 'x', done: false }], achievedAt: null });
    render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);

    fireEvent.click(await screen.findByRole('button', { name: /加入目標/ }));
    fireEvent.click(screen.getByRole('button', { name: '確認加入' }));

    await vi.waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
    const payload = createGoal.mock.calls[0][0];
    expect(payload.assessmentId).toBe('leadership-9d');
    expect(payload.dimensionId).toBe('communication');
    expect(payload.baselineAverage).toBe(3.2);
    expect(payload.actions[0].text).toContain(article.title);
    expect(payload.actions[0].text).toContain(article.url);
    expect(await screen.findByText('已加入目標')).toBeInTheDocument();
  });

  it('加入目標：選擇既有目標會把行動附加上去而不是新建', async () => {
    myGoals.mockResolvedValue([{ id: 'g-existing', text: '既有目標', actions: [], achievedAt: null }]);
    updateGoal.mockResolvedValue({ id: 'g-existing', text: '既有目標', actions: [{ id: 'a1', text: 'x', done: false }], achievedAt: null });
    render(<LearningResources assessmentId="leadership-9d" dimensions={dimensions} />);

    fireEvent.click(await screen.findByRole('button', { name: /加入目標/ }));
    const select = await screen.findByLabelText('加到哪個目標？');
    fireEvent.change(select, { target: { value: 'g-existing' } });
    fireEvent.click(screen.getByRole('button', { name: '確認加入' }));

    await vi.waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
    expect(updateGoal).toHaveBeenCalledWith('g-existing', {
      actions: [expect.objectContaining({ text: expect.stringContaining(article.title) })],
    });
    expect(createGoal).not.toHaveBeenCalled();
  });
});
