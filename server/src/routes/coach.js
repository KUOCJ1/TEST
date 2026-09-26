import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { publicUser } from '../auth.js';
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
import { isMailConfigured, sendMail } from '../lib/mailer.js';

// 同一班寄一次催交信後的冷卻時間：避免誤觸連按、把學員信箱洗版。
export const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

function appBaseUrl() {
  return (process.env.APP_URL || 'https://assess.rong-rise.com').replace(/\/+$/, '');
}

function formatTaipeiDate(iso) {
  return new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
}

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
      submissions: db.data.submissions
        .map(normalizeSubmission)
        .filter((s) => canSee(s.rateeId) || canSee(s.userId))
        .map((s) => ({ ...s, answers: undefined })),
    });
  });

  // 建立／編輯班別時的「可加入成員」名冊。只有姓名與 Email，不含任何成績，
  // 因此不受上面的成績可見範圍限制——否則教練無從把新成員加進自己的班別。
  router.get('/directory', (_req, res) => {
    res.json({
      users: db.data.users
        .filter((u) => u.role !== 'admin')
        .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    });
  });

  // ── 班別 CRUD ─────────────────────────────────────────────
  router.get('/groups', (req, res) => {
    const groups = (db.data.groups ?? [])
      .filter((g) => g.coachId === req.user.id || req.user.role === 'admin')
      .map((g) => ({ ...g, phase: getGroupPhase(g) }));
    res.json({ groups });
  });

  router.post('/groups', (req, res) => {
    const { name, companyName, assessmentId, memberIds, focusDimensionIds, targetHeadcount, dimensionNotes } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: '請輸入班別名稱' });
    const group = {
      id: randomUUID(),
      name: name.trim(),
      companyName: companyName?.trim() ?? '',
      assessmentId: typeof assessmentId === 'string' ? assessmentId : 'ai-competency',
      coachId: req.user.id,
      coachName: req.user.name,
      memberIds: Array.isArray(memberIds) ? memberIds : [],
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
    db.persist();
    res.status(201).json({ group });
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
    res.json({ group: { ...group, phase: getGroupPhase(group) }, submissions: memberSubs });
  });

  router.put('/groups/:id', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    const { name, companyName, assessmentId, memberIds, groupComment, groupTips, focusDimensionIds, targetHeadcount, dimensionNotes, startDate, endDate } = req.body ?? {};
    const isISODate = (v) => v === null || (typeof v === 'string' && !isNaN(Date.parse(v)));
    groups[idx] = {
      ...groups[idx],
      ...(name !== undefined && { name: name.trim() }),
      ...(companyName !== undefined && { companyName: companyName.trim() }),
      ...(assessmentId !== undefined && { assessmentId }),
      ...(memberIds !== undefined && { memberIds: Array.isArray(memberIds) ? memberIds : [] }),
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
    res.json({ group: { ...groups[idx], phase: getGroupPhase(groups[idx]) } });
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
      .filter(Boolean);

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
    const result = { added: 0, pending: 0, invalid: [] };

    for (const raw of entries) {
      const email = (raw.email || '').trim().toLowerCase();
      const name = (raw.name || '').trim();
      if (!emailRe.test(email)) { result.invalid.push(raw.email || '(空白)'); continue; }
      const existing = db.data.users.find((u) => u.email === email && u.role !== 'admin');
      if (existing) {
        if (!group.memberIds.includes(existing.id)) { group.memberIds.push(existing.id); result.added += 1; }
      } else if (!group.pendingMembers.some((p) => p.email === email)) {
        group.pendingMembers.push({ name, email });
        result.pending += 1;
      }
    }
    group.updatedAt = new Date().toISOString();
    db.persist();
    res.json({ group, result });
  });

  router.delete('/groups/:id', (req, res) => {
    const groups = db.data.groups ?? [];
    const idx = groups.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '班別不存在' });
    if (groups[idx].coachId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    groups.splice(idx, 1);
    db.persist();
    res.json({ ok: true });
  });

  return router;
}
