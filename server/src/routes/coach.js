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
import { isMailConfigured, sendMail, appBaseUrl, formatTaipeiDate } from '../lib/mailer.js';

// 同一班寄一次催交信後的冷卻時間：避免誤觸連按、把學員信箱洗版。
export const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

function buildReminderMail({ group, name, phaseLabel }) {
  const link = group.joinCode ? `${appBaseUrl()}/?join=${group.joinCode}` : `${appBaseUrl()}/`;
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

  router.post('/groups', (req, res) => {
    const { name, companyName, assessmentId, memberIds, focusDimensionIds, targetHeadcount, dimensionNotes } = req.body ?? {};
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
    const memberSubs = db.data.submissions
      .map(normalizeSubmission)
      .filter((n) => (n.groupId
        ? n.groupId === group.id
        : group.memberIds.includes(n.userId) && n.assessmentId === group.assessmentId))
      .map((n) => ({ ...n, answers: undefined }));
    // 班級成員的姓名與 Email（Sprint 11）：取代以前的全站名冊，前端只需要「這個班的人」。
    const members = (group.memberIds ?? [])
      .map((id) => db.data.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, disabled: Boolean(u.disabled) }));
    // 還在等對方接受的班級邀請（教練不能直接把已有帳號的人加進班級）。
    const invites = (db.data.groupInvites ?? [])
      .filter((i) => i.groupId === group.id && i.status === 'pending')
      .map((i) => {
        const u = db.data.users.find((x) => x.id === i.userId);
        return u ? { id: i.id, userId: u.id, name: u.name, email: u.email } : null;
      })
      .filter(Boolean);
    res.json({ group: { ...group, phase: getGroupPhase(group) }, submissions: stripRaterDetails(memberSubs), members, invites });
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
    const { name, companyName, assessmentId, memberIds, groupComment, groupTips, focusDimensionIds, targetHeadcount, dimensionNotes, startDate, endDate } = req.body ?? {};
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
      .filter((u) => u && !u.disabled);

    const notStartedPre = members.filter((m) => !preDone.has(m.id));
    const pending = group.pendingMembers ?? [];
    let phase;
    let recipients;
    if (notStartedPre.length > 0 || pending.length > 0) {
      phase = 'pre';
      recipients = [...notStartedPre, ...pending].map((m) => ({ name: m.name, email: m.email }));
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
      const result = await sendMail({ to: r.email, ...buildReminderMail({ group, name: r.name, phaseLabel }) });
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
    if (!group.pendingMembers) group.pendingMembers = [];
    const result = { added: 0, pending: 0, invited: 0, invalid: [] };

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
      } else if (!group.pendingMembers.some((p) => p.email === email)) {
        group.pendingMembers.push({ name, email });
        result.pending += 1;
      }
    }
    group.updatedAt = new Date().toISOString();
    db.persist();
    auditLog(req, 'import_roster', { groupId: group.id, groupName: group.name, added: result.added, invited: result.invited, pending: result.pending });
    res.json({ group, result });
  });

  router.delete('/groups/:id', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const removedGroup = groups[idx];
    groups.splice(idx, 1);
    db.persist();
    auditLog(req, 'delete_group', { groupId: removedGroup.id, groupName: removedGroup.name, members: (removedGroup.memberIds ?? []).length });
    res.json({ ok: true });
  });

  return router;
}
