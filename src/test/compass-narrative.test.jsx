import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultPanel from '../survey/components/ResultPanel';
import * as compass from '../survey/data/assessments/leadership-compass.js';
import { DIMENSION_INTRO, SUB_TEXT } from '../survey/data/assessments/compass-narrative.js';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { bandOf, buildCompassNarrative, hashSeed, pickVariant } from '../survey/utils/compassNarrative.js';
import { jaccard, longestCommonSubstring, THRESHOLDS } from '../../scripts/leadership-similarity.mjs';

vi.mock('../survey/api/client', () => ({
  api: { learningResources: async () => [], myReadingList: async () => [], addToReadingList: async () => ({}), trackArticleClick: async () => {}, myGoals: async () => [] },
}));

const BANDS = ['high', 'mid', 'low'];
const FORBIDDEN = /待強化|不及格|落後|很差|失敗|缺點|不夠好|能力不足|不適任/;

const resultOf = (fn, form = 'full') => {
  const view = compass.selectForm(form);
  const ans = Object.fromEntries(view.ALL_QUESTIONS.map((q, i) => [q.id, fn(q, i)]));
  return compass.SCORING.buildResult(ans, view);
};
// 讓反向題也落在期望的有效分：raw = 有效分（反向題用 6 − 有效分）
const withEffective = (eff) => (q) => (q.reversed ? 6 - eff : eff);

describe('敘事資料的完整性', () => {
  const dimsWithText = Object.keys(DIMENSION_INTRO);

  it('每個已撰寫的構面：三個分段各至少 2 個開場變體', () => {
    dimsWithText.forEach((id) => BANDS.forEach((b) => expect(DIMENSION_INTRO[id][b]?.length, `${id}/${b}`).toBeGreaterThanOrEqual(2)));
  });

  it('已撰寫構面的每個子面向都有三個分段的文字，且不會有多餘的子面向', () => {
    const subsOfWritten = compass.DIMENSIONS.filter((d) => dimsWithText.includes(d.id)).flatMap((d) => d.subDimensions.map((s) => s.id));
    subsOfWritten.forEach((id) => BANDS.forEach((b) => expect(SUB_TEXT[id]?.[b]?.length, `${id}/${b}`).toBeGreaterThan(0)));
    expect(Object.keys(SUB_TEXT).sort()).toEqual([...subsOfWritten].sort());
    dimsWithText.forEach((id) => expect(compass.DIMENSIONS.some((d) => d.id === id)).toBe(true));
  });

  const allTexts = [
    ...Object.entries(DIMENSION_INTRO).flatMap(([id, bands]) => BANDS.flatMap((b) => bands[b].map((t, i) => [`${id}/${b}/${i}`, t, 'intro']))),
    ...Object.entries(SUB_TEXT).flatMap(([id, bands]) => BANDS.map((b) => [`${id}/${b}`, bands[b], 'sub'])),
  ];

  it('長度合理（不空洞、不冗長）', () => {
    allTexts.forEach(([key, t]) => {
      expect(t.length, key).toBeGreaterThanOrEqual(60);
      expect(t.length, key).toBeLessThanOrEqual(260);
    });
  });

  it('不使用評判字眼', () => {
    allTexts.forEach(([key, t]) => expect(t, key).not.toMatch(FORBIDDEN));
  });

  it('高分段提到可能的限制；中低分段給出具體的小動作', () => {
    Object.entries(SUB_TEXT).forEach(([id, b]) => {
      expect(b.high, `${id}/high`).toMatch(/留意|需要留意|可以進一步|不必|小心/);
      expect(b.mid, `${id}/mid`).toMatch(/可以|不妨|先/);
      expect(b.low, `${id}/low`).toMatch(/可以|從.*開始|先/);
    });
    Object.entries(DIMENSION_INTRO).forEach(([id, b]) => {
      b.high.forEach((t, i) => expect(t, `${id}/high/${i}`).toMatch(/留意|記得/));
      [...b.mid, ...b.low].forEach((t, i) => expect(t, `${id}/ml/${i}`).toMatch(/可以|不如|從/));
    });
  });

  it('同一構面同一分段的變體彼此不同', () => {
    Object.entries(DIMENSION_INTRO).forEach(([id, bands]) => BANDS.forEach((b) => expect(new Set(bands[b]).size, `${id}/${b}`).toBe(bands[b].length)));
  });

  it('原創性：與既有題庫的題目與評語沒有過度相似（同題庫相似度門檻）', () => {
    const existing = Object.values(REGISTRY).filter((c) => c.ID !== compass.ID).flatMap((c) => [
      ...c.ALL_QUESTIONS.map((q) => q.text),
      ...Object.values(c.COMMENTARY ?? {}).flatMap((row) => Object.values(row)),
    ]);
    allTexts.forEach(([key, t]) => {
      existing.forEach((e) => {
        expect(jaccard(t, e), `${key} 相似度`).toBeLessThan(THRESHOLDS.jaccard);
        expect(longestCommonSubstring(t, e), `${key} 共同字串`).toBeLessThan(THRESHOLDS.lcs + 4);
      });
    });
  });
});

