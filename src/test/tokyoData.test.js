import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthCalendarDays,
  isSameDay,
  formatDateInput,
  combineDatetime,
  generateId,
} from '../utils/calendar';

beforeEach(() => {
  localStorage.clear();
});

describe('getDaysInMonth', () => {
  it('returns 30 for June', () => {
    expect(getDaysInMonth(2026, 5)).toBe(30);
  });

  it('returns 31 for January', () => {
    expect(getDaysInMonth(2026, 0)).toBe(31);
  });

  it('returns 28 for February 2025 (non-leap)', () => {
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('returns 29 for February 2024 (leap)', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });
});

describe('getMonthCalendarDays', () => {
  it('always returns exactly 42 days', () => {
    for (let m = 0; m < 12; m++) {
      expect(getMonthCalendarDays(2026, m)).toHaveLength(42);
    }
  });

  it('first day of grid is Sunday when month starts on Sunday', () => {
    // 2026-03 starts on Sunday
    const days = getMonthCalendarDays(2026, 2);
    expect(days[0].date.getDay()).toBe(0);
    expect(days[0].isCurrentMonth).toBe(true);
  });

  it('marks prev/next month days correctly', () => {
    const days = getMonthCalendarDays(2026, 5);
    const current = days.filter(d => d.isCurrentMonth);
    const other = days.filter(d => !d.isCurrentMonth);
    expect(current).toHaveLength(30);
    expect(other).toHaveLength(12);
  });
});

describe('isSameDay', () => {
  it('returns true for identical dates', () => {
    expect(isSameDay(new Date(2026, 5, 9), new Date(2026, 5, 9))).toBe(true);
  });

  it('returns false when days differ', () => {
    expect(isSameDay(new Date(2026, 5, 9), new Date(2026, 5, 10))).toBe(false);
  });

  it('ignores time component', () => {
    expect(isSameDay(new Date(2026, 5, 9, 8, 0), new Date(2026, 5, 9, 23, 59))).toBe(true);
  });
});

describe('formatDateInput', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads month and day with leading zeros', () => {
    expect(formatDateInput(new Date(2026, 8, 3))).toBe('2026-09-03');
  });
});

describe('combineDatetime', () => {
  it('combines date and time strings into ISO string', () => {
    const result = combineDatetime('2026-06-09', '10:30');
    const parsed = new Date(result);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(9);
    expect(parsed.getHours()).toBe(10);
    expect(parsed.getMinutes()).toBe(30);
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});
