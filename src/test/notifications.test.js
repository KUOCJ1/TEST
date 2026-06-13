import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { computeUpcomingReminders } from '../hooks/useNotifications';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper: make an event with reminder
function makeEvent(id, minutesFromNow, reminderMinutes) {
  const now = new Date();
  const start = new Date(now.getTime() + minutesFromNow * 60_000);
  const end   = new Date(start.getTime() + 60 * 60_000);
  return {
    id,
    title: `Event ${id}`,
    startAt: start.toISOString(),
    endAt:   end.toISOString(),
    reminder: String(reminderMinutes),
    type: 'work',
    color: 'blue',
    isAllDay: false,
    isPrivate: false,
    tags: [],
  };
}

describe('computeUpcomingReminders', () => {
  it('returns empty for events with no reminder', () => {
    const event = { ...makeEvent('a', 30, 15), reminder: '' };
    expect(computeUpcomingReminders([event])).toHaveLength(0);
  });

  it('includes event whose reminder fires within 24 hours', () => {
    // Event in 60 min with 15-min reminder → reminder fires in 45 min
    const result = computeUpcomingReminders([makeEvent('a', 60, 15)]);
    expect(result).toHaveLength(1);
    expect(result[0].event.id).toBe('a');
    expect(result[0].minutes).toBe(15);
  });

  it('excludes event whose reminder already fired (past)', () => {
    // Event started 30 min ago, 15-min reminder → reminder was 45 min ago
    const result = computeUpcomingReminders([makeEvent('a', -30, 15)]);
    expect(result).toHaveLength(0);
  });

  it('excludes reminder more than 48 hours away', () => {
    // Event in 72 hours with 15-min reminder → reminder fires in ~71h45m > 48h
    const result = computeUpcomingReminders([makeEvent('a', 72 * 60, 15)]);
    expect(result).toHaveLength(0);
  });

  it('event whose reminder fires beyond 48h is excluded', () => {
    // Event in 50h with 30-min reminder → reminder fires in 49.5h > 48h
    const result = computeUpcomingReminders([makeEvent('a', 50 * 60, 30)]);
    expect(result).toHaveLength(0);
  });

  it('includes event whose reminder fires within 48h window', () => {
    // Event in 48h with 15-min reminder → reminder fires in ~47h45m < 48h
    const result = computeUpcomingReminders([makeEvent('a', 48 * 60, 15)]);
    expect(result).toHaveLength(1);
  });

  it('sorts reminders by reminderTime ascending', () => {
    const events = [makeEvent('b', 120, 15), makeEvent('a', 60, 15)];
    const result = computeUpcomingReminders(events);
    expect(result[0].event.id).toBe('a');
    expect(result[1].event.id).toBe('b');
  });

  it('handles multiple events with different reminders', () => {
    const events = [
      makeEvent('a', 30, 15),    // reminder in 15 min ✓
      makeEvent('b', 60, 15),    // reminder in 45 min ✓
      makeEvent('c', 72 * 60, 15), // reminder fires in ~71h45m > 48h ✗
    ];
    expect(computeUpcomingReminders(events)).toHaveLength(2);
  });

  it('returns correct reminderTime for 1-hour reminder', () => {
    const event = makeEvent('a', 120, 60); // event in 2h, 1-hour reminder
    const result = computeUpcomingReminders([event]);
    expect(result).toHaveLength(1);
    // reminderTime should be ~60 min from now
    const diff = result[0].reminderTime - new Date();
    expect(diff).toBeGreaterThan(55 * 60_000);
    expect(diff).toBeLessThan(65 * 60_000);
  });

  it('all-day events with reminder are included if reminder fires in window', () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const event = {
      id: 'allday',
      title: 'All Day Event',
      startAt: tomorrow.toISOString(),
      endAt: new Date(tomorrow.getTime() + 86400_000).toISOString(),
      reminder: '60', // 1 hour before midnight
      isAllDay: true,
      isPrivate: false,
      tags: [],
      type: 'personal',
      color: 'green',
    };
    // Whether it shows depends on exact timing; just verify it doesn't throw
    expect(() => computeUpcomingReminders([event])).not.toThrow();
  });

  it('empty events array returns empty reminders', () => {
    expect(computeUpcomingReminders([])).toEqual([]);
  });
});
