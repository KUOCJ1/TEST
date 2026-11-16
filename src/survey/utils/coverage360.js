// 360° 他評收齊狀況（Sprint 27）的純函式。只有人數，沒有評分者身分。
// 同儕／部屬少於 GROUP_MIN 位標示「未達匿名門檻」；主管通常只有 1 位，不算不足。
export const GROUP_MIN = 3;
export const COVERAGE_TYPES = [['manager', '主管'], ['peer', '同儕'], ['subordinate', '部屬']];

/** 依成員列整理收齊狀況（純函式，方便測試）。 */
export function buildCoverage(memberRows) {
  return memberRows.map((r) => {
    const by = r.others?.byType ?? {};
    const low = ['peer', 'subordinate'].filter((t) => (by[t] ?? 0) > 0 && (by[t] ?? 0) < GROUP_MIN);
    const none = !r.others || r.others.count === 0;
    return { id: r.userId, name: r.name, counts: { manager: by.manager ?? 0, peer: by.peer ?? 0, subordinate: by.subordinate ?? 0 }, none, low };
  });
}

