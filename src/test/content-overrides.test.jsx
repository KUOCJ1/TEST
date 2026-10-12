import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { REGISTRY } from '../survey/data/assessments/index.js';
import { applyContentOverrides, getBuiltinContent } from '../survey/data/assessments/overrides.js';
import { ContentProvider } from '../survey/content/ContentProvider';
import { useContent } from '../survey/content/useContent';
import { api } from '../survey/api/client';

// Sprint 10 驗收條件 10.2：題庫內容覆寫的前端套用層。

const L9D = REGISTRY['leadership-9d'];
const firstDim = L9D.DIMENSIONS[0];
const firstSub = firstDim.subDimensions[0];
const firstQ = firstDim.questions[0];
const level = L9D.LEVELS[0];
const subId = Object.keys(L9D.COMMENTARY)[0];

const builtin = {
  dimName: firstDim.name,
  sub: firstSub.name,
  q: firstQ.text,
  high: L9D.COMMENTARY[subId].high,
  desc: level.desc,
};

beforeEach(() => applyContentOverrides({}));
afterAll(() => applyContentOverrides({}));

describe('applyContentOverrides', () => {
  it('套用後 DIMENSIONS／ALL_QUESTIONS／COMMENTARY／LEVELS 都是覆寫值（共用同一批物件）', () => {
    applyContentOverrides({
      'leadership-9d': {
        version: 1,
        overrides: {
          dimensions: { [firstDim.id]: { name: '新構面名', subtitle: '新副標' } },
          subDimensions: { [firstSub.id]: { name: '新子能力' } },
          questions: { [firstQ.id]: '新題目文字' },
          commentary: { [subId]: { high: '新的高分評語' } },
          levels: { [level.id]: { desc: '新的等級說明' } },
        },
      },
    });
    expect(firstDim.name).toBe('新構面名');
    expect(firstDim.subtitle).toBe('新副標');
    expect(firstSub.name).toBe('新子能力');
    expect(firstQ.text).toBe('新題目文字');
    expect(L9D.ALL_QUESTIONS.find((q) => q.id === firstQ.id).text).toBe('新題目文字');
    expect(L9D.COMMENTARY[subId].high).toBe('新的高分評語');
    expect(L9D.COMMENTARY[subId].mid).toBeTruthy(); // 沒被覆寫的欄位維持內建
    expect(level.desc).toBe('新的等級說明');
  });

  it('再套用空覆寫就完整還原成內建原文', () => {
    applyContentOverrides({ 'leadership-9d': { overrides: { questions: { [firstQ.id]: '暫時的' }, dimensions: { [firstDim.id]: { name: '暫時' } } } } });
    applyContentOverrides({});
    expect(firstQ.text).toBe(builtin.q);
    expect(firstDim.name).toBe(builtin.dimName);
  });

  it('可重複套用：第二次覆寫以內建為基準，不會疊在上一次的覆寫上', () => {
    applyContentOverrides({ 'leadership-9d': { overrides: { questions: { [firstQ.id]: 'A' } } } });
    applyContentOverrides({ 'leadership-9d': { overrides: { dimensions: { [firstDim.id]: { name: 'B' } } } } });
    expect(firstQ.text).toBe(builtin.q); // 第二次沒有覆寫題目 → 回到內建，而不是殘留 A
    expect(firstDim.name).toBe('B');
  });

  it('getBuiltinContent 永遠回內建原文，不受已套用的覆寫影響', () => {
    applyContentOverrides({ 'leadership-9d': { overrides: { questions: { [firstQ.id]: '被改過' } } } });
    const b = getBuiltinContent('leadership-9d');
    expect(b.questions[firstQ.id]).toBe(builtin.q);
    expect(b.dimensions[firstDim.id].name).toBe(builtin.dimName);
    expect(b.commentary[subId].high).toBe(builtin.high);
    expect(b.levels[level.id].desc).toBe(builtin.desc);
    expect(getBuiltinContent('不存在')).toBeNull();
  });

  it('忽略不認得的 id、不存在的欄位與空白字串，並回報忽略筆數', () => {
    const stats = applyContentOverrides({
      'leadership-9d': {
        overrides: {
          questions: { 'no-such-q': 'x', [firstQ.id]: '   ' },
          dimensions: { nope: { name: 'x' }, [firstDim.id]: { bogus: 'x' } },
          levels: { [level.id]: { min: 999, badge: '假徽章' } },
        },
      },
      'no-such-assessment': { overrides: { questions: { a: 'b' } } },
    });
    expect(firstQ.text).toBe(builtin.q);
    expect(firstDim.name).toBe(builtin.dimName);
    expect(stats['leadership-9d'].ignored).toBeGreaterThanOrEqual(4);
    expect(stats['leadership-9d'].applied).toBe(0);
  });

  it('絕不改到計分欄位：題數、reversed、分數區間、徽章都不動', () => {
    const before = JSON.stringify({
      n: L9D.ALL_QUESTIONS.length,
      rev: L9D.ALL_QUESTIONS.map((q) => q.reversed),
      lv: L9D.LEVELS.map((l) => [l.id, l.min, l.max, l.badge, l.color]),
    });
    applyContentOverrides({
      'leadership-9d': { overrides: { levels: { [level.id]: { min: 1, max: 2, badge: 'x', desc: '只有這個會生效' } }, questions: { [firstQ.id]: { reversed: true } } } },
    });
    const after = JSON.stringify({
      n: L9D.ALL_QUESTIONS.length,
      rev: L9D.ALL_QUESTIONS.map((q) => q.reversed),
      lv: L9D.LEVELS.map((l) => [l.id, l.min, l.max, l.badge, l.color]),
    });
    expect(after).toBe(before);
  });

  it('每套題庫的 ALL_QUESTIONS 與 DIMENSIONS 共用題目物件（改一處兩邊都變）', () => {
    for (const [id, cfg] of Object.entries(REGISTRY)) {
      const q = cfg.DIMENSIONS[0].questions[0];
      applyContentOverrides({ [id]: { overrides: { questions: { [q.id]: `覆寫-${id}` } } } });
      expect(cfg.ALL_QUESTIONS.find((x) => x.id === q.id).text, id).toBe(`覆寫-${id}`);
      expect(q.text, id).toBe(`覆寫-${id}`);
      applyContentOverrides({});
    }
  });

  it('風格型題庫（DISC）的等級／風格說明不開放編輯：覆寫被忽略', () => {
    const disc = REGISTRY.disc;
    const lv = disc.LEVELS[0];
    const original = lv.desc;
    const stats = applyContentOverrides({ disc: { overrides: { levels: { [lv.id]: { desc: '想改風格說明' } } } } });
    expect(lv.desc).toBe(original);
    expect(stats.disc.ignored).toBe(1);
    expect(getBuiltinContent('disc').levels).toEqual({});
  });

  it('壞資料不丟例外', () => {
    expect(() => applyContentOverrides(null)).not.toThrow();
    expect(() => applyContentOverrides({ 'leadership-9d': { overrides: { questions: null, dimensions: 5, levels: { x: null } } } })).not.toThrow();
    expect(firstQ.text).toBe(builtin.q);
  });
});

