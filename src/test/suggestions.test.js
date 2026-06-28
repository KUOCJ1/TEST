import { describe, it, expect } from 'vitest';
import { buildSuggestions } from '../survey/utils/suggestions';

const ADVICE = {
  d1: { develop: '加強 D1', leverage: '發揮 D1' },
  d2: { develop: '加強 D2', leverage: '發揮 D2' },
  d3: { develop: '加強 D3', leverage: '發揮 D3' },
};

function dim(id, tone, average) {
  return { id, subtitle: `S-${id}`, name: `Name-${id}`, color: '#000', rating: { tone }, average };
}

const config = { DIMENSION_ADVICE: ADVICE };

describe('buildSuggestions', () => {
  it('returns null when config has no DIMENSION_ADVICE', () => {
    const result = { dimensions: [dim('d1', 'weak', 1)] };
    expect(buildSuggestions(result, {})).toBeNull();
    expect(buildSuggestions(result, null)).toBeNull();
  });

  it('returns null when result has no dimensions', () => {
    expect(buildSuggestions({ dimensions: [] }, config)).toBeNull();
    expect(buildSuggestions({}, config)).toBeNull();
  });

  it('surfaces weak dimensions as develop suggestions', () => {
    const result = {
      dimensions: [
        dim('d1', 'weak', 1.5),
        dim('d2', 'low', 2.5),
        dim('d3', 'high', 4.5),
      ],
    };
    const s = buildSuggestions(result, config);
    expect(s.develop.map((x) => x.id)).toContain('d1');
    expect(s.develop.map((x) => x.id)).toContain('d2');
    expect(s.leverage.map((x) => x.id)).toContain('d3');
  });

  it('limits develop to 3 and leverage to 2', () => {
    const result = {
      dimensions: [
        dim('d1', 'weak', 1),
        dim('d2', 'low', 2),
        dim('d3', 'mid', 3),
        dim('d4', 'high', 4),
        dim('d5', 'high', 5),
      ],
    };
    const advice = {
      ...ADVICE,
      d4: { leverage: '發揮 D4' },
      d5: { leverage: '發揮 D5' },
    };
    const s = buildSuggestions(result, { DIMENSION_ADVICE: advice });
    expect(s.develop.length).toBeLessThanOrEqual(3);
    expect(s.leverage.length).toBeLessThanOrEqual(2);
  });

  it('excludes dimension if advice text is missing', () => {
    const result = { dimensions: [dim('d1', 'weak', 1), dim('d99', 'weak', 1.1)] };
    const s = buildSuggestions(result, config);
    expect(s.develop.every((x) => x.text)).toBe(true);
  });

  it('returns null when no develop or leverage entries survive', () => {
    const result = { dimensions: [dim('d99', 'weak', 1)] };
    expect(buildSuggestions(result, config)).toBeNull();
  });
});
