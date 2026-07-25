import { Router } from 'express';
import { getGroupPhase } from '../lib/helpers.js';

// ── 用戶：查看自己所在的班別 ──────────────────────────────
/** @param {{db, requireAuth}} deps */
export function createGroupsRouter({ db, requireAuth }) {
  const router = Router();

  router.get('/groups/mine', requireAuth, (req, res) => {
    const myGroups = (db.data.groups ?? [])
      .filter((g) => g.memberIds.includes(req.user.id))
      .map((g) => ({ ...g, phase: getGroupPhase(g) }));
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
