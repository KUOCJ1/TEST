// 學員自助刪除帳號（Sprint 39）。
//
// 流程：申請 → 立刻停止出現在班級報告與統計、不再寄任何信 → 7 天內登入可取消 → 到期永久刪除。
// 作法是「暫存移出」：申請當下把本人的資料從各集合搬到 user.deletionHold（班級報告、教練／管理端的
// 統計都是從集合讀的，搬走就自然不再出現，不必每個端點各自過濾）；取消時原封搬回；到期時丟掉。
//
// 例外：本人「幫別人做的 360° 他評」屬於對方的報告，搬走會讓對方的報告少一位評分者（甚至因此低於
// 匿名門檻而整份他評消失）。所以它留在原處，到期時「去識別化」——拿掉與帳號的連結、姓名與逐題作答，
// 只留評分者類別與結果分數（產品負責人 2026-11-17 決定）。
import { randomUUID } from 'node:crypto';

export const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const SELF_SERVICE_ROLES = new Set(['user']);

const isSelf = (s) => (s.raterType ?? 'self') === 'self';
const rateeOf = (s) => s.rateeId ?? s.userId;

/** 申請刪除：搬移本人資料到 hold、退出班級。回傳排定刪除時間。 */
export function requestDeletion(db, user, now = Date.now()) {
  const id = user.id;
  const take = (key, pred) => {
    const list = db.data[key] ?? [];
    const out = list.filter(pred);
    db.data[key] = list.filter((x) => !pred(x));
    return out;
  };
  const groupIds = (db.data.groups ?? []).filter((g) => (g.memberIds ?? []).includes(id)).map((g) => g.id);
  for (const g of db.data.groups ?? []) {
    if ((g.memberIds ?? []).includes(id)) g.memberIds = g.memberIds.filter((m) => m !== id);
  }
  user.deletionHold = {
    groupIds,
    // 本人的自評（含課後問卷）、別人對本人的評分：都是「本人的報告」
    submissions: take('submissions', (s) => (s.userId === id && isSelf(s)) || (rateeOf(s) === id && !isSelf(s))),
    goals: take('goals', (g) => g.userId === id),
    readingList: take('readingList', (r) => r.userId === id),
    courseFollowUps: take('courseFollowUps', (r) => r.userId === id),
    sessionReflections: take('sessionReflections', (r) => r.userId === id),
  };
  user.deletionRequestedAt = new Date(now).toISOString();
  user.deletionScheduledFor = new Date(now + DELETION_GRACE_MS).toISOString();
  db.persist();
  return user.deletionScheduledFor;
}

/** 取消：原封搬回、回到原本的班級（班級已被刪除的略過）。 */
export function cancelDeletion(db, user) {
  const h = user.deletionHold ?? {};
  for (const key of ['submissions', 'goals', 'readingList', 'courseFollowUps', 'sessionReflections']) {
    if (h[key]?.length) (db.data[key] ??= []).push(...h[key]);
  }
  for (const g of db.data.groups ?? []) {
    if ((h.groupIds ?? []).includes(g.id) && !(g.memberIds ?? []).includes(user.id)) g.memberIds = [...(g.memberIds ?? []), user.id];
  }
  delete user.deletionHold;
  delete user.deletionRequestedAt;
  delete user.deletionScheduledFor;
  db.persist();
}

