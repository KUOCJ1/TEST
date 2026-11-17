// 課後四週微練習（Sprint 38）的前端規則：任務內容、焦點構面。伺服器只存與清理文字（routes/practice.js）。
import { startersFor } from '../data/goal-starters.js';

export const PRACTICE_WEEKS = 4;
export const REFLECTION_TASK = '回頭看這四週：哪一個做法最有效？寫一句話給自己，決定接下來要保留的一個習慣';

/**
 * 四週的任務：前三週先用「目標裡還沒做的行動」（學員在「選一件事」選的那件事就是第一週），
 * 不夠的用該構面的起手行動補（不重複），第四週固定是回顧。
 * 這樣微練習和目標是同一條線：同一件事不會在兩個地方各出現一次、各勾一次（見伺服器 practice.js 的連結）。
 */
export function buildPracticeTasks(assessmentId, dimensionId, goalActions = []) {
  const picked = [];
  for (const t of [...goalActions.filter(Boolean), ...startersFor(assessmentId, dimensionId)]) {
    if (!picked.includes(t)) picked.push(t);
    if (picked.length === 3) break;
  }
  while (picked.length < 3) picked.push(picked[picked.length - 1] ?? '每週固定留一個時段，刻意練習這件事，並記下做法');
  return [...picked, REFLECTION_TASK];
}

/** 本週的任務還沒勾：給首頁提示用。 */
export function practiceDueThisWeek(p) {
  if (!p?.active) return null;
  const w = p.weeks?.[p.currentWeek - 1];
  return w && !w.doneAt ? w : null;
}
