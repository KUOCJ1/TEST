import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { applyContentOverrides } from '../survey/data/assessments/overrides.js';
import { refreshResultsInPlace } from '../survey/data/assessments/refreshResult.js';
import { buildResult } from '../survey/utils/scoring.js';

// Sprint 10：舊的作答結果是快照，顯示用字要換成目前題庫文字，分數與等級 id 不能動。

const cfg = REGISTRY['leadership-9d'];
const answers = Object.fromEntries(cfg.ALL_QUESTIONS.map((q) => [q.id, 3]));
const dim = cfg.DIMENSIONS[0];
const sub = dim.subDimensions[0];
const level = cfg.LEVELS[1];

beforeEach(() => applyContentOverrides({}));
afterAll(() => applyContentOverrides({}));

// 模擬「舊紀錄」：在套用任何覆寫之前算好、存下來的 result。
const oldResult = () => JSON.parse(JSON.stringify(buildResult(answers, cfg)));

describe('refreshResultsInPlace', () => {
  it('把快照裡的構面／副標／子能力名稱與等級說明換成目前文字，分數與等級 id 不變', () => {
    const stored = oldResult();
    const before = { total: stored.total, level: stored.level.id, scores: stored.dimensions.map((d) => [d.id, d.score, d.average, d.percent, d.color]) };
    applyContentOverrides({
      'leadership-9d': { overrides: {
        dimensions: { [dim.id]: { name: '新構面名', subtitle: '新副標' } },
        subDimensions: { [sub.id]: { name: '新子能力名' } },
        levels: { [level.id]: { desc: '新的等級說明', advice: '新的發展建議' } },
      } },
    });
    const data = refreshResultsInPlace({ submissions: [{ id: 's1', assessmentId: 'leadership-9d', result: stored }] });
    const r = data.submissions[0].result;
    const d0 = r.dimensions.find((d) => d.id === dim.id);
    expect(d0.name).toBe('新構面名');
    expect(d0.subtitle).toBe('新副標');
    expect(d0.subs.find((s) => s.id === sub.id).name).toBe('新子能力名');
    if (r.level.id === level.id) {
      expect(r.level.desc).toBe('新的等級說明');
      expect(r.level.advice).toBe('新的發展建議');
    }
    expect({ total: r.total, level: r.level.id, scores: r.dimensions.map((d) => [d.id, d.score, d.average, d.percent, d.color]) }).toEqual(before);
  });

  it('等級說明只在該結果落在被改的等級時才會變；其他等級不受影響', () => {
    const stored = oldResult();
    const other = cfg.LEVELS.find((l) => l.id !== stored.level.id);
    const originalDesc = stored.level.desc;
    applyContentOverrides({ 'leadership-9d': { overrides: { levels: { [other.id]: { desc: '別的等級被改了' } } } } });
    refreshResultsInPlace({ x: { assessmentId: 'leadership-9d', total: 1, dimensions: [], level: stored.level }, y: stored });
    expect(stored.level.desc).toBe(originalDesc);
  });

  it('還原後再整理，名稱回到內建原文', () => {
    const stored = oldResult();
    applyContentOverrides({ 'leadership-9d': { overrides: { dimensions: { [dim.id]: { name: '暫時改名' } } } } });
    refreshResultsInPlace([stored]);
    expect(stored.dimensions[0].name).toBe('暫時改名');
    applyContentOverrides({});
    refreshResultsInPlace([stored]);
    expect(stored.dimensions[0].name).toBe(dim.name);
  });

  it('走訪巢狀結構（陣列、物件）、處理循環參照，非結果物件原樣不動', () => {
    const stored = oldResult();
    const payload = { a: [{ nested: { assessmentId: 'leadership-9d', result: stored } }], note: '不是結果', n: 5, nothing: null };
    payload.self = payload;
    expect(() => refreshResultsInPlace(payload)).not.toThrow();
    expect(payload.note).toBe('不是結果');
  });

  it('不認得的題庫、缺少欄位、風格型題庫的等級：維持快照、不丟例外', () => {
    const unknown = { assessmentId: 'nope', total: 1, dimensions: [{ id: 'x', name: '原名' }], level: { id: 'l', desc: '原說明' } };
    refreshResultsInPlace(unknown);
    expect(unknown.dimensions[0].name).toBe('原名');
    const disc = REGISTRY.disc;
    const discResult = JSON.parse(JSON.stringify(buildResult(Object.fromEntries(disc.ALL_QUESTIONS.map((q) => [q.id, 3])), disc)));
    const descBefore = discResult.level.desc;
    refreshResultsInPlace(discResult);
    expect(discResult.level.desc).toBe(descBefore);
    expect(() => refreshResultsInPlace(null)).not.toThrow();
    expect(() => refreshResultsInPlace('字串')).not.toThrow();
  });
});
