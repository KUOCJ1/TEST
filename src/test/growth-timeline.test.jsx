import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildGrowthEvents } from '../survey/utils/growthTimeline';
import JourneyTimeline from '../survey/components/JourneyTimeline';

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const goal = { id: 'g1', assessmentId: 'a1', dimensionName: '溝通力', text: '每週一對一', createdAt: '2026-05-01T00:00:00Z', achievedAt: null,
  actions: [{ id: 'x1', text: '約談', done: true, doneAt: '2026-05-10T00:00:00Z' }, { id: 'x2', text: '回饋', done: false }],
  checkins: [{ id: 'c1', at: '2026-05-12T00:00:00Z', text: '有做', rating: 4 }] };
const practice = { id: 'p1', assessmentId: 'a1', dimensionName: '溝通力', startedAt: '2026-05-02T00:00:00Z',
  weeks: [{ week: 1, task: 't1', doneAt: '2026-05-08T00:00:00Z', goalLinked: false }, { week: 2, task: 't2', doneAt: '2026-05-10T00:00:00Z', goalLinked: true }, { week: 3, task: null, doneAt: null }] };
const sessions = [
  { id: 's1', assessmentId: 'a1', typeLabel: '一對一教練', title: '第一次', coachName: '王教練', sessionDate: '2026-05-15T00:00:00Z', reflection: { submittedAt: '2026-05-16T00:00:00Z', insight: '我看見自己太急' } },
  { id: 's2', assessmentId: 'a1', typeLabel: '一對一教練', title: '未來的', sessionDate: '2026-07-01T00:00:00Z', reflection: null },
];

describe('buildGrowthEvents', () => {
  const ev = buildGrowthEvents({ goals: [goal], practice, sessions, assessmentId: 'a1', now: NOW });
  it('新到舊排序', () => {
    const times = ev.map((e) => new Date(e.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
  it('包含各類事件，未來會談不列', () => {
    const kinds = ev.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['goal-set', 'action-done', 'checkin', 'practice-start', 'practice-week', 'session', 'reflection']));
    expect(ev.find((e) => e.id === 'ses-s2')).toBeUndefined();
  });
  it('與目標行動連動的微練習週不重複列', () => {
    expect(ev.filter((e) => e.kind === 'practice-week')).toHaveLength(1);
  });
  it('只含其他評量的資料時不列', () => {
    expect(buildGrowthEvents({ goals: [goal], assessmentId: 'zzz', now: NOW })).toEqual([]);
  });
  it('沒資料回空陣列、壞日期略過', () => {
    expect(buildGrowthEvents()).toEqual([]);
    expect(buildGrowthEvents({ goals: [{ ...goal, createdAt: 'x', actions: [], checkins: [] }], now: NOW })).toEqual([]);
  });
});

describe('JourneyTimeline 穿插成長事件', () => {
  const subs = [{ id: 'a', createdAt: '2026-05-05T00:00:00Z', phase: 'pre', result: { total: 100, percent: 50, level: { color: '#000', badge: 'x' } } }];
  it('有事件時標題變成成長紀錄並顯示事件', () => {
    render(<JourneyTimeline narrative="" submissions={subs} events={buildGrowthEvents({ goals: [goal], assessmentId: 'a1', now: NOW })} onSelect={() => {}} />);
    expect(screen.getByText('我的成長紀錄')).toBeInTheDocument();
    expect(screen.getAllByTestId('growth-event').length).toBeGreaterThan(1);
  });
  it('沒有事件時維持原樣', () => {
    render(<JourneyTimeline narrative="" submissions={subs} onSelect={() => {}} />);
    expect(screen.getByText('我的歷程')).toBeInTheDocument();
    expect(screen.queryByTestId('growth-event')).toBeNull();
  });
});
