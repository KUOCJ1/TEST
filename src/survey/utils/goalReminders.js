const DAY = 24 * 60 * 60 * 1000;
// 檢視期少於這麼久就不提醒「期中」（太短，期中跟到期幾乎同時）。
const MIN_SPAN_FOR_MIDPOINT = 6 * DAY;

/**
 * 站內的目標提醒（不靠 SMTP，登入後在首頁與「我的學習」就看得到）：
 *  - overdue：已過預計檢視日、目標還沒達成。
 *  - midpoint：時間已過一半，而且這一半之後還沒有任何追蹤紀錄——輕輕推一下去記錄進度。
 * 逾期的排前面；純函式，方便測試每個分支。
 */
export function goalReminders(goals = [], now = Date.now()) {
  const out = [];
  for (const goal of goals) {
    if (goal.achievedAt || !goal.reviewDate) continue;
    const due = Date.parse(goal.reviewDate);
    const start = Date.parse(goal.createdAt);
    if (Number.isNaN(due) || Number.isNaN(start)) continue;
    if (due <= now) {
      out.push({ goal, kind: 'overdue' });
      continue;
    }
    if (due - start < MIN_SPAN_FOR_MIDPOINT) continue;
    const mid = start + (due - start) / 2;
    if (now < mid) continue;
    const last = (goal.checkins ?? []).at(-1);
    if (last && Date.parse(last.at) >= mid) continue;
    out.push({ goal, kind: 'midpoint' });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'overdue' ? -1 : 1));
}
