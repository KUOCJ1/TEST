import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { summarizeSince } from '../survey/utils/growthTimeline';

vi.mock('../survey/api/client', () => ({ api: {
  mySubmissions: vi.fn(), myGoals: vi.fn(), myPractice: vi.fn(), myReflections: vi.fn(),
} }));
import { api } from '../survey/api/client';
import SinceLastCard from '../survey/components/SinceLastCard';

const ev = (id, at, kind) => ({ id, at, kind, title: kind });

describe('summarizeSince', () => {
  it('只算上次作答之後的事件，並彙整成片語', () => {
    const r = summarizeSince([ev('1', '2026-05-10', 'action-done'), ev('2', '2026-05-11', 'action-done'), ev('3', '2026-04-01', 'checkin'), ev('4', '2026-05-12', 'goal-set')], '2026-05-01');
    expect(r.total).toBe(2);
    expect(r.parts).toEqual(['完成 2 個行動']);
  });
  it('沒有事件時 total 為 0', () => {
    expect(summarizeSince([], '2026-05-01')).toMatchObject({ total: 0, parts: [], latest: null });
  });
});

describe('SinceLastCard', () => {
  beforeEach(() => {
    api.mySubmissions.mockResolvedValue([{ id: 's', assessmentId: 'a1', createdAt: '2026-05-01T00:00:00Z', raterType: 'self' }]);
    api.myPractice.mockResolvedValue(null);
    api.myReflections.mockResolvedValue([]);
  });
  it('有紀錄時顯示統計', async () => {
    api.myGoals.mockResolvedValue([{ id: 'g', assessmentId: 'a1', text: 't', createdAt: '2026-05-02T00:00:00Z', actions: [{ id: 'x', text: '約談', done: true, doneAt: '2026-05-05T00:00:00Z' }], checkins: [] }]);
    render(<SinceLastCard assessmentId="a1" enabled />);
    await waitFor(() => expect(screen.getByText(/完成 1 個行動/)).toBeInTheDocument());
  });
  it('沒有紀錄時用鼓勵語氣', async () => {
    api.myGoals.mockResolvedValue([]);
    render(<SinceLastCard assessmentId="a1" enabled />);
    await waitFor(() => expect(screen.getByText(/也沒關係/)).toBeInTheDocument());
  });
  it('沒有前一次自評或未啟用時不顯示', async () => {
    api.mySubmissions.mockResolvedValue([]);
    api.myGoals.mockResolvedValue([]);
    const { container } = render(<SinceLastCard assessmentId="a1" enabled />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
    expect(render(<SinceLastCard assessmentId="a1" enabled={false} />).container).toBeEmptyDOMElement();
  });
});
