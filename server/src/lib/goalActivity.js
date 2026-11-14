// Sprint 26：班級行動概況與回訪紀錄（只有彙總，沒有個人層級的行為追蹤）。
//
// 隱私設計：
// - 回訪紀錄只記「哪一天有登入活動」（user.activeDays，YYYY-MM-DD，最多保留 120 天），不記頁面或操作。
// - 班級行動概況只回人數；成員少於 MIN_N 位時不顯示，避免等於點名個人。
// - 教練看不到「誰沒設定目標」，只能對全體未設定者發送提醒。
const DAY_MS = 86400000;
export const MIN_N = 3;
export const RECENT_CHECKIN_DAYS = 14;
const MAX_ACTIVE_DAYS = 120;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

/** 每位使用者每天最多寫一次（日期變了才寫入），所以不會每個請求都 persist。 */
export function recordActivity(db, user, now = Date.now()) {
  const today = dayOf(now);
  const days = user.activeDays ?? [];
  if (days.at(-1) === today) return false;
  user.activeDays = [...days, today].slice(-MAX_ACTIVE_DAYS);
  db.persist();
  return true;
}

const groupMembers = (db, group) => (group.memberIds ?? [])
  .map((id) => db.data.users.find((u) => u.id === id))
  .filter((u) => u && !u.disabled);
const activeMembers = (db, group) => groupMembers(db, group).filter((u) => !(group.excludedUserIds ?? []).includes(u.id));

const sameAssessment = (g, group) => (g.assessmentId ?? 'ai-competency') === (group.assessmentId ?? 'ai-competency');

/** 班級行動概況：已設定目標、近 14 天有回報、完全沒設定目標的人數。 */
// 注意：這裡「不」套用班級的「不列入統計」排除名單。否則教練可以把某位成員排除再重新查詢，用前後差回推
// 他有沒有設定目標（差分攻擊，與課後問卷彙總同一個問題）。殘留風險：教練把人移出班級也會改變人數，
// 這是班級管理本來就有的權限，靠「少於 3 位不顯示」與審慎的政策文字限制。
export function goalSummaryForGroup(db, group, now = Date.now()) {
  const members = groupMembers(db, group);
  if (members.length < MIN_N) return { hidden: true, minN: MIN_N };
  const since = now - RECENT_CHECKIN_DAYS * DAY_MS;
  let withGoal = 0;
  let recentCheckin = 0;
  for (const m of members) {
    const goals = (db.data.goals ?? []).filter((g) => g.userId === m.id && sameAssessment(g, group));
    if (goals.length > 0) withGoal += 1;
    if (goals.some((g) => (g.checkins ?? []).some((c) => Date.parse(c.at) >= since))) recentCheckin += 1;
  }
  return { hidden: false, members: members.length, withGoal, recentCheckin, noGoal: members.length - withGoal, recentDays: RECENT_CHECKIN_DAYS };
}

/** 還沒有任何目標的成員（只給伺服器內部寄提醒用，不回傳給前端）。 */
export function membersWithoutGoal(db, group) {
  return activeMembers(db, group).filter((m) => !(db.data.goals ?? []).some((g) => g.userId === m.id && sameAssessment(g, group)));
}

/**
 * 報告後回訪比例：成員最新一次自評之後的第 1～windowDays 天內，是否至少有一天登入活動。
 * 只計「視窗已經走完」的人（太新的不算進分母）；符合條件的人少於 MIN_N 位時不顯示。
 */
export function retentionForGroup(db, group, windowDays, now = Date.now()) {
  let eligible = 0;
  let returned = 0;
  for (const m of activeMembers(db, group)) {
    const latest = db.data.submissions
      .filter((s) => s.userId === m.id && (s.raterType ?? 'self') === 'self' && (s.assessmentId ?? 'ai-competency') === (group.assessmentId ?? 'ai-competency'))
      .map((s) => Date.parse(s.createdAt))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    if (latest == null || now < latest + windowDays * DAY_MS) continue;
    eligible += 1;
    const from = dayOf(latest + DAY_MS);
    const to = dayOf(latest + windowDays * DAY_MS);
    if ((m.activeDays ?? []).some((d) => d >= from && d <= to)) returned += 1;
  }
  if (eligible < MIN_N) return { hidden: true, eligible, minN: MIN_N };
  return { hidden: false, eligible, returned, rate: Math.round((returned / eligible) * 100) };
}
