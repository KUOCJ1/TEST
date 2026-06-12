import { describe, it, expect } from 'vitest';
import { findConflicts } from '../utils/conflicts';
import { expandRecurringEvents } from '../utils/recurrence';

// ── Conflict detection ────────────────────────────────────────────
describe('findConflicts', () => {
  const base = {
    id: 'e1',
    title: 'Existing',
    isAllDay: false,
    source: undefined,
    startAt: '2026-06-10T10:00:00.000Z',
    endAt:   '2026-06-10T11:00:00.000Z',
  };

  it('returns empty for all-day candidate', () => {
    const candidate = { isAllDay: true, startAt: '2026-06-10T00:00:00.000Z', endAt: '2026-06-10T23:59:59.000Z' };
    expect(findConflicts([base], candidate)).toHaveLength(0);
  });

  it('detects overlap when candidate starts inside existing event', () => {
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T10:30:00.000Z',
      endAt:   '2026-06-10T11:30:00.000Z',
    };
    expect(findConflicts([base], candidate)).toHaveLength(1);
  });

  it('detects overlap when candidate fully contains existing event', () => {
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T09:00:00.000Z',
      endAt:   '2026-06-10T12:00:00.000Z',
    };
    expect(findConflicts([base], candidate)).toHaveLength(1);
  });

  it('returns empty when events are adjacent (no overlap)', () => {
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T11:00:00.000Z',
      endAt:   '2026-06-10T12:00:00.000Z',
    };
    expect(findConflicts([base], candidate)).toHaveLength(0);
  });

  it('excludes event by id (for edit mode)', () => {
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T10:30:00.000Z',
      endAt:   '2026-06-10T11:30:00.000Z',
    };
    expect(findConflicts([base], candidate, 'e1')).toHaveLength(0);
  });

  it('skips Google calendar events', () => {
    const googleEvent = { ...base, id: 'g1', source: 'google' };
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T10:30:00.000Z',
      endAt:   '2026-06-10T11:30:00.000Z',
    };
    expect(findConflicts([googleEvent], candidate)).toHaveLength(0);
  });

  it('skips all-day events in the event list', () => {
    const allDayEvent = { ...base, isAllDay: true };
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T10:30:00.000Z',
      endAt:   '2026-06-10T11:30:00.000Z',
    };
    expect(findConflicts([allDayEvent], candidate)).toHaveLength(0);
  });

  it('returns multiple conflicts', () => {
    const e2 = { ...base, id: 'e2', startAt: '2026-06-10T10:45:00.000Z', endAt: '2026-06-10T11:15:00.000Z' };
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T09:00:00.000Z',
      endAt:   '2026-06-10T12:00:00.000Z',
    };
    expect(findConflicts([base, e2], candidate)).toHaveLength(2);
  });
});

// ── Recurring events ──────────────────────────────────────────────
describe('expandRecurringEvents', () => {
  const rangeStart = new Date('2026-06-01T00:00:00.000Z');
  const rangeEnd   = new Date('2026-06-30T23:59:59.000Z');

  const baseEvent = {
    id: 'r1',
    title: 'Daily Standup',
    color: 'blue',
    isAllDay: false,
    startAt: '2026-06-01T09:00:00.000Z',
    endAt:   '2026-06-01T09:30:00.000Z',
    recurrence: { freq: 'daily', until: '2026-06-05' },
  };

  it('expands a non-recurring event unchanged', () => {
    const event = { id: 'x', recurrence: null, startAt: '2026-06-10T10:00:00.000Z', endAt: '2026-06-10T11:00:00.000Z' };
    const result = expandRecurringEvents([event], rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('x');
  });

  it('expands daily recurrence to correct count', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    expect(result).toHaveLength(5); // June 1–5
  });

  it('first instance retains original id', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    expect(result[0].id).toBe('r1');
  });

  it('subsequent instances get unique ids', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    const ids = result.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all instances have isRecurring flag', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    expect(result.every(e => e.isRecurring)).toBe(true);
  });

  it('all instances have recurringBaseId pointing to base', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    expect(result.every(e => e.recurringBaseId === 'r1')).toBe(true);
  });

  it('preserves event duration across instances', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    result.forEach(e => {
      const dur = new Date(e.endAt) - new Date(e.startAt);
      expect(dur).toBe(30 * 60 * 1000); // 30 min
    });
  });

  it('weekly recurrence generates correct instances', () => {
    const weekly = {
      ...baseEvent,
      id: 'w1',
      recurrence: { freq: 'weekly', until: '2026-06-30' },
    };
    const result = expandRecurringEvents([weekly], rangeStart, rangeEnd);
    // June 1, 8, 15, 22, 29 = 5 instances
    expect(result).toHaveLength(5);
  });

  it('does not generate instances past until date', () => {
    const result = expandRecurringEvents([baseEvent], rangeStart, rangeEnd);
    result.forEach(e => {
      expect(new Date(e.startAt).toISOString().slice(0, 10) <= '2026-06-05').toBe(true);
    });
  });

  it('handles event with no until date (bounded by rangeEnd)', () => {
    const noUntil = {
      ...baseEvent,
      id: 'nu1',
      recurrence: { freq: 'daily', until: null },
    };
    const result = expandRecurringEvents([noUntil], rangeStart, rangeEnd);
    expect(result.length).toBe(30); // all 30 days of June
  });
});
