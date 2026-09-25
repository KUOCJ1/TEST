import { getAssessment } from '../data/assessments/index.js';

// 跟 SurveyApp.jsx 判斷「這個班現在該做課前還是課後」用的是同一套推導方式：
// 只看「自評」提交、且 groupId 對得上目前這個班，避免不同梯次/舊資料互相污染。
// 兩處重複這幾行而不是抽成共用函式，是因為 SurveyApp 那邊是單一班別、單一
// assessmentId 的 in-component 邏輯，這裡則要一次掃過使用者所有的班——直接
// 抽共用函式反而要多繞一層參數轉換，不如各自維持小而直接。
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
 * 首頁「下一步」卡片的優先序判斷（見 docs/SPRINT_PLAN.md Sprint 2 驗收條件 2.1）：
 *   ① 所屬班級課前未作答 → 開始課前評測
 *   ② 課前已完成、班級進行中 → 開始課後複測
 *   ③ 360° 他評邀請未完成 → 還有 N 位同事等你評分
 *   ④ 都完成 → 看看你的成長報告
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
 * @returns {null | {kind: 'pre'|'post'|'rate-others'|'view-report'|'start-any',
 *   assessmentId, assessmentName, groupId?, count?}}
 */
export function computeNextStep({ assessments = [], mySubmissions = [], myGroups = [], groupMembers = [] }) {
  const nameOf = (id) => assessments.find((a) => a.id === id)?.name ?? id;

  // ① / ②：逐一檢查目前「進行中」的班別，看自己還缺課前還是課後。
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
      return {
        kind: 'post',
        assessmentId: group.assessmentId,
        assessmentName: nameOf(group.assessmentId),
        groupId: group.id,
      };
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

  // ④：有作答紀錄就導去看最新一筆的分析報告。
  if (mySubmissions.length > 0) {
    const latestSelf = mySubmissions.find((s) => (s.raterType ?? 'self') === 'self') ?? mySubmissions[0];
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
