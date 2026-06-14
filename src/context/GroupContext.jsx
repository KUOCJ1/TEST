import { createContext, useContext, useState, useCallback } from 'react';
import { generateId } from '../utils/calendar';

const GroupContext = createContext(null);

const GROUPS_KEY = 'cal_groups';

function loadGroups() {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); }
  catch { return []; }
}

function saveGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function GroupProvider({ children, currentUser }) {
  const [groups, setGroups] = useState(() =>
    loadGroups().filter(g => g.members.some(m => m.userId === currentUser.id))
  );

  function refresh() {
    setGroups(loadGroups().filter(g => g.members.some(m => m.userId === currentUser.id)));
  }

  const createGroup = useCallback((name) => {
    const all = loadGroups();
    const newGroup = {
      id: generateId(),
      name: name.trim(),
      inviteCode: generateInviteCode(),
      members: [{ userId: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'owner' }],
    };
    saveGroups([...all, newGroup]);
    setGroups(g => [...g, newGroup]);
    return newGroup;
  }, [currentUser]);

  const joinGroup = useCallback((inviteCode) => {
    const all = loadGroups();
    const group = all.find(g => g.inviteCode === inviteCode.trim().toUpperCase());
    if (!group) throw new Error('找不到此邀請碼，請確認後再試');
    if (group.members.find(m => m.userId === currentUser.id)) throw new Error('你已是此群組的成員');

    const updated = {
      ...group,
      members: [...group.members, { userId: currentUser.id, name: currentUser.name, email: currentUser.email, role: 'member' }],
    };
    const updatedAll = all.map(g => g.id === group.id ? updated : g);
    saveGroups(updatedAll);
    setGroups(prev => [...prev, updated]);
    return updated;
  }, [currentUser]);

  const leaveGroup = useCallback((groupId) => {
    const all = loadGroups();
    const group = all.find(g => g.id === groupId);
    if (!group) return;

    const remaining = group.members.filter(m => m.userId !== currentUser.id);
    if (remaining.length === 0) {
      // Last member — delete the group
      saveGroups(all.filter(g => g.id !== groupId));
    } else {
      // Transfer ownership if needed
      const next = remaining.find(m => m.role === 'owner') ?? { ...remaining[0], role: 'owner' };
      const newMembers = remaining.map(m => m.userId === next.userId ? next : m);
      saveGroups(all.map(g => g.id === groupId ? { ...g, members: newMembers } : g));
    }
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, [currentUser]);

  const removeMember = useCallback((groupId, userId) => {
    const all = loadGroups();
    const updated = all.reduce((acc, g) => {
      if (g.id !== groupId) { acc.push(g); return acc; }
      const members = g.members.filter(m => m.userId !== userId);
      if (members.length > 0) acc.push({ ...g, members });
      return acc;
    }, []);
    saveGroups(updated);
    refresh();
  }, []);

  const renameGroup = useCallback((groupId, name) => {
    const all = loadGroups().map(g => g.id === groupId ? { ...g, name: name.trim() } : g);
    saveGroups(all);
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: name.trim() } : g));
  }, []);

  function getGroupEvents(groupId) {
    const group = loadGroups().find(g => g.id === groupId);
    if (!group) return [];
    return group.members.flatMap(member => {
      try {
        const evts = JSON.parse(localStorage.getItem(`cal_events_${member.userId}`) || '[]');
        return evts.map(e => ({ ...e, creatorName: member.name, isOwnEvent: member.userId === currentUser.id }));
      } catch { return []; }
    });
  }

  function getGroupById(groupId) {
    return loadGroups().find(g => g.id === groupId) ?? null;
  }

  return (
    <GroupContext.Provider value={{ groups, createGroup, joinGroup, leaveGroup, removeMember, renameGroup, getGroupEvents, getGroupById, refresh }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  return useContext(GroupContext);
}