/** 永久刪除一位使用者（已到期）。 */
export function purgeUser(db, user) {
  const id = user.id;
  // 幫別人做的他評：去識別化保留
  for (const s of db.data.submissions ?? []) {
    if (s.userId === id && !isSelf(s)) {
      s.userId = `deleted-${randomUUID()}`;
      delete s.userName;
      delete s.userEmail;
      delete s.answers;
      s.deidentifiedAt = new Date().toISOString();
    }
  }
  // 邀請、班級排除名單裡的參照
  db.data.raterInvites = (db.data.raterInvites ?? []).filter((i) => i.rateeId !== id && i.raterUserId !== id);
  db.data.groupInvites = (db.data.groupInvites ?? []).filter((i) => i.userId !== id);
  db.data.memberInvites = (db.data.memberInvites ?? []).filter((i) => i.joinedUserId !== id && String(i.email ?? '').toLowerCase() !== String(user.email ?? '').toLowerCase());
  for (const g of db.data.groups ?? []) {
    if ((g.memberIds ?? []).includes(id)) g.memberIds = g.memberIds.filter((m) => m !== id);
    if ((g.excludedUserIds ?? []).includes(id)) g.excludedUserIds = g.excludedUserIds.filter((m) => m !== id);
  }
  db.data.learningResourceClicks = (db.data.learningResourceClicks ?? []).filter((c) => c.userId !== id);
  for (const s of db.data.coachingSessions ?? []) {
    if ((s.participantIds ?? []).includes(id)) s.participantIds = s.participantIds.filter((m) => m !== id);
    if ((s.remindedIds ?? []).includes(id)) s.remindedIds = s.remindedIds.filter((m) => m !== id);
  }
  db.data.sessionReflections = (db.data.sessionReflections ?? []).filter((r) => r.userId !== id);
  // 稽核紀錄保留「做了什麼、什麼時候」，不再保留 Email
  for (const e of db.data.auditLog ?? []) {
    if (e.actor === id && e.actorEmail) e.actorEmail = null;
  }
  db.data.users = db.data.users.filter((u) => u.id !== id);
  (db.data.auditLog ??= []).push({ id: randomUUID(), ts: new Date().toISOString(), actor: null, actorEmail: null, action: 'account_purged', targetUserId: id });
}

/** 排程：刪除所有已到期的帳號。回傳刪除人數。 */
export function purgeDueDeletions(db, now = Date.now()) {
  const due = (db.data.users ?? []).filter((u) => u.deletionScheduledFor && new Date(u.deletionScheduledFor).getTime() <= now);
  for (const u of due) purgeUser(db, u);
  if (due.length) db.persist();
  return due.length;
}

/** 下載我的資料：本人可以拿走的全部內容（JSON）。別人對本人的個別評分不含在內（屬於評分者的匿名資料）。 */
export function exportUserData(db, user) {
  const id = user.id;
  const hold = user.deletionHold ?? {};
  const all = (key) => [...(db.data[key] ?? []), ...(hold[key] ?? [])];
  const groupName = (gid) => (db.data.groups ?? []).find((g) => g.id === gid)?.name ?? null;
  const subs = all('submissions');
  return {
    exportedAt: new Date().toISOString(),
    notice: '這是你在榕光評測的個人資料副本。別人對你的 360° 評分依匿名規則只出現在報告的彙總裡，這裡不含個別評分。',
    account: {
      id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt,
      consent: user.consent ?? null, preferences: user.preferences ?? {},
      activeDays: user.activeDays ?? [],
      deletionScheduledFor: user.deletionScheduledFor ?? null,
    },
    groups: [...new Set([...(db.data.groups ?? []).filter((g) => (g.memberIds ?? []).includes(id)).map((g) => g.id), ...(hold.groupIds ?? [])])]
      .map((gid) => ({ id: gid, name: groupName(gid) })),
    selfAssessments: subs.filter((s) => s.userId === id && isSelf(s)).map((s) => ({
      id: s.id, assessmentId: s.assessmentId ?? 'ai-competency', createdAt: s.createdAt, phase: s.phase ?? null,
      group: groupName(s.groupId ?? s.surveyGroupId), answers: s.answers ?? null, result: s.result ?? null,
      coachComments: (s.comments ?? []).map((c) => ({ coachName: c.coachName ?? null, text: c.text, tips: c.tips ?? [], createdAt: c.createdAt, updatedAt: c.updatedAt ?? null })),
    })),
    ratingsGivenToOthers: subs.filter((s) => s.userId === id && !isSelf(s)).map((s) => ({
      assessmentId: s.assessmentId ?? 'ai-competency', raterType: s.raterType, createdAt: s.createdAt, answers: s.answers ?? null,
    })),
    goals: all('goals').filter((g) => g.userId === id).map(({ userId, ...g }) => g),
    practice: user.practice ?? null,
    readingList: all('readingList').filter((r) => r.userId === id).map(({ userId, ...r }) => r),
    courseFollowUps: all('courseFollowUps').filter((r) => r.userId === id).map(({ userId, ...r }) => r),
    coachingReflections: all('sessionReflections').filter((r) => r.userId === id).map(({ userId, ...r }) => {
      const s = (db.data.coachingSessions ?? []).find((x) => x.id === r.sessionId);
      return { ...r, session: s ? { title: s.title, type: s.type, sessionDate: s.sessionDate } : null };
    }),
  };
}
