// 360° 他評收齊狀況（Sprint 27）的純函式。只有人數，沒有評分者身分。
// 匿名門檻 GROUP_MIN：他評合計少於 3 位，報告不顯示他評結果（`short`）；同儕／部屬各類少於 3 位標示「未達」。
// 主管通常只有 1 位：報告上不會單獨呈現主管（併入他評合計），所以主管 1 位不算不足。
export const GROUP_MIN = 3;
export const COVERAGE_TYPES = [['manager', '主管'], ['peer', '同儕'], ['subordinate', '部屬']];

/** 依成員列整理收齊狀況（純函式，方便測試）。 */
export function buildCoverage(memberRows) {
  return memberRows.map((r) => {
    const by = r.others?.byType ?? {};
    const low = ['peer', 'subordinate'].filter((t) => (by[t] ?? 0) > 0 && (by[t] ?? 0) < GROUP_MIN);
    const none = !r.others || r.others.count === 0;
    const counts = { manager: by.manager ?? 0, peer: by.peer ?? 0, subordinate: by.subordinate ?? 0 };
    const total = counts.manager + counts.peer + counts.subordinate;
    return { id: r.userId, name: r.name, counts, none, low, short: !none && total < GROUP_MIN, total };
  });
}

