import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { publicUser } from '../auth.js';
import { stripRaterDetails } from '../lib/compassPrivacy.js';
import {
  asyncHandler,
  normalizeSubmission,
  getGroupPhase,
  auditLog,
  sanitizeFocusDimensionIds,
  sanitizeTargetHeadcount,
  sanitizeDimensionNotes,
} from '../lib/helpers.js';
import { generateJoinCode } from '../lib/joinCode.js';
import { splitNewMembers } from '../lib/invites.js';
import {
  newMemberInvite, inviteForCoach, inviteState, inviteExpiry, generateInviteCode, inviteLink,
} from '../lib/memberInvites.js';
import { buildInviteMail, MAX_INVITE_SUBJECT, MAX_INVITE_BODY } from '../lib/inviteMail.js';
import { sharedGoalForCoach } from './goals.js';
import { isMailConfigured, sendMail, appBaseUrl, formatTaipeiDate } from '../lib/mailer.js';
import { COURSE_SURVEY_ID, summarizeCourseSurvey } from '../lib/courseSurvey.js';

// 同一班寄一次催交信後的冷卻時間：避免誤觸連按、把學員信箱洗版。
export const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

function buildReminderMail({ group, name, phaseLabel, link: personalLink }) {
  // 還沒加入的人（邀請制）附他自己的邀請連結；已加入的人用班級報到連結。
  const link = personalLink ?? (group.joinCode ? `${appBaseUrl()}/?join=${group.joinCode}` : `${appBaseUrl()}/`);
  const deadline = group.endDate ? `請於 ${formatTaipeiDate(group.endDate)} 前完成` : '請盡快完成';
  const org = group.companyName ? `（${group.companyName}）` : '';
  return {
    subject: `【${group.name}】${phaseLabel}評測提醒`,
    text: [
      `${name || '同學'} 您好：`,
      '',
      `您參加的「${group.name}」${org}${phaseLabel}評測尚未完成，${deadline}。`,
      '',
      `作答連結：${link}`,
      '',
      `（此信由評測平台代 ${group.coachName || '授課教練'} 寄出；如已完成，請忽略這封信。）`,
    ].join('\n'),
  };
}

