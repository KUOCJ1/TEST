import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { auditLog } from '../lib/helpers.js';
import { isMailConfigured, sendMail, appBaseUrl, formatTaipeiDate } from '../lib/mailer.js';
import {
  SESSION_TYPES, defaultDueAt, reflectionOf, sessionForLearner, publicReflection,
} from '../lib/coaching.js';

// 教練會談與會後反思（Sprint 40）。說明見 lib/coaching.js。
const MAX = { title: 80, focus: 500, answer: 1000, note: 300, reply: 1000 };
const clean = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());

export function createCoachingRouter({ db, requireAuth, requireCoach }) {
  const router = Router();
  const sessions = () => (db.data.coachingSessions ??= []);
  const reflections = () => (db.data.sessionReflections ??= []);
  const groupOf = (id) => (db.data.groups ?? []).find((g) => g.id === id);
  const canCoach = (user, group) => group && (user.role === 'admin' || group.coachId === user.id);
  const userName = (id) => db.data.users.find((u) => u.id === id)?.name ?? '（已刪除的帳號）';

  const forCoach = (s) => ({
    id: s.id, groupId: s.groupId, type: s.type, typeLabel: SESSION_TYPES[s.type], title: s.title, focus: s.focus ?? '',
    sessionDate: s.sessionDate, dueAt: s.dueAt, createdAt: s.createdAt,
    participants: (s.participantIds ?? [])
      .filter((uid) => !db.data.users.find((u) => u.id === uid)?.deletionScheduledFor)
      .map((uid) => {
        const r = reflectionOf(db, s.id, uid);
        return { userId: uid, name: userName(uid), status: r ? 'submitted' : Date.now() > new Date(s.dueAt).getTime() ? 'overdue' : 'pending', reflection: r ? publicReflection(r) : null };
      }),
  });

  async function notifyAssigned(s) {
    if (!isMailConfigured()) return;
    const coach = db.data.users.find((u) => u.id === s.coachId);
    for (const uid of s.participantIds) {
      const u = db.data.users.find((x) => x.id === uid);
      if (!u?.email || u.disabled || u.preferences?.notifyAssessment === false) continue;
      await sendMail({
        to: u.email,
        subject: `請在 ${formatTaipeiDate(s.dueAt)} 前填寫會後反思：${s.title}`,
        text: [
          `${u.name || '您'} 您好：`,
          '',
          `${coach?.name ?? '教練'} 為「${s.title}」（${SESSION_TYPES[s.type]}，${formatTaipeiDate(s.sessionDate)}）建立了會後反思。`,
          '四個問題，大約 5 分鐘：這次的收穫、你要做的一個行動、需要的支持、對這次會談的回饋。',
          '內容只有這場會談的教練看得到。',
          '',
          `前往填寫：${appBaseUrl()}/learning`,
          '',
          '（不想收到這類信？到平台「個人設定 → 通知偏好」關閉「評測提醒」。）',
        ].join('\n'),
      }).catch(() => {});
    }
  }

  // ── 教練端 ─────────────────────────────────────────────
  router.get('/coach/groups/:id/sessions', requireAuth, requireCoach, (req, res) => {
    const group = groupOf(req.params.id);
    if (!canCoach(req.user, group)) return res.status(403).json({ error: '無權限' });
    const list = sessions().filter((s) => s.groupId === group.id).sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));
    res.json({ sessions: list.map(forCoach) });
  });

  router.post('/coach/groups/:id/sessions', requireAuth, requireCoach, (req, res) => {
    const group = groupOf(req.params.id);
    if (!canCoach(req.user, group)) return res.status(403).json({ error: '無權限' });
    const { type, sessionDate, dueAt } = req.body ?? {};
    const title = clean(req.body?.title, MAX.title);
    const ids = [...new Set(Array.isArray(req.body?.participantIds) ? req.body.participantIds : [])];
    if (!SESSION_TYPES[type]) return res.status(400).json({ error: '請選擇會談類型（一對一或團隊）' });
    if (!title) return res.status(400).json({ error: '請填寫會談主題' });
    if (!isDate(sessionDate)) return res.status(400).json({ error: '請填寫會談日期' });
    if (dueAt !== undefined && dueAt !== null && !isDate(dueAt)) return res.status(400).json({ error: '繳交期限格式不正確' });
    if (ids.length === 0) return res.status(400).json({ error: '請選擇參與的學員' });
    if (type === 'one-on-one' && ids.length !== 1) return res.status(400).json({ error: '一對一會談只能選一位學員' });
    if (ids.some((id) => !(group.memberIds ?? []).includes(id))) return res.status(400).json({ error: '參與者必須是這個班的成員' });
    const s = {
      id: randomUUID(), groupId: group.id, coachId: group.coachId ?? req.user.id, createdBy: req.user.id,
      type, title, focus: clean(req.body?.focus, MAX.focus),
      sessionDate: new Date(sessionDate).toISOString(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : defaultDueAt(sessionDate),
      participantIds: ids, remindedIds: [], createdAt: new Date().toISOString(),
    };
    sessions().push(s);
    db.persist();
    auditLog(req, 'create_coaching_session', { sessionId: s.id, groupId: group.id, type, participants: ids.length });
    notifyAssigned(s);
    res.status(201).json({ session: forCoach(s) });
  });

  const ownSession = (req, res) => {
    const s = sessions().find((x) => x.id === req.params.sid);
    if (!s || !canCoach(req.user, groupOf(s.groupId))) { res.status(404).json({ error: '找不到這場會談' }); return null; }
    return s;
  };

  router.patch('/coach/sessions/:sid', requireAuth, requireCoach, (req, res) => {
    const s = ownSession(req, res);
    if (!s) return;
    const { title, focus, dueAt } = req.body ?? {};
    if (title !== undefined) { const t = clean(title, MAX.title); if (!t) return res.status(400).json({ error: '會談主題不能是空的' }); s.title = t; }
    if (focus !== undefined) s.focus = clean(focus, MAX.focus);
    if (dueAt !== undefined) { if (!isDate(dueAt)) return res.status(400).json({ error: '繳交期限格式不正確' }); s.dueAt = new Date(dueAt).toISOString(); }
    db.persist();
    res.json({ session: forCoach(s) });
  });

  router.delete('/coach/sessions/:sid', requireAuth, requireCoach, (req, res) => {
    const s = ownSession(req, res);
    if (!s) return;
    if (reflections().some((r) => r.sessionId === s.id)) {
      return res.status(409).json({ code: 'HAS_REFLECTIONS', error: '已經有學員繳交反思，不能刪除這場會談。' });
    }
    db.data.coachingSessions = sessions().filter((x) => x.id !== s.id);
    db.persist();
    auditLog(req, 'delete_coaching_session', { sessionId: s.id });
    res.json({ ok: true });
  });

  router.post('/coach/sessions/:sid/reflections/:uid/reply', requireAuth, requireCoach, (req, res) => {
    const s = ownSession(req, res);
    if (!s) return;
    const r = reflectionOf(db, s.id, req.params.uid);
    if (!r) return res.status(404).json({ error: '這位學員還沒繳交反思' });
    const text = clean(req.body?.text, MAX.reply);
    r.coachReply = text ? { text, by: req.user.name, at: new Date().toISOString() } : null;
    db.persist();
    res.json({ session: forCoach(s) });
  });

  // ── 學員端 ─────────────────────────────────────────────
  router.get('/reflections', requireAuth, (req, res) => {
    const mine = sessions().filter((s) => (s.participantIds ?? []).includes(req.user.id))
      .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate))
      .map((s) => sessionForLearner(db, s, req.user.id));
    res.json({ sessions: mine });
  });

  router.put('/reflections/:sid', requireAuth, (req, res) => {
    const s = sessions().find((x) => x.id === req.params.sid && (x.participantIds ?? []).includes(req.user.id));
    if (!s) return res.status(404).json({ error: '找不到這場會談' });
    const body = req.body ?? {};
    const insight = clean(body.insight, MAX.answer);
    const action = clean(body.action, MAX.answer);
    const support = clean(body.support, MAX.answer);
    const rating = Number(body.rating);
    if (!insight || !action) return res.status(400).json({ error: '請至少填寫「收穫」與「行動」' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: '請為這次會談打 1–5 分' });
    const now = new Date().toISOString();
    let r = reflectionOf(db, s.id, req.user.id);
    if (!r) {
      r = { id: randomUUID(), sessionId: s.id, userId: req.user.id, submittedAt: now, late: Date.now() > new Date(s.dueAt).getTime() };
      reflections().push(r);
    } else {
      r.updatedAt = now;
    }
    Object.assign(r, { insight, action, support, rating, ratingNote: clean(body.ratingNote, MAX.note) });
    // 把行動變成發展目標（只建立一次；目標預設只有本人看得到）。
    if (body.makeGoal === true && !r.goalId) {
      const group = groupOf(s.groupId);
      const goal = {
        id: randomUUID(), userId: req.user.id, assessmentId: group?.assessmentId ?? null, dimensionId: null, dimensionName: null,
        text: `${s.title}：會後行動`.slice(0, 500), actions: [{ id: randomUUID(), text: action.slice(0, 200), done: false, doneAt: null }],
        createdAt: now, updatedAt: now, achievedAt: null, reviewDate: new Date(Date.now() + 28 * 864e5).toISOString(),
        sharedWithCoach: false, checkins: [], source: { type: 'coaching-session', sessionId: s.id },
      };
      (db.data.goals ??= []).push(goal);
      r.goalId = goal.id;
    }
    db.persist();
    res.json({ session: sessionForLearner(db, s, req.user.id) });
  });

  return router;
}
