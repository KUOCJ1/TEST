export const FREQ_OPTIONS = [
  { value: '', label: '不重複' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

function step(date, freq, originDay) {
  const d = new Date(date);
  if (freq === 'daily')   { d.setDate(d.getDate() + 1); return d; }
  if (freq === 'weekly')  { d.setDate(d.getDate() + 7); return d; }
  if (freq === 'monthly') {
    const targetMonth = d.getMonth() + 1;
    const targetYear = targetMonth > 11 ? d.getFullYear() + 1 : d.getFullYear();
    const normalizedMonth = targetMonth % 12;
    const daysInTarget = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    d.setFullYear(targetYear, normalizedMonth, Math.min(originDay, daysInTarget));
    return d;
  }
  if (freq === 'yearly') {
    const targetYear = d.getFullYear() + 1;
    const month = d.getMonth();
    const daysInTarget = new Date(targetYear, month + 1, 0).getDate();
    d.setFullYear(targetYear, month, Math.min(originDay, daysInTarget));
    return d;
  }
  return d;
}

export function expandRecurringEvents(events, rangeStart, rangeEnd) {
  const result = [];
  for (const event of events) {
    if (!event.recurrence?.freq) {
      result.push(event);
      continue;
    }
    const { freq, until } = event.recurrence;
    const ceiling = until
      ? new Date(Math.min(new Date(until + 'T23:59:59').getTime(), rangeEnd.getTime()))
      : new Date(rangeEnd);

    const duration = new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
    let cur = new Date(event.startAt);
    const originDay = cur.getDate();

    for (let i = 0; cur <= ceiling && i < 500; i++, cur = step(cur, freq, originDay)) {
      const instanceEnd = new Date(cur.getTime() + duration);
      if (instanceEnd >= rangeStart) {
        result.push({
          ...event,
          id: i === 0 ? event.id : `${event.id}__r${i}`,
          startAt: cur.toISOString(),
          endAt: instanceEnd.toISOString(),
          isRecurring: true,
          recurringBaseId: event.id,
        });
      }
    }
  }
  return result;
}
