// Sprint 29：教練「今天要做什麼」工作台。只回人數與每班的待辦數，沒有任何個人名單
// （延續「教練看不到誰沒設定目標」的隱私決定）。個別名單仍在各自原本的頁面（作答進度有名單，因為那是課程行政）。
import { normalizeSubmission, getGroupPhase } from './helpers.js';
import { groupWarnings } from './groupConsistency.js';
import { goalSummaryForGroup } from './goalActivity.js';
import { isStrictPrivacy } from './compassPrivacy.js';
import { COURSE_SURVEY_ID } from './courseSurvey.js';
import { pendingReflectionsForGroup } from './coaching.js';

const GROUP_MIN = 3; // 同儕／部屬少於這個數字視為「他評不足」

const members = (db, group) => (group.memberIds ?? [])
  .map((id) => db.data.users.find((u) => u.id === id))
  .filter((u) => u && !u.disabled && !(group.excludedUserIds ?? []).includes(u.id));

export function workbenchForGroup(db, group, coachId) {
  const ms = members(db, group);
  const own = group.assessmentId ?? 'ai-competency';
  const subs = db.data.submissions.map(normalizeSubmission).filter((s) => s.assessmentId !== COURSE_SURVEY_ID && (s.groupId
    ? s.groupId === group.id
    : group.memberIds.includes(s.userId) && s.assessmentId === own));
  const selfBy = new Map();
  for (const s of subs) {
    if (s.raterType !== 'self') continue;
    const cur = selfBy.get(s.userId);
    if (!cur || new Date(s.createdAt) >= new Date(cur.createdAt)) selfBy.set(s.userId, s);
  }
  const notDone = ms.filter((m) => !selfBy.has(m.id)).length;
  const uncommented = ms.filter((m) => selfBy.has(m.id) && !(selfBy.get(m.id).comments ?? []).some((c) => c.coachId === coachId)).length;

  // 360° 他評不足（嚴格隱私題庫不計：連完成狀態都不能讓教練知道）
  let ratersLow = null;
  if (!isStrictPrivacy(own) && subs.some((s) => s.raterType !== 'self')) {
    ratersLow = 0;
    for (const m of ms) {
      if (!selfBy.has(m.id)) continue;
      const latest = new Map();
      for (const s of subs) {
        if (s.raterType === 'self' || s.rateeId !== m.id) continue;
        latest.set(`${s.raterType}|${s.userId}`, s);
      }
      const by = { peer: 0, subordinate: 0, total: latest.size };
      for (const s of latest.values()) if (by[s.raterType] !== undefined) by[s.raterType] += 1;
      if (by.total < GROUP_MIN || (by.peer > 0 && by.peer < GROUP_MIN) || (by.subordinate > 0 && by.subordinate < GROUP_MIN)) ratersLow += 1;
    }
  }

  const goals = goalSummaryForGroup(db, group);
  return {
    id: group.id,
    name: group.name,
    companyName: group.companyName ?? '',
    phase: getGroupPhase(group),
    memberCount: ms.length,
    notDone,
    ratersLow,
    uncommented,
    warnings: groupWarnings(db.data, group).length,
    noGoal: goals.hidden ? null : goals.noGoal,
    // 會後反思還沒繳的份數（Sprint 40；這是教練自己建立的會談，份數就夠，名單在會談頁）
    reflectionsPending: pendingReflectionsForGroup(db, group.id),
  };
}

export const todoTotal = (w) => w.notDone + (w.ratersLow ?? 0) + w.uncommented + w.warnings + (w.noGoal ?? 0) + (w.reflectionsPending ?? 0);

/** 這位教練（或管理員）名下的班；已發佈（結案）的班不列入。待辦多的排前面。 */
export function buildWorkbench(db, user) {
  const groups = (db.data.groups ?? []).filter((g) => (g.coachId === user.id || user.role === 'admin') && getGroupPhase(g) !== 'published');
  return groups.map((g) => workbenchForGroup(db, g, user.id)).sort((a, b) => todoTotal(b) - todoTotal(a));
}
