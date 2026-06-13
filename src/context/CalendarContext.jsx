import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
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
    setEvents(prev => {
      const next = [...prev, event];
      persist(userId, next);
      return next;
    });
    return event;
  }, [userId]);

  const updateEvent = useCallback((id, data) => {
    setEvents(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      persist(userId, next);
      return next;
    });
  }, [userId]);

  const deleteEvent = useCallback((id) => {
    setEvents(prev => {
      const next = prev.filter(e => e.id !== id);
      persist(userId, next);
      return next;
    });
  }, [userId]);

  const value = useMemo(
    () => ({ events, addEvent, updateEvent, deleteEvent }),
    [events, addEvent, updateEvent, deleteEvent]
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
