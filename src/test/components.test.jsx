import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getMonthCalendarDays, isSameDay, isToday, getEventsForDay, layoutDayEvents, getWeekStart, getWeekDays, formatDisplayTime } from '../utils/calendar';
import { getColorHex, EVENT_COLORS, EVENT_TYPES } from '../utils/colors';

beforeEach(() => {
  localStorage.clear();
});

describe('calendar utilities', () => {
  it('getMonthCalendarDays returns 42 cells', () => {
    const days = getMonthCalendarDays(2026, 5);
    expect(days).toHaveLength(42);
  });

  it('marks correct days as current month', () => {
    const days = getMonthCalendarDays(2026, 5); // June 2026
    const currentDays = days.filter(d => d.isCurrentMonth);
    expect(currentDays).toHaveLength(30); // June has 30 days
  });

  it('isSameDay returns true for same date', () => {
    const a = new Date(2026, 5, 9);
    const b = new Date(2026, 5, 9);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('isSameDay returns false for different dates', () => {
    const a = new Date(2026, 5, 9);
    const b = new Date(2026, 5, 10);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('getEventsForDay filters events by date', () => {
    const events = [
      { id: '1', startAt: '2026-06-09T10:00:00.000Z', endAt: '2026-06-09T11:00:00.000Z' },
      { id: '2', startAt: '2026-06-10T10:00:00.000Z', endAt: '2026-06-10T11:00:00.000Z' },
    ];
    const date = new Date(2026, 5, 10);
    const result = getEventsForDay(events, date);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});

describe('layoutDayEvents', () => {
  function makeEv(id, startH, endH) {
    const d = '2026-06-10';
    return {
      id,
      startAt: `${d}T${String(startH).padStart(2,'0')}:00:00Z`,
      endAt:   `${d}T${String(endH).padStart(2,'0')}:00:00Z`,
    };
  }

  it('returns empty for no events', () => {
    expect(layoutDayEvents([])).toEqual([]);
  });

  it('single event gets col 0 and totalCols 1', () => {
    const [result] = layoutDayEvents([makeEv('a', 9, 10)]);
    expect(result.col).toBe(0);
    expect(result.totalCols).toBe(1);
  });

  it('non-overlapping events both get col 0', () => {
    const result = layoutDayEvents([makeEv('a', 9, 10), makeEv('b', 11, 12)]);
    expect(result.every(r => r.col === 0)).toBe(true);
    expect(result.every(r => r.totalCols === 1)).toBe(true);
  });

  it('two overlapping events get col 0 and col 1', () => {
    const result = layoutDayEvents([makeEv('a', 9, 11), makeEv('b', 10, 12)]);
    const cols = result.map(r => r.col).sort();
    expect(cols).toEqual([0, 1]);
    expect(result.every(r => r.totalCols === 2)).toBe(true);
  });

  it('three overlapping events use three columns', () => {
    const result = layoutDayEvents([makeEv('a', 9, 12), makeEv('b', 9, 12), makeEv('c', 9, 12)]);
    const cols = result.map(r => r.col).sort();
    expect(cols).toEqual([0, 1, 2]);
    expect(result.every(r => r.totalCols === 3)).toBe(true);
  });

  it('adjacent events (no overlap) both get col 0', () => {
    // 09:00–10:00 and 10:00–11:00 should not overlap (startAt < endAt strict)
    const result = layoutDayEvents([makeEv('a', 9, 10), makeEv('b', 10, 11)]);
    expect(result.every(r => r.col === 0)).toBe(true);
  });
});

describe('getWeekStart and getWeekDays', () => {
  it('getWeekStart returns Sunday of the week', () => {
    // June 10, 2026 is a Wednesday
    const d = new Date(2026, 5, 10);
    const ws = getWeekStart(d);
    expect(ws.getDay()).toBe(0); // Sunday
    expect(ws.getDate()).toBe(7); // June 7
  });

  it('getWeekDays returns 7 days starting with Sunday', () => {
    const d = new Date(2026, 5, 10);
    const days = getWeekDays(d);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
  });

  it('getWeekDays are consecutive days', () => {
    const days = getWeekDays(new Date(2026, 5, 10));
    for (let i = 1; i < days.length; i++) {
      expect(days[i].getDate() - days[i - 1].getDate()).toBe(1);
    }
  });
});

describe('formatDisplayTime', () => {
  it('formats a UTC time to HH:MM string', () => {
    // Use a time that's unambiguous regardless of local timezone by just checking format
    const result = formatDisplayTime('2026-06-10T09:00:00.000Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('color utilities', () => {
  it('getColorHex returns hex for known color', () => {
    expect(getColorHex('blue')).toBe('#3b82f6');
    expect(getColorHex('red')).toBe('#ef4444');
  });

  it('getColorHex returns fallback for unknown color', () => {
    expect(getColorHex('unknown')).toBe('#6366f1');
  });

  it('EVENT_COLORS has 12 entries', () => {
    expect(EVENT_COLORS).toHaveLength(12);
  });

  it('EVENT_TYPES has 4 entries', () => {
    expect(EVENT_TYPES).toHaveLength(4);
  });
});
