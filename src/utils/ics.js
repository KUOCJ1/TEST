// iCalendar import/export

function pad(n) { return String(n).padStart(2, '0'); }

function toICSDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function toICSDateOnly(iso) {
  return iso.slice(0,10).replace(/-/g,'');
}

function escICS(s) {
  return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}

function unescICS(s) {
  return s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
}

export function exportToIcs(events) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//共享行事曆//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@shared-cal`);
    lines.push(`DTSTAMP:${toICSDate(new Date().toISOString())}`);
    if (e.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${toICSDateOnly(e.startAt)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDateOnly(e.endAt)}`);
    } else {
      lines.push(`DTSTART:${toICSDate(e.startAt)}`);
      lines.push(`DTEND:${toICSDate(e.endAt)}`);
    }
    lines.push(`SUMMARY:${escICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escICS(e.description)}`);
    if (e.location)    lines.push(`LOCATION:${escICS(e.location)}`);
    if (e.url)         lines.push(`URL:${e.url}`);
    if (e.tags?.length) lines.push(`CATEGORIES:${e.tags.join(',')}`);
    if (e.isPrivate)   lines.push('CLASS:PRIVATE');
    if (e.recurrence?.freq) {
      const freq = e.recurrence.freq.toUpperCase();
      const until = e.recurrence.until
        ? `;UNTIL=${e.recurrence.until.replace(/-/g,'')}T000000Z`
        : '';
      lines.push(`RRULE:FREQ=${freq}${until}`);
    }
    if (e.reminder) lines.push(`BEGIN:VALARM\r\nTRIGGER:-PT${e.reminder}M\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function parseIcs(text) {
  const normalized = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  // Unfold continuation lines
  const unfolded = normalized.replace(/\n[ \t]/g,'');
  const lines = unfolded.split('\n');

  const events = [];
  let cur = null;
  let inAlarm = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = { tags:[], isAllDay:false, isPrivate:false, type:'personal', color:'blue', reminder:'' }; continue; }
    if (line === 'END:VEVENT') { if (cur?.title && cur?.startAt) events.push(cur); cur = null; continue; }
    if (line === 'BEGIN:VALARM') { inAlarm = true; continue; }
    if (line === 'END:VALARM') { inAlarm = false; continue; }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const prop = line.slice(0, colon).toUpperCase();
    const val  = line.slice(colon + 1);

    if (inAlarm) {
      // Parse TRIGGER to restore reminder duration
      if (prop === 'TRIGGER') {
        const m = val.match(/-PT(\d+)M/);
        const h = val.match(/-PT(\d+)H/);
        const d = val.match(/-P(\d+)D/);
        if (m) cur.reminder = m[1];
        else if (h) cur.reminder = String(parseInt(h[1], 10) * 60);
        else if (d) cur.reminder = String(parseInt(d[1], 10) * 1440);
      }
      continue;
    }

    if (prop === 'SUMMARY') { cur.title = unescICS(val); }
    else if (prop === 'DESCRIPTION') { cur.description = unescICS(val); }
    else if (prop === 'LOCATION') { cur.location = unescICS(val); }
    else if (prop === 'URL') { cur.url = val.trim(); }
    else if (prop.startsWith('DTSTART')) {
      if (prop.includes('VALUE=DATE') || val.length === 8) {
        cur.isAllDay = true;
        const y=val.slice(0,4), m=val.slice(4,6), d=val.slice(6,8);
        cur.startAt = new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
      } else {
        const clean = val.replace('Z','').replace(/[T]/,(c)=>c);
        const y=clean.slice(0,4),mo=clean.slice(4,6),d=clean.slice(6,8);
        const h=clean.slice(9,11)||'00', mi=clean.slice(11,13)||'00', s=clean.slice(13,15)||'00';
        cur.startAt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
      }
    }
    else if (prop.startsWith('DTEND')) {
      if (prop.includes('VALUE=DATE') || val.length === 8) {
        const y=val.slice(0,4), m=val.slice(4,6), d=val.slice(6,8);
        cur.endAt = new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
      } else {
        const clean = val.replace('Z','');
        const y=clean.slice(0,4),mo=clean.slice(4,6),d=clean.slice(6,8);
        const h=clean.slice(9,11)||'00', mi=clean.slice(11,13)||'00', s=clean.slice(13,15)||'00';
        cur.endAt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
      }
    }
    else if (prop === 'CATEGORIES') {
      cur.tags = val.split(',').map(t=>t.trim()).filter(Boolean);
    }
    else if (prop === 'CLASS') {
      cur.isPrivate = val.trim().toUpperCase() === 'PRIVATE';
    }
    else if (prop === 'RRULE') {
      const freqMatch  = val.match(/FREQ=(\w+)/i);
      const untilMatch = val.match(/UNTIL=(\d{8})/i);
      if (freqMatch) {
        const freq = freqMatch[1].toLowerCase();
        const until = untilMatch
          ? `${untilMatch[1].slice(0,4)}-${untilMatch[1].slice(4,6)}-${untilMatch[1].slice(6,8)}`
          : null;
        cur.recurrence = { freq, until };
      }
    }
    else if (prop === 'UID') {
      cur.externalId = val;
    }
  }
  return events;
}
