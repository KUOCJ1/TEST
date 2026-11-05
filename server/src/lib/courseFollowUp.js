// 課後問卷（韋能《AI 深度整合工作坊》）的 30／60 天追蹤：到期寄信、收追蹤問卷、算完成率。
//
// 只寄給「在課後問卷勾了 D7 同意、而且還沒撤回」的人（同意記在課後問卷作答的 result.course.followUpConsent，
// 撤回走 PATCH /course-survey/follow-up，排程每次都重新檢查，所以撤回後不會再寄）。
// 到期日是「這個人交課後問卷那天」加 30／60 天。每人每個階段最多寄一封（courseFollowUps 的 sentAt）。
// 承辦單位（教練）只看得到完成率，看不到個別答案（routes/coach.js 的 course-survey 彙總）。
import { isMailConfigured, sendMail, appBaseUrl, formatTaipeiDate } from './mailer.js';
import { COURSE_SURVEY_ID, MIN_N } from './courseSurvey.js';
import { FOLLOW_UP_STAGES, sanitizeFollowUpAnswers } from './courseFollowUpQuestions.js';

export { FOLLOW_UP_STAGES, FOLLOW_UP_QUESTIONS, sanitizeFollowUpAnswers } from './courseFollowUpQuestions.js';
import { randomUUID } from 'node:crypto';

const DAY = 864e5;
// 到期後超過這麼多天才開始寄（例如伺服器停了很久）就不寄了：過了太久的「30 天追蹤」沒有意義。
export const MAX_LATE_DAYS = 21;
const stageDueAt = (sub, stage) => new Date(sub.createdAt).getTime() + stage * DAY;

/** 每位學員「最新一筆」課後問卷（用來判斷同意與起算日）。 */
export function latestCourseSubmissions(db) {
  const latest = new Map();
  for (const s of db.data.submissions) {
    if (s.assessmentId !== COURSE_SURVEY_ID) continue;
    const prev = latest.get(s.userId);
    if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) latest.set(s.userId, s);
  }
  return latest;
}

const records = (db) => (db.data.courseFollowUps ??= []);
const hasRecord = (db, userId, stage) => records(db).find((r) => r.userId === userId && r.stage === stage);
// 匯入時用占位 Email（.invalid）建立的帳號收不到信。
const mailable = (u) => Boolean(u?.email) && !u.disabled && !/\.invalid$/i.test(u.email);

function buildMail(user, sub, stage) {
  const link = `${appBaseUrl()}/?followup=${stage}`;
  const when = formatTaipeiDate(sub.createdAt);
  const intro = stage === 30
    ? `距離您參加 AI 深度整合工作坊並填寫課後問卷（${when}）已經 30 天了。想請您花約 5 分鐘，回顧這個月把課堂上學到的東西用出來的情形。`
    : `距離您參加 AI 深度整合工作坊（${when}）已經 60 天了。想請您花約 5 分鐘，回顧這兩個月 AI 在工作上的持續使用與影響；也歡迎回平台重做一次課前的 AI 職能評測，看看自己的變化。`;
  return {
    subject: `【${stage} 天追蹤】AI 深度整合工作坊：您的 AI 應用進行得如何？`,
    text: [
      `${user.name || '您'} 您好：`,
      '',
      intro,
      '',
      `填寫連結（需登入）：${link}`,
      '',
      '承辦單位只會看到完成人數與比例，看不到您的個別答案。',
      '',
      '（不想再收到追蹤信？登入後到「課後問卷」結果頁，取消勾選「同意收追蹤信」即可，之後就不會再寄。）',
    ].join('\n'),
  };
}

/**
 * 寄出到期的追蹤信。每人每階段最多一封；寄失敗不留紀錄，下次排程再試。
 * @returns {Promise<{sent:number, failed:number}>}
 */
