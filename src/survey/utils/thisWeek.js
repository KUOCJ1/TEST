import { practiceDueThisWeek } from './practice.js';

// 首頁「這週你的小步」（Sprint 41）：把散在四處的訊號（本週微練習、待填會後反思、進行中目標）收成一張卡，
// 最多三件事、有輕重緩急的順序，每件事都能在卡片上直接做或一步到位。純函式，方便測試。
export const MAX_ITEMS = 3;

/**
 * @param {{practice: object|null, reflectionsPending: number, goals: Array}} data
 * @returns {Array<{id:'practice'|'reflection'|'goals', title:string, detail?:string, week?:number, action: 'mark-practice'|'go-learning'}>}
 */
export function buildThisWeek({ practice = null, reflectionsPending = 0, goals = [] } = {}) {
  const items = [];
  const due = practiceDueThisWeek(practice);
  if (due) items.push({ id: 'practice', title: `本週的小步（第 ${practice.currentWeek}／4 週）`, detail: due.task, week: due.week, action: 'mark-practice' });
  if (reflectionsPending > 0) items.push({ id: 'reflection', title: `會後反思待填 ${reflectionsPending} 份`, detail: '教練會談之後的 5 分鐘回顧，趁印象還清楚。', action: 'go-learning' });
  const active = goals.filter((g) => !g.achievedAt);
  if (active.length > 0) {
    const total = active.reduce((n, g) => n + (g.actions?.length ?? 0), 0);
    const done = active.reduce((n, g) => n + (g.actions ?? []).filter((a) => a.done).length, 0);
    items.push({ id: 'goals', title: `進行中的目標 ${active.length} 個`, detail: total > 0 ? `行動完成 ${done}／${total}` : '還沒有具體行動，補上第一個吧', action: 'go-learning' });
  }
  return items.slice(0, MAX_ITEMS);
}
