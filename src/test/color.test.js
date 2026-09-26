import { describe, it, expect } from 'vitest';
import { badgeBg, contrastWithWhite, dimTextStyle } from '../survey/utils/color';

// Sprint 8 驗收條件 8.1：題庫設定的顏色不一定達到 WCAG AA，這些工具把它們調到達標。

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('badgeBg', () => {
  it('白字對比不足的底色調深到 ≥4.5:1，已達標的原樣回傳', () => {
    for (const c of ['#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#dd6b20']) {
      expect(contrastWithWhite(badgeBg(c))).toBeGreaterThanOrEqual(4.5);
    }
    expect(badgeBg('#744210')).toBe('#744210');
  });
  it('非 hex 值原樣回傳，不丟例外', () => {
    expect(badgeBg(undefined)).toBe(undefined);
    expect(badgeBg('rgb(0,0,0)')).toBe('rgb(0,0,0)');
  });
});

describe('dimTextStyle', () => {
  it('亮色版在白／紙色／米色底都 ≥4.5:1，深色版在深色面板上都 ≥4.5:1', () => {
    for (const c of ['#38a169', '#d69e2e', '#319795', '#744210', '#805ad5', '#2b6cb0']) {
      const s = dimTextStyle(c);
      for (const bg of ['#ffffff', '#fefdfb', '#f6f1e7', '#f6ecd7']) expect(ratio(s['--dim-light'], bg)).toBeGreaterThanOrEqual(4.5);
      for (const bg of ['#231d15', '#1c1610', '#17130e', '#2a2217']) expect(ratio(s['--dim-dark'], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('非 hex 值（例如 inherit）當一般 color 回傳', () => {
    expect(dimTextStyle('inherit')).toEqual({ color: 'inherit' });
  });
});
