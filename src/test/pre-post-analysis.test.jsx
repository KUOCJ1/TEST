import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import PrePostAnalysis from '../survey/coach/PrePostAnalysis.jsx';
import { buildPrePost, summarize, supportsPrePost, latestByPhase } from '../survey/utils/prePost.js';
import { getAssessment } from '../survey/data/assessments/index.js';
import { buildResult } from '../survey/utils/scoring.js';

const config = getAssessment('ai-competency');

// 讓每題的「原始分數」都是 value（反向題照實計分），得到可預期的結果。
const resultOf = (value) => buildResult(Object.fromEntries(config.ALL_QUESTIONS.map((q) => [q.id, value])), config);
let order = 0;
const sub = (userId, phase, value, extra = {}) => ({
  id: `s${++order}`, userId, userName: userId, raterType: 'self', phase, createdAt: new Date(2026, 9, 1, 0, order).toISOString(), result: resultOf(value), ...extra,
});
const members = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: `學員${id}`, email: `${id}@x.co` }));

describe('描述統計', () => {
  it('平均、中位數、樣本標準差、範圍', () => {
    expect(summarize([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ n: 8, mean: 5, median: 4.5, sd: 2.1, min: 2, max: 9 });
    expect(summarize([])).toBeNull();
    expect(summarize([3])).toMatchObject({ n: 1, sd: 0 });
  });
});

describe('適用的題庫', () => {
  it('一般 LEVELS 題庫適用；DISC、羅盤、接班、課後問卷不適用', () => {
    expect(supportsPrePost(config)).toBe(true);
    expect(supportsPrePost(getAssessment('leadership-9d'))).toBe(true);
    for (const id of ['disc', 'archetype', 'leadership-compass', 'succession-intent']) expect(supportsPrePost(getAssessment(id)), id).toBe(false);
  });
});

describe('每人每階段取最新一筆；舊資料（沒有 phase）視為前測；他評不算', () => {
  it('latestByPhase', () => {
    const subs = [sub('a', 'pre', 2), sub('a', 'pre', 4), sub('a', null, 1, { createdAt: '2020-01-01T00:00:00Z' }), sub('b', 'pre', 3, { raterType: 'peer' })];
    const pre = latestByPhase(subs, 'pre');
    expect(pre.size).toBe(1);
    expect(pre.get('a').result.total).toBe(resultOf(4).total);
  });
});

describe('buildPrePost', () => {
  const subs = [
    sub('a', 'pre', 2), sub('b', 'pre', 2), sub('c', 'pre', 3), sub('d', 'pre', 3), sub('e', 'pre', 4), sub('f', 'pre', 4),
    sub('a', 'post', 4), sub('b', 'post', 3), sub('c', 'post', 5), sub('d', 'post', 3), sub('e', 'post', 4),
    // f 沒有後測；另有一位只做後測。
    sub('g', 'post', 5),
  ];

  it('前測分布：人數、總分統計、落點與直方圖加總一致', () => {
    const d = buildPrePost(subs, config, members);
    expect(d.pre.n).toBe(6);
    expect(d.pre.levelDist.reduce((s, l) => s + l.count, 0)).toBe(6);
    expect(d.pre.histogram.reduce((s, b) => s + b.count, 0)).toBe(6);
    expect(d.pre.total.min).toBe(resultOf(2).total);
    expect(d.pre.total.max).toBe(resultOf(4).total);
    expect(d.pre.dimensions).toHaveLength(6);
    for (const dim of d.pre.dimensions) expect(Object.values(dim.ratingDist).reduce((s, x) => s + x, 0)).toBe(6);
  });

  it('只用配對樣本比較；未配對的人另外計數', () => {
    const d = buildPrePost(subs, config, members);
    expect(d.paired.n).toBe(5);
    expect(d.unpaired).toEqual({ preOnly: 1, postOnly: 1 });
    expect(d.paired.improved + d.paired.same + d.paired.declined).toBe(5);
    expect(d.paired).toMatchObject({ improved: 3, same: 2, declined: 0 }); // a、b、c 進步；d、e 持平
  });

  it('進步／持平／退步與落點矩陣：矩陣加總＝配對人數，升降級人數與矩陣一致', () => {
    const d = buildPrePost(subs, config, members);
    const total = d.paired.levelMatrix.counts.flat().reduce((s, x) => s + x, 0);
    expect(total).toBe(5);
    let up = 0; let down = 0;
    d.paired.levelMatrix.counts.forEach((row, i) => row.forEach((c, j) => { if (j > i) up += c; if (j < i) down += c; }));
    expect(d.paired.levelUp).toBe(up);
    expect(d.paired.levelDown).toBe(down);
  });

  it('各構面差：以平均（1–5）計算，依進步最多排序，進步＋持平＋退步＝配對人數', () => {
    const d = buildPrePost(subs, config, members);
    const deltas = d.paired.dimensions.map((x) => x.delta);
    expect(deltas).toEqual([...deltas].sort((x, y) => y - x));
    for (const dim of d.paired.dimensions) expect(dim.improved + dim.same + dim.declined).toBe(5);
  });

  it('效果量只在 ≥5 人且有差異時提供；4 人不提供', () => {
    expect(buildPrePost(subs, config, members).paired.dz).not.toBeNull();
    const small = buildPrePost([sub('a', 'pre', 2), sub('b', 'pre', 3), sub('a', 'post', 4), sub('b', 'post', 5)], config, members);
    expect(small.paired.dz).toBeNull();
  });

  it('沒有任何作答 → null；只有前測 → 沒有 paired', () => {
    expect(buildPrePost([], config, members)).toBeNull();
    const onlyPre = buildPrePost([sub('a', 'pre', 3)], config, members);
    expect(onlyPre.paired).toBeNull();
    expect(onlyPre.post).toBeNull();
  });

  it('不適用的題庫回 null', () => {
    expect(buildPrePost([sub('a', 'pre', 3)], getAssessment('disc'), members)).toBeNull();
  });
});

describe('畫面', () => {
  const group = { id: 'g1', assessmentId: 'ai-competency' };
  const subs = [
    sub('a', 'pre', 2), sub('b', 'pre', 2), sub('c', 'pre', 3), sub('d', 'pre', 3), sub('e', 'pre', 4),
    sub('a', 'post', 4), sub('b', 'post', 3), sub('c', 'post', 5), sub('d', 'post', 3), sub('e', 'post', 5),
  ];

  it('顯示前測分布（落點分布、直方圖、構面表）與前後測比較（矩陣、構面、個人）', () => {
    render(<PrePostAnalysis group={group} submissions={subs} members={members} />);
    expect(screen.getByText('前測分布（5 人）')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '前測落點等級分布' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '前測總分分布圖' })).toBeInTheDocument();
    expect(screen.getByText('前後測比較（配對 5 人）')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '落點等級變化矩陣' })).toBeInTheDocument();
    const personal = screen.getByRole('region', { name: '每位成員前後測變化' });
    expect(within(personal).getByText('學員c')).toBeInTheDocument();
    expect(within(personal).getAllByRole('row')).toHaveLength(6); // 表頭＋5 人
  });

  it('只有前測時顯示說明，不顯示比較表', () => {
    render(<PrePostAnalysis group={group} submissions={[sub('a', 'pre', 3)]} members={members} />);
    expect(screen.getByText('前測分布（1 人）')).toBeInTheDocument();
    expect(screen.getByText(/還沒有成員同時完成前測與後測/)).toBeInTheDocument();
  });

  it('不適用的題庫不渲染', () => {
    const { container } = render(<PrePostAnalysis group={{ assessmentId: 'disc' }} submissions={[]} members={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('可以匯出前後測明細 CSV（只含配對的人）', () => {
    const created = [];
    globalThis.URL.createObjectURL = vi.fn((b) => { created.push(b); return 'blob:x'; });
    globalThis.URL.revokeObjectURL = vi.fn();
    render(<PrePostAnalysis group={group} submissions={subs} members={members} />);
    fireEvent.click(screen.getByRole('button', { name: /匯出前後測明細/ }));
    expect(created).toHaveLength(1);
  });
});
