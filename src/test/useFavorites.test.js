import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CalendarProvider, useCalendar } from '../context/CalendarContext';

beforeEach(() => {
  localStorage.clear();
});

const authWrapper = ({ children }) => React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
  it('starts with no current user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    expect(result.current.currentUser).toBeNull();
  });

  it('registers a new user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Alice', 'alice@example.com', 'pass123'); });
    expect(result.current.currentUser).not.toBeNull();
    expect(result.current.currentUser.name).toBe('Alice');
  });

  it('logs in an existing user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Bob', 'bob@example.com', 'pass123'); });
    act(() => { result.current.logout(); });
    expect(result.current.currentUser).toBeNull();
    act(() => { result.current.login('bob@example.com', 'pass123'); });
    expect(result.current.currentUser.name).toBe('Bob');
  });

  it('throws on wrong password', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Carol', 'carol@example.com', 'correct'); });
    act(() => { result.current.logout(); });
    expect(() => {
      act(() => { result.current.login('carol@example.com', 'wrong'); });
    }).toThrow('Email 或密碼錯誤');
  });

  it('throws when registering duplicate email', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Dave', 'dave@example.com', 'pass123'); });
    act(() => { result.current.logout(); });
    expect(() => {
      act(() => { result.current.register('Dave2', 'dave@example.com', 'pass456'); });
    }).toThrow('此 Email 已被使用');
  });

  it('persists session to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Eve', 'eve@example.com', 'pass123'); });
    const stored = JSON.parse(localStorage.getItem('cal_session'));
    expect(stored.name).toBe('Eve');
  });

  it('logs out and clears session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    act(() => { result.current.register('Frank', 'frank@example.com', 'pass123'); });
    act(() => { result.current.logout(); });
    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem('cal_session')).toBeNull();
  });
});

describe('CalendarContext', () => {
  const makeWrapper = (userId) =>
    ({ children }) => React.createElement(CalendarProvider, { userId }, children);

  it('starts with empty events', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u1') });
    expect(result.current.events).toEqual([]);
  });

  it('adds an event', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u1') });
    act(() => {
      result.current.addEvent({
        title: 'Test Event',
        type: 'work',
        color: 'blue',
        startAt: '2026-06-09T10:00:00.000Z',
        endAt: '2026-06-09T11:00:00.000Z',
        isAllDay: false,
        isPrivate: false,
        tags: [],
        description: '',
        reminder: '',
      });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe('Test Event');
  });

  it('updates an event', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u2') });
    let eventId;
    act(() => {
      const e = result.current.addEvent({ title: 'Original', type: 'work', color: 'blue',
        startAt: '2026-06-09T10:00:00.000Z', endAt: '2026-06-09T11:00:00.000Z',
        isAllDay: false, isPrivate: false, tags: [], description: '', reminder: '' });
      eventId = e.id;
    });
    act(() => { result.current.updateEvent(eventId, { title: 'Updated' }); });
    expect(result.current.events[0].title).toBe('Updated');
  });

  it('deletes an event', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u3') });
    let eventId;
    act(() => {
      const e = result.current.addEvent({ title: 'To Delete', type: 'work', color: 'blue',
        startAt: '2026-06-09T10:00:00.000Z', endAt: '2026-06-09T11:00:00.000Z',
        isAllDay: false, isPrivate: false, tags: [], description: '', reminder: '' });
      eventId = e.id;
    });
    act(() => { result.current.deleteEvent(eventId); });
    expect(result.current.events).toHaveLength(0);
  });

  it('persists events to localStorage', () => {
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u4') });
    act(() => {
      result.current.addEvent({ title: 'Persisted', type: 'work', color: 'blue',
        startAt: '2026-06-09T10:00:00.000Z', endAt: '2026-06-09T11:00:00.000Z',
        isAllDay: false, isPrivate: false, tags: [], description: '', reminder: '' });
    });
    const stored = JSON.parse(localStorage.getItem('cal_events_u4'));
    expect(stored[0].title).toBe('Persisted');
  });
});