describe('ContentProvider', () => {
  function Probe() {
    const { version, previewing, previewDraft, stopPreview } = useContent();
    return (
      <div>
        <p data-testid="q">{firstQ.text}</p>
        <p data-testid="v">{version}</p>
        <p data-testid="p">{String(previewing)}</p>
        <button onClick={() => previewDraft('leadership-9d', { questions: { [firstQ.id]: '預覽中的題目' } })}>預覽</button>
        <button onClick={stopPreview}>結束</button>
      </div>
    );
  }

  it('載入已發佈內容後才渲染子畫面，並套用覆寫', async () => {
    vi.spyOn(api, 'assessmentContent').mockResolvedValue({ 'leadership-9d': { version: 3, overrides: { questions: { [firstQ.id]: '已發佈的題目' } } } });
    render(<ContentProvider><Probe /></ContentProvider>);
    await waitFor(() => expect(screen.getByTestId('q')).toHaveTextContent('已發佈的題目'));
  });

  it('取不到覆寫時用內建原文，不擋畫面', async () => {
    vi.spyOn(api, 'assessmentContent').mockRejectedValue(new Error('network'));
    render(<ContentProvider><Probe /></ContentProvider>);
    await waitFor(() => expect(screen.getByTestId('q')).toHaveTextContent(builtin.q));
  });

  it('預覽草稿只暫時套用，結束預覽回到已發佈版本', async () => {
    vi.spyOn(api, 'assessmentContent').mockResolvedValue({ 'leadership-9d': { version: 1, overrides: { questions: { [firstQ.id]: '已發佈' } } } });
    render(<ContentProvider><Probe /></ContentProvider>);
    await waitFor(() => expect(screen.getByTestId('q')).toHaveTextContent('已發佈'));
    fireEvent.click(screen.getByText('預覽'));
    expect(screen.getByTestId('q')).toHaveTextContent('預覽中的題目');
    expect(screen.getByTestId('p')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('結束'));
    expect(screen.getByTestId('q')).toHaveTextContent('已發佈');
    expect(screen.getByTestId('p')).toHaveTextContent('false');
  });
});
