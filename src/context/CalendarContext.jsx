import { createContext, useContext, useState, useCallback } from 'react';
import { generateId } from '../utils/calendar';

const CalendarContext = createContext(null);

function storageKey(userId) { return `cal_events_${userId}`; }

function loadEvents(userId) {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]'); }
  catch { return []; }
}

function persist(userId, events) {
  localStorage.setItem(storageKey(userId), JSON.stringify(events));
}

export function CalendarProvider({ children, userId }) {
  const [events, setEvents] = useState(() => loadEvents(userId));

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

  return (
    <CalendarContext.Provider value={{ events, addEvent, updateEvent, deleteEvent }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
