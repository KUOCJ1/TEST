import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GroupProvider, useGroups } from '../context/GroupContext';

const GROUPS_KEY = 'cal_groups';

const alice = { id: 'u_alice', name: 'Alice', email: 'alice@test.com' };
const bob   = { id: 'u_bob',   name: 'Bob',   email: 'bob@test.com' };

function makeWrapper(user) {
  return ({ children }) => (
    <GroupProvider currentUser={user}>{children}</GroupProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('createGroup', () => {
  it('creates a group with the creator as owner', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    let group;
    act(() => { group = result.current.createGroup('Test Group'); });
    expect(group.name).toBe('Test Group');
    expect(group.members).toHaveLength(1);
    expect(group.members[0].userId).toBe(alice.id);
    expect(group.members[0].role).toBe('owner');
  });

  it('generates a 6-character invite code', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    let group;
    act(() => { group = result.current.createGroup('My Group'); });
    expect(group.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.createGroup('Stored Group'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Stored Group');
  });

  it('reflects the new group in the groups list', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.createGroup('Visible Group'); });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe('Visible Group');
  });
});

describe('joinGroup', () => {
  function seedGroup(group) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
  }

  it('adds a new member to the group', () => {
    const group = {
      id: 'g1', name: 'Alpha', inviteCode: 'ABC123',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    seedGroup(group);
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(bob) });
    act(() => { result.current.joinGroup('ABC123'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].members).toHaveLength(2);
    expect(stored[0].members[1].userId).toBe(bob.id);
    expect(stored[0].members[1].role).toBe('member');
  });

  it('throws when invite code is not found', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(bob) });
    expect(() => {
      act(() => { result.current.joinGroup('XXXXXX'); });
    }).toThrow('找不到此邀請碼');
  });

  it('throws when user is already a member', () => {
    const group = {
      id: 'g1', name: 'Alpha', inviteCode: 'ABC123',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    seedGroup(group);
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    expect(() => {
      act(() => { result.current.joinGroup('ABC123'); });
    }).toThrow('你已是此群組的成員');
  });

  it('is case-insensitive for invite code', () => {
    const group = {
      id: 'g1', name: 'Alpha', inviteCode: 'ABC123',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    seedGroup(group);
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(bob) });
    act(() => { result.current.joinGroup('abc123'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].members).toHaveLength(2);
  });
});

describe('leaveGroup', () => {
  it('removes the current user from the group', () => {
    const group = {
      id: 'g1', name: 'Beta', inviteCode: 'DEF456',
      members: [
        { userId: alice.id, name: alice.name, email: alice.email, role: 'owner' },
        { userId: bob.id,   name: bob.name,   email: bob.email,   role: 'member' },
      ],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(bob) });
    act(() => { result.current.leaveGroup('g1'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].members.find(m => m.userId === bob.id)).toBeUndefined();
  });

  it('transfers ownership when owner leaves', () => {
    const group = {
      id: 'g1', name: 'Gamma', inviteCode: 'GHI789',
      members: [
        { userId: alice.id, name: alice.name, email: alice.email, role: 'owner' },
        { userId: bob.id,   name: bob.name,   email: bob.email,   role: 'member' },
      ],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.leaveGroup('g1'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].members).toHaveLength(1);
    expect(stored[0].members[0].userId).toBe(bob.id);
    expect(stored[0].members[0].role).toBe('owner');
  });

  it('deletes the group when the last member leaves', () => {
    const group = {
      id: 'g1', name: 'Solo', inviteCode: 'JKL012',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.leaveGroup('g1'); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored).toHaveLength(0);
  });

  it('removes group from the local state after leaving', () => {
    const group = {
      id: 'g1', name: 'Delta', inviteCode: 'MNO345',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.leaveGroup('g1'); });
    expect(result.current.groups).toHaveLength(0);
  });
});

describe('removeMember', () => {
  it('removes the specified member from the group', () => {
    const group = {
      id: 'g1', name: 'Epsilon', inviteCode: 'PQR678',
      members: [
        { userId: alice.id, name: alice.name, email: alice.email, role: 'owner' },
        { userId: bob.id,   name: bob.name,   email: bob.email,   role: 'member' },
      ],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.removeMember('g1', bob.id); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].members).toHaveLength(1);
    expect(stored[0].members[0].userId).toBe(alice.id);
  });

  it('deletes the group record when the last member is removed', () => {
    const group = {
      id: 'g1', name: 'Solo', inviteCode: 'ZZZ999',
      members: [
        { userId: bob.id, name: bob.name, email: bob.email, role: 'member' },
      ],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.removeMember('g1', bob.id); });
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored).toHaveLength(0);
  });
});

describe('renameGroup', () => {
  it('updates the group name in localStorage and state', () => {
    const group = {
      id: 'g1', name: 'Original', inviteCode: 'STU901',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    act(() => { result.current.renameGroup('g1', 'Renamed'); });
    expect(result.current.groups[0].name).toBe('Renamed');
    const stored = JSON.parse(localStorage.getItem(GROUPS_KEY));
    expect(stored[0].name).toBe('Renamed');
  });
});

describe('getGroupById', () => {
  it('returns the group for a valid id', () => {
    const group = {
      id: 'g1', name: 'Zeta', inviteCode: 'VWX234',
      members: [{ userId: alice.id, name: alice.name, email: alice.email, role: 'owner' }],
    };
    localStorage.setItem(GROUPS_KEY, JSON.stringify([group]));
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    const found = result.current.getGroupById('g1');
    expect(found?.name).toBe('Zeta');
  });

  it('returns null for an unknown id', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: makeWrapper(alice) });
    expect(result.current.getGroupById('nonexistent')).toBeNull();
  });
});
