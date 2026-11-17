// 「成長紀錄」（Sprint 42）：把目標、追蹤紀錄、微練習、會談與會後反思整理成時間軸事件，
// 跟「我的歷程」的作答節點穿插顯示。全部是本人自己的資料，純函式、不打 API、不含分數。
const clip = (s, n = 40) => {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const ts = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : null; };

/**
 * @param {{goals?:Array, practice?:object|null, sessions?:Array, assessmentId?:string, now?:number}} data
 * @returns {Array<{id:string, at:string, kind:string, title:string, detail?:string}>} 新到舊
 */
export function buildGrowthEvents({ goals = [], practice = null, sessions = [], assessmentId = null, now = Date.now() } = {}) {
  const ev = [];
  const add = (id, at, kind, title, detail) => { if (ts(at) !== null) ev.push({ id, at, kind, title, ...(detail ? { detail } : {}) }); };
  const inScope = (x) => !assessmentId || !x.assessmentId || x.assessmentId === assessmentId;

  for (const g of goals.filter(inScope)) {
    add(`goal-${g.id}`, g.createdAt, 'goal-set', `訂了一個目標${g.dimensionName ? `（${g.dimensionName}）` : ''}`, clip(g.text, 60));
    for (const a of g.actions ?? []) if (a.done) add(`act-${g.id}-${a.id}`, a.doneAt, 'action-done', '完成一個行動', clip(a.text));
    for (const c of g.checkins ?? []) add(`chk-${c.id}`, c.at, 'checkin', '寫下一則追蹤紀錄', clip(c.text, 50));
    if (g.achievedAt) add(`ach-${g.id}`, g.achievedAt, 'goal-achieved', '達成目標', clip(g.text, 60));
  }

  if (practice && inScope(practice)) {
    add(`prac-${practice.id}`, practice.startedAt, 'practice-start', '開始四週微練習', practice.dimensionName ?? '');
    for (const w of practice.weeks ?? []) {
      // 與目標行動連動的週，已由「完成一個行動」呈現，不重複列。
      if (w.doneAt && !w.goalLinked) add(`prac-${practice.id}-${w.week}`, w.doneAt, 'practice-week', `完成微練習第 ${w.week} 週`, clip(w.task));
    }
  }

  for (const s of sessions) {
    const sOk = !assessmentId || !s.assessmentId || s.assessmentId === assessmentId;
    if (!sOk) continue;
    if (ts(s.sessionDate) !== null && ts(s.sessionDate) <= now) {
      add(`ses-${s.id}`, s.sessionDate, 'session', `${s.typeLabel ?? '教練會談'}：${clip(s.title, 30)}`, s.coachName ? `與 ${s.coachName}` : '');
    }
    if (s.reflection?.submittedAt) add(`ref-${s.id}`, s.reflection.submittedAt, 'reflection', '寫了會後反思', clip(s.reflection.insight, 60));
  }

  return ev.sort((a, b) => ts(b.at) - ts(a.at));
}
