import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GoalItem from '../survey/components/GoalItem.jsx';
import GoalReminders from '../survey/components/GoalReminders.jsx';
import { ConfirmProvider } from '../survey/components/ConfirmDialog';
import { goalReminders } from '../survey/utils/goalReminders';
import { GOAL_STARTERS, GENERIC_STARTERS, startersFor } from '../survey/data/goal-starters';
import { REGISTRY } from '../survey/data/assessments/index.js';

const m = vi.hoisted(() => ({
  updateGoal: vi.fn(), snoozeGoal: vi.fn(), addGoalCheckin: vi.fn(), removeGoalCheckin: vi.fn(), deleteGoal: vi.fn(),
}));
vi.mock('../survey/api/client', () => ({ api: m }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); navigate.mockReset(); });

const DAY = 864e5;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();
const baseGoal = {
  id: 'g1', assessmentId: 'ai-competency', dimensionId: 'communication', dimensionName: 'Communication', text: '每週練習表達',
  actions: [{ id: 'a1', text: '行動一', done: false }], createdAt: iso(-20), reviewDate: iso(10), achievedAt: null,
  baselineAverage: 2.5, sharedWithCoach: false, checkins: [],
};
const wrap = (ui) => render(<MemoryRouter><ConfirmProvider>{ui}</ConfirmProvider></MemoryRouter>);

