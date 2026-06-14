export function findConflicts(events, candidate, excludeId = null) {
  if (candidate.isAllDay) {
    const cStart = new Date(candidate.startAt).getTime();
    const cEnd = new Date(candidate.endAt).getTime();
    return events.filter(e => {
      if (e.id === excludeId || !e.isAllDay || e.source === 'google') return false;
      const eStart = new Date(e.startAt).getTime();
      const eEnd = new Date(e.endAt).getTime();
      return cStart <= eEnd && cEnd >= eStart;
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
