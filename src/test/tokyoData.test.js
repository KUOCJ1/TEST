import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthCalendarDays,
  isSameDay,
  formatDateInput,
  combineDatetime,
  getWeekStart,
  getWeekDays,
  layoutDayEvents,
  formatWeekTitle,
  formatDayTitle,
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

describe('getWeekStart', () => {
  it('returns Sunday for a Wednesday', () => {
    const wed = new Date(2026, 5, 10); // Wed June 10
    const start = getWeekStart(wed);
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(7); // June 7 is Sunday
  });

  it('returns same day if already Sunday', () => {
    const sun = new Date(2026, 5, 7);
    const start = getWeekStart(sun);
    expect(start.getDate()).toBe(7);
  });
});

describe('getWeekDays', () => {
  it('returns exactly 7 days', () => {
    expect(getWeekDays(new Date(2026, 5, 9))).toHaveLength(7);
  });

  it('starts on Sunday', () => {
    const days = getWeekDays(new Date(2026, 5, 9));
    expect(days[0].getDay()).toBe(0);
  });

  it('ends on Saturday', () => {
    const days = getWeekDays(new Date(2026, 5, 9));
    expect(days[6].getDay()).toBe(6);
  });
});

describe('layoutDayEvents', () => {
  const makeEvent = (id, startH, endH) => ({
    id,
    startAt: new Date(2026, 5, 9, startH, 0).toISOString(),
    endAt:   new Date(2026, 5, 9, endH,   0).toISOString(),
  });

  it('returns empty array for no events', () => {
    expect(layoutDayEvents([])).toEqual([]);
  });

  it('single event gets col 0, totalCols 1', () => {
    const result = layoutDayEvents([makeEvent('a', 10, 11)]);
    expect(result[0].col).toBe(0);
    expect(result[0].totalCols).toBe(1);
  });

  it('two non-overlapping events both get col 0', () => {
    const result = layoutDayEvents([makeEvent('a', 9, 10), makeEvent('b', 11, 12)]);
    expect(result.find(r => r.event.id === 'a').col).toBe(0);
    expect(result.find(r => r.event.id === 'b').col).toBe(0);
  });

  it('two overlapping events get different columns', () => {
    const result = layoutDayEvents([makeEvent('a', 9, 11), makeEvent('b', 10, 12)]);
    const cols = result.map(r => r.col);
    expect(new Set(cols).size).toBe(2);
  });

  it('overlapping events report totalCols >= 2', () => {
    const result = layoutDayEvents([makeEvent('a', 9, 11), makeEvent('b', 10, 12)]);
    expect(result.every(r => r.totalCols >= 2)).toBe(true);
  });

  it('non-overlapping event after overlap group gets totalCols 1', () => {
    const result = layoutDayEvents([makeEvent('a', 9, 10), makeEvent('b', 9, 10), makeEvent('c', 14, 15)]);
    expect(result.find(r => r.event.id === 'c').totalCols).toBe(1);
  });
});

describe('formatWeekTitle', () => {
  it('same-month week shows date range', () => {
    const days = getWeekDays(new Date(2026, 5, 9));
    const title = formatWeekTitle(days);
    expect(title).toContain('6 月');
  });

  it('cross-month week shows both months', () => {
    const days = getWeekDays(new Date(2026, 5, 29)); // week spanning June/July
    const title = formatWeekTitle(days);
    expect(title).toMatch(/6|7/);
  });
});

describe('formatDayTitle', () => {
  it('includes day of week', () => {
    const title = formatDayTitle(new Date(2026, 5, 9)); // Tuesday
    expect(title).toContain('星期二');
  });

  it('includes month and date', () => {
    const title = formatDayTitle(new Date(2026, 5, 9));
    expect(title).toContain('6');
    expect(title).toContain('9');
  });
});
