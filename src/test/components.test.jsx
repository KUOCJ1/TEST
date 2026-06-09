import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getMonthCalendarDays, isSameDay, isToday, getEventsForDay } from '../utils/calendar';
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

describe('color utilities', () => {
  it('getColorHex returns hex for known color', () => {
    expect(getColorHex('blue')).toBe('#3b82f6');
    expect(getColorHex('red')).toBe('#ef4444');
  });

  it('getColorHex returns fallback for unknown color', () => {
    expect(getColorHex('unknown')).toBe('#6366f1');
  });

  it('EVENT_COLORS has 6 entries', () => {
    expect(EVENT_COLORS).toHaveLength(6);
  });

  it('EVENT_TYPES has 4 entries', () => {
    expect(EVENT_TYPES).toHaveLength(4);
  });
});