describe('bandOf / 變體選擇', () => {
  it('切分點', () => {
    expect(bandOf(4.0)).toBe('high');
    expect(bandOf(3.99)).toBe('mid');
    expect(bandOf(3.0)).toBe('mid');
    expect(bandOf(2.99)).toBe('low');
    expect(bandOf(1)).toBe('low');
  });
  it('同一輸入每次選到同一個變體；不同輸入可選到不同變體', () => {
    const v = ['a', 'b'];
    expect(pickVariant(v, hashSeed('100|find'))).toBe(pickVariant(v, hashSeed('100|find')));
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickVariant(v, hashSeed(`${100 + i}|find`))));
    expect(picks.size).toBe(2);
  });
});

describe('buildCompassNarrative', () => {
  it('八個構面都產生解讀，且穩定', () => {
    const r = resultOf(withEffective(4));
    const a = buildCompassNarrative(r);
    const b = buildCompassNarrative(r);
    expect(a.map((x) => x.id)).toEqual(compass.DIMENSIONS.map((d) => d.id));
    expect(a).toEqual(b);
    expect(a[0].subs).toHaveLength(4);
    expect(a.reduce((n, d) => n + d.subs.length, 0)).toBe(24);
    a.forEach((d) => expect(d.band).toBe('high'));
  });
  it('依平均分段：2→low、3.5→mid（子面向各自分段）', () => {
    expect(buildCompassNarrative(resultOf(withEffective(2)))[0].band).toBe('low');
    const mid = buildCompassNarrative(resultOf(withEffective(3)))[0];
    expect(mid.band).toBe('mid');
    mid.subs.forEach((s) => expect(s.band).toBe('mid'));
  });
  it('構面沒有有效作答時略過；精簡版只列有題目的子面向', () => {
    const empty = compass.SCORING.buildResult({}, compass.selectForm('full'));
    expect(buildCompassNarrative(empty)).toEqual([]);
    const short = buildCompassNarrative(resultOf(withEffective(4), 'short'))[0];
    expect(short.subs.length).toBeLessThanOrEqual(4);
    expect(short.subs.length).toBeGreaterThan(0);
  });
});

describe('報告中的解讀區塊', () => {
  const renderPanel = (result) => render(<MemoryRouter><ResultPanel result={result} onRetake={() => {}} onCopy={() => {}} copied={false} /></MemoryRouter>);
  it('顯示各構面的解讀與子面向文字，並出現在章節導覽', () => {
    renderPanel(resultOf(withEffective(2)));
    expect(screen.getByText('各構面的解讀')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '解讀' })).toBeInTheDocument();
    expect(screen.getByText(/最近最卡的是什麼|少了讓真實狀況進來的管道/)).toBeInTheDocument();
    expect(screen.getByText('風險預見', { selector: 'dt' })).toBeInTheDocument();
  });
  it('沒有任何有效作答時不顯示解讀區塊', () => {
    renderPanel(compass.SCORING.buildResult({}, compass.selectForm('full')));
    expect(screen.queryByText('各構面的解讀')).not.toBeInTheDocument();
  });
});
