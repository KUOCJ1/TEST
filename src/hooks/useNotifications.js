import { useState, useEffect, useCallback } from 'react';
import { formatDisplayTime } from '../utils/calendar';

const SENT_KEY = 'cal_sent_reminders';
const WINDOW_MS = 35_000; // 35-second fire window per check interval

function pruneOldSent(sent) {
  // Key format: eventId_reminderMinutes_isoStartAt — prune if event start > 2 days ago
  const cutoff = new Date(Date.now() - 2 * 24 * 3600 * 1000);
  const pruned = new Set();
  for (const key of sent) {
    const lastUs = key.lastIndexOf('_');
    if (lastUs === -1) continue;
    const startAt = new Date(key.slice(lastUs + 1));
    if (!isNaN(startAt) && startAt > cutoff) pruned.add(key);
  }
  return pruned;
}

function loadSent() {
  try {
    const sent = new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]'));
    return pruneOldSent(sent);
  }
  catch { return new Set(); }
}

function markSent(key) {
  const s = loadSent();
  s.add(key);
  localStorage.setItem(SENT_KEY, JSON.stringify([...s]));
}

function reminderLabel(minutes) {
  const m = Number(minutes);
  if (m >= 10080) return '1 週前';
  if (m >= 2880)  return '2 天前';
  if (m >= 1440)  return '1 天前';
  if (m >= 60)    return `${m / 60} 小時前`;
  return `${m} 分鐘前`;
}

export function computeUpcomingReminders(events) {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  return events
    .filter(e => e.reminder && e.reminder !== '')
    .flatMap(e => {
      const minutes = parseInt(e.reminder, 10);
      const eventStart = new Date(e.startAt);
      const reminderTime = new Date(eventStart.getTime() - minutes * 60_000);
      if (reminderTime <= now || reminderTime > in48h) return [];
      return [{ event: e, reminderTime, eventStart, minutes }];
    })
    .sort((a, b) => a.reminderTime - b.reminderTime);
}

export function useNotifications(events) {
  const [permission, setPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [upcomingReminders, setUpcomingReminders] = useState(() => computeUpcomingReminders(events));
  const [toasts, setToasts] = useState([]);

  // ── Toast helpers ─────────────────────────────────────────────
  const addToast = useCallback((toast) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts(t => [...t, { ...toast, id }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // ── Permission ────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, []);

  // ── Check + fire reminders ────────────────────────────────────
  const checkReminders = useCallback((evts) => {
    const now = new Date();
    const sent = loadSent();

    for (const event of evts) {
      if (!event.reminder) continue;
      const minutes = parseInt(event.reminder, 10);
      const eventStart = new Date(event.startAt);
      const reminderTime = new Date(eventStart.getTime() - minutes * 60_000);
      const key = `${event.id}_${event.reminder}_${event.startAt}`;

      if (!sent.has(key) && now >= reminderTime && now < new Date(reminderTime.getTime() + WINDOW_MS)) {
        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`📅 ${event.title}`, {
              body: `${reminderLabel(minutes)}開始 · ${formatDisplayTime(event.startAt)}`,
              tag: key,
            });
          } catch { /* browser may block */ }
        }

        // In-app toast (also serves as "email" reminder UI)
        addToast({
          title: event.title,
          body: `${reminderLabel(minutes)}開始`,
          time: formatDisplayTime(event.startAt),
        });

        markSent(key);
      }
    }
  }, [addToast]);

  // ── Polling loop ──────────────────────────────────────────────
  useEffect(() => {
    setUpcomingReminders(computeUpcomingReminders(events));
    checkReminders(events);
    const id = setInterval(() => {
      setUpcomingReminders(computeUpcomingReminders(events));
      checkReminders(events);
    }, 30_000);
    return () => clearInterval(id);
  }, [events, checkReminders]);

  return { permission, requestPermission, upcomingReminders, toasts, addToast, dismissToast };
}
