import { getAssessment } from '../data/assessments/index.js';

// 跟 SurveyApp.jsx 判斷「這個班現在該做課前還是課後」用的是同一套推導方式：
// 只看「自評」提交、且 groupId 對得上目前這個班，避免不同梯次/舊資料互相污染。
// 兩處重複這幾行而不是抽成共用函式，是因為 SurveyApp 那邊是單一班別、單一
// assessmentId 的 in-component 邏輯，這裡則要一次掃過使用者所有的班——直接
// 抽共用函式反而要多繞一層參數轉換，不如各自維持小而直接。
// 課後複測的時機（2026-11-17 決定）：課前完成滿 21 天，或班級結束前 7 天。
// 之前只要「課前做完、班級進行中」就叫人複測，學員剛做完評測、還沒練習，首頁最大的卡片就寫「該回來複測了」。
export const POST_RETEST_DAYS = 21;
export const POST_BEFORE_END_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 這個班的課後複測時間到了嗎？沒有課前紀錄時間（舊資料）視為到了，不阻擋。 */
export function retestDueAt(mySubmissions, group) {
  const pre = mySubmissions
    .filter((s) => (s.raterType ?? 'self') === 'self' && s.groupId === group.id && (s.phase ?? 'pre') === 'pre' && s.createdAt)
    .map((s) => new Date(s.createdAt).getTime())
    .sort((a, b) => a - b)[0];
  const byPre = pre != null ? pre + POST_RETEST_DAYS * DAY_MS : 0;
  const end = group.endDate ? new Date(group.endDate).getTime() - POST_BEFORE_END_DAYS * DAY_MS : Infinity;
  return Math.min(byPre, end);
}

function selfDonePhases(mySubmissions, groupId) {
  const done = new Set();
  mySubmissions.forEach((s) => {
    if ((s.raterType ?? 'self') !== 'self') return;
    if (s.groupId !== groupId) return;
    done.add(s.phase ?? 'pre');
  });
  return done;
}

/**
 * 首頁「下一步」卡片的優先序判斷（見 docs/archive/sprints-1-5.md Sprint 2 驗收條件 2.1，
 * ④ 是 Sprint 3 驗收條件 3.4 加的複測提醒）：
 *   ① 所屬班級課前未作答 → 開始課前評測
 *   ② 課前已完成、班級進行中，且課前滿 21 天（或班級結束前 7 天）→ 開始課後複測；
 *      還沒到 → 'keep-going'（先練習，之後再複測），排在 ③④ 之後
 *   ③ 360° 他評邀請未完成 → 還有 N 位同事等你評分
 *   ④ 有目標的建議複測日已到 → 提醒回來複測看看有沒有變化
 *   ⑤ 都完成 → 看看你的成長報告
 *   （完全沒有任何班級/評量可做 → 回傳 null，卡片不顯示）
 *
 * 刻意寫成不打 API 的純函式，方便單元測試涵蓋每個分支，資料全部由呼叫端
 * （已經在 AssessmentHome 打過的 API 結果）傳入。
 *
 * @param {object} data
 * @param {Array} data.assessments   GET /assessments 的結果（含 id/name/enabled）
 * @param {Array} data.mySubmissions GET /submissions/me 的結果
 * @param {Array} data.myGroups      GET /groups/mine 的結果（含 phase/coachName/…）
 * @param {Array} data.groupMembers  GET /groups/mine/members 的結果（跨所有班別的同學名單）
 * @param {Array} data.goals         GET /goals 的結果（用於④的複測提醒）
 * @returns {null | {kind: 'pre'|'post'|'rate-others'|'retest-reminder'|'view-report'|'start-any',
 *   assessmentId, assessmentName, groupId?, count?, goalText?}}
 */
