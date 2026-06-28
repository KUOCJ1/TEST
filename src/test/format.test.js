import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort, resultSummaryText } from '../survey/utils/format';

describe('formatDate', () => {
  it('formats a valid ISO string', () => {
    expect(formatDate('2026-03-15T09:05:00.000Z')).toMatch(/2026\/03\/15 \d{2}:\d{2}/);
  });

  it('returns empty string for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('pads month, day, hour and minute with leading zero', () => {
    // Use a UTC+0 anchor and note local TZ offset may shift the hour — just verify format.
    const result = formatDate('2026-01-05T04:05:00.000Z');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});

describe('formatDateShort', () => {
  it('returns MM/DD format', () => {
    const result = formatDateShort('2026-12-03T00:00:00.000Z');
    expect(result).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('returns empty string for invalid input', () => {
    expect(formatDateShort('bad')).toBe('');
  });
});

describe('resultSummaryText', () => {
  const fakeResult = {
    assessmentName: '測試評量',
    total: 300,
    maxScore: 450,
    percent: 67,
    level: { badge: '發展期', badgeEn: 'Developing' },
    dimensions: [
      { subtitle: 'D1', name: '構面一', score: 80, max: 100, percent: 80, rating: { label: '熟練' } },
    ],
    strongest: { subtitle: 'D1' },
    weakest: { subtitle: 'D1' },
  };

  it('includes assessment name, total and level', () => {
    const text = resultSummaryText(fakeResult);
    expect(text).toContain('測試評量');
    expect(text).toContain('300 / 450');
    expect(text).toContain('發展期');
  });

  it('lists dimension scores', () => {
    const text = resultSummaryText(fakeResult);
    expect(text).toContain('D1');
    expect(text).toContain('80%');
  });

  it('falls back to default name when assessmentName is absent', () => {
    const text = resultSummaryText({ ...fakeResult, assessmentName: undefined });
    expect(text).toContain('職能評測');
  });
});
