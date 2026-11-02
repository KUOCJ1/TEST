// 班級總覽的成員資料列用到的小工具（純函式）。
//
// 作答（submission）的 userId 是「填答的人」，rateeId 才是「被評的人」。自評兩者相同；
// 360° 他評（含管理後台批次匯入的他評）userId 是評分者。所以班級總覽的「成員成績」只能用自評：
// 如果把他評也算進去，評分者會被當成「拿到別人給的分數的成員」。

const RATER_ORDER = ['manager', 'peer', 'subordinate'];

export const isSelf = (s) => (s.raterType ?? 'self') === 'self';

/** 只留自評。 */
export const selfSubmissions = (subs) => (subs ?? []).filter(isSelf);

/**
 * 某位受評者收到的他評摘要：每位評分者只取最新一筆；回傳人數、平均總分、各類評分者人數。
 * 沒有他評回 null。
 */
export function othersSummary(subs, rateeId) {
  const latest = new Map();
  for (const s of subs ?? []) {
    if (isSelf(s) || s.rateeId !== rateeId) continue;
    const key = `${s.raterType}|${s.userId}`;
    const cur = latest.get(key);
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) latest.set(key, s);
  }
  const rows = [...latest.values()].filter((s) => typeof s.result?.total === 'number');
  if (rows.length === 0) return null;
  const byType = Object.fromEntries(RATER_ORDER.map((t) => [t, rows.filter((s) => s.raterType === t).length]));
  const avgTotal = Math.round((rows.reduce((sum, s) => sum + s.result.total, 0) / rows.length) * 10) / 10;
  return { count: rows.length, avgTotal, byType };
}
