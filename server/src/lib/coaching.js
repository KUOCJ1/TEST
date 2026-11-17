// 教練會談與會後反思（Sprint 40）。
//
// 教練建立一場會談（一對一或團隊）→ 參與的學員各自收到一份「會後反思」待填（固定四題）→
// 學員在期限內（預設會後 3 天）繳交，第 2 天還沒交會收到一封提醒 → 教練看全文並可回一句話。
// 可見範圍：反思全文只有「該場會談的教練」（與管理者）看得到；班級報告只放彙總
// （場次、繳交率、會談回饋平均，回饋少於 3 份不顯示平均）。
export const REFLECTION_DUE_DAYS = 3;
export const REFLECTION_REMIND_DAY = 2;
export const MIN_RATINGS_SHOWN = 3;
const DAY = 24 * 60 * 60 * 1000;

export const SESSION_TYPES = { 'one-on-one': '一對一教練', team: '團隊教練' };

export function defaultDueAt(sessionDate) {
  return new Date(new Date(sessionDate).getTime() + REFLECTION_DUE_DAYS * DAY).toISOString();
}

export const reflectionOf = (db, sessionId, userId) =>
  (db.data.sessionReflections ?? []).find((r) => r.sessionId === sessionId && r.userId === userId) ?? null;

/** 學員端看到的會談：教練姓名、主題、期限、教練在這個班給他的最新評語（就是這場會談的起點）。 */
export function sessionForLearner(db, s, userId) {
  const coach = db.data.users.find((u) => u.id === s.coachId);
  const group = (db.data.groups ?? []).find((g) => g.id === s.groupId);
  const r = reflectionOf(db, s.id, userId);
  const mySubs = (db.data.submissions ?? []).filter((x) => x.userId === userId && (x.raterType ?? 'self') === 'self' && (x.groupId === s.groupId || (!x.groupId && x.assessmentId === group?.assessmentId)));
  const comment = mySubs
    .flatMap((x) => (x.comments ?? []).filter((c) => c.coachId === s.coachId).map((c) => ({ ...c, at: c.updatedAt ?? c.createdAt })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  return {
    id: s.id,
    type: s.type,
    typeLabel: SESSION_TYPES[s.type] ?? '教練會談',
    title: s.title,
    focus: s.focus ?? '',
    sessionDate: s.sessionDate,
    dueAt: s.dueAt,
    coachName: coach?.name ?? '教練',
    groupName: group?.name ?? null,
    assessmentId: group?.assessmentId ?? null,
    coachComment: comment ? { text: comment.text, tips: comment.tips ?? [], at: comment.at } : null,
    reflection: r ? publicReflection(r) : null,
    overdue: !r && Date.now() > new Date(s.dueAt).getTime(),
  };
}

export function publicReflection(r) {
  return {
    id: r.id,
    insight: r.insight,
    action: r.action,
    support: r.support,
    rating: r.rating ?? null,
    ratingNote: r.ratingNote ?? '',
    goalId: r.goalId ?? null,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt ?? null,
    late: Boolean(r.late),
    coachReply: r.coachReply ?? null,
  };
}

/** 班級報告用的彙總：沒有姓名、沒有內容。 */
export function coachingSummaryForGroup(db, groupId) {
  const sessions = (db.data.coachingSessions ?? []).filter((s) => s.groupId === groupId);
  if (!sessions.length) return null;
  let assigned = 0;
  let submitted = 0;
  const ratings = [];
  for (const s of sessions) {
    for (const uid of s.participantIds ?? []) {
      assigned += 1;
      const r = reflectionOf(db, s.id, uid);
      if (r) {
        submitted += 1;
        if (typeof r.rating === 'number') ratings.push(r.rating);
      }
    }
  }
  return {
    sessions: sessions.length,
    oneOnOne: sessions.filter((s) => s.type === 'one-on-one').length,
    team: sessions.filter((s) => s.type === 'team').length,
    assigned,
    submitted,
    rate: assigned ? Math.round((submitted / assigned) * 100) : null,
    avgRating: ratings.length >= MIN_RATINGS_SHOWN ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    ratingCount: ratings.length,
  };
}

/** 工作台：這個班還沒繳的會後反思份數（只有份數）。 */
export function pendingReflectionsForGroup(db, groupId) {
  let n = 0;
  for (const s of (db.data.coachingSessions ?? []).filter((x) => x.groupId === groupId)) {
    for (const uid of s.participantIds ?? []) if (!reflectionOf(db, s.id, uid)) n += 1;
  }
  return n;
}

/** 第 2 天還沒繳交：寄一次提醒（每人每場一次）。 */
export function dueReflectionReminders(db, now = Date.now()) {
  const out = [];
  for (const s of db.data.coachingSessions ?? []) {
    const remindAt = new Date(s.sessionDate).getTime() + REFLECTION_REMIND_DAY * DAY;
    if (now < remindAt) continue;
    for (const uid of s.participantIds ?? []) {
      if (reflectionOf(db, s.id, uid)) continue;
      if ((s.remindedIds ?? []).includes(uid)) continue;
      out.push({ session: s, userId: uid });
    }
  }
  return out;
}