export async function sendDueCourseFollowUps(db, { now = Date.now(), send = sendMail, configured = isMailConfigured() } = {}) {
  if (!configured) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const [userId, sub] of latestCourseSubmissions(db)) {
    if (!sub.result?.course?.followUpConsent) continue;
    const user = db.data.users.find((u) => u.id === userId);
    if (!mailable(user)) continue;
    for (const stage of FOLLOW_UP_STAGES) {
      const due = stageDueAt(sub, stage);
      if (now < due || now > due + MAX_LATE_DAYS * DAY) continue;
      if (hasRecord(db, userId, stage)) continue; // 已寄過，或已經自己填過
      const result = await send({ to: user.email, ...buildMail(user, sub, stage) });
      if (result.ok) {
        records(db).push({ id: randomUUID(), userId, courseSubmissionId: sub.id, groupId: sub.surveyGroupId ?? null, stage, dueAt: new Date(due).toISOString(), sentAt: new Date(now).toISOString(), completedAt: null });
        sent += 1;
      } else {
        failed += 1;
      }
    }
  }
  if (sent > 0) db.persist();
  return { sent, failed };
}

/** 這位學員的追蹤狀態：沒有同意或沒填過課後問卷時回空陣列。 */
export function followUpStatus(db, userId, now = Date.now()) {
  const sub = latestCourseSubmissions(db).get(userId);
  if (!sub) return [];
  return FOLLOW_UP_STAGES.map((stage) => {
    const rec = hasRecord(db, userId, stage);
    const due = stageDueAt(sub, stage);
    let status = 'not_due';
    if (rec?.completedAt) status = 'completed';
    else if (now >= due && (sub.result?.course?.followUpConsent || rec)) status = 'available';
    return { stage, status, dueAt: new Date(due).toISOString(), completedAt: rec?.completedAt ?? null };
  });
}

/** 收一份追蹤問卷。回傳 { ok:true } 或 { ok:false, code, error }。 */
export function submitFollowUp(db, userId, stage, rawAnswers, now = Date.now()) {
  if (!FOLLOW_UP_STAGES.includes(stage)) return { ok: false, code: 'BAD_STAGE', error: '不認得的追蹤階段' };
  const sub = latestCourseSubmissions(db).get(userId);
  if (!sub) return { ok: false, code: 'NO_COURSE_SURVEY', error: '找不到您的課後問卷紀錄' };
  const rec = hasRecord(db, userId, stage);
  if (rec?.completedAt) return { ok: false, code: 'ALREADY_DONE', error: '這份追蹤問卷已經填過了' };
  if (now < stageDueAt(sub, stage)) return { ok: false, code: 'NOT_DUE', error: `還沒到 ${stage} 天追蹤的時間` };
  let answers;
  try { answers = sanitizeFollowUpAnswers(stage, rawAnswers); } catch (e) { return { ok: false, code: 'VALIDATION_ERROR', error: e.message }; }
  const record = rec ?? { id: randomUUID(), userId, courseSubmissionId: sub.id, groupId: sub.surveyGroupId ?? null, stage, dueAt: new Date(stageDueAt(sub, stage)).toISOString(), sentAt: null };
  if (!rec) records(db).push(record);
  record.answers = answers;
  record.completedAt = new Date(now).toISOString();
  db.persist();
  return { ok: true };
}

/** 班級彙總用：同意收追蹤信的人（userIds）在各階段「到期人數」與「完成人數」。到期人數少於 MIN_N 不顯示。 */
export function followUpProgress(db, subs, now = Date.now()) {
  const consented = subs.filter((s) => s.answers?.d7 === 'yes');
  const out = {};
  for (const stage of FOLLOW_UP_STAGES) {
    const due = consented.filter((s) => now >= stageDueAt(s, stage));
    if (due.length < MIN_N) { out[`stage${stage}`] = { hidden: true }; continue; }
    const completed = due.filter((s) => records(db).some((r) => r.userId === s.userId && r.stage === stage && r.completedAt)).length;
    out[`stage${stage}`] = { due: due.length, completed, rate: Math.round((completed / due.length) * 100) };
  }
  return out;
}