describe('GoalItem', () => {
  it('勾行動、標達成都會呼叫 API 並回報更新後的目標', async () => {
    const onChange = vi.fn();
    m.updateGoal.mockResolvedValueOnce({ ...baseGoal, actions: [{ id: 'a1', text: '行動一', done: true }] })
      .mockResolvedValueOnce({ ...baseGoal, achievedAt: iso(0) });
    wrap(<ul><GoalItem goal={baseGoal} onChange={onChange} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: /未完成：行動一/ }));
    await waitFor(() => expect(m.updateGoal).toHaveBeenCalledWith('g1', { actions: [{ id: 'a1', text: '行動一', done: true }] }));
    fireEvent.click(screen.getByRole('button', { name: '標記達成' }));
    await waitFor(() => expect(m.updateGoal).toHaveBeenLastCalledWith('g1', { achieved: true }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('預設不分享給教練；勾選後送出 sharedWithCoach，說明追蹤筆記不會給教練看', async () => {
    m.updateGoal.mockResolvedValue({ ...baseGoal, sharedWithCoach: true });
    wrap(<ul><GoalItem goal={baseGoal} onChange={() => {}} /></ul>);
    const box = screen.getByRole('checkbox', { name: /分享給我的教練/ });
    expect(box).not.toBeChecked();
    expect(screen.getByText(/目前只有你看得到/)).toBeInTheDocument();
    fireEvent.click(box);
    await waitFor(() => expect(m.updateGoal).toHaveBeenCalledWith('g1', { sharedWithCoach: true }));
  });

  it('修改檢視日、延後一週', async () => {
    m.updateGoal.mockResolvedValue(baseGoal);
    m.snoozeGoal.mockResolvedValue(baseGoal);
    wrap(<ul><GoalItem goal={baseGoal} onChange={() => {}} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: '延後一週' }));
    await waitFor(() => expect(m.snoozeGoal).toHaveBeenCalledWith('g1', 7));
    fireEvent.click(screen.getByRole('button', { name: /修改檢視日/ }));
    fireEvent.change(screen.getByLabelText('預計檢視日'), { target: { value: '2030-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存日期' }));
    await waitFor(() => expect(m.updateGoal).toHaveBeenCalledWith('g1', { reviewDate: new Date('2030-01-15T00:00:00').toISOString() }));
  });

  it('追蹤紀錄：什麼都沒填不能送出；填一句話加自評後送出；已有的紀錄會列出', async () => {
    m.addGoalCheckin.mockResolvedValue({ ...baseGoal, checkins: [{ id: 'c1', at: iso(0), text: '試了一次', rating: 4 }] });
    const onChange = vi.fn();
    const { rerender } = wrap(<ul><GoalItem goal={baseGoal} onChange={onChange} /></ul>);
    fireEvent.click(screen.getByRole('button', { name: /記錄這段時間的進度/ }));
    fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('寫一句話');
    fireEvent.change(screen.getByLabelText(/這段時間發生了什麼/), { target: { value: '試了一次' } });
    fireEvent.click(screen.getByRole('radio', { name: /4 大多有做/ }));
    fireEvent.click(screen.getByRole('button', { name: '儲存紀錄' }));
    await waitFor(() => expect(m.addGoalCheckin).toHaveBeenCalledWith('g1', { text: '試了一次', rating: 4 }));
    expect(onChange).toHaveBeenCalled();
    rerender(<MemoryRouter><ConfirmProvider><ul><GoalItem goal={{ ...baseGoal, checkins: [{ id: 'c1', at: iso(0), text: '試了一次', rating: 4 }] }} onChange={onChange} /></ul></ConfirmProvider></MemoryRouter>);
    const list = screen.getByRole('list', { name: '追蹤紀錄' });
    expect(within(list).getByText(/試了一次/)).toBeInTheDocument();
    expect(within(list).getByText(/4／5 大多有做/)).toBeInTheDocument();
  });

  it('複測後進步夠明顯時，提示可以標記達成', () => {
    wrap(<ul><GoalItem goal={baseGoal} dimensions={[{ id: 'communication', subtitle: 'Communication', average: 3.2 }]} onChange={() => {}} /></ul>);
    expect(screen.getByText(/2\.5 分 → 最新 3\.2 分/)).toBeInTheDocument();
    expect(screen.getByText(/已提升 0\.7，可以考慮標記達成/)).toBeInTheDocument();
  });

  it('已達成的目標不顯示檢視日操作', () => {
    wrap(<ul><GoalItem goal={{ ...baseGoal, achievedAt: iso(-1) }} onChange={() => {}} /></ul>);
    expect(screen.queryByRole('button', { name: '延後一週' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消達成' })).toBeInTheDocument();
  });
});

describe('goalReminders（純函式）', () => {
  const g = (over) => ({ ...baseGoal, ...over });
  it('逾期、期中、不提醒三種；逾期排前面', () => {
    const overdue = g({ id: 'o', createdAt: iso(-30), reviewDate: iso(-1) });
    const mid = g({ id: 'm', createdAt: iso(-12), reviewDate: iso(8) });
    const early = g({ id: 'e', createdAt: iso(-2), reviewDate: iso(20) });
    const done = g({ id: 'd', createdAt: iso(-30), reviewDate: iso(-1), achievedAt: iso(-5) });
    const r = goalReminders([mid, early, done, overdue]);
    expect(r.map((x) => [x.goal.id, x.kind])).toEqual([['o', 'overdue'], ['m', 'midpoint']]);
  });
  it('期中之後已經有記錄就不再提醒；期間太短不提醒期中', () => {
    const recorded = g({ id: 'r', createdAt: iso(-12), reviewDate: iso(8), checkins: [{ id: 'c', at: iso(-1), text: 'x' }] });
    const oldNote = g({ id: 'n', createdAt: iso(-12), reviewDate: iso(8), checkins: [{ id: 'c', at: iso(-11), text: 'x' }] });
    const short = g({ id: 's', createdAt: iso(-3), reviewDate: iso(1) });
    expect(goalReminders([recorded, short]).map((x) => x.goal.id)).toEqual([]);
    expect(goalReminders([oldNote]).map((x) => x.goal.id)).toEqual(['n']);
  });
});

describe('GoalReminders 站內提醒', () => {
  it('逾期：回來複測導向該評量、延後一週呼叫 API；skipOverdue 時只剩期中提醒', async () => {
    const overdue = { ...baseGoal, id: 'o', createdAt: iso(-30), reviewDate: iso(-1) };
    m.snoozeGoal.mockResolvedValue({ ...overdue, reviewDate: iso(7) });
    const onGoalChanged = vi.fn();
    const { unmount } = wrap(<GoalReminders goals={[overdue]} onGoalChanged={onGoalChanged} />);
    expect(screen.getByText(/已經到了預計檢視的日子/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '回來複測' }));
    expect(navigate).toHaveBeenCalledWith('/survey/ai-competency');
    fireEvent.click(screen.getByRole('button', { name: '延後一週' }));
    await waitFor(() => expect(onGoalChanged).toHaveBeenCalled());
    unmount();
    wrap(<GoalReminders goals={[overdue]} onGoalChanged={() => {}} skipOverdue />);
    expect(screen.queryByLabelText('目標提醒')).not.toBeInTheDocument();
  });
  it('期中提醒：記錄進度導向「我的學習」；稍後只在這次隱藏', () => {
    const mid = { ...baseGoal, id: 'm', createdAt: iso(-12), reviewDate: iso(8) };
    wrap(<GoalReminders goals={[mid]} onGoalChanged={() => {}} />);
    expect(screen.getByText(/時間已經過一半了/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '記錄進度' }));
    expect(navigate).toHaveBeenCalledWith('/learning');
    fireEvent.click(screen.getByRole('button', { name: '稍後' }));
    expect(screen.queryByText(/時間已經過一半了/)).not.toBeInTheDocument();
  });
});

describe('起手行動範例', () => {
  it('每個評量的每個構面都有範例（新增構面時這裡會提醒補上）', () => {
    for (const [id, cfg] of Object.entries(REGISTRY).filter(([, c]) => !c.CLASS_ONLY)) {
      for (const d of cfg.DIMENSIONS ?? []) {
        const key = `${id}:${d.id}`;
        // 接班準備度的面向是「意向」，不是要練習的能力，不提供行動範例。
        if (id === 'succession-intent') continue;
        expect(GOAL_STARTERS[key], key).toBeTruthy();
        expect(GOAL_STARTERS[key].length, key).toBeGreaterThanOrEqual(3);
        GOAL_STARTERS[key].forEach((t) => expect(t.length).toBeGreaterThan(8));
      }
    }
  });
  it('沒有對應構面時用通用範例', () => {
    expect(startersFor('ai-competency', 'no-such')).toBe(GENERIC_STARTERS);
    expect(startersFor('ai-competency', null)).toBe(GENERIC_STARTERS);
  });
});