export function computeNextStep({ assessments = [], mySubmissions = [], myGroups = [], groupMembers = [], goals = [] }) {
  const nameOf = (id) => assessments.find((a) => a.id === id)?.name ?? id;

  // ① / ②：逐一檢查目前「進行中」的班別，看自己還缺課前還是課後。
  let keepGoing = null;
  for (const group of myGroups) {
    if (group.phase !== 'in_progress') continue;
    const done = selfDonePhases(mySubmissions, group.id);
    if (!done.has('pre')) {
      return {
        kind: 'pre',
        assessmentId: group.assessmentId,
        assessmentName: nameOf(group.assessmentId),
        groupId: group.id,
      };
    }
  }
  for (const group of myGroups) {
    if (group.phase !== 'in_progress') continue;
    const done = selfDonePhases(mySubmissions, group.id);
    if (done.has('pre') && !done.has('post')) {
      const dueAt = retestDueAt(mySubmissions, group);
      if (Date.now() >= dueAt) {
        return {
          kind: 'post',
          assessmentId: group.assessmentId,
          assessmentName: nameOf(group.assessmentId),
          groupId: group.id,
        };
      }
      // 還沒到複測時間：先練習。記下來，等 ③④ 判斷完再回傳（他評與到期的目標複測比較急）。
      keepGoing ??= { kind: 'keep-going', assessmentId: group.assessmentId, assessmentName: nameOf(group.assessmentId), groupId: group.id, retestAt: new Date(dueAt).toISOString() };
    }
  }

  // ③：支援 360° 的題庫裡，還有沒有同學一次都還沒評過（任何關係皆可，跟
  // MultiRaterHome 現有的「評測他人」邏輯採同一種寬鬆判定——系統不指派特定
  // 對象與關係，由使用者自行選擇要評誰、評什麼關係）。
  if (groupMembers.length > 0) {
    const ratedMemberIds = new Set(
      mySubmissions
        .filter((s) => (s.raterType ?? 'self') !== 'self')
        .map((s) => s.rateeId),
    );
    const supported360 = assessments.filter((a) => getAssessment(a.id)?.SUPPORTS_360);
    for (const a of supported360) {
      const pendingCount = groupMembers.filter((m) => !ratedMemberIds.has(m.id)).length;
      if (pendingCount > 0) {
        return {
          kind: 'rate-others',
          assessmentId: a.id,
          assessmentName: a.name,
          count: pendingCount,
        };
      }
    }
  }

  // ④：有目標設定了複測日、而且已經到期（且目標還沒達成）——提醒回來複測，
  // 而不是靜靜等使用者自己想起來。
  const dueGoal = goals.find((g) => !g.achievedAt && g.reviewDate && new Date(g.reviewDate).getTime() <= Date.now());
  if (dueGoal) {
    return {
      kind: 'retest-reminder',
      assessmentId: dueGoal.assessmentId,
      assessmentName: nameOf(dueGoal.assessmentId),
      goalText: dueGoal.text,
    };
  }

  // 課前做完、還沒到複測時間：先練習（取代「該回來複測了」）。
  if (keepGoing) return keepGoing;

  // ⑤：有作答紀錄就導去看最新一筆的分析報告。
  // 班級限定的問卷（課後問卷）沒有「成長報告」可看，不算在內。
  const reportable = mySubmissions.filter((s) => !getAssessment(s.assessmentId)?.CLASS_ONLY);
  if (reportable.length > 0) {
    const latestSelf = reportable.find((s) => (s.raterType ?? 'self') === 'self') ?? reportable[0];
    return {
      kind: 'view-report',
      assessmentId: latestSelf.assessmentId ?? 'ai-competency',
      assessmentName: nameOf(latestSelf.assessmentId ?? 'ai-competency'),
    };
  }

  // 完全是新帳號：沒有任何班級、也還沒作答過——指向第一個可作答的題庫。
  const firstEnabled = assessments.find((a) => a.enabled !== false);
  if (firstEnabled) {
    return { kind: 'start-any', assessmentId: firstEnabled.id, assessmentName: firstEnabled.name };
  }

  return null;
}
