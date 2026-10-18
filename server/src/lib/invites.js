// 邀請（P0 隱私修補，2026-10-18 使用者決策）：
//  - 他評邀請（raterInvites）：嚴格隱私題庫（領導力羅盤）的他評，必須有「受評者本人或該班教練」
//    發出的邀請才收件；邀請同時決定評分者類型與歸屬班級。這讓人數門檻真的在算「不同的人」，
//    也擋住任何人替任何人填他評、冒充上級。
//  - 班級邀請（groupInvites）：教練不能直接把「已有帳號的人」加進班級，必須由本人接受。
//    （管理員維持直接加入；未註冊的 Email 走既有的待加入名單，本人註冊時就是同意。）
import { randomUUID } from 'node:crypto';

export const RATER_INVITE_TYPES = new Set(['peer', 'subordinate', 'manager']);
export const MAX_INVITES_PER_RATEE = 30;

export const isActiveInvite = (inv) => inv.status !== 'revoked';

/** 找出同時包含受評者與評分者、且評量相同的班級。 */
export function findSharedGroup(db, { assessmentId, rateeId, raterUserId, groupId }) {
  return (db.data.groups ?? []).find((g) =>
    (g.assessmentId ?? 'ai-competency') === assessmentId
    && (!groupId || g.id === groupId)
    && g.memberIds.includes(rateeId)
    && g.memberIds.includes(raterUserId));
}

export function newRaterInvite({ assessmentId, groupId, rateeId, raterUserId, raterType, createdBy }) {
  return {
    id: randomUUID(),
    assessmentId,
    groupId,
    rateeId,
    raterUserId,
    raterType,
    createdBy,
    createdAt: new Date().toISOString(),
    status: 'pending',
    usedPhases: [],
  };
}

export function newGroupInvite({ groupId, userId, invitedBy }) {
  return { id: randomUUID(), groupId, userId, invitedBy, createdAt: new Date().toISOString(), status: 'pending' };
}

/**
 * 教練（非管理員）提出的成員名單：已經是成員的保留；其餘已有帳號的人改成「班級邀請」。
 * 回傳 { memberIds, invitedIds }。管理員直接生效。
 */
export function splitNewMembers(db, group, wantedIds, reqUser) {
  if (reqUser.role === 'admin') return { memberIds: wantedIds, invitedIds: [] };
  const current = new Set(group.memberIds ?? []);
  const memberIds = wantedIds.filter((id) => current.has(id));
  const invitedIds = [];
  const invites = (db.data.groupInvites ??= []);
  for (const id of wantedIds) {
    if (current.has(id)) continue;
    const dup = invites.some((i) => i.groupId === group.id && i.userId === id && i.status === 'pending');
    if (!dup) invites.push(newGroupInvite({ groupId: group.id, userId: id, invitedBy: reqUser.id }));
    invitedIds.push(id);
  }
  return { memberIds, invitedIds };
}
