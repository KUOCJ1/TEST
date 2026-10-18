import { Router } from 'express';
import { getGroupPhase, auditLog } from '../lib/helpers.js';
import { isStrictPrivacy } from '../lib/compassPrivacy.js';
import {
  RATER_INVITE_TYPES, MAX_INVITES_PER_RATEE, isActiveInvite, findSharedGroup, newRaterInvite,
} from '../lib/invites.js';
import { POLICY_VERSION } from '../lib/policy.js';

/**
 * 他評邀請與班級邀請（見 lib/invites.js 的說明）。
 * @param {{db, requireAuth}} deps
 */
export function createInvitesRouter({ db, requireAuth }) {
  const router = Router();
  const userName = (id) => db.data.users.find((u) => u.id === id)?.name ?? '（已移除）';
  const isCoachOf = (user, group) => user.role === 'admin' || group?.coachId === user.id;

  // ── 他評邀請 ──────────────────────────────────────────────
  // 受評者本人（邀請同班的人評自己）或該班教練／管理員（替班上的人安排）都可以發。
  router.post('/rater-invites', requireAuth, (req, res) => {
    const { assessmentId, raterUserId, raterType, groupId } = req.body ?? {};
    const rateeId = typeof req.body?.rateeId === 'string' && req.body.rateeId ? req.body.rateeId : req.user.id;
    if (typeof assessmentId !== 'string' || !isStrictPrivacy(assessmentId)) {
      return res.status(400).json({ code: 'INVITE_NOT_REQUIRED', error: '這份評量不需要邀請' });
    }
    const assessment = (db.data.assessments ?? []).find((a) => a.id === assessmentId);
    if (!assessment?.enabled) return res.status(403).json({ code: 'ASSESSMENT_DISABLED', error: '這份評量尚未開放' });
    if (!RATER_INVITE_TYPES.has(raterType)) return res.status(400).json({ code: 'INVALID_RATER_TYPE', error: '請選擇評分者的身分（主管／同儕／部屬）' });
    if (typeof raterUserId !== 'string' || raterUserId === rateeId) {
      return res.status(400).json({ code: 'INVALID_RATER', error: '請選擇另一位成員擔任評分者' });
    }
    const rater = db.data.users.find((u) => u.id === raterUserId);
    const ratee = db.data.users.find((u) => u.id === rateeId);
    if (!rater || rater.disabled || rater.role === 'admin' || !ratee) {
      return res.status(400).json({ code: 'INVALID_RATER', error: '找不到這位成員' });
    }
    const group = findSharedGroup(db, { assessmentId, rateeId, raterUserId, groupId });
    if (!group) {
      return res.status(403).json({ code: 'NOT_SAME_GROUP', error: '評分者與受評者必須在同一個班級（且該班使用這份評量）' });
    }
    // 權限：受評者本人（且是該班成員），或該班教練／管理員。
    const allowed = req.user.id === rateeId || isCoachOf(req.user, group);
    if (!allowed) return res.status(403).json({ code: 'FORBIDDEN', error: '只有受評者本人或班級教練可以發出邀請' });
    if (['closed', 'published'].includes(getGroupPhase(group))) {
      return res.status(409).json({ code: 'PHASE_LOCKED', error: '這個班級已結束作答，無法再邀請' });
    }
    const invites = (db.data.raterInvites ??= []);
    const mineActive = invites.filter((i) => i.rateeId === rateeId && i.groupId === group.id && isActiveInvite(i));
    if (mineActive.some((i) => i.raterUserId === raterUserId)) {
      return res.status(409).json({ code: 'ALREADY_INVITED', error: '已經邀請過這位成員了' });
    }
    if (mineActive.length >= MAX_INVITES_PER_RATEE) {
      return res.status(409).json({ code: 'TOO_MANY_INVITES', error: `每位受評者最多邀請 ${MAX_INVITES_PER_RATEE} 位評分者` });
    }
    const invite = newRaterInvite({
      assessmentId, groupId: group.id, rateeId, raterUserId, raterType, createdBy: req.user.id,
    });
    invites.push(invite);
    db.persist();
    auditLog(req, 'create_rater_invite', { inviteId: invite.id, rateeId, groupId: group.id, raterType });
    res.status(201).json({ invite: { id: invite.id, raterUserId, raterName: rater.name, raterType, rateeId, groupId: group.id } });
  });

  // 我的邀請：我被邀請去評別人的（toRate，只有我自己的完成狀態），以及我邀請了誰（invited，
  // 只有姓名與身分——不含是否已完成，否則受評者就能看出「誰評了、誰還沒評」，匿名就破功了）。
  router.get('/rater-invites/mine', requireAuth, (req, res) => {
    const all = (db.data.raterInvites ?? []).filter(isActiveInvite);
    const toRate = all
      .filter((i) => i.raterUserId === req.user.id)
      .map((i) => ({
        id: i.id, assessmentId: i.assessmentId, groupId: i.groupId, rateeId: i.rateeId,
        rateeName: userName(i.rateeId), raterType: i.raterType, usedPhases: i.usedPhases ?? [],
      }));
    const invited = all
      .filter((i) => i.rateeId === req.user.id)
      .map((i) => ({ id: i.id, assessmentId: i.assessmentId, groupId: i.groupId, raterUserId: i.raterUserId, raterName: userName(i.raterUserId), raterType: i.raterType }));
    res.json({ toRate, invited });
  });

  // 教練／管理員看某個班的邀請安排（同樣不含完成狀態）。
  router.get('/rater-invites/group/:groupId', requireAuth, (req, res) => {
    const group = (db.data.groups ?? []).find((g) => g.id === req.params.groupId);
    if (!group) return res.status(404).json({ error: '班別不存在' });
    if (!isCoachOf(req.user, group)) return res.status(403).json({ error: '無權限' });
    const invites = (db.data.raterInvites ?? [])
      .filter((i) => i.groupId === group.id && isActiveInvite(i))
      .map((i) => ({
        id: i.id, rateeId: i.rateeId, rateeName: userName(i.rateeId),
        raterUserId: i.raterUserId, raterName: userName(i.raterUserId), raterType: i.raterType,
      }));
    res.json({ invites });
  });

  // 撤回邀請：受評者本人或班級教練。已經被使用過的邀請不會被撤銷（也不告知，避免洩漏誰已完成）。
  router.delete('/rater-invites/:id', requireAuth, (req, res) => {
    const invite = (db.data.raterInvites ?? []).find((i) => i.id === req.params.id);
    if (!invite) return res.status(404).json({ error: '邀請不存在' });
    const group = (db.data.groups ?? []).find((g) => g.id === invite.groupId);
    if (req.user.id !== invite.rateeId && !isCoachOf(req.user, group)) return res.status(403).json({ error: '無權限' });
    if ((invite.usedPhases ?? []).length === 0) {
      invite.status = 'revoked';
      invite.revokedAt = new Date().toISOString();
      db.persist();
      auditLog(req, 'revoke_rater_invite', { inviteId: invite.id, rateeId: invite.rateeId, groupId: invite.groupId });
    }
    res.json({ ok: true });
  });

  // ── 班級邀請（教練邀請已有帳號的人加入班級，本人接受才生效）────────────
  router.get('/groups/invites', requireAuth, (req, res) => {
    const invites = (db.data.groupInvites ?? [])
      .filter((i) => i.userId === req.user.id && i.status === 'pending')
      .map((i) => {
        const g = (db.data.groups ?? []).find((x) => x.id === i.groupId);
        return g ? {
          id: i.id, groupId: g.id, groupName: g.name, companyName: g.companyName || '',
          assessmentId: g.assessmentId, coachName: g.coachName || '', createdAt: i.createdAt,
        } : null;
      })
      .filter(Boolean);
    res.json({ invites });
  });

  function ownPending(req, res) {
    const inv = (db.data.groupInvites ?? []).find((i) => i.id === req.params.id);
    if (!inv || inv.userId !== req.user.id || inv.status !== 'pending') {
      res.status(404).json({ code: 'INVITE_NOT_FOUND', error: '邀請不存在或已處理' });
      return null;
    }
    return inv;
  }

  router.post('/groups/invites/:id/accept', requireAuth, (req, res) => {
    const inv = ownPending(req, res);
    if (!inv) return;
    const group = (db.data.groups ?? []).find((g) => g.id === inv.groupId);
    if (!group) {
      inv.status = 'void';
      db.persist();
      return res.status(404).json({ code: 'GROUP_GONE', error: '這個班級已不存在' });
    }
    // 加入的班級若使用需要新版政策同意的評量，本人須先同意現行政策（前端登入流程已會要求）。
    if (isStrictPrivacy(group.assessmentId) && req.user.consent?.version !== POLICY_VERSION) {
      return res.status(403).json({ code: 'CONSENT_REQUIRED', error: '請先同意最新的隱私權政策' });
    }
    if (!group.memberIds.includes(req.user.id)) group.memberIds.push(req.user.id);
    group.updatedAt = new Date().toISOString();
    inv.status = 'accepted';
    inv.respondedAt = group.updatedAt;
    db.persist();
    auditLog(req, 'accept_group_invite', { groupId: group.id, groupName: group.name });
    res.json({ joinedGroup: { id: group.id, name: group.name, companyName: group.companyName || '', assessmentId: group.assessmentId } });
  });

  router.post('/groups/invites/:id/decline', requireAuth, (req, res) => {
    const inv = ownPending(req, res);
    if (!inv) return;
    inv.status = 'declined';
    inv.respondedAt = new Date().toISOString();
    db.persist();
    res.json({ ok: true });
  });

  return router;
}
