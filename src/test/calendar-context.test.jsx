import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CalendarProvider, useCalendar } from '../context/CalendarContext';

const USER_ID = 'u_test';
const STORAGE_KEY = `cal_events_${USER_ID}`;

function makeWrapper() {
  return ({ children }) => (
    <CalendarProvider userId={USER_ID}>{children}</CalendarProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('addEvent', () => {
  it('returns the new event with a generated id and creatorId', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Test', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    expect(event.id).toBeTruthy();
    expect(event.creatorId).toBe(USER_ID);
    expect(event.title).toBe('Test');
  });

  it('adds the event to the events list', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    act(() => { result.current.addEvent({ title: 'Alpha', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe('Alpha');
  });

  it('persists the event to localStorage after debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    act(() => { result.current.addEvent({ title: 'Stored', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { vi.advanceTimersByTime(300); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Stored');
  });

  it('accumulates multiple events', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    act(() => {
      result.current.addEvent({ title: 'A', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' });
      result.current.addEvent({ title: 'B', startAt: '2026-06-11T09:00:00.000Z', endAt: '2026-06-11T10:00:00.000Z' });
    });
    expect(result.current.events).toHaveLength(2);
  });
});

describe('updateEvent', () => {
  it('updates the specified event by id', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Original', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { result.current.updateEvent(event.id, { title: 'Updated' }); });
    expect(result.current.events[0].title).toBe('Updated');
  });

  it('preserves fields not included in the update', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Keep', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z', color: 'blue' }); });
    act(() => { result.current.updateEvent(event.id, { title: 'Changed' }); });
    expect(result.current.events[0].color).toBe('blue');
    expect(result.current.events[0].startAt).toBe('2026-06-10T09:00:00.000Z');
  });

  it('never overrides creatorId', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'T', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { result.current.updateEvent(event.id, { creatorId: 'attacker' }); });
    expect(result.current.events[0].creatorId).toBe(USER_ID);
  });

  it('persists the update to localStorage after debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Orig', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { result.current.updateEvent(event.id, { title: 'Saved' }); });
    act(() => { vi.advanceTimersByTime(300); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored[0].title).toBe('Saved');
  });

  it('does not modify other events', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let a, b;
    act(() => {
      a = result.current.addEvent({ title: 'A', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' });
      b = result.current.addEvent({ title: 'B', startAt: '2026-06-11T09:00:00.000Z', endAt: '2026-06-11T10:00:00.000Z' });
    });
    act(() => { result.current.updateEvent(a.id, { title: 'A-updated' }); });
    const bEvent = result.current.events.find(e => e.id === b.id);
    expect(bEvent.title).toBe('B');
  });
});

describe('deleteEvent', () => {
  it('removes the event from the list', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Delete me', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { result.current.deleteEvent(event.id); });
    expect(result.current.events).toHaveLength(0);
  });

  it('persists the deletion to localStorage after debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let event;
    act(() => { event = result.current.addEvent({ title: 'Gone', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }); });
    act(() => { result.current.deleteEvent(event.id); });
    act(() => { vi.advanceTimersByTime(300); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toHaveLength(0);
  });

  it('only removes the targeted event', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    let a, b;
    act(() => {
      a = result.current.addEvent({ title: 'A', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' });
      b = result.current.addEvent({ title: 'B', startAt: '2026-06-11T09:00:00.000Z', endAt: '2026-06-11T10:00:00.000Z' });
    });
    act(() => { result.current.deleteEvent(a.id); });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].id).toBe(b.id);
  });
});

describe('persistence on mount', () => {
  it('loads events from localStorage on initial render', () => {
    const seed = [{ id: 'existing', title: 'Pre-existing', creatorId: USER_ID, startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe('Pre-existing');
  });

  it('returns empty array when localStorage has no data', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    expect(result.current.events).toHaveLength(0);
  });

  it('returns empty array when localStorage has corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper() });
    expect(result.current.events).toHaveLength(0);
  });
});
