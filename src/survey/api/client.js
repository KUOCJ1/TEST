import { refreshResultsInPlace } from '../data/assessments/refreshResult';

const BASE = import.meta.env.VITE_API_BASE || '/api';
export const API_BASE = BASE;

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('無法連線到伺服器，請稍後再試');
  }

  let data = null;
  try { data = await res.json(); } catch { /* no json */ }

  if (!res.ok) {
    const err = new Error(data?.error || `請求失敗（${res.status}）`);
    err.status = res.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  // 作答結果裡存的是送出當下的構面名稱與等級說明；改用目前題庫文字顯示（見 refreshResult.js）。
  return refreshResultsInPlace(data);
}

export const api = {
  // 回傳完整 { user, joinedGroup }：joinedGroup 只有帶了有效報到代碼時才會有值，
  // 供呼叫端（AuthContext）判斷要不要直接導去對應的評量。
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  // 既有用戶補同意隱私權政策與服務條款（Sprint 12）。
  acceptPolicy: () => request('/auth/consent', { method: 'POST', body: { accept: true } }).then((d) => d.user),
  me: () => request('/auth/me').then((d) => d.user),
  // 啟動時查登入狀態：未登入回 { user: null }（200），不會在 console 留 401。
  session: () => request('/auth/session').then((d) => d.user),
  updateProfile: (payload) => request('/auth/profile', { method: 'PATCH', body: payload }).then((d) => d.user),
  changePassword: (payload) => request('/auth/password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),

  assessments: () => request('/assessments').then((d) => d.assessments),
  assessmentContent: () => request('/assessments/content').then((d) => d.content),
  benchmark: (assessmentId) => request(`/assessments/${assessmentId}/benchmark`),
  // dimensionIds 可傳多個（一次評測結果常有不只一個值得延伸的構面），回傳
  // [{ dimensionId, articles }]，跟傳入順序一致。
  learningResources: (assessmentId, dimensionIds) => {
    const params = new URLSearchParams({ assessmentId });
    dimensionIds.forEach((id) => params.append('dimensionId', id));
    return request(`/learning-resources?${params.toString()}`)
      .then((d) => d.byDimension)
      .catch(() => []); // 非必要的附加功能，任何失敗都不能讓報告頁面壞掉。
  },
  // fire-and-forget：呼叫端不 await，記錄失敗也不該影響文章正常開啟。
  trackArticleClick: (payload) => request('/learning-resources/track-click', { method: 'POST', body: payload }).catch(() => {}),
  adminLearningResourceStats: () => request('/admin/learning-resources/stats').then((d) => d.stats),
  adminAssessments: () => request('/admin/assessments').then((d) => d.assessments),
  toggleAssessment: (id, enabled) =>
    request(`/admin/assessments/${id}`, { method: 'PATCH', body: { enabled } }).then((d) => d.assessment),

  createSubmission: (payload) =>
    request('/submissions', { method: 'POST', body: payload }).then((d) => d.submission),
  mySubmissions: () => request('/submissions/me').then((d) => d.submissions),
  // 課後學習成效問卷（ai-course-post）：撤回／重新同意 30、60 天追蹤信；教練端取得班級彙總（只含彙總、不含姓名）。
  setCourseFollowUp: (consent) => request('/course-survey/follow-up', { method: 'PATCH', body: { consent } }),
  getCourseSurveySummary: (groupId) => request(`/coach/groups/${groupId}/course-survey`),
  rateeSubmissions: (rateeId, assessmentId, opts = {}) => {
    const qs = new URLSearchParams({ assessmentId, ...(opts.deanonymize ? { deanonymize: '1' } : {}) });
    return request(`/submissions/ratee/${rateeId}?${qs}`).then((d) => d.submissions);
  },

  setCompassManagerShare: (granted) =>
    request('/auth/compass-manager-share', { method: 'PUT', body: { granted } }).then((d) => d.user),

  // 他評邀請（領導力羅盤等嚴格隱私題庫）：受評者或教練發出邀請，評分者才能評。
  raterInvitesMine: () => request('/rater-invites/mine'),
  groupRaterInvites: (groupId) => request(`/rater-invites/group/${groupId}`).then((d) => d.invites),
  createRaterInvite: (payload) => request('/rater-invites', { method: 'POST', body: payload }).then((d) => d.invite),
  deleteRaterInvite: (id) => request(`/rater-invites/${id}`, { method: 'DELETE' }),
  // 班級邀請：教練邀請已有帳號的人入班，本人接受才加入。
  groupInvites: () => request('/groups/invites').then((d) => d.invites),
  acceptGroupInvite: (id) => request(`/groups/invites/${id}/accept`, { method: 'POST' }),
  declineGroupInvite: (id) => request(`/groups/invites/${id}/decline`, { method: 'POST' }),
  coachCancelGroupInvite: (groupId, inviteId) => request(`/coach/groups/${groupId}/invites/${inviteId}`, { method: 'DELETE' }),

  adminOverview: () => request('/admin/overview'),
  health: () => request('/health'),
  adminSystemStatus: () => request('/admin/system-status'),
  // 稽核紀錄（只讀）與管理員還原嚴格隱私題庫的評分者身分（要填理由，會寫入稽核紀錄）。
  adminAuditLog: ({ action = '', before = '', limit = 50 } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit), ...(action && { action }), ...(before && { before }) });
    return request(`/admin/audit-log?${qs}`);
  },
  revealRaters: (rateeId, payload) => request(`/submissions/ratee/${rateeId}/reveal`, { method: 'POST', body: payload }),
  adminAssessmentContent: (id) => request(`/admin/assessment-content/${id}`).then((d) => d.content),
  adminSaveContentDraft: (id, overrides) =>
    request(`/admin/assessment-content/${id}/draft`, { method: 'PUT', body: { overrides } }).then((d) => d.content),
  adminDiscardContentDraft: (id) =>
    request(`/admin/assessment-content/${id}/draft`, { method: 'DELETE' }).then((d) => d.content),
  adminPublishContent: (id, note) =>
    request(`/admin/assessment-content/${id}/publish`, { method: 'POST', body: { note } }).then((d) => d.content),
  adminRollbackContent: (id, version, note) =>
    request(`/admin/assessment-content/${id}/rollback`, { method: 'POST', body: { version, note } }).then((d) => d.content),
  batchImport: (payload) => request('/admin/batch-import', { method: 'POST', body: payload }),
  setUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } }).then((d) => d.user),
  setUserDisabled: (userId, disabled) =>
    request(`/admin/users/${userId}/disabled`, { method: 'PATCH', body: { disabled } }).then((d) => d.user),
  transferGroup: (groupId, coachId) =>
    request(`/admin/groups/${groupId}/coach`, { method: 'PATCH', body: { coachId } }).then((d) => d.group),
  generateResetToken: (userId) =>
    request(`/admin/users/${userId}/reset-token`, { method: 'POST' }),

  coachOverview: () => request('/coach/overview'),
  // 全站名冊已移除（Sprint 11）：教練只能搜尋，至少 2 個字、最多 10 筆。
  coachUserSearch: (q) => request(`/coach/user-search?q=${encodeURIComponent(q)}`).then((d) => d.users),
  coachGroups: () => request('/coach/groups').then((d) => d.groups),
  createGroup: (payload) => request('/coach/groups', { method: 'POST', body: payload }).then((d) => d.group),
  getGroup: (id) => request(`/coach/groups/${id}`),
  updateGroup: (id, payload) => request(`/coach/groups/${id}`, { method: 'PUT', body: payload }).then((d) => d.group),
  deleteGroup: (id) => request(`/coach/groups/${id}`, { method: 'DELETE' }),
  importRoster: (id, entries) =>
    request(`/coach/groups/${id}/roster`, { method: 'POST', body: { entries } }),
  // 邀請制入班（Sprint 19）：每位學員一組專屬邀請連結，狀態與寄送紀錄見 docs/onboarding-invitations-spec.md。
  regenerateMemberInvite: (groupId, inviteId) =>
    request(`/coach/groups/${groupId}/member-invites/${inviteId}/regenerate`, { method: 'POST' }).then((d) => d.memberInvite),
  revokeMemberInvite: (groupId, inviteId) =>
    request(`/coach/groups/${groupId}/member-invites/${inviteId}`, { method: 'DELETE' }),
  // 沒給 inviteIds 就寄這個班所有有效、尚未加入的邀請。SMTP 沒設定時後端回 503（code: CONFIG_ERROR）。
  sendMemberInvites: (groupId, inviteIds) =>
    request(`/coach/groups/${groupId}/member-invites/send`, { method: 'POST', body: inviteIds ? { inviteIds } : {} }),
  // 排除／恢復「不列入統計」（掃碼報到先收後審用）：資料不刪除，只是不進班級報告、統計與匯出。
  setGroupExclusion: (id, userId, excluded) =>
    request(`/coach/groups/${id}/exclusions`, { method: 'PUT', body: { userId, excluded } }).then((d) => d.group),
  publishGroup: (id) => request(`/coach/groups/${id}/publish`, { method: 'POST' }).then((d) => d.group),
  unpublishGroup: (id) => request(`/coach/groups/${id}/publish`, { method: 'DELETE' }).then((d) => d.group),
  // 回傳 { phase, sent, failed:[email], group }；群組帶新的 lastReminderSentAt（冷卻用）。
  sendGroupReminders: (id) => request(`/coach/groups/${id}/remind`, { method: 'POST' }),

  upsertComment: (submissionId, payload) =>
    request(`/submissions/${submissionId}/comment`, { method: 'POST', body: payload }).then((d) => d.comment),
  deleteComment: (submissionId, commentId) =>
    request(`/submissions/${submissionId}/comment/${commentId}`, { method: 'DELETE' }),

  myGroups: () => request('/groups/mine').then((d) => d.groups),
  groupMembers: () => request('/groups/mine/members').then((d) => d.members),
  // 已登入使用者掃到（另一個）班級的 QR：直接加入，不需重新註冊/登入。
  joinGroup: (joinCode) => request('/groups/join', { method: 'POST', body: { joinCode } }).then((d) => d.joinedGroup),

  // 個人發展目標（僅本人可讀寫）
  myGoals: (assessmentId) =>
    request(`/goals${assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : ''}`).then((d) => d.goals),
  createGoal: (body) => request('/goals', { method: 'POST', body }).then((d) => d.goal),
  updateGoal: (id, body) => request(`/goals/${id}`, { method: 'PATCH', body }).then((d) => d.goal),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),
  // 發展閉環（Sprint 20）：延後檢視日、追蹤紀錄（一句話＋自評 1–5）。都回傳更新後的目標。
  snoozeGoal: (id, days = 7) => request(`/goals/${id}/snooze`, { method: 'POST', body: { days } }).then((d) => d.goal),
  addGoalCheckin: (id, body) => request(`/goals/${id}/checkins`, { method: 'POST', body }).then((d) => d.goal),
  removeGoalCheckin: (id, checkinId) => request(`/goals/${id}/checkins/${checkinId}`, { method: 'DELETE' }).then((d) => d.goal),
  adminDevelopmentFunnel: () => request('/admin/development-funnel'),
  // 完全公開、免登入：QR 報到連結在使用者登入前就要能顯示班級資訊。
  // 邀請連結落地頁：註冊前先查「誰邀請你加入哪個班」與被邀請的 Email（有邀請碼才查得到）。
  publicInviteInfo: (code) => request(`/public/invite/${encodeURIComponent(code)}`),
  // 已登入、還沒入班的人輸入邀請碼；Email 必須和邀請上的相同。
  redeemInvite: (code) => request('/invites/redeem', { method: 'POST', body: { code } }).then((d) => d.joinedGroup),
  publicJoinInfo: (code) => request(`/public/join/${encodeURIComponent(code)}`),

  // 我的學習清單（僅本人可讀寫，見 server/src/routes/readingList.js）
  myReadingList: () => request('/reading-list').then((d) => d.items),
  addToReadingList: (body) => request('/reading-list', { method: 'POST', body }).then((d) => d.item),
  markReadingListItem: (id, read) => request(`/reading-list/${id}`, { method: 'PATCH', body: { read } }).then((d) => d.item),
  removeReadingListItem: (id) => request(`/reading-list/${id}`, { method: 'DELETE' }),

  generateJoinCode: (groupId) =>
    request(`/coach/groups/${groupId}/join-code`, { method: 'POST' }),
  revokeJoinCode: (groupId) =>
    request(`/coach/groups/${groupId}/join-code`, { method: 'DELETE' }).then((d) => d.group),
};
