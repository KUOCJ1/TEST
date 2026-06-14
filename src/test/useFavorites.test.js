import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CalendarProvider, useCalendar } from '../context/CalendarContext';
import { GroupProvider, useGroups } from '../context/GroupContext';

beforeEach(() => {
  localStorage.clear();
});

const authWrapper = ({ children }) => React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
  it('starts with no current user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    expect(result.current.currentUser).toBeNull();
  });

  it('registers a new user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Alice', 'alice@example.com', 'pass123'); });
    expect(result.current.currentUser).not.toBeNull();
    expect(result.current.currentUser.name).toBe('Alice');
  });

  it('logs in an existing user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Bob', 'bob@example.com', 'pass123'); });
    act(() => { result.current.logout(); });
    expect(result.current.currentUser).toBeNull();
    await act(async () => { await result.current.login('bob@example.com', 'pass123'); });
    expect(result.current.currentUser.name).toBe('Bob');
  });

  it('throws on wrong password', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Carol', 'carol@example.com', 'correct'); });
    act(() => { result.current.logout(); });
    await expect(
      act(async () => { await result.current.login('carol@example.com', 'wrong'); })
    ).rejects.toThrow('Email 或密碼錯誤');
  });

  it('throws when registering duplicate email', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Dave', 'dave@example.com', 'pass123'); });
    act(() => { result.current.logout(); });
    await expect(
      act(async () => { await result.current.register('Dave2', 'dave@example.com', 'pass456'); })
    ).rejects.toThrow('此 Email 已被使用');
  });

  it('persists session to localStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Eve', 'eve@example.com', 'pass123'); });
    const stored = JSON.parse(localStorage.getItem('cal_session'));
    expect(stored.name).toBe('Eve');
  });

  it('logs out and clears session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: authWrapper });
    await act(async () => { await result.current.register('Frank', 'frank@example.com', 'pass123'); });
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

  it('persists events to localStorage after debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCalendar(), { wrapper: makeWrapper('u4') });
    act(() => {
      result.current.addEvent({ title: 'Persisted', type: 'work', color: 'blue',
        startAt: '2026-06-09T10:00:00.000Z', endAt: '2026-06-09T11:00:00.000Z',
        isAllDay: false, isPrivate: false, tags: [], description: '', reminder: '' });
    });
    act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();
    const stored = JSON.parse(localStorage.getItem('cal_events_u4'));
    expect(stored[0].title).toBe('Persisted');
  });
});

describe('GroupContext', () => {
  const user1 = { id: 'g-u1', name: 'Alice', email: 'alice@test.com' };
  const user2 = { id: 'g-u2', name: 'Bob', email: 'bob@test.com' };
  const makeWrapper = (user) =>
    ({ children }) => React.createElement(GroupProvider, { currentUser: user }, children);

  it('starts with no groups', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    expect(result.current.groups).toHaveLength(0);
  });

  it('creates a group with invite code', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let group;
    act(() => { group = result.current.createGroup('Team Alpha'); });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe('Team Alpha');
    expect(result.current.groups[0].inviteCode).toHaveLength(6);
    expect(result.current.groups[0].members).toHaveLength(1);
  });

  it('owner has role "owner"', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    act(() => { result.current.createGroup('My Group'); });
    expect(result.current.groups[0].members[0].role).toBe('owner');
  });

  it('second user can join with invite code', () => {
    const { result: r1 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let inviteCode;
    act(() => { r1.current.createGroup('Shared'); });
    inviteCode = r1.current.groups[0].inviteCode;

    // user2 joins
    const { result: r2 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user2) });
    act(() => { r2.current.joinGroup(inviteCode); });
    expect(r2.current.groups).toHaveLength(1);
    expect(r2.current.groups[0].members).toHaveLength(2);
  });

  it('throws when joining with wrong invite code', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    expect(() => {
      act(() => { result.current.joinGroup('XXXXXX'); });
    }).toThrow('找不到此邀請碼');
  });

  it('throws when joining a group you are already in', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let code;
    act(() => { const g = result.current.createGroup('G'); code = g.inviteCode; });
    expect(() => {
      act(() => { result.current.joinGroup(code); });
    }).toThrow('你已是此群組的成員');
  });

  it('leaveGroup removes user from group', () => {
    const { result: r1 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId;
    act(() => { const g = r1.current.createGroup('LeaveTest'); groupId = g.id; });
    act(() => { r1.current.leaveGroup(groupId); });
    expect(r1.current.groups).toHaveLength(0);
  });

  it('getGroupById returns correct group', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId;
    act(() => { const g = result.current.createGroup('FindMe'); groupId = g.id; });
    const found = result.current.getGroupById(groupId);
    expect(found?.name).toBe('FindMe');
  });

  it('getGroupById returns null for unknown id', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    expect(result.current.getGroupById('nonexistent')).toBeNull();
  });

  it('renameGroup updates name', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId;
    act(() => { const g = result.current.createGroup('OldName'); groupId = g.id; });
    act(() => { result.current.renameGroup(groupId, 'NewName'); });
    expect(result.current.groups[0].name).toBe('NewName');
  });

  it('removeMember removes a member from the group', () => {
    const { result: r1 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId, code;
    act(() => { const g = r1.current.createGroup('RemoveTest'); groupId = g.id; code = g.inviteCode; });

    const { result: r2 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user2) });
    act(() => { r2.current.joinGroup(code); });

    act(() => { r1.current.refresh(); });
    expect(r1.current.getGroupById(groupId).members).toHaveLength(2);

    act(() => { r1.current.removeMember(groupId, user2.id); });
    expect(r1.current.getGroupById(groupId).members).toHaveLength(1);
    expect(r1.current.getGroupById(groupId).members[0].userId).toBe(user1.id);
  });

  it('ownership transfers when owner leaves a multi-member group', () => {
    const { result: r1 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId, code;
    act(() => { const g = r1.current.createGroup('TransferTest'); groupId = g.id; code = g.inviteCode; });

    const { result: r2 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user2) });
    act(() => { r2.current.joinGroup(code); });

    // Owner (user1) leaves
    act(() => { r1.current.leaveGroup(groupId); });

    // user2 should now own the group
    const remaining = r2.current.getGroupById(groupId);
    const u2member = remaining?.members.find(m => m.userId === user2.id);
    expect(u2member?.role).toBe('owner');
  });

  it('getGroupEvents aggregates events from all members', () => {
    const { result: r1 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    let groupId, code;
    act(() => { const g = r1.current.createGroup('EventsGroup'); groupId = g.id; code = g.inviteCode; });

    const { result: r2 } = renderHook(() => useGroups(), { wrapper: makeWrapper(user2) });
    act(() => { r2.current.joinGroup(code); });

    // Plant events for both users directly in localStorage
    const evt1 = { id: 'e1', title: 'Alice Event', startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T11:00:00Z' };
    const evt2 = { id: 'e2', title: 'Bob Event',   startAt: '2026-06-10T12:00:00Z', endAt: '2026-06-10T13:00:00Z' };
    localStorage.setItem(`cal_events_${user1.id}`, JSON.stringify([evt1]));
    localStorage.setItem(`cal_events_${user2.id}`, JSON.stringify([evt2]));

    const groupEvents = r1.current.getGroupEvents(groupId);
    expect(groupEvents).toHaveLength(2);
    const titles = groupEvents.map(e => e.title).sort();
    expect(titles).toEqual(['Alice Event', 'Bob Event']);
  });

  it('getGroupEvents returns empty for unknown group', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(user1) });
    expect(result.current.getGroupEvents('unknown-id')).toEqual([]);
  });
});
