// 把目標的檢視日存成行事曆檔（.ics）：全程在瀏覽器裡產生、不經過伺服器，也不放任何評量分數。
// 內容只有學員自己寫的目標文字、檢視日，與一個前一天早上的提醒。
import { toDateInputValue } from './format.js';

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// RFC 5545：一行最多 75 bytes，超過要換行並以空白開頭。中文一字 3 bytes，用字元數保守切 20 字。
function fold(line) {
  const out = [];
  let rest = line;
  while (Array.from(rest).length > 20 && new TextEncoder().encode(rest).length > 70) {
    const chars = Array.from(rest);
    let take = 0; let bytes = 0;
    while (take < chars.length && bytes + new TextEncoder().encode(chars[take]).length <= (out.length ? 70 : 72)) { bytes += new TextEncoder().encode(chars[take]).length; take += 1; }
    out.push(chars.slice(0, take).join(''));
    rest = chars.slice(take).join('');
  }
  out.push(rest);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n');
}

/**
 * @param {{id:string, text:string, reviewDate:string, dimensionName?:string}} goal
 * @param {{now?: Date, appUrl?: string}} [opts]
 * @returns {string|null} .ics 內容；沒有有效檢視日回 null
 */
export function buildGoalIcs(goal, { now = new Date(), appUrl = '' } = {}) {
  const day = goal?.reviewDate ? toDateInputValue(goal.reviewDate) : '';
  if (!day) return null;
  const ymd = day.replace(/-/g, '');
  const next = new Date(`${day}T00:00:00`);
  next.setDate(next.getDate() + 1);
  const endYmd = toDateInputValue(next).replace(/-/g, '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const title = `檢視我的發展目標${goal.dimensionName ? `（${goal.dimensionName}）` : ''}`;
  const desc = `目標：${goal.text ?? ''}${appUrl ? `\n回報進度：${appUrl}/learning` : ''}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//榕光評測//目標檢視日//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:goal-${goal.id}-${ymd}@rongguang`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${endYmd}`,
    fold(`SUMMARY:${esc(title)}`),
    fold(`DESCRIPTION:${esc(desc)}`),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:明天是目標檢視日', 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(ics, filename = 'goal-review.ics') {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
