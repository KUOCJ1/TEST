// 教練工作台（Sprint 29）：每班待辦總數。noGoal／ratersLow 為 null 代表不適用（人數不足或題庫不支援）。
export function todoTotal(w) {
  return w.notDone + (w.ratersLow ?? 0) + w.uncommented + w.warnings + (w.noGoal ?? 0);
}
