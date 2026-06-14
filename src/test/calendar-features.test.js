import { describe, it, expect } from 'vitest';
import { findConflicts } from '../utils/conflicts';
import { expandRecurringEvents } from '../utils/recurrence';
import { exportToIcs, parseIcs } from '../utils/ics';

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

  it('skips all-day events in the event list for timed candidates', () => {
    const allDayEvent = { ...base, isAllDay: true };
    const candidate = {
      isAllDay: false,
      startAt: '2026-06-10T10:30:00.000Z',
      endAt:   '2026-06-10T11:30:00.000Z',
    };
    expect(findConflicts([allDayEvent], candidate)).toHaveLength(0);
  });

  it('detects duplicate all-day events on the same day', () => {
    const allDayEvent = {
      id: 'a1', title: 'Holiday', isAllDay: true, source: undefined,
      startAt: '2026-06-15T00:00:00.000Z', endAt: '2026-06-15T23:59:59.000Z',
    };
    const candidate = { isAllDay: true, startAt: '2026-06-15T00:00:00.000Z', endAt: '2026-06-15T23:59:59.000Z' };
    expect(findConflicts([allDayEvent], candidate)).toHaveLength(1);
  });

  it('all-day candidate does not conflict with events on different days', () => {
    const allDayEvent = {
      id: 'a1', title: 'Holiday', isAllDay: true, source: undefined,
      startAt: '2026-06-14T00:00:00.000Z', endAt: '2026-06-14T23:59:59.000Z',
    };
    const candidate = { isAllDay: true, startAt: '2026-06-15T00:00:00.000Z', endAt: '2026-06-15T23:59:59.000Z' };
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

  it('monthly recurrence generates instances on same day each month', () => {
    const monthly = {
      ...baseEvent,
      id: 'm1',
      startAt: '2026-01-15T09:00:00.000Z',
      endAt:   '2026-01-15T10:00:00.000Z',
      recurrence: { freq: 'monthly', until: '2026-06-30' },
    };
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end   = new Date('2026-06-30T23:59:59.000Z');
    const result = expandRecurringEvents([monthly], start, end);
    // Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15 = 6
    expect(result).toHaveLength(6);
    result.forEach(e => {
      expect(new Date(e.startAt).getUTCDate()).toBe(15);
    });
  });

  it('monthly recurrence on month-end clamps to last day of shorter months', () => {
    const monthEnd = {
      ...baseEvent,
      id: 'me1',
      startAt: '2026-01-31T09:00:00.000Z',
      endAt:   '2026-01-31T10:00:00.000Z',
      recurrence: { freq: 'monthly', until: '2026-03-31' },
    };
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end   = new Date('2026-03-31T23:59:59.000Z');
    const result = expandRecurringEvents([monthEnd], start, end);
    // Jan 31, Feb 28 (clamped), Mar 31 = 3 instances
    expect(result).toHaveLength(3);
    expect(new Date(result[0].startAt).getUTCDate()).toBe(31); // Jan 31
    expect(new Date(result[1].startAt).getUTCDate()).toBe(28); // Feb 28 (2026 not leap)
    expect(new Date(result[2].startAt).getUTCDate()).toBe(31); // Mar 31
  });

  it('yearly recurrence generates one instance per year', () => {
    const yearly = {
      ...baseEvent,
      id: 'y1',
      startAt: '2024-03-20T09:00:00.000Z',
      endAt:   '2024-03-20T10:00:00.000Z',
      recurrence: { freq: 'yearly', until: '2027-12-31' },
    };
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end   = new Date('2027-12-31T23:59:59.000Z');
    const result = expandRecurringEvents([yearly], start, end);
    expect(result).toHaveLength(4); // 2024, 2025, 2026, 2027
    const years = result.map(e => new Date(e.startAt).getUTCFullYear());
    expect(years).toEqual([2024, 2025, 2026, 2027]);
  });

  it('event starting before range shows instances in range', () => {
    const pastStart = {
      ...baseEvent,
      id: 'ps1',
      startAt: '2026-05-28T09:00:00.000Z',
      endAt:   '2026-05-28T09:30:00.000Z',
      recurrence: { freq: 'daily', until: '2026-06-03' },
    };
    const result = expandRecurringEvents([pastStart], rangeStart, rangeEnd);
    // May 28, 29, 30, 31 are before range; June 1–3 are in range = 3 instances
    expect(result).toHaveLength(3);
    result.forEach(e => {
      const d = new Date(e.startAt);
      expect(d.getUTCMonth()).toBe(5); // June (0-indexed)
    });
  });

  it('yearly recurrence on Feb 29 clamps to Feb 28 in non-leap years', () => {
    const leapDay = {
      ...baseEvent,
      id: 'leap1',
      startAt: '2024-02-29T09:00:00.000Z',
      endAt:   '2024-02-29T10:00:00.000Z',
      recurrence: { freq: 'yearly', until: '2028-12-31' },
    };
    const start = new Date('2024-01-01T00:00:00.000Z');
    const end   = new Date('2028-12-31T23:59:59.000Z');
    const result = expandRecurringEvents([leapDay], start, end);
    // 2024 (Feb 29), 2025 (Feb 28), 2026 (Feb 28), 2027 (Feb 28), 2028 (Feb 29)
    expect(result).toHaveLength(5);
    const dates = result.map(e => new Date(e.startAt).getUTCDate());
    expect(dates[0]).toBe(29); // 2024 leap
    expect(dates[1]).toBe(28); // 2025 not leap
    expect(dates[2]).toBe(28); // 2026 not leap
    expect(dates[3]).toBe(28); // 2027 not leap
    expect(dates[4]).toBe(29); // 2028 leap
  });
});

