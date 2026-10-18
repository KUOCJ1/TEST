import { describe, it, expect } from 'vitest';
import * as l9d from '../survey/data/assessments/leadership-9d.js';
import * as ai from '../survey/data/assessments/ai-competency.js';
import { getLevel, computeTotalScore } from '../survey/utils/scoring.js';

// L9D 的切分點是對外承諾的規格（docs/leadership-9d-spec.md）：邊界上差 1 分等級就不同，要有測試鎖住。
describe('L9D 落點等級邊界（探索期 90–225／發展期 226–315／精熟期 316–405／卓越 406–450）', () => {
  const idOf = (t) => getLevel(t, l9d).id;
  it('每個邊界差 1 分就換級', () => {
    expect(idOf(90)).toBe('explorer');
    expect(idOf(225)).toBe('explorer');
    expect(idOf(226)).toBe('developer');
    expect(idOf(315)).toBe('developer');
    expect(idOf(316)).not.toBe('developer');
    const levels = l9d.LEVELS.map((l) => l.id);
    expect(idOf(316)).toBe(levels[2]);
    expect(idOf(405)).toBe(levels[2]);
    expect(idOf(406)).toBe(levels[3]);
    expect(idOf(450)).toBe(levels[3]);
  });
  it('等級區間連續、不重疊、涵蓋 90–450', () => {
    const ls = l9d.LEVELS;
    expect(ls[0].min).toBe(90);
    expect(ls.at(-1).max).toBe(450);
    for (let i = 1; i < ls.length; i += 1) expect(ls[i].min).toBe(ls[i - 1].max + 1);
  });
  it('全部填最低／最高：總分剛好是 90／450（含反向題）', () => {
    const all = (v) => Object.fromEntries(l9d.ALL_QUESTIONS.map((q) => [q.id, v]));
    const min = Math.min(...[1, 5].map((v) => computeTotalScore(all(v), l9d)));
    const max = Math.max(...[1, 5].map((v) => computeTotalScore(all(v), l9d)));
    // 反向題的存在讓「全部填 1」不等於最低分；真正的最低／最高是依反向題調整後的作答。
    expect(min).toBeGreaterThanOrEqual(90);
    expect(max).toBeLessThanOrEqual(450);
    const best = Object.fromEntries(l9d.ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 1 : 5]));
    const worst = Object.fromEntries(l9d.ALL_QUESTIONS.map((q) => [q.id, q.reversed ? 5 : 1]));
    expect(computeTotalScore(best, l9d)).toBe(450);
    expect(computeTotalScore(worst, l9d)).toBe(90);
  });
});

describe('L9D 構面評等邊界（精熟≥4.2／熟練≥3.4／發展中≥2.6／萌芽≥1.8／待啟蒙）', () => {
  const label = (a) => l9d.dimensionRating(a).label;
  it('剛好在邊界與邊界之下', () => {
    expect(label(4.2)).toBe('精熟');
    expect(label(4.19)).toBe('熟練');
    expect(label(3.4)).toBe('熟練');
    expect(label(3.39)).toBe('發展中');
    expect(label(2.6)).toBe('發展中');
    expect(label(2.59)).toBe('萌芽');
    expect(label(1.8)).toBe('萌芽');
    expect(label(1.79)).toBe('待啟蒙');
    expect(label(1)).toBe('待啟蒙');
    expect(label(5)).toBe('精熟');
  });
});

describe('AI 職能評測等級區間連續且涵蓋滿分範圍', () => {
  it('區間首尾相接', () => {
    const ls = ai.LEVELS;
    for (let i = 1; i < ls.length; i += 1) expect(ls[i].min).toBe(ls[i - 1].max + 1);
  });
});