/** @param {{db, requireAuth, requireCoach}} deps */
export function createCoachRouter({ db, requireAuth, requireCoach }) {
  const router = Router();
  router.use(requireAuth, requireCoach);

  // 這位教練「看得到成績」的對象：自己名下班別的所有成員。admin 不受限。
  // 評測分數屬敏感資料，教練不應看到別的教練所帶學員的成績。
  function visibleUserIds(reqUser) {
    if (reqUser.role === 'admin') return null; // null = 不設限
    const ids = new Set();
    for (const g of db.data.groups ?? []) {
      if (g.coachId !== reqUser.id) continue;
      for (const id of g.memberIds ?? []) ids.add(id);
    }
    return ids;
  }

  router.get('/overview', (req, res) => {
    const allow = visibleUserIds(req.user);
    const canSee = (userId) => allow === null || allow.has(userId);

    res.json({
      users: db.data.users
        .filter((u) => u.role !== 'admin' && canSee(u.id))
        .map(publicUser),
      // 受評者或評分者其中一方在可見範圍內才回傳，360 他評才不會漏掉。
      // 嚴格隱私題庫的他評只回傳「誰收到哪一類評分」的計數用欄位（見 compassPrivacy.js）。
      submissions: stripRaterDetails(db.data.submissions
        .map(normalizeSubmission)
        // 課後問卷只以彙總呈現給教練（GET /groups/:id/course-survey），個人的作答與結果不經由這裡。
        .filter((s) => s.assessmentId !== COURSE_SURVEY_ID)
        .filter((s) => canSee(s.rateeId) || canSee(s.userId))
        .map((s) => ({ ...s, answers: undefined }))),
    });
  });

  // 成員搜尋（Sprint 11）：取代以前「回傳全站所有用戶姓名與 Email」的名冊——那讓任何教練
  // 都能翻閱全站的 Email，用戶一多教練也根本找不到人。現在要輸入至少 2 個字、一次最多
  // 10 筆，只回姓名與 Email（不含成績），並排除管理者與已停用的帳號。
  const SEARCH_MIN_CHARS = 2;
  const SEARCH_LIMIT = 10;
  router.get('/user-search', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (q.length < SEARCH_MIN_CHARS) return res.json({ users: [], limit: SEARCH_LIMIT, minChars: SEARCH_MIN_CHARS });
    const matches = db.data.users
      .filter((u) => u.role !== 'admin' && !u.disabled
        && (String(u.name ?? '').toLowerCase().includes(q) || String(u.email ?? '').toLowerCase().includes(q)))
      .slice(0, SEARCH_LIMIT)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
    res.json({ users: matches, limit: SEARCH_LIMIT, minChars: SEARCH_MIN_CHARS });
  });

  router.get('/groups', (req, res) => {
    const groups = (db.data.groups ?? [])
      .filter((g) => g.coachId === req.user.id || req.user.role === 'admin')
      .map((g) => ({ ...g, phase: getGroupPhase(g) }));
    res.json({ groups });
  });

  // 成員 id 只收「存在、非管理者」的帳號，去重；已停用的帳號不能新加入（但原本就在班上的保留，
  // 停用不該讓人從班級與成績中消失）。
  const sanitizeMemberIds = (ids, existing = []) => {
    if (!Array.isArray(ids)) return [];
    const keep = new Set(existing);
    const out = [];
    for (const id of ids) {
      if (typeof id !== 'string' || out.includes(id)) continue;
      const u = db.data.users.find((x) => x.id === id);
      if (!u || u.role === 'admin') continue;
      if (u.disabled && !keep.has(id)) continue;
      out.push(id);
    }
    return out;
  };

  const isKnownAssessment = (id) => typeof id === 'string' && (db.data.assessments ?? []).some((a) => a.id === id);
  // 建班／換評量時，評量必須已啟用（停用的評量不開放建班，避免繞過「驗收後才啟用」的流程）。
  const isEnabledAssessment = (id) => (db.data.assessments ?? []).some((a) => a.id === id && a.enabled);
  // 班級可附加的「課後問卷」（classOnly 評量）：只收存在、已啟用、標記為 classOnly 的 id，去重。
  const sanitizeExtraAssessmentIds = (ids) => {
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids)].filter((id) => typeof id === 'string'
      && (db.data.assessments ?? []).some((a) => a.id === id && a.enabled && a.classOnly)).slice(0, 5);
  };

  // 邀請制入班（Sprint 19）：這個班的邀請（不含已撤銷），含連結，給教練／管理員的畫面使用。
  // 每筆附上「寄給這個人的信」（主旨與內文，含他專屬的連結）：SMTP 還沒設定時，教練可以複製或匯出
  // 後自己寄（郵件合併、LINE）；設定好之後系統寄出的就是同一份內容。
  const listMemberInvites = (groupId) => {
    const group = (db.data.groups ?? []).find((g) => g.id === groupId);
    return (db.data.memberInvites ?? [])
      .filter((i) => i.groupId === groupId && i.status !== 'revoked')
      .map((i) => {
        const mail = group ? buildInviteMail({ group, invite: i }) : { subject: '', text: '' };
        return { ...inviteForCoach(i, appBaseUrl()), mailSubject: mail.subject, mailText: mail.text };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  };

  // 取得有權管理的班級與其中一筆邀請（找不到／無權限時直接回應並回傳 null）。
  function manageInvite(req, res) {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) { res.status(404).json({ error: '班別不存在' }); return null; }
    if (group.coachId !== req.user.id && req.user.role !== 'admin') { res.status(403).json({ error: '無權限' }); return null; }
    return group;
  }

  const sanitizeMaxMembers = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : null;
  };
  // 網域：小寫、去掉開頭的 @、只留合法網域格式、去重、最多 10 個。
  const sanitizeEmailDomains = (v) => {
    const list = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;、，]+/);
    const out = [];
    for (const raw of list) {
      const d = String(raw ?? '').trim().toLowerCase().replace(/^@+/, '');
      if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) && !out.includes(d)) out.push(d);
    }
    return out.slice(0, 10);
  };

  router.post('/groups', (req, res) => {
    const { name, companyName, assessmentId, memberIds, focusDimensionIds, targetHeadcount, dimensionNotes, exclusive } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || (companyName !== undefined && typeof companyName !== 'string')) {
      return res.status(400).json({ error: '請輸入班別名稱' });
    }
    // 不認得的題庫 id 會讓前端整個班級畫面找不到題庫設定；沒帶時沿用預設的 ai-competency。
    if (assessmentId !== undefined && !isKnownAssessment(assessmentId)) return res.status(400).json({ error: '評量不存在' });
    if (assessmentId !== undefined && !isEnabledAssessment(assessmentId)) return res.status(403).json({ code: 'ASSESSMENT_DISABLED', error: '這份評量目前未開放，請先請管理者啟用' });
    const group = {
      id: randomUUID(),
      name: name.trim(),
      companyName: companyName?.trim() ?? '',
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      coachId: req.user.id,
      coachName: req.user.name,
      memberIds: [],
      exclusive: exclusive === true,
      focusDimensionIds: sanitizeFocusDimensionIds(focusDimensionIds),
      targetHeadcount: sanitizeTargetHeadcount(targetHeadcount),
      dimensionNotes: sanitizeDimensionNotes(dimensionNotes),
      groupComment: '',
      groupTips: [],
      startDate: null,
      endDate: null,
      publishedAt: null,
      joinCode: null,
      joinCodeCreatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!db.data.groups) db.data.groups = [];
    db.data.groups.push(group);
    // 已有帳號的人：教練只能「邀請」，本人接受才加入（管理員直接生效）。
    const split = splitNewMembers(db, group, sanitizeMemberIds(memberIds), req.user);
    group.memberIds = split.memberIds;
    db.persist();
    auditLog(req, 'create_group', { groupId: group.id, groupName: group.name, assessmentId: group.assessmentId, invited: split.invitedIds.length });
    res.status(201).json({ group, invitedIds: split.invitedIds });
  });

  router.get('/groups/:id', (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    // 新資料在送出時就已寫死 groupId，精準對應「這一梯」；舊資料（groupId 為 null）
    // 沒有這個歸屬，退回原本「用當下成員名單反查」的方式相容，確保既有正式站資料
    // 不會從報告中消失。兩者擇一，不會重複計入。
    const excluded = new Set(group.excludedUserIds ?? []);
    const memberSubs = db.data.submissions
      .map(normalizeSubmission)
      // 被排除（不列入統計）的人：他的作答與別人對他的評分都不進班級報告、統計與匯出。
      .filter((n) => !excluded.has(n.userId) && !excluded.has(n.rateeId))
      .filter((n) => (n.groupId
        ? n.groupId === group.id
        : group.memberIds.includes(n.userId) && n.assessmentId === group.assessmentId))
      .map((n) => ({ ...n, answers: undefined }));
    // 班級成員的姓名與 Email（Sprint 11）：取代以前的全站名冊，前端只需要「這個班的人」。
    const members = (group.memberIds ?? [])
      .map((id) => db.data.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, disabled: Boolean(u.disabled), excluded: excluded.has(u.id) }));
    // 還在等對方接受的班級邀請（教練不能直接把已有帳號的人加進班級）。
    const invites = (db.data.groupInvites ?? [])
      .filter((i) => i.groupId === group.id && i.status === 'pending')
      .map((i) => {
        const u = db.data.users.find((x) => x.id === i.userId);
        return u ? { id: i.id, userId: u.id, name: u.name, email: u.email } : null;
      })
      .filter(Boolean);
    res.json({
      group: { ...group, phase: getGroupPhase(group) },
      submissions: stripRaterDetails(memberSubs),
      members,
      invites,
      memberInvites: listMemberInvites(group.id),
      mailConfigured: isMailConfigured(),
      // 學員「選擇分享給教練」的發展目標（預設私密）；只含本班評量、本班成員，且不含追蹤筆記。
      sharedGoals: (db.data.goals ?? [])
        .filter((g) => g.sharedWithCoach === true
          && group.memberIds.includes(g.userId)
          && (g.assessmentId ?? 'ai-competency') === (group.assessmentId ?? 'ai-competency'))
        .map((g) => sharedGoalForCoach(g, db.data.users.find((u) => u.id === g.userId))),
    });
  });

  // 課後問卷彙總（課後學習成效問卷，見 docs/post-course-survey-design.md）。
  // 只回彙總：完成率、平均、答對人數、開放題文字（不附姓名）；少於 3 人的項目不顯示。
  // 被排除（不列入統計）的人不計入應填與彙總。
  router.get('/groups/:id/course-survey', (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    if (!(group.extraAssessmentIds ?? []).includes(COURSE_SURVEY_ID)) return res.json({ attached: false });
    const excluded = new Set(group.excludedUserIds ?? []);
    const expectedIds = new Set((group.memberIds ?? []).filter((id) => !excluded.has(id)));
    const latest = new Map();
    for (const sub of db.data.submissions) {
      if (sub.assessmentId !== COURSE_SURVEY_ID || sub.surveyGroupId !== group.id || !expectedIds.has(sub.userId)) continue;
      const prev = latest.get(sub.userId);
      if (!prev || new Date(sub.createdAt) > new Date(prev.createdAt)) latest.set(sub.userId, sub);
    }
    const subs = [...latest.values()];
    const consented = subs.filter((s) => s.answers?.d7 === 'yes');
    const firstAt = consented.map((s) => new Date(s.createdAt).getTime()).sort((a, b) => a - b)[0];
    const addDays = (t, d) => new Date(t + d * 864e5).toISOString().slice(0, 10);
    res.json({
      attached: true,
      ...summarizeCourseSurvey(subs, expectedIds.size),
      followUp: { consented: consented.length, due30: firstAt ? addDays(firstAt, 30) : null, due60: firstAt ? addDays(firstAt, 60) : null },
    });
  });

  // 排除／恢復「不列入統計」：資料不刪除，只是不進這個班的報告、統計與匯出，也不再被催交。
  // 用在掃碼報到「先收後審」時，名單外或誤填的人。排除記錄在班級上，即使之後把人移出班級也仍然有效。
  router.put('/groups/:id/exclusions', (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '無權限' });
    const { userId, excluded } = req.body ?? {};
    if (typeof userId !== 'string' || typeof excluded !== 'boolean') {
      return res.status(400).json({ code: 'INVALID_EXCLUSION', error: '請指定成員與是否排除' });
    }
    const user = db.data.users.find((u) => u.id === userId);
    const isMember = (group.memberIds ?? []).includes(userId);
    const hasData = db.data.submissions.some((s) => s.groupId === group.id && s.userId === userId);
    if (!user || (!isMember && !hasData)) return res.status(404).json({ error: '這個人不在這個班級裡' });
    const set = new Set(group.excludedUserIds ?? []);
    if (excluded) set.add(userId); else set.delete(userId);
    group.excludedUserIds = [...set];
    group.updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, excluded ? 'exclude_member' : 'restore_member', { groupId: group.id, groupName: group.name, userId, email: user.email });
    res.json({ group: { ...group, phase: getGroupPhase(group) } });
  });

  // 取消尚未被接受的班級邀請。
  router.delete('/groups/:id/invites/:inviteId', (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '無權限' });
    const inv = (db.data.groupInvites ?? []).find((i) => i.id === req.params.inviteId && i.groupId === group.id);
    if (inv && inv.status === 'pending') {
      inv.status = 'cancelled';
      db.persist();
    }
    res.json({ ok: true });
  });

  router.put('/groups/:id', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const { name, companyName, assessmentId, memberIds, groupComment, groupTips, focusDimensionIds, targetHeadcount, dimensionNotes, startDate, endDate, exclusive, inviteSubject, inviteBody, maxMembers, joinEmailDomains, extraAssessmentIds } = req.body ?? {};
    if ((name !== undefined && typeof name !== 'string') || (companyName !== undefined && typeof companyName !== 'string')) {
      return res.status(400).json({ error: '名稱格式不正確' });
    }
    if (assessmentId !== undefined && !isKnownAssessment(assessmentId)) return res.status(400).json({ error: '評量不存在' });
    if (assessmentId !== undefined && assessmentId !== groups[idx].assessmentId && !isEnabledAssessment(assessmentId)) {
      return res.status(403).json({ code: 'ASSESSMENT_DISABLED', error: '這份評量目前未開放，請先請管理者啟用' });
    }
    let invitedIds = [];
    let nextMemberIds;
    if (memberIds !== undefined) {
      const before = groups[idx].memberIds ?? [];
      const split = splitNewMembers(db, groups[idx], sanitizeMemberIds(memberIds, groups[idx].memberIds), req.user);
      nextMemberIds = split.memberIds;
      invitedIds = split.invitedIds;
      const added = nextMemberIds.filter((id) => !before.includes(id));
      const removed = before.filter((id) => !nextMemberIds.includes(id));
      if (added.length || removed.length || invitedIds.length) {
        auditLog(req, 'change_group_members', { groupId: groups[idx].id, groupName: groups[idx].name, added, removed, invited: invitedIds });
      }
    }
    const isISODate = (v) => v === null || (typeof v === 'string' && !isNaN(Date.parse(v)));
    groups[idx] = {
      ...groups[idx],
      ...(name !== undefined && { name: name.trim() }),
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(assessmentId !== undefined && { assessmentId }),
      ...(exclusive !== undefined && { exclusive: exclusive === true }),
      ...(extraAssessmentIds !== undefined && { extraAssessmentIds: sanitizeExtraAssessmentIds(extraAssessmentIds) }),
      // 邀請信的自訂主旨與內文（見 lib/inviteMail.js）：空字串＝改回預設的信。
      // 報到限制（掃碼報到的保護，見 lib/joinCode.js）：人數上限（null＝不限）與限定 Email 網域（空陣列＝不限）。
      ...(maxMembers !== undefined && { maxMembers: sanitizeMaxMembers(maxMembers) }),
      ...(joinEmailDomains !== undefined && { joinEmailDomains: sanitizeEmailDomains(joinEmailDomains) }),
      ...(inviteSubject !== undefined && { inviteSubject: typeof inviteSubject === 'string' ? inviteSubject.trim().slice(0, MAX_INVITE_SUBJECT) : '' }),
      ...(inviteBody !== undefined && { inviteBody: typeof inviteBody === 'string' ? inviteBody.trim().slice(0, MAX_INVITE_BODY) : '' }),
      ...(nextMemberIds !== undefined && { memberIds: nextMemberIds }),
      ...(groupComment !== undefined && { groupComment: String(groupComment).slice(0, 10000) }),
      ...(groupTips !== undefined && {
        groupTips: Array.isArray(groupTips)
          ? groupTips.slice(0, 100).map((t) => String(t ?? '').slice(0, 1000))
          : [],
      }),
      ...(focusDimensionIds !== undefined && { focusDimensionIds: sanitizeFocusDimensionIds(focusDimensionIds) }),
      ...(targetHeadcount !== undefined && { targetHeadcount: sanitizeTargetHeadcount(targetHeadcount) }),
      ...(dimensionNotes !== undefined && { dimensionNotes: sanitizeDimensionNotes(dimensionNotes) }),
      ...(startDate !== undefined && isISODate(startDate) && { startDate: startDate ?? null }),
      ...(endDate !== undefined && isISODate(endDate) && { endDate: endDate ?? null }),
      updatedAt: new Date().toISOString(),
    };
    if (extraAssessmentIds !== undefined) auditLog(req, 'set_group_extra_assessments', { groupId: groups[idx].id, groupName: groups[idx].name, extraAssessmentIds: groups[idx].extraAssessmentIds });
    db.persist();
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) }, invitedIds });
  });

  // 發布班級報告（admin 或該班 coach 皆可）。
  router.post('/groups/:id/publish', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups[idx].publishedAt = new Date().toISOString();
    groups[idx].updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'publish_group', { groupId: groups[idx].id, groupName: groups[idx].name });
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) } });
  });

  // ── 報到 QR Code ──────────────────────────────────────────
  // 產生／重新產生報到代碼。重新產生會讓舊代碼立即失效（單一代碼欄位，非多代碼列表）。
  router.post('/groups/:id/join-code', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups[idx].joinCode = generateJoinCode(db);
    groups[idx].joinCodeCreatedAt = new Date().toISOString();
    // 產生報到 QR 的目的就是讓學員現場掃碼馬上作答；若還沒設定開始時間，
    // 直接開啟，避免學員到現場掃了碼卻看到「尚未開放作答」而卡住。
    let autoOpened = false;
    if (!groups[idx].startDate) {
      groups[idx].startDate = new Date().toISOString();
      autoOpened = true;
    }
    groups[idx].updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'generate_join_code', { groupId: groups[idx].id, groupName: groups[idx].name, autoOpened });
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) }, autoOpened });
  });

  // 撤銷報到代碼（可逆——之後仍可重新產生新的代碼）。
  router.delete('/groups/:id/join-code', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups[idx].joinCode = null;
    groups[idx].joinCodeCreatedAt = null;
    groups[idx].updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'revoke_join_code', { groupId: groups[idx].id, groupName: groups[idx].name });
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) } });
  });

  // 取消發布（可逆，admin 或該班 coach 皆可）。
  router.delete('/groups/:id/publish', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups[idx].publishedAt = null;
    groups[idx].updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'unpublish_group', { groupId: groups[idx].id, groupName: groups[idx].name });
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) } });
  });

  // ── 寄送催交提醒信（Sprint 6 驗收條件 6.5、6.6）───────────────
  // 對象判定跟前端 ProgressPanel 的「複製提醒訊息」一致：只看自評提交；還有人
  // 沒做課前就只催課前（課程還沒上，不該叫已做完課前的人去做課後），全員課前
  // 都完成後才改催課後。課前階段也會寄給「待加入」名單（已登錄 Email、尚未
  // 註冊）的人——他們顯然還沒作答，信裡的連結帶報到代碼，註冊完直接進班。
  router.post('/groups/:id/remind', asyncHandler(async (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    if (!isMailConfigured()) {
      return res.status(503).json({ code: 'CONFIG_ERROR', error: '尚未設定寄信服務，請聯絡管理員設定 SMTP。' });
    }
    // 不在施測期間內寄催交信沒有意義：學員點進去也會被擋在「尚未開放／已截止」。
    if (getGroupPhase(group) !== 'in_progress') {
      return res.status(409).json({ code: 'NOT_IN_PROGRESS', error: '目前不在施測期間，無法寄送提醒信。' });
    }
    const last = group.lastReminderSentAt ? new Date(group.lastReminderSentAt).getTime() : 0;
    const waitMs = last + REMINDER_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      return res.status(429).json({
        code: 'REMINDER_COOLDOWN',
        error: `這個班 1 小時內已寄過提醒信，請 ${Math.ceil(waitMs / 60000)} 分鐘後再試。`,
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }

    const selfSubs = db.data.submissions
      .map(normalizeSubmission)
      .filter((n) => n.raterType === 'self' && (n.groupId
        ? n.groupId === group.id
        : group.memberIds.includes(n.userId) && n.assessmentId === group.assessmentId));
    const preDone = new Set(selfSubs.filter((n) => (n.phase ?? 'pre') === 'pre').map((n) => n.userId));
    const postDone = new Set(selfSubs.filter((n) => n.phase === 'post').map((n) => n.userId));
    const members = (group.memberIds ?? [])
      .map((id) => db.data.users.find((u) => u.id === id))
      .filter((u) => u && !u.disabled && !(group.excludedUserIds ?? []).includes(u.id));

    const notStartedPre = members.filter((m) => !preDone.has(m.id));
    // 邀請制：還沒加入的人（邀請仍有效）也要催，信裡附他專屬的邀請連結。
    const pending = (db.data.memberInvites ?? [])
      .filter((i) => i.groupId === group.id && inviteState(i) === 'invited')
      .map((i) => ({ name: i.name, email: i.email, link: inviteLink(i.code, appBaseUrl()) }));
    let phase;
    let recipients;
    if (notStartedPre.length > 0 || pending.length > 0) {
      phase = 'pre';
      recipients = [...notStartedPre.map((m) => ({ name: m.name, email: m.email })), ...pending];
    } else {
      phase = 'post';
      recipients = members
        .filter((m) => preDone.has(m.id) && !postDone.has(m.id))
        .map((m) => ({ name: m.name, email: m.email }));
    }

    if (recipients.length === 0) {
      return res.json({ phase, sent: 0, failed: [], group: { ...group, phase: getGroupPhase(group) } });
    }

    const phaseLabel = phase === 'pre' ? '課前' : '課後';
    const failed = [];
    let sent = 0;
    // 一人一封（個人化稱呼，也不會把全班信箱互相曝光在收件人欄位）。
    for (const r of recipients) {
      const result = await sendMail({ to: r.email, ...buildReminderMail({ group, name: r.name, phaseLabel, link: r.link }) });
      if (result.ok) sent += 1;
      else failed.push(r.email);
    }

    // 全部失敗（通常是 SMTP 設定錯）時不進冷卻，讓教練修好設定後可以馬上重試。
    if (sent > 0) {
      group.lastReminderSentAt = new Date().toISOString();
      group.updatedAt = group.lastReminderSentAt;
      db.persist();
    }
    auditLog(req, 'send_reminders', { groupId: group.id, phase, sent, failed: failed.length });
    res.json({ phase, sent, failed, group: { ...group, phase: getGroupPhase(group) } });
  }));

  // 批量匯入名單。
  router.post('/groups/:id/roster', (req, res) => {
    const groups = db.data.groups ?? [];
    const group = groups.find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (group.coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const { entries } = req.body ?? {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: '名單格式不正確' });

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const invitesData = (db.data.memberInvites ??= []);
    // added＝直接加入（管理員）；invited＝已有帳號、發了班級邀請等本人接受；
    // pending＝新建了邀請連結給尚未註冊的人；existing＝已經有有效邀請（沿用，不重複建立）。
    const result = { added: 0, pending: 0, invited: 0, existing: 0, invalid: [] };

    for (const raw of entries) {
      const email = (raw.email || '').trim().toLowerCase();
      const name = (raw.name || '').trim();
      if (!emailRe.test(email)) { result.invalid.push(raw.email || '(空白)'); continue; }
      const existing = db.data.users.find((u) => u.email === email && u.role !== 'admin');
      if (existing?.disabled) { result.invalid.push(email); continue; }
      if (existing) {
        if (group.memberIds.includes(existing.id)) continue;
        if (req.user.role === 'admin') { group.memberIds.push(existing.id); result.added += 1; continue; }
        // 已有帳號：教練只能邀請，本人接受才加入。
        const split = splitNewMembers(db, group, [...group.memberIds, existing.id], req.user);
        if (split.invitedIds.length > 0) result.invited += 1;
      } else {
        // 尚未註冊：建立專屬邀請（Sprint 19）。同班同 Email 已有「未過期、未使用」的邀請就沿用。
        const alive = invitesData.find((i) => i.groupId === group.id && i.email === email && inviteState(i) === 'invited');
        if (alive) {
          if (name && !alive.name) alive.name = name.slice(0, 100);
          result.existing += 1;
        } else {
          invitesData.push(newMemberInvite(db.data, { groupId: group.id, email, name, createdBy: req.user.id }));
          result.pending += 1;
        }
      }
    }
    group.updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'import_roster', { groupId: group.id, groupName: group.name, added: result.added, invited: result.invited, pending: result.pending, existing: result.existing });
    res.json({ group, result, memberInvites: listMemberInvites(group.id) });
  });

  // ── 學員邀請管理（Sprint 19）─────────────────────────────────
  // 重新產生：換一組新碼並把期限重設為 14 天（舊連結立即失效）。已加入的不能重新產生。
  router.post('/groups/:id/member-invites/:inviteId/regenerate', (req, res) => {
    const group = manageInvite(req, res);
    if (!group) return;
    const inv = (db.data.memberInvites ?? []).find((i) => i.id === req.params.inviteId && i.groupId === group.id);
    if (!inv || inv.status === 'revoked') return res.status(404).json({ error: '邀請不存在' });
    if (inv.status === 'joined') return res.status(409).json({ code: 'ALREADY_JOINED', error: '這位學員已經加入了，不需要重新邀請。' });
    inv.code = generateInviteCode(db.data);
    inv.expiresAt = inviteExpiry();
    db.persist();
    auditLog(req, 'regenerate_member_invite', { groupId: group.id, inviteId: inv.id });
    res.json({ memberInvite: inviteForCoach(inv, appBaseUrl()) });
  });

  // 撤銷：連結立即失效，名單不再顯示（資料保留供稽核）。已加入者撤銷不會把人移出班級。
  router.delete('/groups/:id/member-invites/:inviteId', (req, res) => {
    const group = manageInvite(req, res);
    if (!group) return;
    const inv = (db.data.memberInvites ?? []).find((i) => i.id === req.params.inviteId && i.groupId === group.id);
    if (inv && inv.status === 'invited') {
      inv.status = 'revoked';
      inv.revokedAt = new Date().toISOString();
      db.persist();
      auditLog(req, 'revoke_member_invite', { groupId: group.id, inviteId: inv.id });
    }
    res.json({ ok: true });
  });

  // 寄送邀請信（沒給 inviteIds 就寄這個班所有「有效、尚未加入」的邀請）。SMTP 沒設定時回 503，
  // 前端據此停用按鈕；其餘邀請功能（複製連結、匯出）完全不受影響。
  router.post('/groups/:id/member-invites/send', asyncHandler(async (req, res) => {
    const group = manageInvite(req, res);
    if (!group) return;
    if (!isMailConfigured()) {
      return res.status(503).json({ code: 'CONFIG_ERROR', error: '尚未設定寄信服務（SMTP），請先用「複製連結」或「匯出連結清單」自行寄出。' });
    }
    const ids = Array.isArray(req.body?.inviteIds) ? new Set(req.body.inviteIds) : null;
    const targets = (db.data.memberInvites ?? []).filter((i) => i.groupId === group.id
      && inviteState(i) === 'invited' && (!ids || ids.has(i.id)));
    let sent = 0;
    const failed = [];
    for (const inv of targets) {
      const result = await sendMail({ to: inv.email, ...buildInviteMail({ group, invite: inv }) });
      if (result.ok) {
        sent += 1;
        inv.lastSentAt = new Date().toISOString();
        inv.sendCount = (inv.sendCount ?? 0) + 1;
      } else failed.push(inv.email);
    }
    if (sent > 0) db.persist();
    auditLog(req, 'send_member_invites', { groupId: group.id, sent, failed: failed.length });
    res.json({ sent, failed, memberInvites: listMemberInvites(group.id) });
  }));

  router.delete('/groups/:id', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const removedGroup = groups[idx];
    groups.splice(idx, 1);
    db.data.memberInvites = (db.data.memberInvites ?? []).filter((i) => i.groupId !== removedGroup.id);
    db.persist();
    auditLog(req, 'delete_group', { groupId: removedGroup.id, groupName: removedGroup.name, members: (removedGroup.memberIds ?? []).length });
    res.json({ ok: true });
  });

  return router;
}