// ── ICS import/export roundtrip ───────────────────────────────────
describe('ICS roundtrip', () => {
  const timed = {
    id: 'evt1',
    title: 'Team Meeting',
    description: 'Q2 Review',
    startAt: '2026-06-10T09:00:00.000Z',
    endAt:   '2026-06-10T10:00:00.000Z',
    isAllDay: false,
    tags: ['work', 'meeting'],
    reminder: '',
    isPrivate: false,
    type: 'work',
    color: 'blue',
  };

  const allDay = {
    id: 'evt2',
    title: 'Company Holiday',
    description: '',
    startAt: '2026-06-15T00:00:00.000Z',
    endAt:   '2026-06-15T23:59:59.000Z',
    isAllDay: true,
    tags: [],
    reminder: '',
    isPrivate: false,
    type: 'personal',
    color: 'green',
  };

  it('exports valid VCALENDAR with BEGIN/END wrappers', () => {
    const ics = exportToIcs([timed]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('roundtrips timed event title and description', () => {
    const ics = exportToIcs([timed]);
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Team Meeting');
    expect(parsed[0].description).toBe('Q2 Review');
  });

  it('roundtrips timed event start/end times', () => {
    const ics = exportToIcs([timed]);
    const parsed = parseIcs(ics);
    expect(parsed[0].startAt).toBe(timed.startAt);
    expect(parsed[0].endAt).toBe(timed.endAt);
  });

  it('roundtrips tags/categories', () => {
    const ics = exportToIcs([timed]);
    const parsed = parseIcs(ics);
    expect(parsed[0].tags).toEqual(['work', 'meeting']);
  });

  it('roundtrips all-day event', () => {
    const ics = exportToIcs([allDay]);
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].isAllDay).toBe(true);
    expect(parsed[0].title).toBe('Company Holiday');
  });

  it('all-day DTEND is exclusive (start + 1 day) per RFC 5545', () => {
    const ics = exportToIcs([allDay]);
    // allDay startAt is 2026-06-15; DTEND must be 20260616 (exclusive)
    const start = new Date(allDay.startAt);
    const expectedEnd = new Date(start);
    expectedEnd.setDate(expectedEnd.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    const expectedDateStr = `${expectedEnd.getFullYear()}${pad(expectedEnd.getMonth()+1)}${pad(expectedEnd.getDate())}`;
    expect(ics).toContain(`DTEND;VALUE=DATE:${expectedDateStr}`);
  });

  it('all-day DTSTART uses local date (not UTC date)', () => {
    const ics = exportToIcs([allDay]);
    const localDate = new Date(allDay.startAt);
    const pad = n => String(n).padStart(2, '0');
    const localDateStr = `${localDate.getFullYear()}${pad(localDate.getMonth()+1)}${pad(localDate.getDate())}`;
    expect(ics).toContain(`DTSTART;VALUE=DATE:${localDateStr}`);
  });

  it('handles special characters in title (escaping)', () => {
    const special = {
      ...timed,
      id: 'sp1',
      title: 'Meeting: Cost, Budget; Review',
      description: 'Line1\nLine2',
    };
    const ics = exportToIcs([special]);
    const parsed = parseIcs(ics);
    expect(parsed[0].title).toBe('Meeting: Cost, Budget; Review');
    expect(parsed[0].description).toBe('Line1\nLine2');
  });

  it('exports multiple events and parses all back', () => {
    const ics = exportToIcs([timed, allDay]);
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(2);
  });

  it('parses CRLF line endings correctly', () => {
    const ics = exportToIcs([timed]); // already uses CRLF
    expect(ics).toContain('\r\n');
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Team Meeting');
  });

  it('returns empty array for empty event list', () => {
    const ics = exportToIcs([]);
    const parsed = parseIcs(ics);
    expect(parsed).toHaveLength(0);
  });

  it('skips VEVENT blocks missing required fields', () => {
    const malformed = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:bad@test\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const parsed = parseIcs(malformed);
    expect(parsed).toHaveLength(0);
  });

  it('roundtrips location field', () => {
    const withLocation = { ...timed, id: 'loc1', location: 'Conference Room A, 2F' };
    const ics = exportToIcs([withLocation]);
    expect(ics).toContain('LOCATION:Conference Room A\\, 2F');
    const parsed = parseIcs(ics);
    expect(parsed[0].location).toBe('Conference Room A, 2F');
  });

  it('roundtrips url field', () => {
    const withUrl = { ...timed, id: 'url1', url: 'https://meet.example.com/abc' };
    const ics = exportToIcs([withUrl]);
    expect(ics).toContain('URL:https://meet.example.com/abc');
    const parsed = parseIcs(ics);
    expect(parsed[0].url).toBe('https://meet.example.com/abc');
  });

  it('roundtrips reminder as VALARM TRIGGER', () => {
    const withReminder = { ...timed, id: 'rem1', reminder: '15' };
    const ics = exportToIcs([withReminder]);
    expect(ics).toContain('TRIGGER:-PT15M');
    const parsed = parseIcs(ics);
    expect(parsed[0].reminder).toBe('15');
  });

  it('roundtrips 1-hour reminder (60 min) using PTxH format', () => {
    const withReminder = { ...timed, id: 'rem2', reminder: '60' };
    const ics = exportToIcs([withReminder]);
    expect(ics).toContain('TRIGGER:-PT1H');
    const parsed = parseIcs(ics);
    expect(parsed[0].reminder).toBe('60');
  });

  it('roundtrips 1-day reminder (1440 min) using PxD format', () => {
    const withReminder = { ...timed, id: 'rem3', reminder: '1440' };
    const ics = exportToIcs([withReminder]);
    expect(ics).toContain('TRIGGER:-P1D');
    const parsed = parseIcs(ics);
    expect(parsed[0].reminder).toBe('1440');
  });

  it('roundtrips 1-week reminder (10080 min) using PxD format', () => {
    const withReminder = { ...timed, id: 'rem4', reminder: '10080' };
    const ics = exportToIcs([withReminder]);
    expect(ics).toContain('TRIGGER:-P7D');
    const parsed = parseIcs(ics);
    expect(parsed[0].reminder).toBe('10080');
  });

  it('exports CLASS:PRIVATE for private events', () => {
    const priv = { ...timed, id: 'p1', isPrivate: true };
    const ics = exportToIcs([priv]);
    expect(ics).toContain('CLASS:PRIVATE');
  });

  it('roundtrips isPrivate field', () => {
    const priv = { ...timed, id: 'p2', isPrivate: true };
    const ics = exportToIcs([priv]);
    const parsed = parseIcs(ics);
    expect(parsed[0].isPrivate).toBe(true);
  });

  it('non-private events do not include CLASS:PRIVATE', () => {
    const ics = exportToIcs([timed]);
    expect(ics).not.toContain('CLASS:PRIVATE');
    const parsed = parseIcs(ics);
    expect(parsed[0].isPrivate).toBe(false);
  });

  it('exports RRULE for recurring event', () => {
    const recurring = { ...timed, id: 'rr1', recurrence: { freq: 'weekly', until: '2026-12-31' } };
    const ics = exportToIcs([recurring]);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20261231T000000Z');
  });

  it('roundtrips recurring event with RRULE', () => {
    const recurring = { ...timed, id: 'rr2', recurrence: { freq: 'daily', until: '2026-07-10' } };
    const ics = exportToIcs([recurring]);
    const parsed = parseIcs(ics);
    expect(parsed[0].recurrence).toEqual({ freq: 'daily', until: '2026-07-10' });
  });

  it('roundtrips recurring event without until date', () => {
    const recurring = { ...timed, id: 'rr3', recurrence: { freq: 'monthly', until: null } };
    const ics = exportToIcs([recurring]);
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    const parsed = parseIcs(ics);
    expect(parsed[0].recurrence?.freq).toBe('monthly');
    expect(parsed[0].recurrence?.until).toBeNull();
  });

  it('roundtrips tags containing commas without data loss', () => {
    const withCommaTag = { ...timed, id: 'tag1', tags: ['work,urgent', 'personal'] };
    const ics = exportToIcs([withCommaTag]);
    const parsed = parseIcs(ics);
    expect(parsed[0].tags).toEqual(['work,urgent', 'personal']);
  });

  it('escapes commas in CATEGORIES export', () => {
    const withCommaTag = { ...timed, id: 'tag2', tags: ['a,b'] };
    const ics = exportToIcs([withCommaTag]);
    expect(ics).toContain('CATEGORIES:a\\,b');
  });

  it('folds lines longer than 75 chars in ICS export', () => {
    const longTitle = 'A'.repeat(80);
    const evt = { ...timed, id: 'fold1', title: longTitle };
    const ics = exportToIcs([evt]);
    const lines = ics.split('\r\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('roundtrips long title via folded ICS', () => {
    const longTitle = 'B'.repeat(100);
    const evt = { ...timed, id: 'fold2', title: longTitle };
    const ics = exportToIcs([evt]);
    const parsed = parseIcs(ics);
    expect(parsed[0].title).toBe(longTitle);
  });

  it('VALARM lines are separate entries in ICS export', () => {
    const withReminder = { ...timed, id: 'val1', reminder: '15' };
    const ics = exportToIcs([withReminder]);
    const lines = ics.split('\r\n');
    expect(lines).toContain('BEGIN:VALARM');
    expect(lines).toContain('END:VALARM');
    expect(lines).toContain('ACTION:DISPLAY');
  });
});
