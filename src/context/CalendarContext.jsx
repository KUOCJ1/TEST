import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { generateId } from '../utils/calendar';

const CalendarContext = createContext(null);

function storageKey(userId) { return `cal_events_${userId}`; }

function loadEvents(userId) {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]'); }
  catch { return []; }
}

function persist(userId, events) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(events));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded — events not saved');
    }
  }
}

export function CalendarProvider({ children, userId }) {
  const [events, setEvents] = useState(() => loadEvents(userId));
  const persistTimer = useRef(null);

  // Debounced persist: batch rapid mutations (bulk delete, multi-event paste) into one write
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persist(userId, events), 300);
    return () => clearTimeout(persistTimer.current);
  }, [userId, events]);

  // Sync across tabs: when another tab writes to localStorage, reload events
  useEffect(() => {
    const key = storageKey(userId);
    const handler = (e) => {
      if (e.key === key && e.newValue) {
        try { setEvents(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [userId]);

  const addEvent = useCallback((data) => {
    const event = { ...data, id: generateId(), creatorId: userId };
    setEvents(prev => [...prev, event]);
    return event;
  }, [userId]);

  const updateEvent = useCallback((id, data) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data, id: e.id, creatorId: e.creatorId } : e));
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  // Used for JSON backup restore: merges events preserving their original IDs.
  // Regular addEvent always generates a new ID, making de-duplication impossible.
  const restoreEvents = useCallback((restored) => {
    setEvents(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      return [...prev, ...restored.filter(e => e.id && !existingIds.has(e.id))];
    });
  }, []);

  const value = useMemo(
    () => ({ events, addEvent, updateEvent, deleteEvent, restoreEvents }),
    [events, addEvent, updateEvent, deleteEvent, restoreEvents]
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
