export function findConflicts(events, candidate, excludeId = null) {
  if (candidate.isAllDay) return [];
  const start = new Date(candidate.startAt).getTime();
  const end = new Date(candidate.endAt).getTime();
  return events.filter(e => {
    if (e.id === excludeId || e.isAllDay || e.source === 'google') return false;
    const eStart = new Date(e.startAt).getTime();
    const eEnd = new Date(e.endAt).getTime();
    return start < eEnd && end > eStart;
  });
}
