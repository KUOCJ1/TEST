/* global process */
import { describe, it, expect } from 'vitest';
import { buildGoalIcs } from '../survey/utils/calendarExport.js';
import { toDateInputValue } from '../survey/utils/format.js';

// 台灣（UTC+8）：當地 00:00 存成 ISO 會是前一天的 16:00Z。以前用 toISOString().slice(0,10) 會讓日期少一天。
describe('檢視日日期（台灣時區）', () => {
  const prev = process.env.TZ;
  const run = (fn) => { process.env.TZ = 'Asia/Taipei'; try { fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; } };

  it('選 12/1 存成 ISO 後再讀回來，仍是 12/1（不會每次少一天）', () => run(() => {
    const saved = new Date('2026-12-01T00:00:00').toISOString();
    expect(saved).toBe('2026-11-30T16:00:00.000Z');
    expect(toDateInputValue(saved)).toBe('2026-12-01');
    // 連續「打開再儲存」不會往前退
    const again = new Date(`${toDateInputValue(saved)}T00:00:00`).toISOString();
    expect(again).toBe(saved);
  }));

  it('無效值回空字串', () => { expect(toDateInputValue('')).toBe(''); expect(toDateInputValue('xx')).toBe(''); });
});

describe('buildGoalIcs', () => {
  const goal = { id: 'g1', text: '每週一次跨部門 check-in，記下對方的回應', dimensionName: '建立關係', reviewDate: new Date(2026, 11, 1).toISOString() };

  it('全天事件、隔天結束、前一天提醒；內容只有目標文字', () => {
    const ics = buildGoalIcs(goal, { now: new Date('2026-11-16T08:00:00Z'), appUrl: 'https://assess.rong-rise.com' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('DTEND;VALUE=DATE:20261202');
    expect(ics).toContain('UID:goal-g1-20261201@rongguang');
    expect(ics).toContain('TRIGGER:-PT15H');
    expect(ics).toContain('建立關係');
    expect(ics).toContain('/learning');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics).not.toMatch(/分數|總分|score/i);
  });

  it('跳脫逗號、分號與換行；沒有檢視日回 null', () => {
    const ics = buildGoalIcs({ ...goal, text: '做 A, B; C\n再做 D' });
    expect(ics).toContain(String.raw`做 A\, B\; C\n再做 D`);
    expect(buildGoalIcs({ ...goal, reviewDate: null })).toBeNull();
  });
});
