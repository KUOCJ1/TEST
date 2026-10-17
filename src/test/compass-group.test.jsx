import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCompassGroupReport, groupTier, latestSelfByUser, FULL_MIN, BASIC_MIN } from '../survey/utils/compassGroup.js';
import { gapsFromAverages } from '../survey/utils/compassScoring.js';
import CompassGroupReport from '../survey/coach/CompassGroupReport.jsx';
import * as compass from '../survey/data/assessments/leadership-compass.js';

vi.mock('../survey/api/client', () => ({ api: {} }));

const resultOf = (fn) => {
  const view = compass.selectForm('full');
  const ans = Object.fromEntries(view.ALL_QUESTIONS.map((q, i) => [q.id, fn(q, i)]));
  return compass.SCORING.buildResult(ans, view);
};
const results = (n) => Array.from({ length: n }, (_, i) => resultOf((q, j) => ((i + j) % 5) + 1));

describe('班級彙整的匿名分級', () => {
  it('門檻', () => {
    expect(FULL_MIN).toBe(5);
    expect(BASIC_MIN).toBe(3);
    expect(groupTier(5)).toBe('full');
    expect(groupTier(4)).toBe('basic');
    expect(groupTier(3)).toBe('basic');
    expect(groupTier(2)).toBe('hidden');
    expect(groupTier(0)).toBe('hidden');
  });

  it('不足 3 位：只有完成率，沒有任何分數', () => {
    const r = buildCompassGroupReport(results(2), 10);
    expect(r.tier).toBe('hidden');
    expect(r.completion).toBeCloseTo(0.2);
    expect(r.dimensions).toBeNull();
    expect(r.loops).toBeNull();
    expect(r.tensions).toBeNull();
  });

  it('3–4 位：只有構面與兩環平均，沒有分布、張力、最強最弱', () => {
    const r = buildCompassGroupReport(results(4), 10);
    expect(r.tier).toBe('basic');
    expect(r.dimensions).toHaveLength(8);
    expect(r.loops).toHaveLength(2);
    expect(r.tensions).toBeNull();
    expect(r.extremes).toBeNull();
    expect(r.ratingSpread).toBeNull();
  });

  it('≥5 位：完整彙整，且不含個人資料', () => {
    const r = buildCompassGroupReport(results(5), 5);
    expect(r.tier).toBe('full');
    expect(r.tensions).toHaveLength(4);
    expect(r.extremes.top).toHaveLength(3);
    const total = Object.values(r.tensions[0].typeCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(r.tensions[0].respondents);
    expect(JSON.stringify(r)).not.toMatch(/userId|userName/);
  });

  it('每位使用者只取最新一份自評，並忽略他評', () => {
    const mk = (userId, createdAt, raterType = 'self') => ({ userId, createdAt, raterType, phase: 'pre', assessmentId: 'leadership-compass', result: resultOf(() => 3) });
    const out = latestSelfByUser([mk('a', '2020-01-01'), mk('a', '2020-02-01'), mk('b', '2020-01-01'), mk('c', '2020-01-01', 'peer')], { phase: 'pre', assessmentId: 'leadership-compass' });
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.userId === 'a').createdAt).toBe('2020-02-01');
  });
});

describe('gapsFromAverages', () => {
  const self = [{ id: 'find', name: '洞察情勢', average: 4.5, answered: 4 }];
  it('他評者不足 → 不給任何數字', () => {
    const g = gapsFromAverages({ selfDimensions: self, otherDimensions: [{ id: 'find', average: 3 }], raters: 2 });
    expect(g.available).toBe(false);
    expect(g.dimensions).toEqual([]);
  });
  it('達門檻 → 計算落差與分類', () => {
    const g = gapsFromAverages({ selfDimensions: self, otherDimensions: [{ id: 'find', average: 3.2 }], raters: 3 });
    expect(g.available).toBe(true);
    expect(g.dimensions[0].gap).toBeCloseTo(1.3);
    expect(g.dimensions[0].type).toBe('blind_spot');
  });
  it('沒有他評資料 → 不可用', () => {
    expect(gapsFromAverages({ selfDimensions: self, otherDimensions: [], raters: 5 }).available).toBe(false);
  });
});

describe('CompassGroupReport', () => {
  const group = { assessmentId: 'leadership-compass' };
  const subsOf = (n) => Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, userId: `u${i}`, raterType: 'self', phase: 'pre', assessmentId: 'leadership-compass', createdAt: '2020-01-01', result: results(n)[i],
  }));
  const members = (n) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `學員${i}` }));

  it('2 位完成：只顯示完成率與隱藏說明', () => {
    render(<CompassGroupReport group={group} members={members(8)} submissions={subsOf(2)} />);
    expect(screen.getByText(/少於 3 位，暫不顯示分數與統計/)).toBeInTheDocument();
    expect(screen.queryByText('八構面平均')).not.toBeInTheDocument();
  });
  it('4 位完成：顯示平均與「樣本少」，沒有張力分布', () => {
    render(<CompassGroupReport group={group} members={members(8)} submissions={subsOf(4)} />);
    expect(screen.getByText('八構面平均')).toBeInTheDocument();
    expect(screen.getByText(/樣本少，僅供參考/)).toBeInTheDocument();
    expect(screen.queryByText('四組張力的取向分布')).not.toBeInTheDocument();
  });
  it('6 位完成：完整，且不出現任何學員姓名', () => {
    const { container } = render(<CompassGroupReport group={group} members={members(6)} submissions={subsOf(6)} />);
    expect(screen.getByText('四組張力的取向分布')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/學員\d/);
  });
});
