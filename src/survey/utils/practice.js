// 課後四週微練習（Sprint 38）的前端規則：任務內容、焦點構面。伺服器只存與清理文字（routes/practice.js）。
import { startersFor } from '../data/goal-starters.js';

export const PRACTICE_WEEKS = 4;
export const REFLECTION_TASK = '回頭看這四週：哪一個做法最有效？寫一句話給自己，決定接下來要保留的一個習慣';

/** 四週的任務：前三週用該構面的起手行動，第四週固定是回顧。 */
export function buildPracticeTasks(assessmentId, dimensionId) {
  const starters = startersFor(assessmentId, dimensionId).slice(0, 3);
  while (starters.length < 3) starters.push(starters[starters.length - 1] ?? '每週固定留一個時段，刻意練習這件事，並記下做法');
  return [...starters, REFLECTION_TASK];
}

/** 焦點構面：分數最低、且有作答的構面（與「選一件事」一致）。 */
export function practiceFocus(dimensions = []) {
  const scored = dimensions.filter((d) => typeof d.average === 'number' && d.average > 0);
  return scored.length ? [...scored].sort((a, b) => a.average - b.average)[0] : null;
}

/** 本週的任務還沒勾：給首頁提示用。 */
export function practiceDueThisWeek(p) {
  if (!p?.active) return null;
  const w = p.weeks?.[p.currentWeek - 1];
  return w && !w.doneAt ? w : null;
}
