import { Router } from 'express';
import { getGroupPhase } from '../lib/helpers.js';
import { joinGroupByCode, findGroupByJoinCode, joinRestriction } from '../lib/joinCode.js';

// ── 用戶：查看自己所在的班別 ──────────────────────────────
/** @param {{db, requireAuth}} deps */
export function createGroupsRouter({ db, requireAuth }) {
  const router = Router();

  // 已登入的使用者掃到（另一個）班級的報到 QR：不需要重新註冊/登入，直接加入即可。
  // 新使用者的「註冊/登入時帶代碼」走的是 /auth/register、/auth/login，這支只服務
  // 已經有 session 的情況。
  router.post('/groups/join', requireAuth, (req, res) => {
    const { joinCode } = req.body ?? {};
    const target = findGroupByJoinCode(db, joinCode);
    const blocked = target ? joinRestriction(target, { email: req.user.email, userId: req.user.id }) : null;
    if (blocked) return res.status(blocked.status).json({ code: blocked.code, error: blocked.error });
    const group = joinGroupByCode(db, req.user, joinCode);
    if (!group) return res.status(404).json({ code: 'INVALID_CODE', error: '報到連結無效或已失效，請向講師確認' });
    res.json({
      joinedGroup: { id: group.id, name: group.name, companyName: group.companyName || '', assessmentId: group.assessmentId },
    });
  });

  router.get('/groups/mine', requireAuth, (req, res) => {
    // 學員只拿到「自己需要的班級資訊」。班級物件裡還有教練才該看的東西：待加入名單
    // （尚未註冊者的姓名與 Email）、報到代碼、催交信時間——以前整包 {...g} 回傳，同班的任何
    // 學員都讀得到其他人登記的 Email。
    const myGroups = (db.data.groups ?? [])
      .filter((g) => g.memberIds.includes(req.user.id))
      .map(({ pendingMembers, joinCode, joinCodeCreatedAt, lastReminderSentAt, ...g }) => ({ ...g, phase: getGroupPhase(g) }));
    res.json({ groups: myGroups });
  });

  router.get('/groups/mine/members', requireAuth, (req, res) => {
    const myGroups = (db.data.groups ?? []).filter((g) => g.memberIds.includes(req.user.id));
    const memberIds = [...new Set(myGroups.flatMap((g) => g.memberIds))].filter((id) => id !== req.user.id);
    const members = memberIds
      .map((id) => {
        const u = db.data.users.find((x) => x.id === id);
        return u ? { id: u.id, name: u.name } : null;
      })
      .filter(Boolean);
    res.json({ members });
  });

  return router;
}
