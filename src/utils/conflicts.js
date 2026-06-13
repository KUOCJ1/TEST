function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function findConflicts(events, candidate, excludeId = null) {
  if (candidate.isAllDay) {
    const cDay = new Date(candidate.startAt);
    return events.filter(e => {
      if (e.id === excludeId || !e.isAllDay || e.source === 'google') return false;
      return sameDay(new Date(e.startAt), cDay);
    });
  }
  const start = new Date(candidate.startAt).getTime();
  const end = new Date(candidate.endAt).getTime();
  return events.filter(e => {
    if (e.id === excludeId || e.isAllDay || e.source === 'google') return false;
    const eStart = new Date(e.startAt).getTime();
    const eEnd = new Date(e.endAt).getTime();
    return start < eEnd && end > eStart;
  });
}
