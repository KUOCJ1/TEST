import { describe, it, expect } from 'vitest';
import { selfSubmissions, othersSummary, isSelf } from '../survey/utils/groupRows.js';

// 作答的 userId 是填答的人，rateeId 才是被評的人：班級總覽的「成員成績」只能用自評。

let n = 0;
const sub = (userId, rateeId, raterType, total, extra = {}) => ({
  id: `s${++n}`, userId, rateeId, raterType, createdAt: new Date(2026, 10, 1, 0, n).toISOString(), result: { total }, ...extra,
});

describe('selfSubmissions', () => {
  it('只留自評；沒有 raterType 的舊資料視為自評；他評（主管／同儕／部屬）不算成員成績', () => {
    const subs = [
      sub('a', 'a', 'self', 200),
      { id: 'old', userId: 'b', createdAt: '2026-01-01T00:00:00Z', result: { total: 100 } },
      sub('m', 'a', 'manager', 150),
      sub('s1', 'a', 'subordinate', 250),
    ];
    expect(selfSubmissions(subs).map((s) => s.userId)).toEqual(['a', 'b']);
    expect(isSelf(subs[2])).toBe(false);
    expect(selfSubmissions(undefined)).toEqual([]);
  });
});

describe('othersSummary', () => {
  const subs = [
    sub('a', 'a', 'self', 300),
    sub('m', 'a', 'manager', 200),
    sub('s1', 'a', 'subordinate', 240),
    sub('s2', 'a', 'subordinate', 260),
    sub('s3', 'a', 'subordinate', 280),
    sub('a', 'p', 'subordinate', 320), // a 也是 p 的部屬
  ];

  it('某位受評者的他評：人數、平均總分、各類評分者人數；不含自評，也不含他評給別人的', () => {
    expect(othersSummary(subs, 'a')).toEqual({ count: 4, avgTotal: 245, byType: { manager: 1, peer: 0, subordinate: 3 } });
    expect(othersSummary(subs, 'p')).toEqual({ count: 1, avgTotal: 320, byType: { manager: 0, peer: 0, subordinate: 1 } });
  });

  it('同一位評分者重複送出只取最新一筆', () => {
    const again = [...subs, sub('s1', 'a', 'subordinate', 100)];
    const s = othersSummary(again, 'a');
    expect(s.count).toBe(4);
    expect(s.avgTotal).toBe(Math.round(((200 + 100 + 260 + 280) / 4) * 10) / 10);
  });

  it('沒有他評回 null', () => {
    expect(othersSummary(subs, 'nobody')).toBeNull();
    expect(othersSummary([sub('a', 'a', 'self', 1)], 'a')).toBeNull();
  });
});
