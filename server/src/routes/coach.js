import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { publicUser } from '../auth.js';
import {
  normalizeSubmission,
  getGroupPhase,
  auditLog,
  sanitizeFocusDimensionIds,
  sanitizeTargetHeadcount,
  sanitizeDimensionNotes,
} from '../lib/helpers.js';

/** @param {{db, requireAuth, requireCoach}} deps */
export function createCoachRouter({ db, requireAuth, requireCoach }) {
  const router = Router();
  router.use(requireAuth, requireCoach);

  router.get('/overview', (_req, res) => {
    res.json({
      users: db.data.users.filter((u) => u.role !== 'admin').map(publicUser),
      submissions: db.data.submissions.map((s) => ({
        ...normalizeSubmission(s),
        answers: undefined,
      })),
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
    const memberSubs = db.data.submissions
      .filter((s) => group.memberIds.includes(s.userId) && (s.assessmentId ?? 'ai-competency') === group.assessmentId)
      .map((s) => ({ ...normalizeSubmission(s), answers: undefined }));
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
