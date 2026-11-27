import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThisWeekCard from '../survey/components/ThisWeekCard.jsx';
import { buildThisWeek } from '../survey/utils/thisWeek.js';
import { focusDimension, strongestDimension } from '../survey/utils/focus.js';

const { api } = vi.hoisted(() => ({ api: { myPractice: vi.fn(), myReflections: vi.fn(), markPracticeWeek: vi.fn() } }));
vi.mock('../survey/api/client', () => ({ api }));

const practice = (done = false) => ({ active: true, currentWeek: 2, weeks: [1, 2, 3, 4].map((w) => ({ week: w, task: w <= 2 ? `任務${w}` : null, doneAt: w === 2 && done ? 'x' : null })) });
const goals = [{ achievedAt: null, actions: [{ done: true }, { done: false }] }, { achievedAt: '2026-01-01', actions: [{ done: true }] }];

beforeEach(() => { vi.clearAllMocks(); api.myPractice.mockResolvedValue(null); api.myReflections.mockResolvedValue([]); });

describe('焦點構面：全站同一個規則', () => {
  const dims = [{ id: 'a', average: 3.2 }, { id: 'b', average: 3.2 }, { id: 'c', average: 3.9 }, { id: 'd', average: 0 }];
  it('最低分；同分取題庫順序在前；沒作答（0）的不算', () => {
    expect(focusDimension(dims).id).toBe('a');
    expect(focusDimension([...dims].reverse().filter((d) => d.id !== 'd')).id).toBe('b'); // 順序顛倒，同分取前面那個（固定規則）
    expect(strongestDimension(dims).id).toBe('c');
    expect(focusDimension([])).toBeNull();
  });
});

describe('這週你的小步：內容與順序', () => {
  it('微練習 → 會後反思 → 目標；最多三件；已達成的目標不算', () => {
    const items = buildThisWeek({ practice: practice(), reflectionsPending: 2, goals });
    expect(items.map((i) => i.id)).toEqual(['practice', 'reflection', 'goals']);
    expect(items[2]).toMatchObject({ title: '進行中的目標 1 個', detail: '行動完成 1／2' });
  });
  it('本週已做完、沒有反思、沒有目標 → 沒有任何項目', () => {
    expect(buildThisWeek({ practice: practice(true), reflectionsPending: 0, goals: [] })).toEqual([]);
  });
});

describe('ThisWeekCard', () => {
  it('沒有待辦時整張卡不出現', async () => {
    const { container } = render(<ThisWeekCard goals={[]} onGoLearning={() => {}} />);
    await waitFor(() => expect(api.myPractice).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('練習期：卡片底下有複測時間一行；沒有待辦時改顯示替代內容（原本的下一步大卡）', async () => {
    const { rerender } = render(<ThisWeekCard goals={goals} onGoLearning={() => {}} footnote="大約 12/18 之後再做課後複測" />);
    expect(await screen.findByText('大約 12/18 之後再做課後複測')).toBeInTheDocument();
    rerender(<ThisWeekCard goals={[]} onGoLearning={() => {}} emptyFallback={<p>下一步大卡</p>} />);
    expect(await screen.findByText('下一步大卡')).toBeInTheDocument();
  });

  it('本週的小步可以直接按「我做了」；做完後顯示鼓勵', async () => {
    api.myPractice.mockResolvedValue(practice());
    api.markPracticeWeek.mockResolvedValue(practice(true));
    render(<ThisWeekCard goals={[]} onGoLearning={() => {}} />);
    expect(await screen.findByText('任務2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /我做了/ }));
    await waitFor(() => expect(api.markPracticeWeek).toHaveBeenCalledWith(2, true));
    expect(await screen.findByRole('status')).toHaveTextContent('本週的小步完成了');
  });

  it('待填反思與目標：前往我的學習', async () => {
    api.myReflections.mockResolvedValue([{ reflection: null }, { reflection: { insight: 'x' } }]);
    const go = vi.fn();
    render(<ThisWeekCard goals={goals} onGoLearning={go} />);
    expect(await screen.findByText('會後反思待填 1 份')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /會後反思待填 1 份，前往我的學習/ }));
    expect(go).toHaveBeenCalledTimes(1);
  });
});
