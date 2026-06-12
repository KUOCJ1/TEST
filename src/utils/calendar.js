export const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'];

export const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function getMonthCalendarDays(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const days = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }

  return days;
}

export function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export function getEventsForDay(events, date) {
  return events.filter(event => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return start < dayEnd && end > dayStart;
  }).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeInput(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDisplayTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function combineDatetime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function getWeekDays(date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// Lay out timed events for a single day, assigning column positions for overlaps.
// Returns: [{ event, col, totalCols }]
export function layoutDayEvents(events) {
  if (!events.length) return [];

  const sorted = [...events].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  function overlaps(a, b) {
    return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
  }

  // Greedy column assignment
  const layouts = sorted.map(e => ({ event: e, col: 0 }));
  const colEnds = [];

  for (const layout of layouts) {
    const start = new Date(layout.event.startAt);
    let col = 0;
    while (colEnds[col] && colEnds[col] > start) col++;
    layout.col = col;
    colEnds[col] = new Date(layout.event.endAt);
  }

  // Per-event totalCols = widest concurrent group involving this event
  return layouts.map(layout => {
    const concurrent = layouts.filter(o => overlaps(layout.event, o.event));
    const neededCols = Math.max(...concurrent.map(o => o.col + 1), 1);
    return { ...layout, totalCols: neededCols };
  });
}

export function formatWeekTitle(days) {
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getFullYear()} 年 ${first.getMonth() + 1} 月 ${first.getDate()} - ${last.getDate()} 日`;
  }
  return `${first.getMonth() + 1} 月 ${first.getDate()} 日 - ${last.getMonth() + 1} 月 ${last.getDate()} 日`;
}

export function formatDayTitle(date) {
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日　${dayNames[date.getDay()]}`;
}
